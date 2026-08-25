'use strict';
// Mineradio 插件沙箱：插件脚本在 Worker 里跑，拿不到 DOM、localStorage、IndexedDB，
// 也拿不到 preload 暴露的 desktopWindow 桥（也就摸不到文件系统与主进程 IPC）。
// 插件也完全没有网络：宿主不再代发请求，主题脚本只需要算出变量表与 CSS 文本。
// 注意：这是能力沙箱而不是语言沙箱 —— eval / new Function 依然可用，
// 但它们能拿到的能力集合就是下面这份，不会因为绕过语法检查而变大。
(function(){
  var hostPostMessage = self.postMessage.bind(self);
  var hostAddEventListener = self.addEventListener.bind(self);
  var ObjectKeys = Object.keys;
  var handlers = Object.create(null);
  var booted = false;

  // 逐项抹掉插件不该拿到的宿主能力。importScripts 会拉远端代码；
  // fetch/XHR/WebSocket 会直连网络；indexedDB/caches 会在用户机器上留持久化数据。
  var STRIPPED = [
    'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts',
    'indexedDB', 'caches', 'Worker', 'SharedWorker', 'BroadcastChannel',
    'postMessage', 'Notification', 'OffscreenCanvas', 'createImageBitmap'
  ];
  for (var s = 0; s < STRIPPED.length; s++) {
    try { self[STRIPPED[s]] = undefined; } catch (e) {}
    try { delete self[STRIPPED[s]]; } catch (e) {}
  }

  /**
   * 把插件抛出的任意值压成可结构化克隆的错误文本。
   * Error 实例本身能克隆，但插件可能抛出带循环引用的对象，直接 postMessage 会整体失败。
   * @param {unknown} err 插件抛出的值。
   * @returns {string} 错误描述。
   */
  function errorText(err) {
    if (err && typeof err === 'object' && err.message) return String(err.message).slice(0, 400);
    try { return String(err).slice(0, 400); } catch (e) { return 'PLUGIN_ERROR'; }
  }

  var EVENTS = ['theme'];

  /**
   * 注册一个宿主可调用的插件钩子。同名钩子后注册的覆盖先注册的。
   * @param {string} event 钩子名，必须在 EVENTS 内。
   * @param {Function} handler 处理函数，可以返回 Promise。
   * @returns {void}
   */
  function on(event, handler) {
    var name = String(event || '');
    if (EVENTS.indexOf(name) < 0) throw new Error('未知插件钩子: ' + name);
    if (typeof handler !== 'function') throw new Error('插件钩子必须是函数: ' + name);
    handlers[name] = handler;
  }

  /**
   * 把日志转交宿主控制台。插件拿不到真 console 的场景下也能排错。
   * @returns {void}
   */
  function log() {
    var parts = [];
    for (var i = 0; i < arguments.length; i++) {
      try { parts.push(typeof arguments[i] === 'string' ? arguments[i] : JSON.stringify(arguments[i])); }
      catch (e) { parts.push('[unserializable]'); }
    }
    hostPostMessage({ type: 'plugin-log', text: parts.join(' ').slice(0, 800) });
  }

  var mineradio = {
    version: 1,
    manifest: null,
    on: on,
    log: log
  };
  self.mineradio = mineradio;
  // 老插件习惯用 lx 命名空间，给个同一对象的别名，省掉一层适配层。
  self.lx = mineradio;

  /**
   * 执行一次宿主调用并回包。钩子未注册按未实现返回，让宿主可以直接跳过这个插件。
   * @param {object} msg 宿主调用包。
   * @returns {void}
   */
  function invoke(msg) {
    var handler = handlers[msg.event];
    if (typeof handler !== 'function') {
      hostPostMessage({ type: 'plugin-result', callId: msg.callId, ok: false, error: 'PLUGIN_HOOK_MISSING' });
      return;
    }
    var args = Array.isArray(msg.args) ? msg.args : [];
    Promise.resolve().then(function(){
      return handler.apply(null, args);
    }).then(function(value){
      // 插件返回值必须能结构化克隆，先过一次 JSON 序列化，把函数、循环引用和 DOM 壳挡在 postMessage 之前。
      var safe;
      try { safe = value === undefined ? null : JSON.parse(JSON.stringify(value)); }
      catch (e) { throw new Error('插件返回值无法序列化'); }
      hostPostMessage({ type: 'plugin-result', callId: msg.callId, ok: true, value: safe });
    }).catch(function(err){
      hostPostMessage({ type: 'plugin-result', callId: msg.callId, ok: false, error: errorText(err) });
    });
  }

  hostAddEventListener('message', function(event){
    var msg = event && event.data;
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'plugin-boot') {
      if (booted) return;
      booted = true;
      mineradio.manifest = Object.freeze(msg.manifest || {});
      try {
        // 用 Function 而不是 eval：插件正文拿不到这里的闭包变量（hostPostMessage / handlers）。
        var factory = new Function('mineradio', 'lx', '"use strict";' + String(msg.script || ''));
        factory(mineradio, mineradio);
        hostPostMessage({ type: 'plugin-ready', hooks: ObjectKeys(handlers) });
      } catch (err) {
        hostPostMessage({ type: 'plugin-boot-failed', error: errorText(err) });
      }
      return;
    }
    if (msg.type === 'plugin-invoke') { invoke(msg); return; }
  });
// __PLUGIN_SANDBOX_TAIL__
})();
