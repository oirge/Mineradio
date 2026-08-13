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

test('透明窗口退出逻辑全屏时仍调用原生退出 API', () => {
  const source = readMainSource();
  const context = createTransparentFullscreenWindow();
  const timers = [];
  const events = {};
  context.win.once = (name, handler) => { events[name] = handler; };
  const scope = {
    windowFullscreenActive: true,
    htmlFullscreenActive: false,
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
  assert.equal(typeof events['leave-full-screen'], 'function');
  assert.equal(timers.length, 1);

  events['leave-full-screen']();
  assert.equal(timers.length, 2);
  timers.forEach((handler) => handler());
  assert.equal(context.calls.setBounds, 1);
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
