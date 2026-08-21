'use strict';
// Mineradio 插件运行时（宿主侧）。职责边界：
// - 插件代码只在 Worker 沙箱（plugin-sandbox.js）里跑，这里是它唯一的对外通道；
// - 清单解析与校验统一走 plugin-manifest.js，运行时不自己再写一套规则；
// - 网络请求先在这里过插件自己声明的 @host 白名单，再交本地服务 /api/plugin/* 代发；
//   白名单必须留在宿主侧，因为可信清单在宿主手里，沙箱里的插件改不了它。
// 加载顺序：plugin-manifest.js → plugin-runtime.js → app.js（app.js 负责注入持久化与提示桥）。
(function(global){
  var Manifest = global.MineradioPluginManifest;
  if (!Manifest) return;

  var PLUGIN_STORE_KEY = 'mineradio-plugins-v1';
  var PLUGIN_THEME_STYLE_ID = 'mineradio-plugin-theme-style';
  // 单次钩子调用上限。音源接口慢是常态，但不能让一个卡住的插件把搜索永远吊住。
  var PLUGIN_CALL_TIMEOUT_MS = 12000;
  var PLUGIN_BOOT_TIMEOUT_MS = 8000;
  // 一个插件同时在飞的代发请求数。插件循环发请求时，这道门防止它把本地服务连接吃满。
  var PLUGIN_MAX_INFLIGHT = 6;
  var PLUGIN_SEARCH_LIMIT = 60;

  var records = [];
  var workers = Object.create(null);
  var proxyInfo = null;
  var proxyInfoPromise = null;
  var bridge = {
    persist: null,
    toast: null,
    log: null
  };

  /**
   * 统一的内部日志出口。默认静默，由 app.js 注入后才落到控制台，避免打包版刷屏。
   * @param {...unknown} args 日志内容。
   * @returns {void}
   */
  function logInternal() {
    if (typeof bridge.log !== 'function') return;
    try { bridge.log.apply(null, arguments); } catch (e) {}
  }

  /**
   * 给用户看的提示。宿主未注入提示桥时静默丢弃，不抛错打断调用链。
   * @param {string} text 提示文本。
   * @returns {void}
   */
  function toast(text) {
    if (typeof bridge.toast !== 'function') return;
    try { bridge.toast(String(text || '')); } catch (e) {}
  }
  /**
   * 从 localStorage 读回插件列表。读取路径也要重新归一化，storage 里的内容可能被外部改过。
   * @returns {object[]} 合法插件记录数组。
   */
  function readStore() {
    var raw = '';
    try { raw = global.localStorage ? (global.localStorage.getItem(PLUGIN_STORE_KEY) || '') : ''; } catch (e) { raw = ''; }
    return Manifest.normalizePluginRecords(raw);
  }

  /**
   * 落盘插件列表。localStorage 是主存储，persist 桥再把它同步到 IndexedDB / 主进程备份。
   * @returns {void}
   */
  function writeStore() {
    var payload = JSON.stringify(records);
    try { if (global.localStorage) global.localStorage.setItem(PLUGIN_STORE_KEY, payload); } catch (e) {}
    if (typeof bridge.persist === 'function') {
      try { bridge.persist(PLUGIN_STORE_KEY, payload); } catch (e) {}
    }
  }

  /**
   * 按 id 找一条插件记录。
   * @param {string} id 插件 id。
   * @returns {object|null} 记录或 null。
   */
  function recordById(id) {
    var key = String(id || '');
    for (var i = 0; i < records.length; i++) if (records[i].manifest.id === key) return records[i];
    return null;
  }

  /**
   * 取当前启用且属于指定类型的插件。
   * theme 类插件不参与音源/歌单调用，反之亦然，避免把主题包也拉去跑搜索。
   * @param {string} kind 插件类型。
   * @returns {object[]} 记录数组。
   */
  function enabledByKind(kind) {
    var out = [];
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      if (!rec.enabled) continue;
      if (kind && rec.manifest.kind !== kind) continue;
      out.push(rec);
    }
    return out;
  }
  /**
   * 取插件代理入口（端口 + token）。token 由主进程生成，只经 IPC 交给渲染进程。
   * 结果缓存住：每次请求都走一次 IPC 没意义，而端口和 token 在进程生命周期内不变。
   * @returns {Promise<{token: string, port: number}|null>} 代理入口，拿不到时为 null。
   */
  function ensureProxyInfo() {
    if (proxyInfo) return Promise.resolve(proxyInfo);
    if (proxyInfoPromise) return proxyInfoPromise;
    var desktop = global.desktopWindow;
    if (!desktop || typeof desktop.getPluginProxyInfo !== 'function') return Promise.resolve(null);
    proxyInfoPromise = Promise.resolve()
      .then(function(){ return desktop.getPluginProxyInfo(); })
      .then(function(info){
        proxyInfoPromise = null;
        if (!info || !info.ok || !info.token || !info.port) return null;
        proxyInfo = { token: String(info.token), port: Number(info.port) };
        return proxyInfo;
      })
      .catch(function(){ proxyInfoPromise = null; return null; });
    return proxyInfoPromise;
  }

  /**
   * 拼出走本地代理的媒体地址（音频流、封面图）。
   * 远程直链不能直接塞给 audio/img：音乐 CDN 不带 CORS 头，取不到 Referer 校验也会被拒。
   * @param {string} url 远程资源地址。
   * @param {object} [opts] 可选 referer / userAgent。
   * @returns {string} 本地代理地址，代理不可用时返回空串。
   */
  function buildStreamUrl(url, opts) {
    if (!proxyInfo) return '';
    var target = String(url == null ? '' : url);
    if (!target) return '';
    var query = 'token=' + encodeURIComponent(proxyInfo.token) + '&url=' + encodeURIComponent(target);
    if (opts && opts.referer) query += '&referer=' + encodeURIComponent(String(opts.referer));
    if (opts && opts.userAgent) query += '&ua=' + encodeURIComponent(String(opts.userAgent));
    return 'http://127.0.0.1:' + proxyInfo.port + '/api/plugin/stream?' + query;
  }
  /**
   * 代插件发一次请求。白名单在这里判定：清单是宿主持有的可信副本，插件运行时改不了。
   * @param {object} manifest 插件清单。
   * @param {string} url 目标地址。
   * @param {object} [options] 请求选项：method / headers / body / responseType / referer / userAgent。
   * @returns {Promise<object>} 给插件的响应对象。
   */
  function proxyRequest(manifest, url, options) {
    var opts = options && typeof options === 'object' ? options : {};
    if (!Manifest.isPluginRequestAllowed(manifest, url)) {
      return Promise.reject(new Error('PLUGIN_HOST_NOT_ALLOWED'));
    }
    return ensureProxyInfo().then(function(info){
      if (!info) throw new Error('PLUGIN_PROXY_UNAVAILABLE');
      var headers = {};
      if (opts.headers && typeof opts.headers === 'object') {
        for (var k in opts.headers) if (Object.prototype.hasOwnProperty.call(opts.headers, k)) headers[k] = opts.headers[k];
      }
      // referer / userAgent 是插件最常用的两个开关，单独给字段比让它自己拼 headers 好用。
      if (opts.referer && !headers.referer && !headers.Referer) headers.referer = opts.referer;
      if (opts.userAgent && !headers['user-agent'] && !headers['User-Agent']) headers['user-agent'] = opts.userAgent;
      var body = null;
      if (opts.body != null) body = typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body);
      return fetch('http://127.0.0.1:' + info.port + '/api/plugin/fetch?token=' + encodeURIComponent(info.token), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: String(url == null ? '' : url),
          method: opts.method || 'GET',
          headers: headers,
          body: body,
          responseType: opts.responseType || 'text'
        })
      });
    }).then(function(res){
      return res.json();
    }).then(function(data){
      if (!data || !data.ok) throw new Error((data && data.error) || 'PLUGIN_REQUEST_FAILED');
      var value = { status: data.status, headers: data.headers || {}, body: data.body };
      if (String(opts.responseType || '') === 'json') {
        // JSON 解析放在宿主侧：插件拿到的是已解析对象，省掉每个插件自己写 try/catch。
        try { value.body = JSON.parse(String(data.body || '')); }
        catch (e) { throw new Error('PLUGIN_BAD_JSON_RESPONSE'); }
      }
      return value;
    });
  }
  /**
   * 结算并清空一个 worker 上所有在飞的调用。销毁或崩溃时必须做，否则调用方的 Promise 永远挂着。
   * @param {object} handle worker 句柄。
   * @param {string} reason 失败原因。
   * @returns {void}
   */
  function rejectAllCalls(handle, reason) {
    var ids = Object.keys(handle.calls);
    for (var i = 0; i < ids.length; i++) {
      var slot = handle.calls[ids[i]];
      delete handle.calls[ids[i]];
      if (slot && slot.timer) clearTimeout(slot.timer);
      if (slot && slot.reject) slot.reject(new Error(reason));
    }
    handle.inflight = 0;
  }

  /**
   * 销毁一个插件 worker。禁用、卸载、脚本更新和崩溃都走这里。
   * @param {string} id 插件 id。
   * @param {string} [reason] 结算在飞调用时用的原因。
   * @returns {void}
   */
  function destroyWorker(id, reason) {
    var handle = workers[String(id || '')];
    if (!handle) return;
    delete workers[handle.id];
    rejectAllCalls(handle, reason || 'PLUGIN_TERMINATED');
    if (handle.bootReject) {
      var reject = handle.bootReject;
      handle.bootResolve = null;
      handle.bootReject = null;
      try { reject(new Error(reason || 'PLUGIN_TERMINATED')); } catch (e) {}
    }
    if (handle.bootTimer) clearTimeout(handle.bootTimer);
    try { if (handle.worker) handle.worker.terminate(); } catch (e) {}
    handle.worker = null;
  }

  /**
   * 销毁全部插件 worker。切换曲库、关闭插件系统或整体重载时用。
   * @returns {void}
   */
  function destroyAllWorkers() {
    var ids = Object.keys(workers);
    for (var i = 0; i < ids.length; i++) destroyWorker(ids[i], 'PLUGIN_RELOADED');
  }
  /**
   * 处理沙箱发来的一条消息。
   * @param {object} handle worker 句柄。
   * @param {object} msg 消息体。
   * @returns {void}
   */
  function handleWorkerMessage(handle, msg) {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'plugin-ready') {
      handle.hooks = Array.isArray(msg.hooks) ? msg.hooks.slice(0, 16) : [];
      if (handle.bootTimer) clearTimeout(handle.bootTimer);
      handle.bootTimer = null;
      var resolve = handle.bootResolve;
      handle.bootResolve = null;
      handle.bootReject = null;
      if (resolve) resolve(handle);
      return;
    }
    if (msg.type === 'plugin-boot-failed') {
      destroyWorker(handle.id, msg.error || 'PLUGIN_BOOT_FAILED');
      return;
    }
    if (msg.type === 'plugin-result') {
      var slot = handle.calls[msg.callId];
      if (!slot) return;
      delete handle.calls[msg.callId];
      if (slot.timer) clearTimeout(slot.timer);
      if (msg.ok) slot.resolve(msg.value);
      else slot.reject(new Error(msg.error || 'PLUGIN_CALL_FAILED'));
      return;
    }
    if (msg.type === 'plugin-log') {
      logInternal('[plugin:' + handle.id + ']', String(msg.text || ''));
      return;
    }
    if (msg.type === 'plugin-request') {
      if (handle.inflight >= PLUGIN_MAX_INFLIGHT) {
        postToWorker(handle, { type: 'plugin-request-result', callId: msg.callId, ok: false, error: 'PLUGIN_TOO_MANY_REQUESTS' });
        return;
      }
      handle.inflight++;
      proxyRequest(handle.manifest, msg.url, msg.options).then(function(value){
        handle.inflight--;
        postToWorker(handle, { type: 'plugin-request-result', callId: msg.callId, ok: true, value: value });
      }, function(err){
        handle.inflight--;
        postToWorker(handle, { type: 'plugin-request-result', callId: msg.callId, ok: false, error: (err && err.message) || 'PLUGIN_REQUEST_FAILED' });
      });
    }
  }
  /**
   * 往沙箱发一条消息。worker 已销毁时静默丢弃，调用方靠自己的超时兜住。
   * @param {object} handle worker 句柄。
   * @param {object} payload 消息体。
   * @returns {void}
   */
  function postToWorker(handle, payload) {
    if (!handle || !handle.worker) return;
    try { handle.worker.postMessage(payload); } catch (e) {}
  }

  /**
   * 取（必要时新建）一个插件的 worker，并等它启动完成。
   * 脚本变了就重建：装了新版本还复用旧 worker 等于更新没生效。
   * @param {object} rec 插件记录。
   * @returns {Promise<object>} 已就绪的 worker 句柄。
   */
  function ensureWorker(rec) {
    var id = rec.manifest.id;
    var handle = workers[id];
    if (handle && handle.script === rec.script && handle.worker) return handle.ready;
    if (handle) destroyWorker(id, 'PLUGIN_REPLACED');
    if (typeof global.Worker !== 'function') return Promise.reject(new Error('PLUGIN_WORKER_UNAVAILABLE'));
    handle = {
      id: id,
      manifest: rec.manifest,
      script: rec.script,
      worker: null,
      calls: Object.create(null),
      seq: 0,
      inflight: 0,
      hooks: [],
      ready: null,
      bootResolve: null,
      bootReject: null,
      bootTimer: null
    };
    workers[id] = handle;
    handle.ready = new Promise(function(resolve, reject){
      handle.bootResolve = resolve;
      handle.bootReject = reject;
      var worker;
      try {
        // 静态文件而不是 Blob URL：可审计、可测试，也不需要为 blob: 放宽 CSP。
        worker = new global.Worker('plugin-sandbox.js');
      } catch (e) {
        reject(new Error('PLUGIN_WORKER_SPAWN_FAILED'));
        return;
      }
      handle.worker = worker;
      worker.onmessage = function(event){ handleWorkerMessage(handle, event && event.data); };
      worker.onerror = function(){ destroyWorker(handle.id, 'PLUGIN_WORKER_ERROR'); };
      handle.bootTimer = setTimeout(function(){ destroyWorker(handle.id, 'PLUGIN_BOOT_TIMEOUT'); }, PLUGIN_BOOT_TIMEOUT_MS);
      postToWorker(handle, { type: 'plugin-boot', manifest: rec.manifest, script: rec.script });
    });
    // 启动失败时把 rejection 消化掉，避免变成 unhandledrejection 噪音；调用方还是会拿到同一个 rejected Promise。
    handle.ready.catch(function(){});
    return handle.ready;
  }
  /**
   * 调用一个插件钩子。带超时：卡住的插件不能把搜索或起播永远吊住。
   * @param {object} rec 插件记录。
   * @param {string} event 钩子名。
   * @param {unknown[]} args 参数数组。
   * @returns {Promise<unknown>} 插件返回值。
   */
  function invokeHook(rec, event, args) {
    if (!rec.script) return Promise.reject(new Error('PLUGIN_HOOK_MISSING'));
    return ensureWorker(rec).then(function(handle){
      if (handle.hooks.indexOf(event) < 0) throw new Error('PLUGIN_HOOK_MISSING');
      return new Promise(function(resolve, reject){
        var callId = 'c' + (++handle.seq);
        var slot = {
          resolve: resolve,
          reject: reject,
          timer: setTimeout(function(){
            delete handle.calls[callId];
            reject(new Error('PLUGIN_CALL_TIMEOUT'));
          }, PLUGIN_CALL_TIMEOUT_MS)
        };
        handle.calls[callId] = slot;
        postToWorker(handle, { type: 'plugin-invoke', callId: callId, event: event, args: Array.isArray(args) ? args : [] });
      });
    });
  }

  /**
   * 对一组插件并发调用同一个钩子，失败的那几个不影响其它插件。
   * 单个插件挂掉就让整次搜索失败是最糟的体验，所以这里只收集成功结果。
   * @param {object[]} list 插件记录数组。
   * @param {string} event 钩子名。
   * @param {unknown[]} args 参数数组。
   * @returns {Promise<Array<{rec: object, value: unknown}>>} 成功结果数组。
   */
  function invokeAll(list, event, args) {
    var jobs = [];
    for (var i = 0; i < list.length; i++) {
      (function(rec){
        jobs.push(invokeHook(rec, event, args).then(function(value){
          return { rec: rec, value: value };
        }, function(err){
          if (err && err.message !== 'PLUGIN_HOOK_MISSING') logInternal('[plugin:' + rec.manifest.id + '] ' + event + ' 失败: ' + ((err && err.message) || err));
          return null;
        }));
      })(list[i]);
    }
    return Promise.all(jobs).then(function(results){
      var out = [];
      for (var j = 0; j < results.length; j++) if (results[j]) out.push(results[j]);
      return out;
    });
  }
  /**
   * 取对象里第一个非空字段。插件生态字段名不统一（name/title、singer/artist…），
   * 让宿主兼容别名比要求每个插件都改字段现实。
   * @param {object} obj 源对象。
   * @param {string[]} keys 候选字段名。
   * @returns {string} 命中的值，未命中为空串。
   */
  function pick(obj, keys) {
    if (!obj || typeof obj !== 'object') return '';
    for (var i = 0; i < keys.length; i++) {
      var v = obj[keys[i]];
      if (v == null) continue;
      if (Array.isArray(v)) {
        var parts = [];
        for (var j = 0; j < v.length && j < 8; j++) {
          var item = v[j];
          if (item == null) continue;
          parts.push(typeof item === 'object' ? String(item.name || item.title || '') : String(item));
        }
        var joined = parts.filter(Boolean).join(' / ');
        if (joined) return joined;
        continue;
      }
      if (typeof v === 'object') {
        var nested = String(v.name || v.title || '');
        if (nested) return nested;
        continue;
      }
      var text = String(v);
      if (text) return text;
    }
    return '';
  }

  /**
   * 把秒/毫秒/`mm:ss` 三种时长写法统一成秒。
   * @param {unknown} value 原始时长。
   * @returns {number} 秒数，无法识别为 0。
   */
  function normalizeDuration(value) {
    if (value == null) return 0;
    if (typeof value === 'number' && isFinite(value)) return value > 3600 ? Math.round(value / 1000) : Math.round(value);
    var text = String(value).trim();
    if (/^\d+$/.test(text)) {
      var n = Number(text);
      return n > 3600 ? Math.round(n / 1000) : n;
    }
    var m = /^(\d{1,3}):(\d{1,2})(?:\.\d+)?$/.exec(text);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
    return 0;
  }
  /**
   * 把插件返回的一条歌曲归一化成宿主队列能直接用的对象。
   * 原始对象整体留在 pluginRaw 里，后面调 url / lyric / cover 钩子时原样回传，
   * 插件就不必把自己需要的所有字段都塞进宿主字段里。
   * @param {object} rec 插件记录。
   * @param {unknown} raw 插件返回的单条数据。
   * @returns {object|null} 归一化歌曲，或 null 表示丢弃。
   */
  function normalizeSong(rec, raw) {
    if (!raw || typeof raw !== 'object') return null;
    var name = pick(raw, ['name', 'title', 'songName', 'songname']);
    if (!name) return null;
    var songId = pick(raw, ['id', 'songId', 'songmid', 'mid', 'hash', 'copyrightId', 'rid']);
    var pluginId = rec.manifest.id;
    var cover = pick(raw, ['cover', 'img', 'pic', 'picUrl', 'albumPic', 'coverUrl']);
    var mediaOpts = { referer: pick(raw, ['referer', 'Referer']), userAgent: pick(raw, ['userAgent', 'ua']) };
    return {
      type: 'plugin',
      pluginId: pluginId,
      pluginName: rec.manifest.name,
      pluginSongId: songId,
      pluginRaw: raw,
      // 队列里要一个稳定 key：同名歌在不同插件里是两首歌，不能靠 name 去重。
      key: 'plugin:' + pluginId + ':' + (songId || name),
      name: name,
      artist: pick(raw, ['artist', 'singer', 'artists', 'author', 'ar']),
      album: pick(raw, ['album', 'albumName', 'albumname', 'al']),
      duration: normalizeDuration(raw.duration != null ? raw.duration : (raw.interval != null ? raw.interval : raw.length)),
      // cover 直接给成本地代理地址：宿主的封面管线会给远程图挂 crossOrigin，
      // 原始 CDN 不带 CORS 头会让取色 canvas 直接污染，代理这层顺手把头补上。
      cover: cover ? buildStreamUrl(cover, mediaOpts) : '',
      pluginCover: cover,
      pluginReferer: mediaOpts.referer,
      pluginUserAgent: mediaOpts.userAgent
    };
  }

  /**
   * 归一化插件返回的歌曲列表。
   * @param {object} rec 插件记录。
   * @param {unknown} value 插件返回值（数组或 {list: []} 包装）。
   * @param {number} limit 数量上限。
   * @returns {object[]} 归一化歌曲数组。
   */
  function normalizeSongList(rec, value, limit) {
    var list = Array.isArray(value) ? value : (value && Array.isArray(value.list) ? value.list : []);
    var out = [];
    for (var i = 0; i < list.length && out.length < limit; i++) {
      var song = normalizeSong(rec, list[i]);
      if (song) out.push(song);
    }
    return out;
  }
  /**
   * 跨全部启用的音源插件搜索。返回结果按插件安装顺序拼接，宿主再决定怎么排。
   * @param {string} query 搜索词。
   * @param {number} [limit] 每个插件的数量上限。
   * @returns {Promise<object[]>} 归一化歌曲数组。
   */
  function searchSongs(query, limit) {
    var q = String(query == null ? '' : query).trim();
    if (!q) return Promise.resolve([]);
    var list = enabledByKind('source');
    if (!list.length) return Promise.resolve([]);
    var cap = Math.max(1, Math.min(PLUGIN_SEARCH_LIMIT, Number(limit) || 30));
    return invokeAll(list, 'search', [q, { limit: cap }]).then(function(results){
      var out = [];
      for (var i = 0; i < results.length; i++) {
        out = out.concat(normalizeSongList(results[i].rec, results[i].value, cap));
      }
      return out;
    });
  }

  /**
   * 向插件要一条可播地址，并转成走本地代理的地址。
   * 直链不能直接给 audio：远程音频普遍没有 CORS 头，缺 Referer 也会被 CDN 拒；
   * 走 /api/plugin/stream 之后 Range、跨域和请求头就都由本地服务处理了。
   * @param {object} song 归一化歌曲（必须是 type === 'plugin'）。
   * @param {string} [quality] 音质档位，原样交给插件。
   * @returns {Promise<{url: string, directUrl: string}>} 可播地址。
   */
  function resolvePlayUrl(song, quality) {
    if (!song || song.type !== 'plugin') return Promise.reject(new Error('PLUGIN_SONG_REQUIRED'));
    var rec = recordById(song.pluginId);
    if (!rec || !rec.enabled) return Promise.reject(new Error('PLUGIN_NOT_AVAILABLE'));
    return invokeHook(rec, 'url', [song.pluginRaw || song, String(quality || '')]).then(function(value){
      var direct = '';
      var referer = song.pluginReferer;
      var userAgent = song.pluginUserAgent;
      if (typeof value === 'string') direct = value;
      else if (value && typeof value === 'object') {
        direct = String(value.url || value.src || '');
        if (value.referer) referer = String(value.referer);
        if (value.userAgent) userAgent = String(value.userAgent);
      }
      if (!direct) throw new Error('PLUGIN_URL_EMPTY');
      var proxied = buildStreamUrl(direct, { referer: referer, userAgent: userAgent });
      if (!proxied) throw new Error('PLUGIN_PROXY_UNAVAILABLE');
      return { url: proxied, directUrl: direct };
    });
  }
  /**
   * 向插件要歌词。返回原文与译文两段，宿主歌词层已有的双行渲染直接能用。
   * @param {object} song 归一化歌曲。
   * @returns {Promise<{lyric: string, translation: string}>} 歌词文本。
   */
  function fetchLyric(song) {
    if (!song || song.type !== 'plugin') return Promise.resolve({ lyric: '', translation: '' });
    var rec = recordById(song.pluginId);
    if (!rec || !rec.enabled) return Promise.resolve({ lyric: '', translation: '' });
    return invokeHook(rec, 'lyric', [song.pluginRaw || song]).then(function(value){
      if (typeof value === 'string') return { lyric: value, translation: '' };
      if (value && typeof value === 'object') {
        return {
          lyric: String(value.lyric || value.lrc || ''),
          translation: String(value.translation || value.tlyric || value.tlrc || '')
        };
      }
      return { lyric: '', translation: '' };
    }, function(){ return { lyric: '', translation: '' }; });
  }

  /**
   * 取一首插件歌曲的封面地址（已转成本地代理地址）。
   * 优先用搜索结果里带的封面，只有缺失时才去调 cover 钩子，省掉一次网络往返。
   * @param {object} song 归一化歌曲。
   * @returns {Promise<string>} 可直接塞给 img.src 的地址，取不到为空串。
   */
  function fetchCover(song) {
    if (!song || song.type !== 'plugin') return Promise.resolve('');
    var opts = { referer: song.pluginReferer, userAgent: song.pluginUserAgent };
    // 先把代理入口拿到手：buildStreamUrl 是同步的，proxyInfo 没就绪会直接吐空串。
    return ensureProxyInfo().then(function(info){
      if (!info) return '';
      if (song.pluginCover) return buildStreamUrl(song.pluginCover, opts);
      var rec = recordById(song.pluginId);
      if (!rec || !rec.enabled) return '';
      return invokeHook(rec, 'cover', [song.pluginRaw || song]).then(function(value){
        var direct = typeof value === 'string' ? value : (value && typeof value === 'object' ? String(value.url || value.cover || '') : '');
        return direct ? buildStreamUrl(direct, opts) : '';
      }, function(){ return ''; });
    });
  }
  /**
   * 归一化插件返回的一条歌单。
   * @param {object} rec 插件记录。
   * @param {unknown} raw 原始歌单对象。
   * @returns {object|null} 归一化歌单，或 null 表示丢弃。
   */
  function normalizePluginPlaylist(rec, raw) {
    if (!raw || typeof raw !== 'object') return null;
    var name = pick(raw, ['name', 'title', 'playlistName']);
    if (!name) return null;
    var id = pick(raw, ['id', 'playlistId', 'listId', 'tid']);
    if (!id) return null;
    var cover = pick(raw, ['cover', 'img', 'pic', 'picUrl', 'coverImgUrl']);
    return {
      type: 'plugin',
      pluginId: rec.manifest.id,
      pluginName: rec.manifest.name,
      id: 'plugin:' + rec.manifest.id + ':' + id,
      pluginPlaylistId: id,
      name: name,
      desc: pick(raw, ['desc', 'description', 'intro']),
      count: Number(pick(raw, ['count', 'total', 'trackCount', 'songCount'])) || 0,
      cover: cover ? buildStreamUrl(cover, {}) : '',
      pluginRaw: raw
    };
  }

  /**
   * 拉取全部启用的歌单插件提供的歌单列表。
   * @returns {Promise<object[]>} 归一化歌单数组。
   */
  function fetchPlaylists() {
    var list = enabledByKind('playlist');
    if (!list.length) return Promise.resolve([]);
    return invokeAll(list, 'playlists', []).then(function(results){
      var out = [];
      for (var i = 0; i < results.length; i++) {
        var raw = results[i].value;
        var arr = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.list) ? raw.list : []);
        for (var j = 0; j < arr.length && out.length < 200; j++) {
          var item = normalizePluginPlaylist(results[i].rec, arr[j]);
          if (item) out.push(item);
        }
      }
      return out;
    });
  }

  /**
   * 拉取一个插件歌单的曲目。
   * @param {object} playlist 归一化歌单。
   * @returns {Promise<object[]>} 归一化歌曲数组。
   */
  function fetchPlaylistDetail(playlist) {
    if (!playlist || playlist.type !== 'plugin') return Promise.resolve([]);
    var rec = recordById(playlist.pluginId);
    if (!rec || !rec.enabled) return Promise.resolve([]);
    return invokeHook(rec, 'playlistDetail', [playlist.pluginPlaylistId, playlist.pluginRaw || null]).then(function(value){
      return normalizeSongList(rec, value, 500);
    }, function(){ return []; });
  }
  /**
   * 取（必要时创建）插件主题的注入节点。
   * 固定一个 style 节点反复覆写，而不是每次新建：多个节点会累积，也会让覆盖顺序变得不可预期。
   * 节点插在 head 末尾，所以能盖住 app.css；但盖不住 applyUiAccentColor 写在
   * documentElement 上的行内变量，用户自己挑的强调色仍然优先，这是刻意的。
   * @returns {HTMLStyleElement|null} style 节点。
   */
  function ensureThemeStyleNode() {
    var doc = global.document;
    if (!doc || !doc.head) return null;
    var node = doc.getElementById(PLUGIN_THEME_STYLE_ID);
    if (!node) {
      node = doc.createElement('style');
      node.id = PLUGIN_THEME_STYLE_ID;
      doc.head.appendChild(node);
    }
    return node;
  }

  /**
   * 把一份变量表与 CSS 拼成注入文本。
   * @param {object} vars CSS 变量表。
   * @param {string} css 附加 CSS。
   * @returns {string} 注入文本。
   */
  function buildThemeCss(vars, css) {
    var names = Object.keys(vars || {});
    var out = '';
    if (names.length) {
      var decls = [];
      for (var i = 0; i < names.length; i++) decls.push(names[i] + ':' + vars[names[i]]);
      out += ':root{' + decls.join(';') + '}\n';
    }
    if (css) out += css;
    return out;
  }

  /**
   * 应用全部启用的主题插件。声明式主题先生效，脚本主题（theme 钩子）随后覆盖同名变量。
   * @returns {Promise<void>} 应用完成。
   */
  function applyThemes() {
    var node = ensureThemeStyleNode();
    if (!node) return Promise.resolve();
    var list = enabledByKind('theme');
    var vars = {};
    var cssParts = [];
    for (var i = 0; i < list.length; i++) {
      var theme = list[i].theme;
      if (!theme) continue;
      var keys = Object.keys(theme.vars || {});
      for (var k = 0; k < keys.length; k++) vars[keys[k]] = theme.vars[keys[k]];
      if (theme.css) cssParts.push(theme.css);
    }
    var scripted = [];
    for (var s = 0; s < list.length; s++) if (list[s].script) scripted.push(list[s]);
    // 声明式部分先同步写进去：脚本主题要等 worker 起来（最坏 8 秒），不能让界面在这段时间里裸着。
    node.textContent = buildThemeCss(vars, cssParts.join('\n'));
    if (!scripted.length) return Promise.resolve();
    return invokeAll(scripted, 'theme', []).then(function(results){
      for (var r = 0; r < results.length; r++) {
        var value = results[r].value;
        if (!value || typeof value !== 'object') continue;
        var safeVars = Manifest.normalizeThemeVars(value.vars);
        var vkeys = Object.keys(safeVars);
        for (var v = 0; v < vkeys.length; v++) vars[vkeys[v]] = safeVars[vkeys[v]];
        var safeCss = Manifest.sanitizeThemeCss(value.css);
        if (safeCss) cssParts.push(safeCss);
      }
      // textContent 而不是 innerHTML：即使清洗漏掉了什么，也不会在这里被当成标签解析。
      node.textContent = buildThemeCss(vars, cssParts.join('\n'));
    });
  }
  /**
   * 安装（或覆盖安装）一个插件包。
   * 同 id 视为升级：保留原有启用状态与安装时间，只换脚本与清单。
   * @param {string} fileName 原始文件名，用来判定 `.js` / `.json` 包格式。
   * @param {string} content 文件文本。
   * @returns {{ok: boolean, error?: string, manifest?: object, replaced?: boolean}} 安装结果。
   */
  function install(fileName, content) {
    var parsed = Manifest.parsePluginPackage(fileName, content);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    var plugin = parsed.plugin;
    var existing = recordById(plugin.manifest.id);
    if (!existing && records.length >= Manifest.MAX_PLUGINS) return { ok: false, error: 'PLUGIN_LIMIT_REACHED' };
    var now = Date.now();
    var record = {
      manifest: plugin.manifest,
      script: plugin.script,
      theme: plugin.theme,
      enabled: existing ? existing.enabled : true,
      installedAt: existing ? existing.installedAt : now,
      updatedAt: now
    };
    if (existing) {
      records[records.indexOf(existing)] = record;
      // 覆盖安装必须重建 worker，否则跑的还是旧脚本。
      destroyWorker(record.manifest.id, 'PLUGIN_UPDATED');
    } else {
      records.push(record);
    }
    writeStore();
    applyThemes();
    return { ok: true, manifest: record.manifest, replaced: !!existing };
  }

  /**
   * 卸载一个插件。
   * @param {string} id 插件 id。
   * @returns {boolean} 是否命中并删除。
   */
  function remove(id) {
    var rec = recordById(id);
    if (!rec) return false;
    records.splice(records.indexOf(rec), 1);
    destroyWorker(rec.manifest.id, 'PLUGIN_REMOVED');
    writeStore();
    applyThemes();
    return true;
  }

  /**
   * 启用/禁用一个插件。禁用会立刻销毁它的 worker，不留后台常驻。
   * @param {string} id 插件 id。
   * @param {boolean} enabled 目标状态。
   * @returns {boolean} 是否命中。
   */
  function setEnabled(id, enabled) {
    var rec = recordById(id);
    if (!rec) return false;
    rec.enabled = !!enabled;
    rec.updatedAt = Date.now();
    if (!rec.enabled) destroyWorker(rec.manifest.id, 'PLUGIN_DISABLED');
    writeStore();
    applyThemes();
    return true;
  }
  /**
   * 列出已安装插件（只读快照）。UI 直接拿去渲染，改这个数组不会影响真实状态。
   * @returns {object[]} 插件摘要数组。
   */
  function list() {
    var out = [];
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      out.push({
        id: rec.manifest.id,
        name: rec.manifest.name,
        kind: rec.manifest.kind,
        version: rec.manifest.version,
        author: rec.manifest.author,
        description: rec.manifest.description,
        homepage: rec.manifest.homepage,
        hosts: rec.manifest.hosts.slice(),
        enabled: rec.enabled,
        hasScript: !!rec.script,
        hasTheme: !!rec.theme,
        installedAt: rec.installedAt,
        updatedAt: rec.updatedAt
      });
    }
    return out;
  }

  /**
   * 是否存在启用的某类插件。宿主用它决定要不要显示插件相关入口。
   * @param {string} kind 插件类型。
   * @returns {boolean} 是否存在。
   */
  function hasEnabled(kind) {
    return enabledByKind(kind).length > 0;
  }

  /**
   * 通过系统对话框导入插件文件。桌面壳不可用时返回明确错误而不是静默失败。
   * @returns {Promise<{ok: boolean, error?: string, canceled?: boolean, manifest?: object, replaced?: boolean}>} 导入结果。
   */
  function importFromDialog() {
    var desktop = global.desktopWindow;
    if (!desktop || typeof desktop.importPluginFile !== 'function') {
      return Promise.resolve({ ok: false, error: 'PLUGIN_IMPORT_UNAVAILABLE' });
    }
    return Promise.resolve(desktop.importPluginFile()).then(function(res){
      if (!res || !res.ok) return { ok: false, error: (res && res.error) || '', canceled: !!(res && res.canceled) };
      return install(res.fileName || '', res.text || '');
    }, function(err){
      return { ok: false, error: (err && err.message) || 'PLUGIN_IMPORT_FAILED' };
    });
  }
  /**
   * 初始化运行时。app.js 在自己的状态水合完成后调用，注入持久化与提示桥。
   * 反复调用是安全的：只会重新读一次 storage 并重刷主题。
   * @param {object} [options] 注入项：persist / toast / log。
   * @returns {object[]} 已安装插件摘要。
   */
  function init(options) {
    var opts = options && typeof options === 'object' ? options : {};
    if (typeof opts.persist === 'function') bridge.persist = opts.persist;
    if (typeof opts.toast === 'function') bridge.toast = opts.toast;
    if (typeof opts.log === 'function') bridge.log = opts.log;
    records = readStore();
    destroyAllWorkers();
    // 代理入口先要一次：主题不需要它，但装了音源插件时可以省掉首播的一次 IPC 往返。
    ensureProxyInfo();
    applyThemes();
    return list();
  }

  global.MineradioPlugins = {
    STORE_KEY: PLUGIN_STORE_KEY,
    init: init,
    list: list,
    hasEnabled: hasEnabled,
    install: install,
    importFromDialog: importFromDialog,
    remove: remove,
    setEnabled: setEnabled,
    applyThemes: applyThemes,
    searchSongs: searchSongs,
    resolvePlayUrl: resolvePlayUrl,
    fetchLyric: fetchLyric,
    fetchCover: fetchCover,
    fetchPlaylists: fetchPlaylists,
    fetchPlaylistDetail: fetchPlaylistDetail,
    buildStreamUrl: buildStreamUrl,
    destroyAllWorkers: destroyAllWorkers,
    toast: toast
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
