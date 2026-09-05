'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 读取主进程源码，供回归测试直接验证真实窗口控制逻辑。
 * @returns {string} 主进程 JavaScript 源码。
 */
function readMainSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
}

/**
 * 从主进程源码截取相邻的真实函数，避免测试复制另一份实现。
 * @param {string} source 主进程源码。
 * @param {string} name 要截取的函数名。
 * @param {string} nextName 下一个函数名，用于确定截取终点。
 * @returns {string} 函数源码片段。
 */
function extractFunction(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start + 1);
  assert.ok(start >= 0 && end > start, `未找到主进程函数：${name}`);
  return source.slice(start, end);
}

/**
 * 创建透明窗口进入全屏后仍会出现的测试边界。
 * @returns {{bounds: object, display: object, calls: object, win: object}} 测试窗口和调用记录。
 */
function createTransparentFullscreenWindow() {
  const bounds = { x: 0, y: 0, width: 1920, height: 1080 };
  const display = {
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1032 },
  };
  const calls = { setMinimumSize: 0, setBounds: 0, setFullScreen: [] };
  const win = {
    isDestroyed: () => false,
    isFullScreen: () => false,
    isMaximized: () => false,
    getBounds: () => bounds,
    setMinimumSize: () => { calls.setMinimumSize += 1; },
    setBounds: () => { calls.setBounds += 1; },
    setFullScreen: (flag) => { calls.setFullScreen.push(flag); },
    once: () => {},
  };
  return { bounds, display, calls, win };
}

test('透明窗口的逻辑全屏状态会阻止显示器边界校正缩回窗口', () => {
  const source = readMainSource();
  const context = createTransparentFullscreenWindow();
  const scope = {
    screen: {
      getDisplayMatching: () => context.display,
      getPrimaryDisplay: () => context.display,
    },
    displayWorkArea: (display) => display.workArea,
    windowedMinimumSize: () => ({ width: 960, height: 540 }),
    getWindowedBounds: () => ({ x: 480, y: 246, width: 960, height: 540 }),
    windowFullscreenActive: true,
    htmlFullscreenActive: false,
    console,
  };
  vm.runInNewContext(
    extractFunction(source, 'keepMainWindowInsideDisplay', 'exitFullscreenToWindow')
      + '\nthis.keep = keepMainWindowInsideDisplay;',
    scope,
  );

  // 透明窗口在 Electron 43 上 isFullScreen() 仍可能为 false，但边界已经覆盖整块显示器。
  scope.keep(context.win);

  assert.equal(context.calls.setBounds, 0);
});

test('HTML 全屏状态会阻止显示器边界校正缩回窗口', () => {
  const source = readMainSource();
  const context = createTransparentFullscreenWindow();
  const scope = {
    screen: {
      getDisplayMatching: () => context.display,
      getPrimaryDisplay: () => context.display,
    },
    displayWorkArea: (display) => display.workArea,
    windowedMinimumSize: () => ({ width: 960, height: 540 }),
    getWindowedBounds: () => ({ x: 480, y: 246, width: 960, height: 540 }),
    windowFullscreenActive: false,
    htmlFullscreenActive: true,
    console,
  };
  vm.runInNewContext(
    extractFunction(source, 'keepMainWindowInsideDisplay', 'exitFullscreenToWindow')
      + '\nthis.keep = keepMainWindowInsideDisplay;',
    scope,
  );

  // HTML 全屏同样可能触发覆盖显示器边界的 move 事件，不能按工作区尺寸缩回。
  scope.keep(context.win);

  assert.equal(context.calls.setBounds, 0);
});

test('普通超大窗口仍会被校正到当前显示器工作区', () => {
  const source = readMainSource();
  const context = createTransparentFullscreenWindow();
  const scope = {
    screen: {
      getDisplayMatching: () => context.display,
      getPrimaryDisplay: () => context.display,
    },
    displayWorkArea: (display) => display.workArea,
    windowedMinimumSize: () => ({ width: 960, height: 540 }),
    getWindowedBounds: () => ({ x: 480, y: 246, width: 960, height: 540 }),
    windowFullscreenActive: false,
    htmlFullscreenActive: false,
    console,
  };
  vm.runInNewContext(
    extractFunction(source, 'keepMainWindowInsideDisplay', 'exitFullscreenToWindow')
      + '\nthis.keep = keepMainWindowInsideDisplay;',
    scope,
  );

  scope.keep(context.win);

  assert.equal(context.calls.setMinimumSize, 1);
  assert.equal(context.calls.setBounds, 1);
});

test('副屏工作区越界时夹回窗口位置而不强制居中', () => {
  const source = readMainSource();
  const bounds = { x: -140, y: 80, width: 960, height: 540 };
  const display = {
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1032 },
  };
  const applied = [];
  const win = {
    isDestroyed: () => false,
    isFullScreen: () => false,
    isMaximized: () => false,
    getBounds: () => ({ ...bounds }),
    setMinimumSize: () => {},
    setBounds: (next) => applied.push({ ...next }),
  };
  const scope = {
    screen: {
      getDisplayMatching: () => display,
      getPrimaryDisplay: () => display,
    },
    displayWorkArea: (value) => value.workArea,
    windowedMinimumSize: () => ({ width: 960, height: 540 }),
    getWindowedBounds: () => ({ x: 480, y: 246, width: 960, height: 540 }),
    windowFullscreenActive: false,
    htmlFullscreenActive: false,
  };
  vm.runInNewContext(
    extractFunction(source, 'keepMainWindowInsideDisplay', 'exitFullscreenToWindow')
      + '\nthis.keep = keepMainWindowInsideDisplay;',
    scope,
  );

  scope.keep(win);

  assert.deepEqual(applied, [{ x: 0, y: 80, width: 960, height: 540 }]);
});

test('主窗口拖动结束时允许窗口部分越出工作区，不再夹回跳位', () => {
  const source = readMainSource();
  const display = {
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1032 },
  };
  const applied = [];
  const win = {
    isDestroyed: () => false,
    isFullScreen: () => false,
    isMaximized: () => false,
    getBounds: () => ({ x: 480, y: 560, width: 960, height: 540 }),
    setMinimumSize: () => {},
    setBounds: (next) => applied.push({ ...next }),
  };
  const scope = {
    screen: {
      getDisplayMatching: () => display,
      getPrimaryDisplay: () => display,
    },
    displayWorkArea: (value) => value.workArea,
    windowedMinimumSize: () => ({ width: 960, height: 540 }),
    getWindowedBounds: () => ({ x: 480, y: 246, width: 960, height: 540 }),
    windowFullscreenActive: false,
    htmlFullscreenActive: false,
  };
  vm.runInNewContext(
    extractFunction(source, 'boundsHasReachableArea', 'windowedMinimumSize')
      + extractFunction(source, 'keepMainWindowInsideDisplay', 'exitFullscreenToWindow')
      + '\nthis.keep = keepMainWindowInsideDisplay;',
    scope,
  );

  // 底部 32px 压到任务栏上方工作区之外，仍有足够可见面积：松手后不得 setBounds。
  scope.keep(win, { allowPartial: true });
  assert.deepEqual(applied, []);

  // 相同越界量但未开启宽容模式（显示器参数变化路径）仍会夹回。
  scope.keep(win, {});
  assert.deepEqual(applied, [{ x: 480, y: 492, width: 960, height: 540 }]);
});

test('主窗口拖动结束时几乎完全不可见仍会夹回可见区域', () => {
  const source = readMainSource();
  const display = {
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1032 },
  };
  const applied = [];
  const win = {
    isDestroyed: () => false,
    isFullScreen: () => false,
    isMaximized: () => false,
    getBounds: () => ({ x: 2000, y: 1200, width: 960, height: 540 }),
    setMinimumSize: () => {},
    setBounds: (next) => applied.push({ ...next }),
  };
  const scope = {
    screen: {
      getDisplayMatching: () => display,
      getPrimaryDisplay: () => display,
    },
    displayWorkArea: (value) => value.workArea,
    windowedMinimumSize: () => ({ width: 960, height: 540 }),
    getWindowedBounds: () => ({ x: 480, y: 246, width: 960, height: 540 }),
    windowFullscreenActive: false,
    htmlFullscreenActive: false,
  };
  vm.runInNewContext(
    extractFunction(source, 'boundsHasReachableArea', 'windowedMinimumSize')
      + extractFunction(source, 'keepMainWindowInsideDisplay', 'exitFullscreenToWindow')
      + '\nthis.keep = keepMainWindowInsideDisplay;',
    scope,
  );

  scope.keep(win, { allowPartial: true });

  assert.deepEqual(applied, [{ x: 960, y: 492, width: 960, height: 540 }]);
});

test('主窗口拖动结束时超大窗口仍会按工作区缩放校正', () => {
  const source = readMainSource();
  const context = createTransparentFullscreenWindow();
  const scope = {
    screen: {
      getDisplayMatching: () => context.display,
      getPrimaryDisplay: () => context.display,
    },
    displayWorkArea: (value) => value.workArea,
    windowedMinimumSize: () => ({ width: 960, height: 540 }),
    getWindowedBounds: () => ({ x: 480, y: 246, width: 960, height: 540 }),
    windowFullscreenActive: false,
    htmlFullscreenActive: false,
    console,
  };
  vm.runInNewContext(
    extractFunction(source, 'boundsHasReachableArea', 'windowedMinimumSize')
      + extractFunction(source, 'keepMainWindowInsideDisplay', 'exitFullscreenToWindow')
      + '\nthis.keep = keepMainWindowInsideDisplay;',
    scope,
  );

  scope.keep(context.win, { allowPartial: true });

  assert.equal(context.calls.setMinimumSize, 1);
  assert.equal(context.calls.setBounds, 1);
});

test('显示器参数变化与拔出显示器仍执行全量纠偏', () => {
  const source = readMainSource();
  const metricsHandler = source.match(/screen\.on\('display-metrics-changed', \(\) => \{([\s\S]*?)\n    \}\);/);
  const addedHandler = source.match(/screen\.on\('display-added', \(\) => \{([\s\S]*?)\n    \}\);/);
  const removedHandler = source.match(/screen\.on\('display-removed', \(\) => \{([\s\S]*?)\n    \}\);/);
  assert.ok(metricsHandler, '缺少 display-metrics-changed 事件');
  assert.ok(addedHandler, '缺少 display-added 事件');
  assert.ok(removedHandler, '缺少 display-removed 事件');
  assert.match(metricsHandler[1], /keepMainWindowInsideDisplay\(mainWindow\)/);
  assert.match(addedHandler[1], /keepMainWindowInsideDisplay\(mainWindow\)/);
  assert.match(removedHandler[1], /keepMainWindowInsideDisplay\(mainWindow\)/);
});

test('主窗口拖动由原生消息和 Electron 事件共同守护，拖动路径不重设边界', () => {
  const source = readMainSource();
  const willMoveHandler = source.match(/mainWindow\.on\('will-move', \(\) => \{([\s\S]*?)\n  \}\);/);
  const moveHandler = source.match(/mainWindow\.on\('move', \(\) => \{([\s\S]*?)\n  \}\);/);
  const movedHandler = source.match(/mainWindow\.on\('moved', \(\) => \{([\s\S]*?)\n  \}\);/);

  assert.ok(willMoveHandler, '缺少主窗口 will-move 事件');
  assert.ok(moveHandler, '缺少主窗口 move 事件');
  assert.ok(movedHandler, '缺少主窗口 moved 事件');
  assert.match(willMoveHandler[1], /beginMainWindowUserMove\(\)/);
  assert.doesNotMatch(moveHandler[1], /keepMainWindowInsideDisplay/);
  assert.match(moveHandler[1], /beginMainWindowUserMove\(\)/);
  assert.match(moveHandler[1], /scheduleWindowStateSend\(mainWindow\)/);
  assert.doesNotMatch(movedHandler[1], /keepMainWindowInsideDisplay/);
  assert.match(movedHandler[1], /scheduleMainWindowMoveRelease\(\)/);
  assert.match(movedHandler[1], /scheduleWindowStateSend\(mainWindow\)/);
  assert.match(source, /installMainWindowNativeMoveGuard\(mainWindow\)/);
});

test('主窗口拖动期间桌面歌词强制穿透并在结束后延迟恢复', () => {
  const source = readMainSource();
  const ignoredStates = [];
  const mouseScope = {
    desktopLyricsWindow: {
      isDestroyed: () => false,
      setIgnoreMouseEvents: (ignored, options) => ignoredStates.push({ ignored, options }),
    },
    desktopLyricsStateCache: { value: { clickThrough: false } },
    desktopLyricsPointerCapture: true,
    desktopLyricsMouseIgnored: null,
    desktopLyricsMouseForwarded: null,
    mainWindowMoveActive: true,
  };
  vm.runInNewContext(
    extractFunction(source, 'applyDesktopLyricsMouseBehavior', 'clearMainWindowMoveReleaseTimer')
      + '\nthis.applyMouseBehavior = applyDesktopLyricsMouseBehavior;',
    mouseScope,
  );

  mouseScope.applyMouseBehavior();
  assert.equal(ignoredStates.length, 1);
  assert.equal(ignoredStates[0].ignored, true);
  assert.equal(ignoredStates[0].options.forward, false);
  mouseScope.mainWindowMoveActive = false;
  mouseScope.desktopLyricsMouseIgnored = null;
  mouseScope.desktopLyricsMouseForwarded = null;
  mouseScope.applyMouseBehavior();
  assert.equal(ignoredStates[1].ignored, false);
  assert.equal(ignoredStates[1].options, undefined);

  const timers = [];
  const moveStates = [];
  const moveScope = {
    mainWindowMoveActive: false,
    mainWindowMoveReleaseTimer: null,
    desktopLyricsPointerCapture: true,
    MAIN_WINDOW_MOVE_RELEASE_DELAY_MS: 160,
    clearTimeout: (id) => {
      if (timers[id - 1]) timers[id - 1].cleared = true;
    },
    setTimeout: (handler, delay) => {
      timers.push({ handler, delay, cleared: false });
      return timers.length;
    },
    applyDesktopLyricsMouseBehavior: () => moveStates.push(moveScope.mainWindowMoveActive),
  };
  vm.runInNewContext(
    extractFunction(source, 'clearMainWindowMoveReleaseTimer', 'desktopLyricsHotBoundsOnScreen')
      + '\nthis.beginMove = beginMainWindowUserMove;'
      + '\nthis.scheduleRelease = scheduleMainWindowMoveRelease;',
    moveScope,
  );

  moveScope.beginMove();
  assert.equal(moveScope.mainWindowMoveActive, true);
  assert.equal(moveScope.desktopLyricsPointerCapture, false);
  assert.deepEqual(moveStates, [true]);
  moveScope.scheduleRelease();
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 160);
  assert.equal(moveScope.mainWindowMoveActive, true);
  timers[0].handler();
  assert.equal(moveScope.mainWindowMoveActive, false);
  assert.deepEqual(moveStates, [true, false]);
});

test('Windows 原生移动循环在跨窗口前切换桌面歌词穿透', () => {
  const source = readMainSource();
  const hooks = new Map();
  const calls = [];
  const win = {
    isDestroyed: () => false,
    hookWindowMessage: (message, handler) => hooks.set(message, handler),
  };
  const scope = {
    process: { platform: 'win32' },
    WM_ENTERSIZEMOVE: 0x0231,
    WM_EXITSIZEMOVE: 0x0232,
    mainWindow: win,
    beginMainWindowUserMove: () => calls.push('begin'),
    scheduleMainWindowMoveRelease: () => calls.push('release'),
    scheduleWindowStateSend: (target) => calls.push(target === win ? 'state' : 'wrong-window'),
    console,
  };
  vm.runInNewContext(
    extractFunction(source, 'installMainWindowNativeMoveGuard', 'desktopLyricsHotBoundsOnScreen')
      + '\nthis.installGuard = installMainWindowNativeMoveGuard;',
    scope,
  );

  scope.installGuard(win);

  assert.equal(hooks.size, 2);
  hooks.get(0x0231)();
  hooks.get(0x0232)();
  assert.deepEqual(calls, ['begin', 'release', 'state']);
});

test('只有逻辑全屏标记时按上游走边界还原，不再空调一次原生退出', () => {
  const source = readMainSource();
  const context = createTransparentFullscreenWindow();
  const timers = [];
  const events = {};
  context.win.once = (name, handler) => { events[name] = handler; };
  const scope = {
    windowFullscreenActive: true,
    htmlFullscreenActive: false,
    setMainWindowFullscreenResizeGuard: () => {},
    applyWindowedBounds: () => { context.calls.setBounds += 1; },
    sendWindowState: () => {},
    setTimeout: (handler) => { timers.push(handler); return timers.length; },
    console,
  };
  vm.runInNewContext(
    extractFunction(source, 'exitFullscreenToWindow', 'toggleFullscreen')
      + '\nthis.exit = exitFullscreenToWindow;',
    scope,
  );

  // 上游 exitFullscreenToWindow 只看 isFullScreen()：原生全屏没生效时直接还原边界。
  scope.exit(context.win);

  assert.deepEqual(context.calls.setFullScreen, []);
  assert.equal(scope.windowFullscreenActive, false);
  assert.equal(context.calls.setBounds, 1);
  assert.equal(events['leave-full-screen'], undefined);
  assert.equal(timers.length, 0);
});

test('退出原生全屏只调一次原生 API，不再补第二次延迟还原', () => {
  const source = readMainSource();
  const context = createTransparentFullscreenWindow();
  const guard = [];
  const timers = [];
  const events = {};
  context.win.isFullScreen = () => true;
  context.win.once = (name, handler) => { events[name] = handler; };
  const scope = {
    windowFullscreenActive: true,
    htmlFullscreenActive: false,
    setMainWindowFullscreenResizeGuard: (_win, fullscreen) => guard.push(fullscreen),
    applyWindowedBounds: () => { context.calls.setBounds += 1; },
    sendWindowState: () => {},
    setTimeout: (handler) => { timers.push(handler); return timers.length; },
    console,
  };
  vm.runInNewContext(
    extractFunction(source, 'exitFullscreenToWindow', 'toggleFullscreen')
      + '\nthis.exit = exitFullscreenToWindow;',
    scope,
  );

  scope.exit(context.win);

  assert.deepEqual(context.calls.setFullScreen, [false]);
  assert.equal(scope.windowFullscreenActive, false);
  assert.deepEqual(guard, [false], '退出前必须先放开尺寸锁');
  // 权威的 leave-full-screen 事件负责还原边界；这里再补一次会变成 move/resize 风暴。
  assert.equal(events['leave-full-screen'], undefined);
  assert.equal(timers.length, 0);
  assert.equal(context.calls.setBounds, 0);
});

test('进入全屏前先把窗口夹回显示器，再锁住尺寸', () => {
  const source = readMainSource();
  const context = createTransparentFullscreenWindow();
  const order = [];
  const scope = {
    windowFullscreenActive: false,
    htmlFullscreenActive: false,
    keepMainWindowInsideDisplay: () => order.push('clamp'),
    setMainWindowFullscreenResizeGuard: (_win, fullscreen) => order.push(fullscreen ? 'lock' : 'unlock'),
    exitFullscreenToWindow: () => order.push('exit'),
    sendWindowState: () => order.push('state'),
    console,
  };
  vm.runInNewContext(
    extractFunction(source, 'toggleFullscreen', 'shouldExitWindowFullscreenFromInput')
      + '\nthis.toggle = toggleFullscreen;',
    scope,
  );

  scope.toggle(context.win);

  // 夹回必须发生在置位全屏标记之前，否则 keepMainWindowInsideDisplay 会因为标记直接返回。
  assert.deepEqual(order, ['clamp', 'lock', 'state']);
  assert.equal(scope.windowFullscreenActive, true);
  assert.deepEqual(context.calls.setFullScreen, [true]);
});

test('Esc 会退出透明窗口的逻辑全屏状态', () => {
  const source = readMainSource();
  const scope = {
    htmlFullscreenActive: false,
    windowFullscreenActive: true,
  };
  vm.runInNewContext(
    extractFunction(source, 'shouldExitWindowFullscreenFromInput', 'overlayUrl')
      + '\nthis.shouldExit = shouldExitWindowFullscreenFromInput;',
    scope,
  );

  assert.equal(scope.shouldExit({ type: 'keyDown', key: 'Escape', code: 'Escape' }, {
    isFullScreen: () => false,
  }), true);
  assert.match(source, /if \(shouldExitWindowFullscreenFromInput\(input, mainWindow\)\)/);
});

test('HTML 全屏时 Esc 交给 Chromium 处理', () => {
  const source = readMainSource();
  const scope = {
    htmlFullscreenActive: true,
    windowFullscreenActive: true,
  };
  vm.runInNewContext(
    extractFunction(source, 'shouldExitWindowFullscreenFromInput', 'overlayUrl')
      + '\nthis.shouldExit = shouldExitWindowFullscreenFromInput;',
    scope,
  );

  assert.equal(scope.shouldExit({ type: 'keyDown', key: 'Escape', code: 'Escape' }, {
    isFullScreen: () => false,
  }), false);
});
