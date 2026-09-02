'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

const {
  createLocalLibraryWatcher,
  normalizeWatchRootPath,
  normalizeWatchRoots,
  watchRootKey,
  isWatchRootInside,
  WATCH_DEBOUNCE_MS,
  WATCH_MAX_WAIT_MS,
} = require('../desktop/local-library-watcher');

const CASE_INSENSITIVE_PATHS = process.platform === 'win32' || process.platform === 'darwin';
const ROOT_A = path.join(os.tmpdir(), 'mineradio-watch-a');
const ROOT_B = path.join(os.tmpdir(), 'mineradio-watch-b');

/**
 * 创建可手动触发的定时器桩。按延迟值分别触发，能把防抖阀门和最长等待阀门验证开。
 * @returns {object} 定时器桩。
 */
function createTimerHarness() {
  const store = new Map();
  let seq = 0;
  return {
    setTimer(fn, delay) {
      const id = ++seq;
      store.set(id, { fn, delay: Number(delay) || 0 });
      return id;
    },
    clearTimer(id) { store.delete(id); },
    delays() { return Array.from(store.values()).map((timer) => timer.delay).sort((a, b) => a - b); },
    fire(delay) {
      let count = 0;
      for (const [id, timer] of Array.from(store)) {
        if (timer.delay !== delay) continue;
        store.delete(id);
        count += 1;
        timer.fn();
      }
      return count;
    },
    size() { return store.size; },
  };
}
/**
 * 创建可注入失败的 fs.watch 桩，用来模拟权限拒绝、递归不支持和移动硬盘掉线。
 * @param {object} config 失败注入开关，测试中可随时改写。
 * @returns {object} fs 桩与已创建的 watcher 句柄列表。
 */
function createFsHarness(config) {
  const options = config || {};
  const watchers = [];
  const calls = [];
  const fs = {
    watch(folderPath, opts, listener) {
      const recursive = !!(opts && opts.recursive);
      calls.push({ folderPath, recursive, persistent: !!(opts && opts.persistent) });
      if (options.recursiveFails && recursive) {
        const error = new Error('recursive watch unsupported');
        error.code = 'ERR_FEATURE_UNAVAILABLE_ON_PLATFORM';
        throw error;
      }
      if (options.failAll) {
        const error = new Error('watch denied');
        error.code = 'EPERM';
        throw error;
      }
      const handle = {
        folderPath,
        recursive,
        closed: false,
        unrefed: false,
        listener,
        handlers: Object.create(null),
        on(name, fn) { this.handlers[name] = fn; return this; },
        unref() { this.unrefed = true; return this; },
        close() { this.closed = true; },
      };
      watchers.push(handle);
      return handle;
    },
  };
  return { fs, options, watchers, calls, latest() { return watchers[watchers.length - 1] || null; } };
}
/**
 * 组装一个完全注入依赖的监控器，测试里不碰真实文件系统也不碰真实定时器。
 * @param {object} [config] 可选的注入配置。
 * @returns {object} 监控器与观察到的回调记录。
 */
function createWatcherHarness(config) {
  const options = config || {};
  const timers = createTimerHarness();
  const fsHarness = createFsHarness(options.fsOptions);
  const flushes = [];
  const statuses = [];
  const watcher = createLocalLibraryWatcher({
    fs: fsHarness.fs,
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
    pathLimit: options.pathLimit,
    retryBaseMs: options.retryBaseMs,
    isTrackedPath: options.isTrackedPath || ((rel) => /\.(flac|mp3|lrc|jpg)$/i.test(String(rel || ''))),
    onFlush: (payload) => { flushes.push(payload); },
    onStatusChange: (payload) => { statuses.push(payload); },
  });
  return { watcher, timers, fsHarness, flushes, statuses };
}

test('normalizeWatchRootPath 去掉尾部分隔符并解析为绝对路径', () => {
  assert.equal(normalizeWatchRootPath(''), '');
  assert.equal(normalizeWatchRootPath(null), '');
  assert.equal(normalizeWatchRootPath(ROOT_A + path.sep), path.resolve(ROOT_A));
  assert.equal(normalizeWatchRootPath(ROOT_A), path.resolve(ROOT_A));
});

test('isWatchRootInside 只在分隔符边界上判定包含关系', () => {
  assert.equal(isWatchRootInside('e:/music', 'e:/music/rock'), true);
  assert.equal(isWatchRootInside('e:/music', 'e:/music'), false);
  // E:\Music2 只是名字前缀相同，不能被 E:\Music 的递归监控吞掉。
  assert.equal(isWatchRootInside('e:/music', 'e:/music2'), false);
  assert.equal(isWatchRootInside('e:\\music', 'e:\\music\\rock'), true);
  assert.equal(isWatchRootInside('e:\\music', 'e:\\music2'), false);
  assert.equal(isWatchRootInside('', 'e:/music'), false);
});
test('normalizeWatchRoots 去重并丢掉被父目录递归覆盖的子目录', () => {
  const parent = path.join(ROOT_A, 'Music');
  const child = path.join(ROOT_A, 'Music', 'Rock');
  const sibling = path.join(ROOT_A, 'Music2');
  const roots = normalizeWatchRoots([parent, child, sibling, '', null, parent]);
  assert.deepEqual(roots, [path.resolve(parent), path.resolve(sibling)]);
});

test('normalizeWatchRoots 在大小写不敏感的平台上合并同一个根', () => {
  const upper = path.join(ROOT_A, 'MUSIC');
  const lower = path.join(ROOT_A, 'music');
  const roots = normalizeWatchRoots([upper, lower]);
  assert.equal(roots.length, CASE_INSENSITIVE_PATHS ? 1 : 2);
  assert.equal(roots[0], path.resolve(upper));
  assert.equal(watchRootKey(upper), CASE_INSENSITIVE_PATHS ? path.resolve(upper).toLowerCase() : path.resolve(upper));
});

test('setRoots 挂上递归监控并给出状态快照', () => {
  const h = createWatcherHarness();
  const result = h.watcher.setRoots([ROOT_A]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.added, [path.resolve(ROOT_A)]);
  assert.deepEqual(result.removed, []);
  assert.equal(h.fsHarness.calls.length, 1);
  assert.equal(h.fsHarness.calls[0].recursive, true);
  assert.equal(h.fsHarness.calls[0].persistent, false);
  // 监控句柄必须 unref，否则退出时会被这个 watcher 吊住事件循环。
  assert.equal(h.fsHarness.latest().unrefed, true);
  const status = h.watcher.getStatus();
  assert.equal(status.ok, true);
  assert.equal(status.roots.length, 1);
  assert.equal(status.roots[0].active, true);
  assert.equal(status.roots[0].recursive, true);
  assert.equal(status.roots[0].error, '');
  assert.ok(h.statuses.length >= 1);
});
test('防抖窗口把整张专辑的上百个事件合并成一次上报', () => {
  const h = createWatcherHarness();
  h.watcher.setRoots([ROOT_A]);
  const handle = h.fsHarness.latest();
  handle.listener('rename', 'Album/01.flac');
  handle.listener('change', 'Album/02.flac');
  handle.listener('change', 'Album/02.flac');
  assert.equal(h.flushes.length, 0);
  assert.deepEqual(h.timers.delays(), [WATCH_DEBOUNCE_MS, WATCH_MAX_WAIT_MS]);
  assert.equal(h.timers.fire(WATCH_DEBOUNCE_MS), 1);
  assert.equal(h.flushes.length, 1);
  assert.equal(h.flushes[0].folderPath, path.resolve(ROOT_A));
  assert.equal(h.flushes[0].reason, 'debounce');
  assert.equal(h.flushes[0].overflow, false);
  assert.deepEqual(h.flushes[0].paths.slice().sort(), ['Album/01.flac', 'Album/02.flac']);
  // 上报后两个阀门都要收掉，不能留下一个空转的最长等待定时器。
  assert.equal(h.timers.size(), 0);
  assert.equal(h.watcher.getStatus().roots[0].pending, 0);
});

test('最长等待阀门让长时间拷贝也能中途上报', () => {
  const h = createWatcherHarness();
  h.watcher.setRoots([ROOT_A]);
  const handle = h.fsHarness.latest();
  for (let i = 0; i < 6; i++) {
    handle.listener('change', `Album/${i}.flac`);
    // 每条事件都会重排防抖阀门，只有最长等待阀门不会被推后。
    assert.deepEqual(h.timers.delays(), [WATCH_DEBOUNCE_MS, WATCH_MAX_WAIT_MS]);
  }
  assert.equal(h.flushes.length, 0);
  assert.equal(h.timers.fire(WATCH_MAX_WAIT_MS), 1);
  assert.equal(h.flushes.length, 1);
  assert.equal(h.flushes[0].reason, 'max-wait');
  assert.equal(h.flushes[0].paths.length, 6);
  assert.equal(h.timers.size(), 0);
});

test('路径里的反斜杠统一成正斜杠', () => {
  const h = createWatcherHarness();
  h.watcher.setRoots([ROOT_A]);
  h.fsHarness.latest().listener('change', 'Album\\01.flac');
  h.timers.fire(WATCH_DEBOUNCE_MS);
  assert.deepEqual(h.flushes[0].paths, ['Album/01.flac']);
});
test('不关心的扩展名不触发任何上报', () => {
  const h = createWatcherHarness();
  h.watcher.setRoots([ROOT_A]);
  const handle = h.fsHarness.latest();
  handle.listener('change', 'tagger.tmp');
  handle.listener('change', 'Thumbs.db');
  assert.equal(h.timers.size(), 0);
  assert.equal(h.flushes.length, 0);
  // 事件计数照旧累加，只是不当成曲库变更。
  assert.equal(h.watcher.getStatus().roots[0].events, 2);
});

test('目录改名没有扩展名，按整根粗粒度变更处理', () => {
  const h = createWatcherHarness();
  h.watcher.setRoots([ROOT_A]);
  h.fsHarness.latest().listener('rename', 'Album');
  h.timers.fire(WATCH_DEBOUNCE_MS);
  assert.deepEqual(h.flushes[0].paths, ['Album']);
});

test('文件名缺失时标记 overflow，让渲染层退回整库比对', () => {
  const h = createWatcherHarness();
  h.watcher.setRoots([ROOT_A]);
  h.fsHarness.latest().listener('rename', null);
  h.timers.fire(WATCH_DEBOUNCE_MS);
  assert.equal(h.flushes.length, 1);
  assert.equal(h.flushes[0].overflow, true);
  assert.deepEqual(h.flushes[0].paths, []);
});

test('待处理路径超过上限时截断并标记 overflow', () => {
  const h = createWatcherHarness({ pathLimit: 3 });
  h.watcher.setRoots([ROOT_A]);
  const handle = h.fsHarness.latest();
  for (let i = 0; i < 5; i++) handle.listener('change', `Album/${i}.flac`);
  assert.equal(h.watcher.getStatus().roots[0].overflow, true);
  h.timers.fire(WATCH_DEBOUNCE_MS);
  assert.equal(h.flushes[0].overflow, true);
  assert.equal(h.flushes[0].paths.length, 3);
});

test('flushNow 立刻上报积压变更，没有积压时不空转', () => {
  const h = createWatcherHarness();
  h.watcher.setRoots([ROOT_A]);
  assert.equal(h.watcher.flushNow(), 0);
  h.fsHarness.latest().listener('change', 'Album/01.flac');
  assert.equal(h.watcher.flushNow(), 1);
  assert.equal(h.flushes[0].reason, 'manual');
  assert.equal(h.timers.size(), 0);
  assert.equal(h.watcher.flushNow(), 0);
  assert.equal(h.flushes.length, 1);
});
test('递归监控不可用时降级成只看根目录一层', () => {
  const h = createWatcherHarness({ fsOptions: { recursiveFails: true } });
  h.watcher.setRoots([ROOT_A]);
  assert.deepEqual(h.fsHarness.calls.map((call) => call.recursive), [true, false]);
  const status = h.watcher.getStatus();
  assert.equal(status.roots[0].active, true);
  assert.equal(status.roots[0].recursive, false);
  assert.equal(status.roots[0].error, '');
});

test('挂载失败按指数退避重试，恢复后自动接回', () => {
  const fsOptions = { failAll: true };
  const h = createWatcherHarness({ fsOptions, retryBaseMs: 5000 });
  h.watcher.setRoots([ROOT_A]);
  let status = h.watcher.getStatus();
  assert.equal(status.roots[0].active, false);
  assert.equal(status.roots[0].error, 'EPERM');
  assert.equal(status.roots[0].retrying, true);
  assert.deepEqual(h.timers.delays(), [5000]);
  // 第一次重试仍然失败：退避翻倍到 10s，而不是继续每 5s 撞一次。
  assert.equal(h.timers.fire(5000), 1);
  assert.deepEqual(h.timers.delays(), [10000]);
  fsOptions.failAll = false;
  assert.equal(h.timers.fire(10000), 1);
  status = h.watcher.getStatus();
  assert.equal(status.roots[0].active, true);
  assert.equal(status.roots[0].error, '');
  assert.equal(status.roots[0].retrying, false);
  assert.equal(h.timers.size(), 0);
});

test('watcher error 事件触发失败处理并排下一次重试', () => {
  const h = createWatcherHarness({ retryBaseMs: 5000 });
  h.watcher.setRoots([ROOT_A]);
  const handle = h.fsHarness.latest();
  const error = new Error('device removed');
  error.code = 'ENOENT';
  handle.handlers.error(error);
  const status = h.watcher.getStatus();
  assert.equal(status.roots[0].active, false);
  assert.equal(status.roots[0].error, 'ENOENT');
  assert.equal(status.roots[0].retrying, true);
  assert.equal(handle.closed, true);
});
test('setRoots 只处理增量：保留的根不重挂，移除的根立刻停掉', () => {
  const h = createWatcherHarness();
  h.watcher.setRoots([ROOT_A]);
  const first = h.fsHarness.latest();
  const grown = h.watcher.setRoots([ROOT_A, ROOT_B]);
  assert.deepEqual(grown.added, [path.resolve(ROOT_B)]);
  assert.deepEqual(grown.removed, []);
  // 刷新曲库时不能把已经在监控的根断一次再接回来。
  assert.equal(first.closed, false);
  assert.equal(h.fsHarness.calls.length, 2);
  assert.equal(h.watcher.getStatus().roots.length, 2);
  const shrunk = h.watcher.setRoots([ROOT_B]);
  assert.deepEqual(shrunk.added, []);
  assert.deepEqual(shrunk.removed, [path.resolve(ROOT_A)]);
  assert.equal(first.closed, true);
  assert.equal(h.watcher.getStatus().roots.length, 1);
  assert.equal(h.watcher.getStatus().roots[0].folderPath, path.resolve(ROOT_B));
});

test('移除根时丢弃它积压的事件，不会在下一轮补报', () => {
  const h = createWatcherHarness();
  h.watcher.setRoots([ROOT_A]);
  h.fsHarness.latest().listener('change', 'Album/01.flac');
  h.watcher.setRoots([]);
  assert.equal(h.timers.size(), 0);
  assert.equal(h.flushes.length, 0);
  assert.deepEqual(h.watcher.getStatus().roots, []);
});

test('close 之后所有入口都不再产生副作用', () => {
  const h = createWatcherHarness();
  h.watcher.setRoots([ROOT_A]);
  const handle = h.fsHarness.latest();
  handle.listener('change', 'Album/01.flac');
  h.watcher.close();
  assert.equal(h.watcher.isClosed(), true);
  assert.equal(handle.closed, true);
  assert.equal(h.timers.size(), 0);
  const status = h.watcher.getStatus();
  assert.equal(status.ok, false);
  assert.equal(status.closed, true);
  assert.deepEqual(status.roots, []);
  const result = h.watcher.setRoots([ROOT_B]);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'LOCAL_LIBRARY_WATCH_CLOSED');
  assert.equal(h.watcher.flushNow(), 0);
  // 关闭后迟到的 fs 事件既不排定时器也不回调。
  handle.listener('change', 'Album/02.flac');
  assert.equal(h.timers.size(), 0);
  assert.equal(h.flushes.length, 0);
  h.watcher.close();
});
