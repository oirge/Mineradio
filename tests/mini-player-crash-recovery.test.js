'use strict';
// 迷你播放器崩溃/加载失败恢复的退避与上限：反复失败按 200·n² 退避、达到上限停手回退主窗口，
// 加载成功后把失败计数清零。源码抽取运行 scheduleMiniPlayerWindowRecovery，纯 Node 假定时器，无 Electron/GUI。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/** @returns {string} desktop/main.js 源码。 */
function readMainSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
}

/**
 * 抽取从 startFn 到 endFn 之间的源码片段（含 startFn，不含 endFn）。
 * @param {string} src 源码全文。
 * @param {string} startFn 起始函数名。
 * @param {string} endFn 结束函数名。
 * @returns {string} 片段源码。
 */
function extractFunction(src, startFn, endFn) {
  const a = src.indexOf('function ' + startFn);
  const b = src.indexOf('function ' + endFn, a + 1);
  assert.ok(a >= 0 && b > a, '抽取失败：' + startFn + ' / ' + endFn);
  return src.slice(a, b);
}

/**
 * 构造恢复函数的运行夹具，提供假定时器与各恢复副作用桩。
 * @returns {object} 夹具句柄。
 */
function createHarness() {
  const jobs = [];
  const calls = { destroy: 0, focusMain: 0, show: 0, reload: 0, periodic: [] };
  const win = {
    isDestroyed: () => false,
    webContents: { isDestroyed: () => false, isCrashed: () => false, reload: () => { calls.reload += 1; } },
  };
  const context = {
    appQuitting: false,
    miniPlayerRecoverySession: { paused: false },
    miniPlayerWindow: win,
    miniPlayerProgrammaticCloseWindows: new WeakSet(),
    miniPlayerRendererReloadWindows: new WeakSet(),
    miniPlayerRecreateTimer: null,
    miniPlayerCrashFailureCount: 0,
    MINI_PLAYER_CRASH_RECOVERY_LIMIT: 3,
    advanceMiniPlayerCoverDragGeneration: () => {},
    destroyMiniPlayerWindowInstance: () => { calls.destroy += 1; },
    focusMainWindow: () => { calls.focusMain += 1; },
    showMiniPlayerWindow: () => { calls.show += 1; },
    scheduleMiniPlayerRecovery: (d) => { calls.periodic.push(d); },
    shouldShowMiniPlayer: () => true,
    console: { warn() {}, log() {} },
    setTimeout: (fn, delay) => { const job = { fn, delay, unrefed: false, unref() { this.unrefed = true; } }; jobs.push(job); return job; },
  };
  vm.runInNewContext(
    extractFunction(readMainSource(), 'scheduleMiniPlayerWindowRecovery', 'handleMiniPlayerSystemSuspend')
      + '\nthis.scheduleRecovery = scheduleMiniPlayerWindowRecovery;',
    context,
  );
  return {
    context, win, jobs, calls,
    schedule: (reason) => context.scheduleRecovery(win, reason),
    clearTimer: () => { context.miniPlayerRecreateTimer = null; },
    runLast: () => { jobs[jobs.length - 1].fn(); },
  };
}

test('迷你播放器崩溃恢复按 200·n² 退避，定时器都 unref 过', () => {
  const h = createHarness();
  const delays = [];
  for (let i = 0; i < 3; i += 1) {
    h.schedule('fail-' + i);
    const job = h.jobs[h.jobs.length - 1];
    delays.push(job.delay);
    assert.equal(job.unrefed, true);
    h.runLast(); // 定时器触发：fn 自身把 recreate timer 清空，再走重建分支
  }
  // 200·n²：第一次几乎立刻（多半瞬时抽风），后面越拖越久。
  assert.deepEqual(delays, [200, 800, 1800]);
});

test('达到上限就停手并回退主窗口，不再排新定时器', () => {
  const h = createHarness();
  for (let i = 0; i < 3; i += 1) { h.schedule('fail-' + i); h.clearTimer(); }
  assert.equal(h.context.miniPlayerCrashFailureCount, 3, '上限前每次失败都计数');
  assert.equal(h.jobs.length, 3);
  const before = h.calls.focusMain;
  h.schedule('fail-again'); // count >= LIMIT → 放弃
  assert.equal(h.jobs.length, 3, '达到上限后不再排恢复定时器');
  assert.ok(h.calls.destroy >= 1, '放弃时销毁坏窗口');
  assert.equal(h.calls.focusMain, before + 1, '放弃时回退聚焦主窗口');
});

test('暂停态（锁屏/休眠）直接跳过，不计数不排队', () => {
  const h = createHarness();
  h.context.miniPlayerRecoverySession.paused = true;
  h.schedule('renderer-gone:crashed');
  assert.equal(h.jobs.length, 0);
  assert.equal(h.context.miniPlayerCrashFailureCount, 0);
});

test('源码接线：上限常量为 3，加载成功后清零失败计数', () => {
  const src = readMainSource();
  assert.match(src, /const MINI_PLAYER_CRASH_RECOVERY_LIMIT = 3;/);
  assert.match(src, /miniPlayerRendererReloadWindows\.delete\(win\);\s*miniPlayerCrashFailureCount = 0;/);
});
