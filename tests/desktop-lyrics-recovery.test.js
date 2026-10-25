'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const source = fs.readFileSync(path.join(__dirname, '../desktop/desktop-lyrics-recovery.js'), 'utf8');

function harness() {
  const jobs = new Map();
  const context = {
    module: { exports: {} }, console,
    setTimeout(fn, delay) { const job = { fn, delay, unref() {} }; jobs.set(job, job); return job; },
    clearTimeout(job) { jobs.delete(job); },
  };
  vm.runInNewContext(source, context);
  const win = new EventEmitter();
  win.webContents = new EventEmitter();
  Object.assign(win, {
    visible: false, destroyed: false, topmost: true, minimized: false,
    shows: 0, loads: 0, raises: 0, restores: 0,
    isDestroyed() { return this.destroyed; },
    isVisible() { return this.visible; },
    isAlwaysOnTop() { return this.topmost; },
    isMinimized() { return this.minimized; },
    restore() { this.minimized = false; this.restores++; },
    moveTop() { this.raises++; },
    setAlwaysOnTop(on, level) { this.topmost = on; this.level = level; },
    showInactive() { this.visible = true; this.shows++; },
    loadURL(url) { this.url = url; this.loads++; return Promise.resolve(); },
  });
  Object.assign(win.webContents, {
    destroyed: false, paints: 0,
    isDestroyed() { return this.destroyed; },
    invalidate() { this.paints++; },
  });
  const h = { win, jobs, current: true, state: 'first', sent: [], logs: [], now: 0 };
  h.api = context.module.exports.createDesktopLyricsRecovery(win, {
    isCurrent: () => h.current,
    syncState: () => h.sent.push(h.state),
    url: 'http://127.0.0.1/desktop-lyrics.html',
    log: (...args) => h.logs.push(args),
    now: () => h.now,
  });
  h.tick = delay => {
    const job = [...jobs.values()].find(value => value.delay === delay);
    assert.ok(job, 'missing timer ' + delay); jobs.delete(job); job.fn();
  };
  return h;
}

test('无 ready-to-show 时页面加载完成仍显示歌词并发送最新状态', () => {
  const h = harness(); h.api.load(); h.state = 'latest lyric';
  h.win.webContents.emit('did-finish-load');
  assert.equal(h.win.visible, true);
  assert.deepEqual(h.sent, ['latest lyric']);
  assert.equal(h.jobs.size, 0);
});

test('首帧和加载完成事件都未到时看门狗不让窗口永久隐藏', () => {
  const h = harness(); h.api.load(); h.tick(2000);
  assert.equal(h.win.visible, true);
  h.win.emit('ready-to-show'); h.win.webContents.emit('did-finish-load');
  assert.equal(h.win.shows, 1, '迟到事件不反复抢窗口层级');
});

test('renderer 崩溃后有限重载，每次加载都补发歌词而非只处理第一次', () => {
  const h = harness(); h.api.load(); h.win.webContents.emit('did-finish-load');
  h.win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
  h.tick(200);
  assert.equal(h.win.loads, 2);
  h.state = 'new song'; h.win.webContents.emit('did-finish-load');
  assert.deepEqual(h.sent, ['first', 'new song']);
});

test('loadURL rejection 与 did-fail-load 合并重试，恢复 URL 保持原页面', async () => {
  const h = harness();
  h.win.loadURL = () => Promise.reject(new Error('ERR_FAILED'));
  h.api.load();
  h.win.webContents.emit('did-fail-load', {}, -2, 'ERR_FAILED', '', true);
  await Promise.resolve();
  assert.equal([...h.jobs.values()].filter(job => job.delay === 200).length, 1);
  h.win.loadURL = url => { h.win.url = url; return Promise.resolve(); };
  h.tick(200);
  assert.equal(h.win.url, 'http://127.0.0.1/desktop-lyrics.html');
});

test('ERR_ABORTED 与子 frame 加载失败不得触发恢复', async () => {
  const h = harness();
  h.win.loadURL = () => Promise.reject(Object.assign(new Error('abort'), { code: 'ERR_ABORTED' }));
  h.api.load();
  h.win.webContents.emit('did-fail-load', {}, -3, 'abort', '', true);
  h.win.webContents.emit('did-fail-load', {}, -2, 'subframe', '', false);
  await Promise.resolve();
  assert.equal(h.logs.length, 0);
  assert.deepEqual([...h.jobs.values()].map(job => job.delay), [2000]);
});

test('反复加载成功后又崩溃也只能恢复三次，不能满负载无限重载', () => {
  const h = harness(); h.api.load();
  for (const delay of [200, 400, 800]) {
    h.win.webContents.emit('did-finish-load');
    h.win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
    h.tick(delay);
  }
  h.win.webContents.emit('did-finish-load');
  h.win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
  assert.equal(h.win.loads, 4);
  assert.equal(h.jobs.size, 0);
  assert.match(h.logs.at(-1)[0], /limit/);
});

test('关闭、禁用、被替换、退出和销毁期间不得被迟到回调复活', () => {
  for (const stop of [h => h.api.dispose(), h => { h.current = false; }, h => { h.win.destroyed = true; }, h => { h.win.webContents.destroyed = true; }]) {
    const h = harness(); h.api.load();
    h.win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
    const lateJobs = [...h.jobs.values()]; stop(h);
    for (const job of lateJobs) job.fn();
    h.win.emit('ready-to-show'); h.win.webContents.emit('did-finish-load');
    assert.equal(h.win.shows, 0); assert.equal(h.win.loads, 1); assert.equal(h.sent.length, 0);
  }
});

test('意外 closed 和正常 dispose 均清理全部定时器', () => {
  const h = harness(); h.api.load();
  h.win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
  h.win.emit('closed');
  assert.equal(h.jobs.size, 0); assert.equal(h.api.show(), false);
});

test('加载成功取消等待中的重复恢复', () => {
  const h = harness(); h.api.load();
  h.win.webContents.emit('did-fail-load', {}, -2, 'failed', '', true);
  h.win.webContents.emit('did-finish-load');
  assert.equal(h.jobs.size, 0); assert.equal(h.win.visible, true);
});

test('解锁/唤醒恢复隐藏和置顶状态，只重画而不重载或抢焦点', () => {
  const h = harness(); h.win.topmost = false; h.api.show();
  assert.equal(h.win.visible, true); assert.equal(h.win.topmost, true);
  assert.equal(h.win.level, 'screen-saver'); assert.equal(h.win.webContents.paints, 1);
  assert.equal(h.win.loads, 0);
});

test('歌词被系统隐藏后自动重新显示，健康窗口没有周期性重画', () => {
  const h = harness(); h.api.load(); h.win.webContents.emit('did-finish-load');
  h.win.visible = false; h.win.emit('hide');
  h.tick(120);
  assert.equal(h.win.visible, true);
  assert.equal(h.win.loads, 1);
  assert.equal(h.win.raises, 2);
  assert.equal(h.jobs.size, 0);
});

test('最小化与置顶丢失事件合并恢复，不调用抢焦点的 show 或 focus', () => {
  const h = harness(); h.api.show();
  h.win.minimized = true; h.win.visible = false; h.win.topmost = false;
  h.win.emit('minimize'); h.win.emit('hide');
  h.win.emit('always-on-top-changed', {}, false);
  assert.equal(h.jobs.size, 1);
  h.tick(120);
  assert.equal(h.win.minimized, false); assert.equal(h.win.restores, 1);
  assert.equal(h.win.visible, true); assert.equal(h.win.topmost, true);
  assert.equal(h.win.loads, 0); assert.equal(h.jobs.size, 0);
});

test('自然恢复的隐藏事件和置顶成功事件不多余重画', () => {
  const h = harness(); h.api.show();
  const paints = h.win.webContents.paints;
  h.win.visible = false; h.win.emit('hide'); h.win.visible = true;
  h.win.emit('always-on-top-changed', {}, true);
  h.tick(120);
  assert.equal(h.win.webContents.paints, paints);
  assert.equal(h.jobs.size, 0);
});

test('关闭或替代窗口的迟到显示恢复不会复活旧窗口', () => {
  for (const stop of [h => h.api.dispose(), h => { h.current = false; }]) {
    const h = harness(); h.win.emit('hide');
    const lateJobs = [...h.jobs.values()]; stop(h);
    for (const job of lateJobs) job.fn();
    h.win.emit('minimize'); h.win.emit('always-on-top-changed', {}, false);
    assert.equal(h.win.shows, 0); assert.equal(h.win.raises, 0);
    assert.equal(h.sent.length, 0);
  }
});

test('页面暂时无响应有宽限期，自行恢复后不重载', () => {
  const h = harness(); h.api.load(); h.win.webContents.emit('did-finish-load');
  h.win.emit('unresponsive');
  assert.equal(h.win.loads, 1);
  assert.equal([...h.jobs.values()].some(job => job.delay === 5000), true);
  h.win.emit('responsive');
  assert.equal(h.jobs.size, 0);
  assert.equal(h.win.loads, 1);
});

test('持续无响应使用有限恢复，关闭时同时取消宽限期', () => {
  const h = harness(); h.api.load(); h.win.webContents.emit('did-finish-load');
  h.win.emit('unresponsive'); h.tick(5000); h.tick(200);
  assert.equal(h.win.loads, 2);
  h.win.webContents.emit('did-finish-load');
  h.win.emit('unresponsive'); h.api.dispose();
  assert.equal(h.jobs.size, 0);
});

test('responsive 取消尚未开始的无响应重载，但不取消其间发生的真正崩溃', () => {
  for (const crashed of [false, true]) {
    const h = harness(); h.api.load(); h.win.webContents.emit('did-finish-load');
    h.win.emit('unresponsive'); h.tick(5000);
    if (crashed) h.win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
    h.win.emit('responsive');
    if (crashed) h.tick(200);
    assert.equal(h.win.loads, crashed ? 2 : 1);
  }
});

test('旧 loadURL Promise 迟到失败不能重载已经恢复的新页面', async () => {
  const h = harness(); let rejectOldLoad;
  h.win.loadURL = () => new Promise((_resolve, reject) => { rejectOldLoad = reject; });
  h.api.load();
  h.win.webContents.emit('did-fail-load', {}, -2, 'ERR_FAILED', '', true);
  h.win.loadURL = () => Promise.resolve(); h.tick(200);
  h.win.webContents.emit('did-finish-load');
  rejectOldLoad(new Error('late failure')); await Promise.resolve();
  assert.equal(h.jobs.size, 0);
  assert.equal(h.sent.length, 1);
});

test('恢复后稳定运行一分钟恢复预算，连续崩溃仍保留三次上限', () => {
  const h = harness(); h.api.load();
  for (const delay of [200, 400, 800]) {
    h.win.webContents.emit('did-finish-load');
    h.win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
    h.tick(delay);
  }
  h.win.webContents.emit('did-finish-load');
  h.now += 60001;
  h.win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
  h.tick(200);
  assert.equal(h.win.loads, 5);
});

test('失败后只等时间不算稳定，不能绕过三次连续恢复上限', () => {
  const h = harness(); h.api.load();
  for (const delay of [200, 400, 800]) {
    h.win.webContents.emit('did-finish-load');
    h.win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
    h.tick(delay);
  }
  h.now += 60001;
  h.win.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
  assert.equal([...h.jobs.values()].some(job => job.delay === 200), false);
  assert.equal(h.win.loads, 4);
});

test('主进程接入恢复管理器，主窗口收进托盘不能连带隐藏歌词', () => {
  const main = fs.readFileSync(path.join(__dirname, '../desktop/main.js'), 'utf8');
  assert.ok(main.includes('desktopLyricsRecovery = createDesktopLyricsRecovery(win,'));
  assert.match(main, /desktopLyricsStateCache.enabled[\s\S]{0,80}!appQuitting && !gpuGuardRelaunching/);
  assert.ok(main.includes("powerMonitor.on('resume', refreshDesktopLyricsWindow)"));
  assert.ok(main.includes("powerMonitor.on('unlock-screen', refreshDesktopLyricsWindow)"));
  assert.doesNotMatch(main, /suspendDesktopLyricsForMainHide/);
});
