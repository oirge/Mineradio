'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { WallpaperEngineRuntime } = require('../desktop/wallpaper-engine-runtime');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function extractFunction(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + 1);
  assert.ok(start >= 0 && end > start, '未找到目标函数：' + startMarker);
  return source.slice(start, end);
}

function extractCallbackBody(source, marker) {
  const start = source.indexOf(marker);
  const braceStart = source.indexOf('{', start);
  assert.ok(start >= 0 && braceStart > start, '未找到目标回调：' + marker);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(braceStart + 1, index);
    }
  }
  throw new Error('目标回调花括号不平衡：' + marker);
}

class FakeWebContents extends EventEmitter {
  isDestroyed() {
    return false;
  }
}

class FakeWindow extends EventEmitter {
  constructor() {
    super();
    this.webContents = new FakeWebContents();
    this.destroyed = false;
  }

  isDestroyed() {
    return this.destroyed;
  }
}

test('renderer 崩溃、主 frame 导航和刷新失败都进入 Wallpaper Engine 清理门', () => {
  const source = read('desktop/wallpaper-engine-bridge.js');
  const attachWindow = extractFunction(source, 'function attachWindow(win) {', '\n\n  async function installProtocol');
  const calls = [];
  const context = {
    windowHooksInstalled: false,
    attachedWindow: null,
    stopRuntimeForRenderer(reason) {
      calls.push(reason);
      return Promise.resolve({ ok: true, stopped: true });
    },
    suspendForHiddenHost() {},
    resumeForVisibleHost() {},
    scheduleHostBoundsRestart() {},
    setTimeout(callback) {
      callback();
      return { unref() {} };
    },
  };
  vm.runInNewContext(attachWindow + '\nthis.attachWindow = attachWindow;', context);

  const first = new FakeWindow();
  context.attachWindow(first);
  first.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
  first.webContents.emit('did-start-navigation', {}, 'http://127.0.0.1:3000/index.html', false, true);
  first.webContents.emit('did-navigate', {}, 'http://127.0.0.1:3000/index.html');
  first.webContents.emit('did-frame-navigate', {}, 'http://127.0.0.1:3000/frame.html', 200, 'OK', false);
  first.webContents.emit('did-frame-navigate', {}, 'http://127.0.0.1:3000/index.html', 200, 'OK', true);
  first.webContents.emit('did-fail-load', {}, -3, 'aborted', '', true);
  first.webContents.emit('did-start-navigation', {}, 'http://127.0.0.1:3000/index.html', false, true);
  first.webContents.emit('did-fail-load', {}, -105, 'offline', '', true);

  assert.deepEqual(calls, [
    'renderer-gone:crashed',
    'main-frame-navigate:http://127.0.0.1:3000/index.html',
    'main-frame-load-failed:-105:offline',
  ]);

  first.emit('closed');
  const second = new FakeWindow();
  context.attachWindow(second);
  first.webContents.emit('render-process-gone', {}, { reason: 'late-old-renderer' });
  first.emit('closed');
  second.emit('closed');

  assert.deepEqual(calls.slice(3), ['window-closed', 'window-closed']);
});

test('renderer 清理在并发失效事件中 single-flight，并强制请求 helper 清理', async () => {
  const source = read('desktop/wallpaper-engine-bridge.js');
  const stopFunction = extractFunction(source, 'function stopRuntimeForRenderer(reason = \'\', options = {}) {', '\n\n  function finishVisibleHostResume');
  const resolvers = [];
  const stopCalls = [];
  const context = {
    captureOperation: 0,
    glassCaptureOperation: 0,
    capturePreparationOperation: 1,
    hostVisibilityResumeTimer: null,
    hostVisibilitySuspended: true,
    hostVisibilityResumePending: true,
    hostVisibilityOperation: 0,
    hostVisibilityStopPromise: {},
    rendererCleanupPromise: null,
    cancelHostBoundsRestart() {},
    clearCaptureGrant() {},
    clearTimeout() {},
    runtime: {
      stop(options) {
        stopCalls.push(options);
        return new Promise((resolve) => resolvers.push(resolve));
      },
    },
    console,
  };
  vm.runInNewContext(stopFunction + '\nthis.stopRuntimeForRenderer = stopRuntimeForRenderer;', context);

  const first = context.stopRuntimeForRenderer('renderer-gone', { rendererLifecycle: true });
  const second = context.stopRuntimeForRenderer('main-frame-navigate', { rendererLifecycle: true });
  assert.strictEqual(first, second);
  await Promise.resolve();
  assert.equal(stopCalls.length, 1);
  assert.equal(stopCalls[0].forceHelperCleanup, true);

  resolvers.shift()({ ok: true, stopped: true, active: false });
  await first;
  const third = context.stopRuntimeForRenderer('window-closed', { rendererLifecycle: true });
  await Promise.resolve();
  assert.notStrictEqual(third, first);
  assert.equal(stopCalls.length, 2);
});

test('pagehide 只对离开前持有的原生 session 发最佳努力停止请求', () => {
  const source = read('public/wallpaper-engine.js');
  const pagehideBody = extractCallbackBody(source, "window.addEventListener('pagehide', function () {");
  const calls = [];
  const context = {
    wallpaperEngineNativeSessionId: '0123456789abcdef01234567',
    wallpaperEngineHostBoundsUnsubscribe() {},
    cancelWallpaperEngineSwitchTimer() {},
    cancelWallpaperEngineVideoRetry() {},
    cancelWallpaperEngineFirstFrameWait() {},
    cancelWallpaperEnginePointerActivity() {},
    stopWallpaperEngineNativeSession(sessionId, options) {
      calls.push({ sessionId, options });
    },
    stopWallpaperEngineCaptureStream() {},
    clearWallpaperEngineFreezeFrame() {},
    wallpaperEngineLayerToken: 0,
    Promise,
  };
  vm.runInNewContext('function handlePagehide() {' + pagehideBody + '}\nthis.handlePagehide = handlePagehide;', context);
  context.handlePagehide();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].sessionId, '0123456789abcdef01234567');
  assert.equal(calls[0].options.rendererLifecycle, true);

  context.wallpaperEngineNativeSessionId = '';
  context.handlePagehide();
  assert.equal(calls.length, 1);
});

test('刷新成功等待 renderer 清理完成，且旧 session 停止不会变成新 session 全量停止', () => {
  const bridge = read('desktop/wallpaper-engine-bridge.js');
  const startHandlerStart = bridge.indexOf("ipcMain.handle('mineradio-wallpaper-engine-start-scene'");
  const startHandlerEnd = bridge.indexOf("ipcMain.handle('mineradio-wallpaper-engine-capture-result'", startHandlerStart + 1);
  assert.ok(startHandlerStart >= 0 && startHandlerEnd > startHandlerStart);
  const startHandler = bridge.slice(startHandlerStart, startHandlerEnd);
  assert.match(startHandler, /const pendingRendererCleanup = rendererCleanupPromise;/);
  assert.match(startHandler, /if \(pendingRendererCleanup\) await pendingRendererCleanup;/);
  assert.match(startHandler, /if \(!isTrustedIpc\(event\)\) return \{ ok: false, error: 'WALLPAPER_ENGINE_UNTRUSTED_CALLER' \};[\s\S]*const pendingRendererCleanup[\s\S]*if \(!isTrustedIpc\(event\)\)/);
  assert.match(bridge, /runtime\.stop\(\{ \.\.\.stopOptions, sessionId \}\)/);
  assert.match(read('desktop/wallpaper-engine-runtime.js'), /if \(expectedSessionId && !matchesPending && !matchesActive\)/);
});

test('renderer 失效的强制停止会收掉 DWM helper 和指针中继，即使原生窗口确认失败', async () => {
  const runtime = Object.create(WallpaperEngineRuntime.prototype);
  const session = { sessionId: '0123456789abcdef01234567', launched: true, initialOpenPromise: null, stopping: false };
  const calls = [];
  runtime.pending = null;
  runtime.active = session;
  runtime.generation = 0;
  runtime.disposed = false;
  runtime._closeSession = async () => false;
  runtime._stopSessionPointerRelay = () => calls.push('pointer-relay');
  runtime._stopSessionDwmSurface = () => calls.push('dwm-helper');
  runtime._waitForSessionDwmSurfaceStop = async () => calls.push('wait-dwm');
  runtime._clearSessionMuteReassertions = () => calls.push('mute-reassertions');

  const result = await runtime.stop({ forceHelperCleanup: true });
  assert.equal(result.stopped, false);
  assert.equal(runtime.active, session);
  assert.equal(session.stopping, false);
  assert.deepEqual(calls, ['pointer-relay', 'dwm-helper', 'wait-dwm', 'mute-reassertions']);
});
