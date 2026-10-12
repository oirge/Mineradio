'use strict';
// 主窗口绘制恢复。迷你播放器很早就有 did-fail-load / render-process-gone 兜底，主窗口一直没有：
// 主渲染进程一崩，`transparent: true` 的无边框主窗口就只剩一片全黑，而且永远不会自己回来。
// 这条测试直接跑 desktop/main.js 里的真实实现（按锚点切片进 node:vm），钉住：
// 单航班调度、退避、上限后停手、加载成功清零、睡眠回来只重画不重载、销毁时清干净定时器。

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const MAIN_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');

/**
 * 截取主窗口绘制恢复实现。锚点是常量声明与 createWindow 的函数头，
 * 拆分或改名这几个函数时这里会立刻报错，提醒同步锚点。
 * @returns {string} 可在隔离 VM 中执行的恢复实现源码。
 */
function extractRecoveryCore() {
  const start = MAIN_SOURCE.indexOf('const MAIN_WINDOW_SHOW_WATCHDOG_MS');
  const end = MAIN_SOURCE.indexOf('async function createWindow(', start);
  assert.ok(start >= 0 && end > start, '未找到主窗口绘制恢复接缝');
  return MAIN_SOURCE.slice(start, end);
}

/**
 * 造一个可控的定时器台面，记录每次调度的延迟并允许手工触发。
 * @returns {{setTimeout: Function, clearTimeout: Function, jobs: Array, runAll: Function, cleared: number[]}} 定时器台面。
 */
function createTimerBench() {
  const jobs = [];
  const cleared = [];
  let nextId = 1;
  return {
    jobs,
    cleared,
    setTimeout(fn, delay) {
      const token = { id: nextId++, fn, delay, unref() { this.unrefed = true; return this; } };
      jobs.push(token);
      return token;
    },
    clearTimeout(token) {
      if (token && token.id) cleared.push(token.id);
      const index = jobs.indexOf(token);
      if (index >= 0) jobs.splice(index, 1);
    },
    runAll() {
      const pending = jobs.splice(0, jobs.length);
      for (const job of pending) job.fn();
      return pending.length;
    },
  };
}

// 切片里的常量与计数器都是 script 作用域的 let/const，不会挂到 VM 的全局对象上。
// 追一段尾巴把它们暴露出来（计数器用 getter，读到的始终是当前值），
// 顺便提供 resetFailureCount() 模拟 did-finish-load 成功后清零的那一步。
const PROBE_EPILOGUE = `
globalThis.__probe = {
  showWatchdogMs: MAIN_WINDOW_SHOW_WATCHDOG_MS,
  recoveryLimit: MAIN_WINDOW_PAINT_RECOVERY_LIMIT,
  clearMainWindowShowWatchdog,
  armMainWindowShowWatchdog,
  nudgeMainWindowRepaint,
  scheduleMainWindowPaintRecovery,
  get failureCount() { return mainWindowPaintFailureCount; },
  get recoveryTimer() { return mainWindowPaintRecoveryTimer; },
  get watchdogTimer() { return mainWindowShowWatchdogTimer; },
  resetFailureCount() { mainWindowPaintFailureCount = 0; },
};
`;

/**
 * 在隔离 VM 里跑一份主窗口恢复实现，并配好可观测的假窗口与假定时器。
 * @param {{port?: number}} [options] 假的服务端口等可选覆盖。
 * @returns {object} 探针、假窗口、定时器台面与调用记录。
 */
function createRecoveryHarness(options) {
  const opts = options || {};
  const timers = createTimerBench();
  const logs = { log: [], warn: [] };
  const calls = { invalidate: 0, reload: 0, show: 0, windowState: 0, loadURL: [] };
  const contents = {
    destroyed: false,
    reloadThrows: false,
    loadThrows: false,
    isDestroyed() { return this.destroyed; },
    invalidate() {
      calls.invalidate += 1;
      if (this.invalidateThrows) throw new Error('invalidate 炸了');
    },
    reload() {
      calls.reload += 1;
      if (this.reloadThrows) throw new Error('reload 炸了');
    },
    loadURL(url) {
      calls.loadURL.push(url);
      if (this.loadThrows) throw new Error('loadURL 也炸了');
    },
  };
  const win = {
    destroyed: false,
    visible: false,
    webContents: contents,
    isDestroyed() { return this.destroyed; },
    isVisible() { return this.visible; },
    show() { calls.show += 1; this.visible = true; },
  };
  const ctx = {
    console: {
      log: (...args) => logs.log.push(args.join(' ')),
      warn: (...args) => logs.warn.push(args.join(' ')),
    },
    setTimeout: timers.setTimeout,
    clearTimeout: timers.clearTimeout,
    appQuitting: false,
    gpuGuardRelaunching: false,
    mainWindow: win,
    mainServerPort: opts.port || 26001,
    sendWindowState() { calls.windowState += 1; },
  };
  vm.createContext(ctx);
  vm.runInContext(extractRecoveryCore() + PROBE_EPILOGUE, ctx);
  return { api: ctx.__probe, ctx, timers, logs, calls, win, contents };
}

test('ready-to-show 迟迟不来时看门狗兜底显示窗口', () => {
  const h = createRecoveryHarness();
  assert.equal(h.api.showWatchdogMs, 6000);
  h.api.armMainWindowShowWatchdog(h.win);
  assert.equal(h.timers.jobs.length, 1);
  assert.equal(h.timers.jobs[0].delay, 6000);
  // 不 unref 的话这个定时器会把进程按住 6 秒不退。
  assert.equal(h.timers.jobs[0].unrefed, true);

  h.timers.runAll();
  assert.equal(h.calls.show, 1, '窗口是 show:false 建的，事件不来就得兜底显示');
  assert.equal(h.calls.windowState, 1, '兜底显示后要把窗口状态同步给渲染层');
  assert.equal(h.api.watchdogTimer, null, '触发后要把句柄清掉，别留悬空引用');
});

test('ready-to-show 正常触发时撤掉看门狗，不会二次 show', () => {
  const h = createRecoveryHarness();
  h.api.armMainWindowShowWatchdog(h.win);
  h.api.clearMainWindowShowWatchdog();
  assert.equal(h.api.watchdogTimer, null);
  assert.equal(h.timers.cleared.length, 1);
  assert.equal(h.timers.runAll(), 0);
  assert.equal(h.calls.show, 0);
});

test('重复布置看门狗只留最后一只，旧的会被清掉', () => {
  const h = createRecoveryHarness();
  h.api.armMainWindowShowWatchdog(h.win);
  const first = h.timers.jobs[0];
  h.api.armMainWindowShowWatchdog(h.win);
  assert.equal(h.timers.jobs.length, 1, '不许攒出两只看门狗');
  assert.equal(h.timers.cleared.includes(first.id), true);
});

test('窗口已经可见、已被换掉或已销毁时看门狗不动手', () => {
  const visible = createRecoveryHarness();
  visible.win.visible = true;
  visible.api.armMainWindowShowWatchdog(visible.win);
  visible.timers.runAll();
  assert.equal(visible.calls.show, 0, '已经看得见了就别再 show 一次');

  const swapped = createRecoveryHarness();
  swapped.api.armMainWindowShowWatchdog(swapped.win);
  swapped.ctx.mainWindow = { isDestroyed: () => false };
  swapped.timers.runAll();
  assert.equal(swapped.calls.show, 0, '窗口已经换了一个，旧窗口不该被拉起来');

  const gone = createRecoveryHarness();
  gone.api.armMainWindowShowWatchdog(gone.win);
  gone.win.destroyed = true;
  gone.timers.runAll();
  assert.equal(gone.calls.show, 0);

  const quitting = createRecoveryHarness();
  quitting.api.armMainWindowShowWatchdog(quitting.win);
  quitting.ctx.appQuitting = true;
  quitting.timers.runAll();
  assert.equal(quitting.calls.show, 0, '正在退出还把窗口拉出来只会闪一下');
});

test('睡眠回来只重画一次，不重载页面', () => {
  const h = createRecoveryHarness();
  assert.equal(h.api.nudgeMainWindowRepaint('system-resume'), true);
  assert.equal(h.calls.invalidate, 1);
  // reload 会打断播放，重画不会 —— 这是这两条路径必须分开的唯一理由。
  assert.equal(h.calls.reload, 0);
  assert.equal(h.calls.loadURL.length, 0);
  assert.equal(h.logs.log.some((line) => line.includes('system-resume')), true);
});

test('窗口或 webContents 不在了就安静跳过重画', () => {
  const destroyedWin = createRecoveryHarness();
  destroyedWin.win.destroyed = true;
  assert.equal(destroyedWin.api.nudgeMainWindowRepaint('x'), false);
  assert.equal(destroyedWin.calls.invalidate, 0);

  const destroyedContents = createRecoveryHarness();
  destroyedContents.contents.destroyed = true;
  assert.equal(destroyedContents.api.nudgeMainWindowRepaint('x'), false);

  const noWindow = createRecoveryHarness();
  noWindow.ctx.mainWindow = null;
  assert.equal(noWindow.api.nudgeMainWindowRepaint('x'), false);

  const quitting = createRecoveryHarness();
  quitting.ctx.appQuitting = true;
  assert.equal(quitting.api.nudgeMainWindowRepaint('x'), false);
  assert.equal(quitting.calls.invalidate, 0);

  // invalidate 不是所有 Electron 版本都有，缺了要当作「不能重画」而不是抛异常。
  const legacy = createRecoveryHarness();
  delete legacy.contents.invalidate;
  assert.equal(legacy.api.nudgeMainWindowRepaint('x'), false);
});

test('重画本身抛异常时吞掉并记一行日志', () => {
  const h = createRecoveryHarness();
  h.contents.invalidateThrows = true;
  assert.equal(h.api.nudgeMainWindowRepaint('display-metrics-changed'), false);
  assert.equal(h.calls.invalidate, 1);
  assert.equal(h.logs.warn.some((line) => line.includes('重画失败')), true);
});

test('恢复调度是单航班的，同一轮里第二次调用不再排队', () => {
  const h = createRecoveryHarness();
  assert.equal(h.api.scheduleMainWindowPaintRecovery(h.win, 'render-process-gone'), true);
  assert.equal(h.api.scheduleMainWindowPaintRecovery(h.win, 'did-fail-load'), false);
  assert.equal(h.timers.jobs.length, 1, 'did-fail-load 和 render-process-gone 常常一起来');
  assert.equal(h.api.failureCount, 1, '被拒的那次不该计入失败次数');
});

test('失败次数越多退避越久，且定时器都 unref 过', () => {
  const h = createRecoveryHarness();
  const delays = [];
  for (let i = 0; i < 3; i += 1) {
    assert.equal(h.api.scheduleMainWindowPaintRecovery(h.win, `fail-${i}`), true);
    const job = h.timers.jobs[0];
    delays.push(job.delay);
    assert.equal(job.unrefed, true);
    h.timers.runAll();
    h.api.clearMainWindowShowWatchdog();
  }
  // 200 * n²：第一次几乎立刻重试（多半是瞬时抽风），后面越拖越久。
  assert.deepEqual(delays, [200, 800, 1800]);
});

test('达到上限就停手，只留一行日志不再重载', () => {
  const h = createRecoveryHarness();
  assert.equal(h.api.recoveryLimit, 3);
  for (let i = 0; i < h.api.recoveryLimit; i += 1) {
    h.api.scheduleMainWindowPaintRecovery(h.win, `fail-${i}`);
    h.timers.runAll();
    h.api.clearMainWindowShowWatchdog();
  }
  assert.equal(h.calls.reload, 3);
  // 无限重载一个加载不起来的页面只会把「黑屏」换成「黑屏 + 满负载」。
  assert.equal(h.api.scheduleMainWindowPaintRecovery(h.win, 'fail-again'), false);
  assert.equal(h.timers.jobs.length, 0);
  assert.equal(h.logs.warn.some((line) => line.includes('已达上限')), true);
  assert.equal(h.calls.reload, 3);
});

test('页面重新加载成功清零之后又能再攒三次机会', () => {
  const h = createRecoveryHarness();
  for (let i = 0; i < 3; i += 1) {
    h.api.scheduleMainWindowPaintRecovery(h.win, `fail-${i}`);
    h.timers.runAll();
    h.api.clearMainWindowShowWatchdog();
  }
  assert.equal(h.api.scheduleMainWindowPaintRecovery(h.win, 'blocked'), false);
  h.api.resetFailureCount();
  assert.equal(h.api.scheduleMainWindowPaintRecovery(h.win, 'much-later'), true);
  assert.equal(h.timers.jobs[0].delay, 200, '清零后退避也要从头算');
});

test('恢复动作走 reload 并重新布置看门狗', () => {
  const h = createRecoveryHarness();
  h.api.scheduleMainWindowPaintRecovery(h.win, 'render-process-gone');
  h.timers.runAll();
  // reload 能重建死掉的渲染进程、也能重试失败的加载，而且不动窗口位置和置顶状态。
  assert.equal(h.calls.reload, 1);
  assert.equal(h.calls.loadURL.length, 0);
  assert.equal(h.api.recoveryTimer, null, '跑完要把句柄清掉，否则单航班锁死后再也调度不了');
  // reload 之后一样可能等不到 ready-to-show，所以看门狗必须跟着重新上。
  assert.equal(h.timers.jobs.length, 1);
  assert.equal(h.timers.jobs[0].delay, h.api.showWatchdogMs);
});

test('reload 抛异常时回落到直接加载本地地址', () => {
  const h = createRecoveryHarness({ port: 27100 });
  h.contents.reloadThrows = true;
  h.api.scheduleMainWindowPaintRecovery(h.win, 'did-fail-load');
  h.timers.runAll();
  assert.equal(h.calls.reload, 1);
  assert.deepEqual(h.calls.loadURL, ['http://127.0.0.1:27100']);
  assert.equal(h.logs.warn.some((line) => line.includes('重载失败')), true);
});

test('回落的 loadURL 也失败时不抛出，只多记一行', () => {
  const h = createRecoveryHarness();
  h.contents.reloadThrows = true;
  h.contents.loadThrows = true;
  h.api.scheduleMainWindowPaintRecovery(h.win, 'did-fail-load');
  assert.doesNotThrow(() => h.timers.runAll());
  assert.equal(h.logs.warn.some((line) => line.includes('重新加载地址失败')), true);
});

test('退出中或正在降档重启时根本不调度恢复', () => {
  const quitting = createRecoveryHarness();
  quitting.ctx.appQuitting = true;
  assert.equal(quitting.api.scheduleMainWindowPaintRecovery(quitting.win, 'x'), false);
  assert.equal(quitting.timers.jobs.length, 0);

  // GPU 守卫降档时会 relaunch，这时候重载页面纯属白费，进程马上就要没了。
  const relaunching = createRecoveryHarness();
  relaunching.ctx.gpuGuardRelaunching = true;
  assert.equal(relaunching.api.scheduleMainWindowPaintRecovery(relaunching.win, 'x'), false);

  const noWindow = createRecoveryHarness();
  assert.equal(noWindow.api.scheduleMainWindowPaintRecovery(null, 'x'), false);

  const stale = createRecoveryHarness();
  assert.equal(
    stale.api.scheduleMainWindowPaintRecovery({ isDestroyed: () => false }, 'x'),
    false,
    '传进来的不是当前主窗口就不该动',
  );
});

test('等待期间状态变了，定时器到点也不再动窗口', () => {
  const quitting = createRecoveryHarness();
  quitting.api.scheduleMainWindowPaintRecovery(quitting.win, 'x');
  quitting.ctx.appQuitting = true;
  quitting.timers.runAll();
  assert.equal(quitting.calls.reload, 0);

  const relaunching = createRecoveryHarness();
  relaunching.api.scheduleMainWindowPaintRecovery(relaunching.win, 'x');
  relaunching.ctx.gpuGuardRelaunching = true;
  relaunching.timers.runAll();
  assert.equal(relaunching.calls.reload, 0);

  const closed = createRecoveryHarness();
  closed.api.scheduleMainWindowPaintRecovery(closed.win, 'x');
  closed.win.destroyed = true;
  closed.timers.runAll();
  assert.equal(closed.calls.reload, 0);
  assert.equal(closed.timers.jobs.length, 0, '窗口没了就别再布置看门狗');

  const deadContents = createRecoveryHarness();
  deadContents.api.scheduleMainWindowPaintRecovery(deadContents.win, 'x');
  deadContents.contents.destroyed = true;
  deadContents.timers.runAll();
  assert.equal(deadContents.calls.reload, 0);
});

// 下面这几条盯的是接线而不是逻辑：恢复实现写得再对，没挂到事件上也救不了黑屏。
test('主窗口的四条失败事件都接到了恢复实现上', () => {
  const wiring = MAIN_SOURCE.slice(MAIN_SOURCE.indexOf('async function createWindow('));
  assert.match(wiring, /on\('did-fail-load'/);
  // errorCode -3 是 ERR_ABORTED：切歌换页时的正常导航打断也会报，当失败会白白吃掉恢复配额。
  assert.match(wiring, /isMainFrame === false \|\| errorCode === -3\) return;/);
  assert.match(wiring, /on\('render-process-gone'[\s\S]{0,160}scheduleMainWindowPaintRecovery/);
  assert.match(wiring, /did-finish-load'[\s\S]{0,120}mainWindowPaintFailureCount = 0;/);
  assert.match(wiring, /catch \(e\) \{[\s\S]{0,320}initial-load-failed/, 'loadURL 必须被兜住');
});

test('看门狗在 ready-to-show 之前布置，事件到了立刻撤掉', () => {
  const armIndex = MAIN_SOURCE.indexOf('armMainWindowShowWatchdog(mainWindow);');
  const readyIndex = MAIN_SOURCE.indexOf("mainWindow.once('ready-to-show'");
  assert.ok(armIndex > 0 && readyIndex > armIndex, '先布置再监听，否则同步触发的场景会漏');
  const readyBody = MAIN_SOURCE.slice(readyIndex, readyIndex + 200);
  assert.match(readyBody, /clearMainWindowShowWatchdog\(\);[\s\S]{0,40}mainWindow\.show\(\)/);
});

test('窗口关闭时两个定时器和计数器都清干净', () => {
  const closedIndex = MAIN_SOURCE.indexOf("mainWindow.on('closed'");
  const body = MAIN_SOURCE.slice(closedIndex, closedIndex + 520);
  assert.match(body, /clearMainWindowShowWatchdog\(\);/);
  assert.match(body, /clearTimeout\(mainWindowPaintRecoveryTimer\);/);
  assert.match(body, /mainWindowPaintRecoveryTimer = null;/);
  assert.match(body, /mainWindowPaintFailureCount = 0;/, '不清零的话下次开窗口就只剩残余配额');
});

test('睡眠、解锁、显示器变化都只触发重画', () => {
  assert.match(MAIN_SOURCE, /powerMonitor\.on\('resume', \(\) => nudgeMainWindowRepaint\('system-resume'\)\)/);
  assert.match(MAIN_SOURCE, /powerMonitor\.on\('unlock-screen', \(\) => nudgeMainWindowRepaint\('screen-unlock'\)\)/);
  assert.match(MAIN_SOURCE, /nudgeMainWindowRepaint\('display-metrics-changed'\);/);
});

test('无响应只记日志，不顺手重载把播放状态弄丢', () => {
  const index = MAIN_SOURCE.indexOf("mainWindow.on('unresponsive'");
  assert.ok(index > 0, '缺了无响应检测就永远不知道渲染进程卡死过');
  const body = MAIN_SOURCE.slice(index, index + 260);
  assert.equal(body.includes('scheduleMainWindowPaintRecovery'), false);
  assert.equal(body.includes('reload()'), false);
});

test('GPU 进程退出的接线只认 GPU，不误伤其它子进程', () => {
  const index = MAIN_SOURCE.indexOf("app.on('child-process-gone'");
  assert.ok(index > 0);
  const body = MAIN_SOURCE.slice(index, index + 240);
  // 工具进程、音频服务、插件进程都会走同一个事件；不过滤就会把无关崩溃算进 GPU 降档计数。
  assert.match(body, /details\.type !== 'GPU'\) return;/);
  assert.match(body, /handleGpuProcessGone\(details\.reason, details\.exitCode\)/);
});
