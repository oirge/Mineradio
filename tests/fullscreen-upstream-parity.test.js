'use strict';
// 全屏进入 / 退出与上游 XxHuberrr/Mineradio 对齐的部分。
// 这一轮补齐三件上游有、本仓库没有的东西：全屏期间的尺寸锁、进入全屏前的显示器夹回、
// 以及「全屏状态还在但窗口已经不可见」的可见性看门狗（那正是一整块黑屏的一个来源）。
// 测试按锚点把 desktop/main.js 的真实实现切进 node:vm，不复制第二份逻辑。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const MAIN_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');

/**
 * 按起止锚点截取主进程源码。锚点消失时立刻报错，提醒同步测试。
 * @param {string} startMarker 起始锚点。
 * @param {string} endMarker 结束锚点。
 * @returns {string} 源码片段。
 */
function slice(startMarker, endMarker) {
  const start = MAIN_SOURCE.indexOf(startMarker);
  const end = MAIN_SOURCE.indexOf(endMarker, start + 1);
  assert.ok(start >= 0 && end > start, `未找到源码块: ${startMarker}`);
  return MAIN_SOURCE.slice(start, end);
}

/**
 * 造一个可控的 setInterval 台面，记录周期并允许手工打点。
 * @returns {{setInterval: Function, clearInterval: Function, jobs: Array, cleared: Array}} 定时器台面。
 */
function createIntervalBench() {
  const jobs = [];
  const cleared = [];
  return {
    jobs,
    cleared,
    setInterval(fn, period) {
      const token = { fn, period, unrefed: false, unref() { this.unrefed = true; return this; } };
      jobs.push(token);
      return token;
    },
    clearInterval(token) { cleared.push(token); },
  };
}

/**
 * 在隔离 VM 里跑真实的全屏可见性看门狗实现。
 * @param {object} [overrides] 覆盖 VM 作用域里的变量，例如 appQuitting。
 * @returns {object} 探针、假窗口、定时器台面与调用记录。
 */
function createVisibilityHarness(overrides) {
  const bench = createIntervalBench();
  const logs = [];
  const calls = { showInactive: 0, show: 0, windowState: 0 };
  const win = {
    destroyed: false,
    fullscreen: true,
    minimized: false,
    visible: false,
    showInactiveThrows: false,
    isDestroyed() { return this.destroyed; },
    isFullScreen() { return this.fullscreen; },
    isMinimized() { return this.minimized; },
    isVisible() { return this.visible; },
    showInactive() {
      if (this.showInactiveThrows) throw new Error('showInactive 炸了');
      calls.showInactive += 1;
      this.visible = true;
    },
    show() { calls.show += 1; this.visible = true; },
  };
  const ctx = Object.assign({
    console: { warn: (...args) => logs.push(args.join(' ')) },
    setInterval: bench.setInterval,
    clearInterval: bench.clearInterval,
    appQuitting: false,
    mainWindowIntentionalHide: false,
    mainWindowFullscreenVisibilityTimer: null,
    sendWindowState() { calls.windowState += 1; },
  }, overrides || {});
  vm.createContext(ctx);
  vm.runInContext(`${slice('const FULLSCREEN_VISIBILITY_CHECK_MS', '// 主窗口绘制恢复。')}
globalThis.__probe = {
  period: FULLSCREEN_VISIBILITY_CHECK_MS,
  clear: clearMainWindowFullscreenVisibilityGuard,
  should: shouldRestoreUnexpectedFullscreenVisibility,
  restore: restoreUnexpectedFullscreenVisibility,
  start: startMainWindowFullscreenVisibilityGuard,
  get timer() { return mainWindowFullscreenVisibilityTimer; },
};`, ctx);
  return { api: ctx.__probe, ctx, bench, logs, calls, win };
}

/**
 * 单独跑尺寸锁实现，记录每次 setResizable 的入参。
 * @param {boolean|undefined} resizable 假窗口当前的可调整状态。
 * @returns {object} 探针与调用记录。
 */
function createResizeGuardHarness(resizable) {
  const logs = [];
  const applied = [];
  const win = {
    resizable,
    throws: false,
    isDestroyed: () => false,
    isResizable() { return this.resizable; },
    setResizable(next) {
      if (this.throws) throw new Error('setResizable 炸了');
      applied.push(next);
      this.resizable = next;
    },
  };
  const ctx = { console: { warn: (...args) => logs.push(args.join(' ')) } };
  vm.createContext(ctx);
  vm.runInContext(`${slice('function setMainWindowFullscreenResizeGuard(', 'function applyWindowedBounds(')}
globalThis.__guard = setMainWindowFullscreenResizeGuard;`, ctx);
  return { guard: ctx.__guard, win, applied, logs };
}

test('全屏期间锁住尺寸，退出全屏时放开', () => {
  const lock = createResizeGuardHarness(true);
  lock.guard(lock.win, true);
  assert.deepEqual(lock.applied, [false]);

  const unlock = createResizeGuardHarness(false);
  unlock.guard(unlock.win, false);
  assert.deepEqual(unlock.applied, [true]);
});

test('状态已经对了就不再调用原生 API，销毁的窗口直接跳过', () => {
  const already = createResizeGuardHarness(false);
  already.guard(already.win, true);
  assert.deepEqual(already.applied, [], '重复下发 setResizable 会白白触发一次窗口样式重算');

  const gone = createResizeGuardHarness(true);
  gone.win.isDestroyed = () => true;
  gone.guard(gone.win, true);
  assert.deepEqual(gone.applied, []);
  gone.guard(null, true);
  gone.guard(undefined, false);
});

test('setResizable 抛异常时吞掉并按方向记一行日志', () => {
  const h = createResizeGuardHarness(true);
  h.win.throws = true;
  h.guard(h.win, true);
  assert.equal(h.logs.length, 1);
  assert.match(h.logs[0], /WindowResizeGuard.*fullscreen-lock/);

  const back = createResizeGuardHarness(false);
  back.win.throws = true;
  back.guard(back.win, false);
  assert.match(back.logs[0], /WindowResizeGuard.*windowed-restore/);
});

test('老版本 Electron 没有 isResizable 时直接下发', () => {
  const h = createResizeGuardHarness(true);
  h.win.isResizable = undefined;
  h.guard(h.win, true);
  assert.deepEqual(h.applied, [false]);
});

test('全屏还在但窗口不可见才算异常，其它状态一概不抢前台', () => {
  const h = createVisibilityHarness();
  assert.equal(h.api.should(h.win), true);

  h.win.visible = true;
  assert.equal(h.api.should(h.win), false, '窗口本来就看得见');
  h.win.visible = false;

  h.win.minimized = true;
  assert.equal(h.api.should(h.win), false, '用户自己最小化的不算异常');
  h.win.minimized = false;

  h.win.fullscreen = false;
  assert.equal(h.api.should(h.win), false, '普通窗口态的隐藏不在看门狗职责内');
  h.win.fullscreen = true;

  h.win.destroyed = true;
  assert.equal(h.api.should(h.win), false);
  h.win.destroyed = false;

  assert.equal(h.api.should(null), false);
  assert.equal(h.api.should(undefined), false);
});

test('退出中或用户主动收进托盘时看门狗不动手', () => {
  const quitting = createVisibilityHarness({ appQuitting: true });
  assert.equal(quitting.api.should(quitting.win), false);
  assert.equal(quitting.api.restore(quitting.win, 'x'), false);
  assert.equal(quitting.calls.showInactive, 0);

  const trayed = createVisibilityHarness({ mainWindowIntentionalHide: true });
  assert.equal(trayed.api.should(trayed.win), false);
  assert.equal(trayed.api.restore(trayed.win, 'x'), false);
  assert.equal(trayed.calls.showInactive, 0);
});

test('恢复用 showInactive，不抢焦点；抛异常时回落到 show', () => {
  const h = createVisibilityHarness();
  assert.equal(h.api.restore(h.win, 'system-resume'), true);
  assert.equal(h.calls.showInactive, 1);
  assert.equal(h.calls.show, 0, 'show() 会把窗口抢到前台并夺走焦点');
  assert.equal(h.calls.windowState, 1);
  assert.equal(h.logs.length, 1);
  assert.match(h.logs[0], /WindowRecovery.*system-resume/);

  const fallback = createVisibilityHarness();
  fallback.win.showInactiveThrows = true;
  assert.equal(fallback.api.restore(fallback.win), true);
  assert.equal(fallback.calls.showInactive, 0);
  assert.equal(fallback.calls.show, 1);
});

test('看门狗按 5 秒周期打点，且 unref 过不吊住进程退出', () => {
  const h = createVisibilityHarness();
  assert.equal(h.api.period, 5000);

  h.api.start(h.win);
  assert.equal(h.bench.jobs.length, 1);
  assert.equal(h.bench.jobs[0].period, 5000);
  assert.equal(h.bench.jobs[0].unrefed, true);

  h.bench.jobs[0].fn();
  assert.equal(h.calls.showInactive, 1);
  assert.match(h.logs[0], /fullscreen-watchdog/);
});

test('重复启动只留最后一只，清理会把定时器槽复位', () => {
  const h = createVisibilityHarness();
  h.api.start(h.win);
  const first = h.api.timer;
  h.api.start(h.win);
  assert.deepEqual(h.bench.cleared, [first], '旧的看门狗必须先停掉');
  assert.notEqual(h.api.timer, first);

  const second = h.api.timer;
  h.api.clear();
  assert.deepEqual(h.bench.cleared, [first, second]);
  assert.equal(h.api.timer, null);

  // 没有在跑的时候清理是安全的，也不会误调 clearInterval。
  h.api.clear();
  assert.equal(h.bench.cleared.length, 2);

  // 窗口已经销毁时不布置看门狗，但仍然会先停掉旧的。
  h.api.start(h.win);
  const third = h.api.timer;
  h.win.destroyed = true;
  h.api.start(h.win);
  assert.deepEqual(h.bench.cleared, [first, second, third]);
  assert.equal(h.api.timer, null);
});

// 下面几条盯的是接线：实现写得再对，没挂到全屏事件上也救不了黑屏。
test('四个全屏事件都带上尺寸锁，进入原生全屏时启动看门狗', () => {
  const enter = slice("mainWindow.on('enter-full-screen'", '});');
  assert.match(enter, /setMainWindowFullscreenResizeGuard\(mainWindow, true\);/);
  assert.match(enter, /startMainWindowFullscreenVisibilityGuard\(mainWindow\);/);

  const leave = slice("mainWindow.on('leave-full-screen'", '});');
  assert.match(leave, /setMainWindowFullscreenResizeGuard\(mainWindow, false\);/);
  assert.match(leave, /clearMainWindowFullscreenVisibilityGuard\(\);/);

  const enterHtml = slice("mainWindow.on('enter-html-full-screen'", '});');
  assert.match(enterHtml, /setMainWindowFullscreenResizeGuard\(mainWindow, true\);/);

  const leaveHtml = slice("mainWindow.on('leave-html-full-screen'", '});');
  assert.match(leaveHtml, /setMainWindowFullscreenResizeGuard\(mainWindow, false\);/);
});

test('窗口关闭、重建窗口时看门狗都会被停掉', () => {
  const closed = slice("mainWindow.on('closed'", 'mainWindow = null;');
  assert.match(closed, /clearMainWindowFullscreenVisibilityGuard\(\);/);

  const created = slice('async function createWindow()', 'const preferredPort');
  assert.match(created, /mainWindowIntentionalHide = false;/);
  assert.match(created, /clearMainWindowFullscreenVisibilityGuard\(\);/);
});

test('收进托盘算主动隐藏，重新显示时解除标记', () => {
  const closing = slice('const canKeepRunning =', 'miniPlayerActive = false;');
  assert.match(closing, /mainWindowIntentionalHide = true;/);
  assert.match(closing, /clearMainWindowFullscreenVisibilityGuard\(\);/);

  const focus = slice('function focusMainWindow()', '\n}');
  assert.match(focus, /mainWindowIntentionalHide = false;/);
});

test('睡眠回来和解锁屏幕都补一次全屏可见性恢复', () => {
  assert.match(
    MAIN_SOURCE,
    /powerMonitor\.on\('resume', \(\) => restoreUnexpectedFullscreenVisibility\(mainWindow, 'system-resume'\)\)/,
  );
  assert.match(
    MAIN_SOURCE,
    /powerMonitor\.on\('unlock-screen', \(\) => restoreUnexpectedFullscreenVisibility\(mainWindow, 'screen-unlock'\)\)/,
  );
});
