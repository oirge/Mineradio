'use strict';
// Mineradio 插件运行时（宿主侧）。职责边界：
// - 插件代码只在 Worker 沙箱（plugin-sandbox.js）里跑，这里是它唯一的对外通道；
// - 清单解析与校验统一走 plugin-manifest.js，运行时不自己再写一套规则；
// - 插件只有主题一种能力，没有网络也没有播放通道：脚本插件只能返回变量表与 CSS 文本。
// 加载顺序：plugin-manifest.js → plugin-runtime.js → app.js（app.js 负责注入持久化与提示桥）。
(function(global){
  var Manifest = global.MineradioPluginManifest;
  if (!Manifest) return;

  var PLUGIN_STORE_KEY = 'mineradio-plugins-v1';
  // 自带主题的附加状态。这里只记「用户卸载过哪些自带主题」，卸载了就不再塞回来。
  var PLUGIN_BUILTIN_STORE_KEY = 'mineradio-plugins-builtin-v1';
  var PLUGIN_THEME_STYLE_ID = 'mineradio-plugin-theme-style';
  // 单次钩子调用上限。主题脚本算变量表通常是毫秒级，但不能让一个死循环的插件把换肤永远吊住。
  var PLUGIN_CALL_TIMEOUT_MS = 12000;
  var PLUGIN_BOOT_TIMEOUT_MS = 8000;

  var records = [];
  var workers = Object.create(null);
  // 最近一次 applyThemes 合并出来的变量表。迷你播放器窗口不加载插件运行时，只能靠这份表转发。
  var activeThemeVars = {};
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
   * 读回自带主题的附加状态。结构固定为 `{removed: string[]}`，外部改坏了就当空表。
   * @returns {{removed: string[]}} 附加状态。
   */
  function readBuiltinState() {
    var raw = '';
    try { raw = global.localStorage ? (global.localStorage.getItem(PLUGIN_BUILTIN_STORE_KEY) || '') : ''; } catch (e) { raw = ''; }
    var parsed = null;
    try { parsed = raw ? JSON.parse(raw) : null; } catch (e) { parsed = null; }
    var removed = parsed && Array.isArray(parsed.removed) ? parsed.removed : [];
    var out = [];
    for (var i = 0; i < removed.length && out.length < 64; i++) {
      var id = String(removed[i] || '');
      if (id && out.indexOf(id) < 0) out.push(id);
    }
    return { removed: out };
  }

  /**
   * 落盘自带主题的附加状态。
   * @param {{removed: string[]}} state 附加状态。
   * @returns {void}
   */
  function writeBuiltinState(state) {
    var payload = JSON.stringify({ removed: (state && state.removed) || [] });
    try { if (global.localStorage) global.localStorage.setItem(PLUGIN_BUILTIN_STORE_KEY, payload); } catch (e) {}
    if (typeof bridge.persist === 'function') {
      try { bridge.persist(PLUGIN_BUILTIN_STORE_KEY, payload); } catch (e) {}
    }
  }

  /**
   * 取自带主题模块提供的插件包。模块没加载（例如纯浏览器环境）时返回空数组。
   * @returns {Array<{fileName: string, content: string}>} 插件包数组。
   */
  function builtinThemePackages() {
    var api = global.MineradioBuiltinThemes;
    if (!api || typeof api.list !== 'function') return [];
    try {
      var arr = api.list();
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }

  /**
   * 判断一个 id 是不是自带主题。
   * @param {string} id 插件 id。
   * @returns {boolean} 是否自带。
   */
  function isBuiltinThemeId(id) {
    var api = global.MineradioBuiltinThemes;
    if (!api || typeof api.ids !== 'function') return false;
    var key = String(id || '');
    try { return api.ids().indexOf(key) >= 0; } catch (e) { return false; }
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
   * 现在只剩 theme 一种类型，这层过滤保留下来是为了让存档里残留的旧类型记录不参与调用。
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
   * 调用一个插件钩子。带超时：卡住的插件不能把换肤永远吊住。
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
   * 单个主题脚本挂掉就让整次换肤失败是最糟的体验，所以这里只收集成功结果。
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
    activeThemeVars = vars;
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
      activeThemeVars = vars;
      node.textContent = buildThemeCss(vars, cssParts.join('\n'));
    });
  }
  /**
   * 取当前生效的主题变量表副本。迷你播放器是独立窗口、不加载插件运行时，
   * 主窗口靠这份表把 --th-* 通过 IPC 送过去，让它跟着主题一起换色。
   * @returns {Object<string,string>} 变量名到值的副本。
   */
  function themeVars() {
    var out = {};
    var keys = Object.keys(activeThemeVars || {});
    for (var i = 0; i < keys.length; i++) out[keys[i]] = activeThemeVars[keys[i]];
    return out;
  }
  /**
   * 主题互斥：同一时刻只允许一个主题插件启用。
   * 两个主题一起开时后注入的那份会盖住前一份的同名变量，结果取决于安装顺序，用户看不懂也调不动，
   * 所以启用一个就把其它的关掉，而不是让它们叠加。
   * @param {string} keepId 要保留启用状态的主题 id。
   * @returns {string[]} 被自动关掉的主题名字。
   */
  function enforceSingleTheme(keepId) {
    var keep = String(keepId || '');
    var turnedOff = [];
    var now = Date.now();
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      if (rec.manifest.kind !== 'theme' || !rec.enabled) continue;
      if (rec.manifest.id === keep) continue;
      rec.enabled = false;
      rec.updatedAt = now;
      destroyWorker(rec.manifest.id, 'PLUGIN_THEME_SWITCHED');
      turnedOff.push(rec.manifest.name);
    }
    return turnedOff;
  }

  /**
   * 找当前启用的主题里最后被操作的那一个。历史数据（1.7.2 之前）可能有多个主题同时启用，
   * 归一化时保留用户最近开的那个最接近他的本意。
   * @returns {string} 主题 id，没有启用的主题时为空串。
   */
  function latestEnabledThemeId() {
    var best = null;
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      if (rec.manifest.kind !== 'theme' || !rec.enabled) continue;
      if (!best || (rec.updatedAt || 0) > (best.updatedAt || 0)) best = rec;
    }
    return best ? best.manifest.id : '';
  }

  /**
   * 比较两个版本号（形如 `1.2.0`）。只用于判断自带主题要不要覆盖已装的旧版。
   * @param {string} a 左值。
   * @param {string} b 右值。
   * @returns {number} a>b 为 1，a<b 为 -1，相等为 0。
   */
  function compareVersions(a, b) {
    var pa = String(a || '0').split('.');
    var pb = String(b || '0').split('.');
    for (var i = 0; i < 4; i++) {
      var na = parseInt(pa[i], 10) || 0;
      var nb = parseInt(pb[i], 10) || 0;
      if (na > nb) return 1;
      if (na < nb) return -1;
    }
    return 0;
  }

  /**
   * 把安装包自带的主题补进插件列表。
   * 走的是和用户导入完全相同的 parsePluginPackage 通道，所以自带主题不享受任何清洗豁免。
   * 三条规则：用户卸载过的不再塞回来；已装同 id 的只在自带版本更高时覆盖（保留启用状态，
   * 也就不会把用户自己改的同 id 版本按回去）；新补进来的默认不启用，避免升级后擅自换掉界面外观。
   * @returns {boolean} 列表是否有改动。
   */
  function seedBuiltinThemes() {
    var packs = builtinThemePackages();
    if (!packs.length) return false;
    var state = readBuiltinState();
    var changed = false;
    for (var i = 0; i < packs.length; i++) {
      var parsed = Manifest.parsePluginPackage(packs[i].fileName, packs[i].content);
      if (!parsed.ok) {
        logInternal('[plugin] 自带主题解析失败: ' + packs[i].fileName + ' ' + parsed.error);
        continue;
      }
      var plugin = parsed.plugin;
      var id = plugin.manifest.id;
      if (state.removed.indexOf(id) >= 0) continue;
      var existing = recordById(id);
      var now = Date.now();
      if (!existing) {
        if (records.length >= Manifest.MAX_PLUGINS) continue;
        records.push({
          manifest: plugin.manifest,
          script: plugin.script,
          theme: plugin.theme,
          enabled: false,
          installedAt: now,
          updatedAt: now
        });
        changed = true;
        continue;
      }
      if (compareVersions(plugin.manifest.version, existing.manifest.version) <= 0) continue;
      records[records.indexOf(existing)] = {
        manifest: plugin.manifest,
        script: plugin.script,
        theme: plugin.theme,
        enabled: existing.enabled,
        installedAt: existing.installedAt,
        updatedAt: now
      };
      destroyWorker(id, 'PLUGIN_UPDATED');
      changed = true;
    }
    return changed;
  }

  /**
   * 安装（或覆盖安装）一个插件包。
   * 同 id 视为升级：保留原有启用状态与安装时间，只换脚本与清单。
   * @param {string} fileName 原始文件名，用来判定 `.js` / `.json` 包格式。
   * @param {string} content 文件文本。
   * @returns {{ok: boolean, error?: string, manifest?: object, replaced?: boolean, switchedOff?: string[]}} 安装结果，
   *   switchedOff 是因主题互斥被自动关掉的主题名字。
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
    // 装进来的主题一旦是启用状态，就让它成为唯一启用的主题。
    var switchedOff = record.manifest.kind === 'theme' && record.enabled ? enforceSingleTheme(record.manifest.id) : [];
    // 用户手动装回一个之前卸掉的自带主题，就说明他改主意了，把「卸载过」的记忆清掉。
    if (isBuiltinThemeId(record.manifest.id)) {
      var state = readBuiltinState();
      var at = state.removed.indexOf(record.manifest.id);
      if (at >= 0) {
        state.removed.splice(at, 1);
        writeBuiltinState(state);
      }
    }
    writeStore();
    applyThemes();
    return { ok: true, manifest: record.manifest, replaced: !!existing, switchedOff: switchedOff };
  }

  /**
   * 卸载一个插件。自带主题被卸载时会记进「用户卸载过」名单，下次启动不再自动补回来。
   * @param {string} id 插件 id。
   * @returns {boolean} 是否命中并删除。
   */
  function remove(id) {
    var rec = recordById(id);
    if (!rec) return false;
    records.splice(records.indexOf(rec), 1);
    destroyWorker(rec.manifest.id, 'PLUGIN_REMOVED');
    if (isBuiltinThemeId(rec.manifest.id)) {
      var state = readBuiltinState();
      if (state.removed.indexOf(rec.manifest.id) < 0) {
        state.removed.push(rec.manifest.id);
        writeBuiltinState(state);
      }
    }
    writeStore();
    applyThemes();
    return true;
  }

  /**
   * 启用/禁用一个插件。禁用会立刻销毁它的 worker，不留后台常驻。
   * 启用主题类插件时其它主题会被自动关掉：主题之间是互斥的，不叠加。
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
    if (rec.enabled && rec.manifest.kind === 'theme') enforceSingleTheme(rec.manifest.id);
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
    // 补齐安装包自带的主题：只在用户没主动卸载过、且本地版本比自带的旧时才动。
    var changed = seedBuiltinThemes();
    // 老版本可能同时启用了多个主题（那时还没有互斥规则），这里收敛成最近启用的那一个。
    var keep = latestEnabledThemeId();
    if (keep && enforceSingleTheme(keep).length) changed = true;
    if (changed) writeStore();
    applyThemes();
    return list();
  }

  global.MineradioPlugins = {
    STORE_KEY: PLUGIN_STORE_KEY,
    BUILTIN_STORE_KEY: PLUGIN_BUILTIN_STORE_KEY,
    init: init,
    list: list,
    hasEnabled: hasEnabled,
    install: install,
    importFromDialog: importFromDialog,
    remove: remove,
    setEnabled: setEnabled,
    applyThemes: applyThemes,
    themeVars: themeVars,
    destroyAllWorkers: destroyAllWorkers,
    toast: toast
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
