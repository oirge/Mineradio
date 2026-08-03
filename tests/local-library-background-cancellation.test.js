'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 截取本地曲库后台资产任务的启动与执行接缝。
 * @returns {string} 可在隔离 VM 中执行的生产源码。
 */
function readBackgroundProcessingSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function startLocalLibraryBackgroundProcessing(');
  const end = source.indexOf('function prepareLocalBeatAnalysis(', start + 1);
  assert.ok(start >= 0 && end > start, '未找到本地曲库后台处理接缝');
  return source.slice(start, end);
}

/**
 * 验证空候选的新曲库会立即取消旧的排队任务并释放其歌曲数组闭包。
 * @returns {void}
 */
function testEmptyCandidatesCancelQueuedProcessing() {
  const scheduled = [];

  /**
   * 记录待执行启动任务，避免测试创建真实后台定时器。
   * @param {Function} callback 待执行回调。
   * @returns {{callback: Function, cleared: boolean}} 可取消的测试句柄。
   */
  function fakeSetTimeout(callback) {
    const handle = { callback, cleared: false };
    scheduled.push(handle);
    return handle;
  }

  /**
   * 标记旧启动任务已取消，使测试能验证闭包可立即释放。
   * @param {{cleared: boolean}} handle 待取消的测试句柄。
   * @returns {void}
   */
  function fakeClearTimeout(handle) {
    handle.cleared = true;
  }

  /**
   * 保持测试候选顺序，隔离排序实现与取消语义。
   * @param {object[]} songs 候选歌曲。
   * @returns {object[]} 原候选数组。
   */
  function sortLocalAssetPreloadQueue(songs) {
    return songs;
  }

  /**
   * 测试不渲染进度界面，只保留状态变更。
   * @returns {void}
   */
  function updateLocalLibraryProcessingProgress() {}

  /**
   * 测试不需要真实启动延迟。
   * @returns {number} 固定零延迟。
   */
  function localAssetProcessingStartDelay() {
    return 0;
  }

  const context = {
    localLibraryProcessToken: 0,
    localLibraryProcessStartTimer: null,
    localLibraryProcessSongs: null,
    localLibraryProcessing: { active: false, token: 0, total: 0, assetsDone: 0 },
    localLibraryAssetUiBatchState: { progressAt: 0, refreshAt: 0 },
    sortLocalAssetPreloadQueue,
    updateLocalLibraryProcessingProgress,
    localAssetProcessingStartDelay,
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    console,
  };
  vm.runInNewContext(
    readBackgroundProcessingSource()
      + '\nthis.startProcessing = startLocalLibraryBackgroundProcessing;'
      + '\n/** @returns {object} 返回后台任务所有权状态。 */'
      + '\nthis.readState = function readState(){ return {'
      + 'token:localLibraryProcessToken,'
      + 'timer:localLibraryProcessStartTimer,'
      + 'processing:localLibraryProcessing'
      + '}; };',
    context,
  );

  assert.equal(context.startProcessing([{ localKey: 'a' }, { localKey: 'b' }], {}), 2);
  assert.equal(scheduled.length, 1);
  assert.equal(context.readState().processing.active, true);

  assert.equal(context.startProcessing([], {}), 0);
  const state = context.readState();
  assert.equal(scheduled[0].cleared, true, '旧启动定时器必须立即取消');
  assert.equal(state.token, 2, '空候选也必须使旧任务令牌失效');
  assert.equal(state.timer, null, '全局不得继续持有旧定时器句柄');
  assert.deepEqual(
    JSON.parse(JSON.stringify(state.processing)),
    { active: false, token: 2, total: 0, assetsDone: 0 },
  );
}

/**
 * 验证在途歌曲完成后，已取消任务不得污染新状态或继续处理下一首。
 * @returns {Promise<void>}
 */
async function testEmptyCandidatesCancelRunningProcessing() {
  const songs = [{ localKey: 'a' }, { localKey: 'b' }];
  const calls = { preloads: [], progress: 0, refresh: 0 };
  let resolvePreload;
  let signalPreloadStarted;

  /**
   * 捕获首个歌曲读取的完成函数，由测试控制在途窗口。
   * @param {Function} resolve Promise 完成函数。
   * @returns {void}
   */
  function capturePreloadResolve(resolve) {
    resolvePreload = resolve;
  }

  /**
   * 捕获首个歌曲开始信号，确保取消发生在真实 await 期间。
   * @param {Function} resolve Promise 完成函数。
   * @returns {void}
   */
  function capturePreloadStarted(resolve) {
    signalPreloadStarted = resolve;
  }

  const preloadPending = new Promise(capturePreloadResolve);
  const preloadStarted = new Promise(capturePreloadStarted);

  /**
   * 测试不执行启动定时器；在途执行器由公共运行接缝直接启动。
   * @returns {object} 测试定时器句柄。
   */
  function fakeSetTimeout() {
    return { cleared: false };
  }

  /**
   * 标记启动定时器已取消。
   * @param {{cleared: boolean}} handle 测试定时器句柄。
   * @returns {void}
   */
  function fakeClearTimeout(handle) {
    handle.cleared = true;
  }

  /**
   * 保持候选数组身份，使测试能验证取消后立即释放旧队列元素。
   * @param {object[]} input 候选歌曲。
   * @returns {object[]} 原候选数组。
   */
  function sortLocalAssetPreloadQueue(input) {
    return input;
  }

  /**
   * 记录状态刷新次数，取消后的旧任务不得再触发刷新。
   * @returns {void}
   */
  function updateLocalLibraryProcessingProgress() {
    calls.progress += 1;
  }

  /** @returns {number} 测试不需要真实启动延迟。 */
  function localAssetProcessingStartDelay() { return 0; }

  /** @returns {Promise<void>} 测试立即取得后台处理轮次。 */
  function waitForLocalAssetPreloadTurn() { return Promise.resolve(); }

  /** @returns {boolean} 测试歌曲不视为当前播放项。 */
  function isCurrentLocalQueueSong() { return false; }

  /**
   * 让首个歌曲保持在途，若错误继续运行则第二首会被记录。
   * @param {object} song 当前预载歌曲。
   * @returns {Promise<void>} 首个返回受控 Promise，其余立即完成。
   */
  function preloadLocalSongAssets(song) {
    calls.preloads.push(song.localKey);
    if (song.localKey === 'a') {
      signalPreloadStarted();
      return preloadPending;
    }
    return Promise.resolve();
  }

  /** @returns {boolean} 强制暴露旧任务的进度刷新副作用。 */
  function shouldUpdateLocalAssetProgressUi() { return true; }

  /** @returns {boolean} 强制暴露旧任务的界面刷新副作用。 */
  function shouldRefreshLocalAssetUiBatch() { return true; }

  /** @returns {void} 记录旧任务界面刷新。 */
  function scheduleLocalAssetUiRefresh() { calls.refresh += 1; }

  /** @returns {Promise<void>} 测试不需要真实空闲延迟。 */
  function yieldToIdle() { return Promise.resolve(); }

  /** @returns {number} 测试不需要真实后台间隔。 */
  function localAssetBackgroundDelayMs() { return 0; }

  /** @returns {void} 测试不需要调整当前歌曲顺序。 */
  function promoteCurrentLocalAssetInQueue() {}

  /** @returns {void} 测试忽略最终队列重绘。 */
  function safeRenderQueuePanel() {}

  /** @returns {void} 测试忽略最终歌单架重建。 */
  function scheduleShelfRebuild() {}

  const context = {
    localLibraryProcessToken: 0,
    localLibraryProcessStartTimer: null,
    localLibraryProcessSongs: null,
    localLibraryProcessing: { active: false, token: 0, total: 0, assetsDone: 0 },
    localLibraryAssetUiBatchState: { progressAt: 0, refreshAt: 0 },
    sortLocalAssetPreloadQueue,
    updateLocalLibraryProcessingProgress,
    localAssetProcessingStartDelay,
    waitForLocalAssetPreloadTurn,
    isCurrentLocalQueueSong,
    preloadLocalSongAssets,
    shouldUpdateLocalAssetProgressUi,
    shouldRefreshLocalAssetUiBatch,
    scheduleLocalAssetUiRefresh,
    yieldToIdle,
    localAssetBackgroundDelayMs,
    promoteCurrentLocalAssetInQueue,
    safeRenderQueuePanel,
    scheduleShelfRebuild,
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    miniQueueOpen: false,
    console,
  };
  vm.runInNewContext(
    readBackgroundProcessingSource()
      + '\nthis.startProcessing = startLocalLibraryBackgroundProcessing;'
      + '\nthis.runProcessing = runLocalLibraryBackgroundProcessing;'
      + '\n/** @returns {object} 返回后台任务所有权状态。 */'
      + '\nthis.readState = function readState(){ return {'
      + 'token:localLibraryProcessToken,'
      + 'songs:localLibraryProcessSongs,'
      + 'processing:localLibraryProcessing'
      + '}; };',
    context,
  );

  assert.equal(context.startProcessing(songs, {}), 2);
  const running = context.runProcessing(songs, 1, {});
  await preloadStarted;
  assert.equal(context.startProcessing([], {}), 0);
  assert.equal(context.readState().songs, null, '取消后不得全局持有旧队列');
  assert.equal(songs.length, 0, '取消后应立即释放尚未处理的歌曲引用');

  resolvePreload();
  await running;

  assert.deepEqual(calls.preloads, ['a']);
  assert.equal(calls.refresh, 0, '旧任务完成当前 I/O 后不得刷新界面');
  assert.equal(calls.progress, 2, '只允许新旧两次启动请求刷新状态');
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.readState().processing)),
    { active: false, token: 2, total: 0, assetsDone: 0 },
  );
}

test('空候选会取消旧的本地曲库后台资产任务', testEmptyCandidatesCancelQueuedProcessing);
test('空候选会隔离正在读取的旧后台资产任务', testEmptyCandidatesCancelRunningProcessing);
