'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 读取真实的本地曲库后台刷新函数。
 * @returns {string} 可在隔离 VM 中执行的函数源码。
 */
function readBackgroundRefreshSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function refreshSavedLocalMusicFolderInBackground(');
  const end = source.indexOf('/**\n * 将导入或恢复的本地文件转换为播放队列', start + 1);
  assert.ok(start >= 0 && end > start, '未找到本地曲库后台刷新函数');
  return source.slice(start, end);
}

/**
 * 等待 Promise 回调和其返回链完成一轮。
 * @returns {Promise<void>}
 */
function waitForPromiseTurn() {
  /**
   * 把 Promise 完成安排到下一轮事件循环。
   * @param {Function} resolve Promise 完成函数。
   * @returns {void}
   */
  function resolveOnImmediate(resolve) { setImmediate(resolve); }
  return new Promise(resolveOnImmediate);
}

/**
 * 创建可控制扫描完成时机的后台刷新环境。
 * @param {string} nextSignature 扫描结果签名。
 * @returns {{context: object, runTimer: Function, resolveScan: Function, calls: object, songsA: object[], songsB: object[]}} 测试入口和调用记录。
 */
function createBackgroundRefreshHarness(nextSignature) {
  const songsA = [{ localKey: 'A-song' }];
  const songsB = [{ localKey: 'B-song' }];
  const calls = { snapshots: 0, indexes: [], handles: 0, toasts: 0 };
  let timerCallback = null;
  let resolveScanPromise = null;

  /**
   * 保存扫描 Promise 的完成函数，供测试控制异步结果时序。
   * @param {Function} resolve Promise 完成函数。
   * @returns {void}
   */
  function captureScanResolver(resolve) {
    resolveScanPromise = resolve;
  }

  const scanPromise = new Promise(captureScanResolver);

  /** @returns {Promise<object>} 可由测试稍后完成的扫描 Promise。 */
  function scanLocalMusicFolder() { return scanPromise; }

  /** @returns {object} 带可控扫描入口的桌面 API。 */
  function desktopLocalMusicApi() { return { scanLocalMusicFolder }; }

  /**
   * 捕获后台刷新定时任务但不在后台执行。
   * @param {Function} callback 待执行任务。
   * @returns {number} 假定时器编号。
   */
  function captureTimeout(callback) {
    timerCallback = callback;
    return 1;
  }

  /** @returns {string} 测试指定的扫描结果签名。 */
  function localLibrarySnapshotSignature() { return nextSignature; }

  /** @returns {void} 记录不应由旧扫描执行的快照保存。 */
  function saveLocalLibrarySnapshot() { calls.snapshots += 1; }

  /**
   * 记录不应把当前 B 歌曲写入旧 A 文件夹的索引保存。
   * @param {string} folderPath 目标文件夹。
   * @param {object[]} songs 被保存的歌曲数组。
   * @returns {void}
   */
  function scheduleLocalLibraryIndexSave(folderPath, songs) {
    calls.indexes.push({ folderPath, songs });
  }

  /** @returns {void} 记录旧扫描不应产生的 UI 提示。 */
  function showToast() { calls.toasts += 1; }

  /** @returns {Promise<void>} 记录旧扫描不应触发的曲库替换。 */
  function handleLocalFolderFiles() {
    calls.handles += 1;
    return Promise.resolve();
  }

  const context = {
    desktopLocalMusicApi,
    setTimeout: captureTimeout,
    localLibrarySnapshotSignature,
    saveLocalLibrarySnapshot,
    scheduleLocalLibraryIndexSave,
    showToast,
    handleLocalFolderFiles,
    localLibrarySongs: songsA,
    playQueue: songsA,
    localLibraryPassiveQueue: true,
    playing: false,
    audio: { src: '', paused: true },
    console,
  };
  vm.runInNewContext(
    readBackgroundRefreshSource()
      + '\nthis.refresh = refreshSavedLocalMusicFolderInBackground;',
    context,
  );

  /** @returns {void} 同步执行被捕获的刷新定时任务。 */
  function runTimer() {
    assert.equal(typeof timerCallback, 'function');
    timerCallback();
  }

  /**
   * 完成扫描并提供最小有效结果。
   * @returns {void}
   */
  function resolveScan() {
    resolveScanPromise({ ok: true, folderPath: 'A', files: [{ name: 'A.mp3' }], directories: [], truncated: false });
  }

  return { context, runTimer, resolveScan, calls, songsA, songsB };
}

/**
 * 验证切换到 B 后，旧 A 的同签名扫描不能用 B 歌曲覆盖 A 索引。
 * @returns {Promise<void>}
 */
async function testStaleRefreshDoesNotSaveCurrentSongsIntoOldFolder() {
  const harness = createBackgroundRefreshHarness('same');
  harness.context.refresh('A', { signature: 'same' });
  harness.runTimer();
  harness.context.localLibrarySongs = harness.songsB;
  harness.context.playQueue = harness.songsB;
  harness.resolveScan();
  await waitForPromiseTurn();

  assert.equal(harness.calls.snapshots, 0);
  assert.deepEqual(harness.calls.indexes, []);
}

/**
 * 验证切换到 B 后，旧 A 的变化扫描不能重新导入并覆盖当前界面。
 * @returns {Promise<void>}
 */
async function testStaleRefreshDoesNotRestoreOldLibrary() {
  const harness = createBackgroundRefreshHarness('changed');
  harness.context.refresh('A', { signature: 'old' });
  harness.runTimer();
  harness.context.localLibrarySongs = harness.songsB;
  harness.context.playQueue = harness.songsB;
  harness.resolveScan();
  await waitForPromiseTurn();

  assert.equal(harness.calls.snapshots, 0);
  assert.equal(harness.calls.handles, 0);
  assert.equal(harness.calls.toasts, 0);
}

test('旧曲库后台扫描不把当前歌曲写入旧索引', testStaleRefreshDoesNotSaveCurrentSongsIntoOldFolder);
test('旧曲库后台扫描不覆盖当前曲库界面', testStaleRefreshDoesNotRestoreOldLibrary);
