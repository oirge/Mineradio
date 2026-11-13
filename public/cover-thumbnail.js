(function (global) {
  'use strict';

  // Keep only one decode active, bound waiting blobs, and release the worker after a quiet period.
  var worker = null, disabled = false, serial = 0, active = null, queue = [], queuedBytes = 0;
  var timeout = 0, idle = 0;
  function stop() {
    global.clearTimeout(timeout); global.clearTimeout(idle);
    timeout = idle = 0;
    if (worker) worker.terminate();
    worker = null;
  }
  function fail() {
    stop(); disabled = true;
    if (active) { active.resolve(null); active = null; }
    while (queue.length) queue.shift().resolve(null);
    queuedBytes = 0;
  }
  function drain() {
    if (active || !queue.length) return;
    global.clearTimeout(idle); idle = 0;
    try {
      if (!worker) {
        worker = new global.Worker(new URL('cover-thumbnail-worker.js', global.location.href));
        var ownedWorker = worker;
        worker.onmessage = function (event) {
          if (worker !== ownedWorker || !active || event.data.id !== active.id) return;
          global.clearTimeout(timeout); timeout = 0;
          var job = active; active = null;
          job.resolve(event.data.fallback ? null : String(event.data.value || ''));
          if (queue.length) drain();
          else idle = global.setTimeout(stop, 30000);
        };
        worker.onerror = worker.onmessageerror = function () { if (worker === ownedWorker) fail(); };
      }
      active = queue.shift(); queuedBytes -= active.bytes;
      timeout = global.setTimeout(fail, 45000);
      worker.postMessage({ id: active.id, source: active.source, maxSide: active.options.maxSide,
        quality: active.options.quality, smoothing: active.options.smoothing });
      active.source = null;
    } catch (_error) { fail(); }
  }
  global.MineradioCoverThumbnail = {
    generate: function (source, options) {
      if (disabled || typeof global.Worker !== 'function' || typeof global.OffscreenCanvas !== 'function') return Promise.resolve(null);
      var bytes = typeof source === 'string' ? source.length * 2 : Number(source && source.size) || 0;
      if (queue.length >= 24 || (queue.length && queuedBytes + bytes > 32 * 1024 * 1024)) return Promise.resolve(null);
      return new Promise(function (resolve) {
        queue.push({ id: ++serial, source: source, options: options, resolve: resolve, bytes: bytes });
        queuedBytes += bytes; drain();
      });
    },
    dispose: fail
  };
  global.addEventListener('beforeunload', fail);
})(window);
