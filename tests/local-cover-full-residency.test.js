'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 读取 renderer 主脚本源码。
 * @returns {string} 完整 index.html 文本。
 */
function readRendererSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
}

/**
 * 截取本地完整封面释放、转移和字段同步函数。
 * @returns {string} 可在隔离 VM 中执行的生产源码。
 */
function readLocalCoverOwnershipSource() {
  const source = readRendererSource();
  const start = source.indexOf('function releaseLocalFullCoverData(');
  const end = source.indexOf('async function readLocalBeatCacheForSong(', start + 1);
  assert.ok(start >= 0 && end > start, '未找到本地完整封面所有权接缝');
  return source.slice(start, end);
}

/**
 * 截取单曲克隆函数，验证入队副本不复制完整封面。
 * @returns {string} 可在隔离 VM 中执行的生产源码。
 */
function readCloneSongSource() {
  const source = readRendererSource();
  const start = source.indexOf('function cloneSong(');
  const end = source.indexOf('/**\n * 批量克隆歌曲列表', start + 1);
  assert.ok(start >= 0 && end > start, '未找到歌曲克隆接缝');
  return source.slice(start, end);
}

/**
 * 截取完整封面转缩略图的所有权入口。
 * @returns {string} 可在隔离 VM 中执行的生产源码。
 */
function readAssignLocalCoverSource() {
  const source = readRendererSource();
  const start = source.indexOf('async function assignLocalCoverSource(');
  const end = source.indexOf('function localAssetCacheSnapshot(', start + 1);
  assert.ok(start >= 0 && end > start, '未找到本地封面写入接缝');
  return source.slice(start, end);
}

/**
 * 截取本地封面加载状态机。
 * @returns {string} 可在隔离 VM 中执行的生产源码。
 */
function readEnsureLocalCoverSource() {
  const source = readRendererSource();
  const start = source.indexOf('function ensureLocalCoverForSong(');
  const end = source.indexOf('function loadLocalCoverForSong(', start + 1);
  assert.ok(start >= 0 && end > start, '未找到本地封面加载状态机');
  return source.slice(start, end);
}

/**
 * 清空测试歌曲的封面派生缓存。
 * @param {object} song 歌曲对象。
 * @returns {void}
 */
function invalidateSongCoverCache(song) {
  song._mineradioCoverCacheKey = '';
  song._mineradioCoverCacheValue = '';
  song._mineradioCoverSignatureKey = '';
  song._mineradioCoverSignatureValue = '';
}

/**
 * 模拟克隆后的封面水合，缩略图继续作为列表封面。
 * @param {object} song 歌曲副本。
 * @returns {object} 已水合的歌曲副本。
 */
function hydrateCustomCover(song) {
  if (song.localCoverThumbDataUrl) song.customCover = song.localCoverThumbDataUrl;
  return song;
}

/**
 * 验证完整封面只在当前歌曲对象间转移，不传播到曲库副本或切歌后残留。
 * @returns {void}
 */
function testFullCoverFollowsCurrentSongOnly() {
  const fullCover = 'data:image/png;base64,' + 'A'.repeat(256 * 1024);
  const thumbCover = 'data:image/webp;base64,thumb';
  const sourceSong = {
    type: 'local',
    localKey: 'song-a',
    localCoverDataUrl: fullCover,
    localCoverThumbDataUrl: thumbCover,
    localCoverLoaded: true,
  };
  const libraryCopy = { type: 'local', localKey: 'song-a', localCoverDataUrl: '' };

  /** @returns {void} 本测试没有歌词原文需要持久化。 */
  function ignoreLyricWrite() {}

  const context = {
    currentLocalSong: null,
    currentIdx: -1,
    localLibrarySongs: [sourceSong, libraryCopy],
    playQueue: [],
    playlist: [],
    invalidateSongCoverCache,
    scheduleLocalAssetCacheWrite: ignoreLyricWrite,
  };
  vm.runInNewContext(
    readLocalCoverOwnershipSource()
      + '\nthis.syncAssets = syncLocalSongAssetFields;'
      + '\nthis.handoffCover = handoffLocalFullCoverData;',
    context,
  );

  context.syncAssets(sourceSong);
  assert.equal(libraryCopy.localCoverDataUrl, '');
  assert.equal(libraryCopy.localCoverThumbDataUrl, thumbCover);

  sourceSong.customCover = fullCover;
  sourceSong._mineradioCoverCacheValue = fullCover;
  const nextSong = { type: 'local', localKey: 'song-b' };
  context.handoffCover(sourceSong, nextSong);
  assert.equal(sourceSong.localCoverDataUrl, '');
  assert.equal(sourceSong.customCover, thumbCover);
  assert.equal(sourceSong._mineradioCoverCacheValue, '');
  assert.equal(nextSong.localCoverDataUrl, undefined);

  const sameKeyPrevious = {
    type: 'local',
    localKey: 'song-c',
    localCoverDataUrl: fullCover,
    localCoverThumbDataUrl: thumbCover,
  };
  const sameKeyNext = { type: 'local', localKey: 'song-c', localCoverThumbDataUrl: thumbCover };
  context.handoffCover(sameKeyPrevious, sameKeyNext);
  assert.equal(sameKeyPrevious.localCoverDataUrl, '');
  assert.equal(sameKeyNext.localCoverDataUrl, fullCover);
}

/**
 * 验证入队克隆只带缩略图，并清除可能保存完整 data URL 的派生缓存。
 * @returns {void}
 */
function testCloneSongSkipsFullCover() {
  const fullCover = 'data:image/png;base64,' + 'B'.repeat(256 * 1024);
  const thumbCover = 'data:image/webp;base64,thumb';
  const pending = Promise.resolve(true);
  const context = { hydrateCustomCover, invalidateSongCoverCache };
  vm.runInNewContext(readCloneSongSource() + '\nthis.clone = cloneSong;', context);

  const copy = context.clone({
    type: 'local',
    localKey: 'song-a',
    localCoverDataUrl: fullCover,
    localCoverThumbDataUrl: thumbCover,
    customCover: fullCover,
    _mineradioCoverCacheValue: fullCover,
    localMetadataPromise: pending,
    localCoverPromise: pending,
    localLyricPromise: pending,
    localLyricCachePromise: pending,
    localCoverLoading: true,
    localLyricLoading: true,
  });

  assert.equal(copy.localCoverDataUrl, undefined);
  assert.equal(copy.localCoverThumbDataUrl, thumbCover);
  assert.equal(copy.customCover, thumbCover);
  assert.equal(copy._mineradioCoverCacheValue, '');
  assert.equal(copy.localMetadataPromise, undefined);
  assert.equal(copy.localCoverPromise, undefined);
  assert.equal(copy.localLyricPromise, undefined);
  assert.equal(copy.localLyricCachePromise, undefined);
  assert.equal(copy.localCoverLoading, undefined);
  assert.equal(copy.localLyricLoading, undefined);
}

/**
 * 验证释放完整封面后，持久索引和详情仍根据缩略图识别内嵌封面。
 * @returns {void}
 */
function testThumbnailPreservesEmbeddedCoverMetadata() {
  const source = readRendererSource();
  assert.match(source, /localCoverSource: song\.localCoverFile \? 'file' : \(\(song\.localCoverThumbDataUrl \|\| song\.localCoverDataUrl\) \? 'embedded'/);
  assert.match(source, /song\.localCoverFileName \|\| \(\(song\.localCoverThumbDataUrl \|\| song\.localCoverDataUrl\) \? '内嵌封面'/);
}

/**
 * 验证后台或迟到的封面读取不能在旧歌曲对象上重新保留完整 data URL。
 * @returns {void}
 */
function testFullCoverRetentionRequiresCurrentOwnership() {
  const currentSong = { type: 'local', localKey: 'song-a' };
  const context = {
    currentLocalSong: currentSong,
    currentIdx: 0,
    invalidateSongCoverCache,
    localLibrarySongs: [],
    playQueue: [currentSong],
    playlist: [],
  };
  vm.runInNewContext(
    readLocalCoverOwnershipSource() + '\nthis.canRetainFullCover = shouldRetainLocalFullCoverData;',
    context,
  );

  assert.equal(context.canRetainFullCover(currentSong), true);
  assert.equal(context.canRetainFullCover({ type: 'local', localKey: 'song-a' }), false);
  context.currentLocalSong = null;
  assert.equal(context.canRetainFullCover(currentSong), false);
}

/**
 * 验证清空队列时同步释放已失去队列所有权的完整封面。
 * @returns {void}
 */
function testQueueClearReleasesFullCover() {
  const source = readRendererSource();
  const start = source.indexOf('function clearQueue()');
  const end = source.indexOf('function removeFromQueue(', start + 1);
  assert.ok(start >= 0 && end > start, '未找到清空播放队列接缝');
  assert.match(
    source.slice(start, end),
    /playQueue = \[\]; currentIdx = -1;\s+releaseLocalFullCoverData\(currentLocalSong\);/,
  );
}

/**
 * 验证缩略图失败时完整 data URL 不会伪装成可持久化缩略图。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testThumbnailFailureKeepsFullCoverOnlyOnCurrentSong() {
  const fullCover = 'data:image/png;base64,' + 'C'.repeat(256 * 1024);

  /** @returns {Promise<string>} 模拟缩略图生成失败。 */
  function createLocalCoverThumbnailDataUrl() { return Promise.resolve(''); }

  /** @param {object} song 歌曲对象。 @returns {boolean} 是否为当前完整封面所有者。 */
  function shouldRetainLocalFullCoverData(song) { return !!song.current; }

  /** @returns {void} 测试不需要真实缓存失效副作用。 */
  function ignoreCoverCacheInvalidation() {}

  const context = {
    LOCAL_COVER_THUMB_MAX_SIZE: 512,
    LOCAL_COVER_THUMB_QUALITY: 0.82,
    createLocalCoverThumbnailDataUrl,
    invalidateSongCoverCache: ignoreCoverCacheInvalidation,
    shouldRetainLocalFullCoverData,
  };
  vm.runInNewContext(readAssignLocalCoverSource() + '\nthis.assignCover = assignLocalCoverSource;', context);

  const backgroundSong = { current: false };
  const backgroundAssigned = await context.assignCover(backgroundSong, fullCover, { thumbnailOnly: true });
  assert.equal(backgroundAssigned, false);
  assert.equal(backgroundSong.localCoverThumbDataUrl || '', '');
  assert.equal(backgroundSong.localCoverDataUrl || '', '');

  const currentSong = { current: true };
  const currentAssigned = await context.assignCover(currentSong, fullCover, {});
  assert.equal(currentAssigned, true);
  assert.equal(currentSong.localCoverThumbDataUrl || '', '');
  assert.equal(currentSong.localCoverDataUrl, fullCover);
}

/**
 * 验证后台缩略图失败不会被标记为已加载或写入完整封面缓存。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testBackgroundThumbnailFailureRemainsRetryable() {
  const fullCover = 'data:image/png;base64,' + 'D'.repeat(256 * 1024);
  let cacheWrites = 0;

  /** @returns {Promise<string>} 返回已提取的内嵌完整封面。 */
  function extractEmbeddedCoverSource() { return Promise.resolve(fullCover); }

  /** @returns {Promise<boolean>} 模拟非当前对象缩略图生成失败。 */
  function assignLocalCoverSource() { return Promise.resolve(false); }

  /** @returns {boolean} 测试歌曲允许读取 FLAC 内嵌封面。 */
  function canReadEmbeddedFlacCover() { return true; }

  /** @returns {void} 记录不应发生的资产缓存写入。 */
  function scheduleLocalAssetCacheWrite() { cacheWrites += 1; }

  /** @returns {void} 测试忽略轻量字段同步。 */
  function ignoreSync() {}

  /** @returns {void} 测试忽略界面刷新。 */
  function ignoreUiRefresh() {}

  /** @returns {void} 测试忽略当前封面应用。 */
  function ignoreCurrentCoverApply() {}

  /** @returns {void} 测试忽略预期内告警。 */
  function ignoreWarning() {}

  /** @returns {string} 返回稳定的测试封面缓存键来源。 */
  function localLibraryFileSignatureFromSong() { return 'song.flac|1|1'; }

  const context = {
    LOCAL_COVER_THUMB_MAX_SIZE: 512,
    LOCAL_COVER_THUMB_QUALITY: 0.82,
    Promise,
    assignLocalCoverSource,
    canReadEmbeddedFlacCover,
    console: { warn: ignoreWarning },
    extractEmbeddedCoverSource,
    invalidateSongCoverCache: ignoreSync,
    localLibraryFileSignatureFromSong,
    maybeApplyLocalCoverForSong: ignoreCurrentCoverApply,
    readFileAsDataUrl: extractEmbeddedCoverSource,
    scheduleLocalAssetCacheWrite,
    scheduleLocalAssetUiRefresh: ignoreUiRefresh,
    syncLocalSongAssetFields: ignoreSync,
  };
  vm.runInNewContext(readEnsureLocalCoverSource() + '\nthis.ensureCover = ensureLocalCoverForSong;', context);

  const song = { type: 'local', name: '后台歌曲', localFile: { name: 'song.flac' } };
  const loaded = await context.ensureCover(song, { background: true, applyCurrent: false });
  assert.equal(loaded, false);
  assert.equal(song.localCoverLoaded || false, false);
  assert.equal(song.localCoverLightScanned, true);
  assert.equal(song.localCoverThumbDataUrl || '', '');
  assert.equal(song.localCoverDataUrl || '', '');
  assert.equal(cacheWrites, 0);
}

/**
 * 验证当前歌曲仅临时持有完整封面时不写入空缩略图已加载状态。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testCurrentFullCoverWithoutThumbnailIsNotPersistedAsLoaded() {
  const fullCover = 'data:image/png;base64,' + 'E'.repeat(256 * 1024);
  let cacheWrites = 0;
  let currentApplies = 0;

  /** @returns {Promise<string>} 返回已提取的完整封面。 */
  function extractEmbeddedCoverSource() { return Promise.resolve(fullCover); }

  /**
   * 模拟缩略图失败但当前歌曲取得完整封面所有权。
   * @param {object} song 当前歌曲。
   * @returns {Promise<boolean>} 当前会话可用结果。
   */
  function assignLocalCoverSource(song) {
    song.localCoverDataUrl = fullCover;
    song.localCoverThumbDataUrl = '';
    return Promise.resolve(true);
  }

  /** @returns {Promise<string>} 重复调用时继续模拟缩略图生成失败。 */
  function createLocalCoverThumbnailDataUrl() { return Promise.resolve(''); }

  /** @returns {boolean} 测试歌曲允许读取内嵌封面。 */
  function canReadEmbeddedFlacCover() { return true; }

  /** @returns {void} 记录不应发生的持久缓存写入。 */
  function scheduleLocalAssetCacheWrite() { cacheWrites += 1; }

  /** @returns {void} 记录当前完整封面应用。 */
  function maybeApplyLocalCoverForSong() { currentApplies += 1; }

  /** @returns {void} 测试忽略轻量字段同步和 UI 刷新。 */
  function ignoreSideEffect() {}

  /** @returns {void} 测试忽略预期内告警。 */
  function ignoreWarning() {}

  /** @returns {string} 返回稳定的测试封面缓存键来源。 */
  function localLibraryFileSignatureFromSong() { return 'song.flac|1|1'; }

  const context = {
    LOCAL_COVER_THUMB_MAX_SIZE: 512,
    LOCAL_COVER_THUMB_QUALITY: 0.82,
    Promise,
    assignLocalCoverSource,
    canReadEmbeddedFlacCover,
    console: { warn: ignoreWarning },
    createLocalCoverThumbnailDataUrl,
    extractEmbeddedCoverSource,
    invalidateSongCoverCache: ignoreSideEffect,
    localLibraryFileSignatureFromSong,
    maybeApplyLocalCoverForSong,
    readFileAsDataUrl: extractEmbeddedCoverSource,
    scheduleLocalAssetCacheWrite,
    scheduleLocalAssetUiRefresh: ignoreSideEffect,
    syncLocalSongAssetFields: ignoreSideEffect,
  };
  vm.runInNewContext(readEnsureLocalCoverSource() + '\nthis.ensureCover = ensureLocalCoverForSong;', context);

  const song = { type: 'local', name: '当前歌曲', localFile: { name: 'song.flac' } };
  const loaded = await context.ensureCover(song, { background: false, applyCurrent: true });
  assert.equal(loaded, true);
  assert.equal(song.localCoverLoaded || false, false);
  assert.equal(song.localCoverThumbDataUrl || '', '');
  assert.equal(song.localCoverDataUrl, fullCover);
  assert.equal(cacheWrites, 0);
  assert.equal(currentApplies, 1);

  const loadedAgain = await context.ensureCover(song, { background: false, applyCurrent: true });
  await Promise.resolve();
  assert.equal(loadedAgain, true);
  assert.equal(song.localCoverLoaded || false, false);
  assert.equal(cacheWrites, 0);
}

/**
 * 验证非当前歌曲的后台内嵌封面直接把 Blob 交给缩略图链路。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testBackgroundEmbeddedCoverSkipsFullDataUrl() {
  const coverBlob = { type: 'image/png', size: 4096 };
  let sourceReads = 0;
  let dataUrlReads = 0;
  let sourceAssignments = 0;

  /** @returns {Promise<object>} 返回后台缩略图使用的临时 Blob。 */
  function extractEmbeddedCoverSource() {
    sourceReads += 1;
    return Promise.resolve(coverBlob);
  }

  /** @returns {Promise<string>} 记录不应发生的完整 data URL 提取。 */
  function readFileAsDataUrl() {
    dataUrlReads += 1;
    return Promise.resolve('data:image/png;base64,unexpected');
  }

  /**
   * 记录 Blob 来源并模拟成功生成可持久化缩略图。
   * @param {object} song 后台歌曲。
   * @param {object} source 封面 Blob。
   * @returns {Promise<boolean>} 固定成功结果。
   */
  function assignLocalCoverSource(song, source) {
    sourceAssignments += 1;
    assert.equal(source, coverBlob);
    song.localCoverThumbDataUrl = 'data:image/webp;base64,thumb';
    song.localCoverDataUrl = '';
    return Promise.resolve(true);
  }

  /** @returns {boolean} 测试歌曲允许读取 FLAC 内嵌封面。 */
  function canReadEmbeddedFlacCover() { return true; }

  /** @returns {void} 测试忽略轻量副作用。 */
  function ignoreSideEffect() {}

  /** @returns {void} 测试忽略预期内告警。 */
  function ignoreWarning() {}

  /** @returns {string} 返回后台歌曲的稳定文件签名。 */
  function localLibraryFileSignatureFromSong() { return 'background.flac|4096|1'; }

  const context = {
    LOCAL_COVER_THUMB_MAX_SIZE: 512,
    LOCAL_COVER_THUMB_QUALITY: 0.82,
    Promise,
    assignLocalCoverSource,
    canReadEmbeddedFlacCover,
    console: { warn: ignoreWarning },
    extractEmbeddedCoverSource,
    invalidateSongCoverCache: ignoreSideEffect,
    localLibraryFileSignatureFromSong,
    maybeApplyLocalCoverForSong: ignoreSideEffect,
    readFileAsDataUrl,
    scheduleLocalAssetCacheWrite: ignoreSideEffect,
    scheduleLocalAssetUiRefresh: ignoreSideEffect,
    syncLocalSongAssetFields: ignoreSideEffect,
  };
  vm.runInNewContext(readEnsureLocalCoverSource() + '\nthis.ensureCover = ensureLocalCoverForSong;', context);

  const song = { type: 'local', name: '后台歌曲', localFile: { name: 'background.flac' } };
  const loaded = await context.ensureCover(song, { background: true, applyCurrent: false });
  assert.equal(loaded, true);
  assert.equal(sourceReads, 1);
  assert.equal(dataUrlReads, 0);
  assert.equal(sourceAssignments, 1);
  assert.equal(song.localCoverThumbDataUrl, 'data:image/webp;base64,thumb');
  assert.equal(song.localCoverDataUrl || '', '');
}

/**
 * 验证 Blob 转完整 data URL 期间切歌后不会把完整封面写回旧歌曲对象。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testEmbeddedCoverConversionRechecksCurrentOwnership() {
  const coverBlob = { type: 'image/png', size: 4096 };
  let finishConversion;
  let conversionCalls = 0;

  /** @returns {Promise<string>} 模拟已成功生成的缩略图。 */
  function createLocalCoverThumbnailDataUrl() {
    return Promise.resolve('data:image/webp;base64,thumb');
  }

  /** @param {object} song 歌曲对象。 @returns {boolean} 是否仍持有当前播放租约。 */
  function shouldRetainLocalFullCoverData(song) { return !!song.current; }

  /** @returns {Promise<string>} 暂停完整图转换，允许测试在完成前撤销所有权。 */
  function readFileAsDataUrl() {
    conversionCalls += 1;
    /** @param {Function} resolve 完整图转换完成函数。 @returns {void} 保存外部完成入口。 */
    function captureConversionResolve(resolve) { finishConversion = resolve; }
    return new Promise(captureConversionResolve);
  }

  /** @returns {void} 测试忽略封面派生缓存失效。 */
  function ignoreCoverCacheInvalidation() {}

  /** @returns {Promise<void>} 等待隔离 VM 的异步函数推进一轮。 */
  function waitForVmTurn() {
    /** @param {Function} resolve 本轮等待完成函数。 @returns {void} 安排到下一事件轮。 */
    function scheduleVmTurn(resolve) { setImmediate(resolve); }
    return new Promise(scheduleVmTurn);
  }

  const context = {
    LOCAL_COVER_THUMB_MAX_SIZE: 512,
    LOCAL_COVER_THUMB_QUALITY: 0.82,
    createLocalCoverThumbnailDataUrl,
    invalidateSongCoverCache: ignoreCoverCacheInvalidation,
    readFileAsDataUrl,
    shouldRetainLocalFullCoverData,
  };
  vm.runInNewContext(readAssignLocalCoverSource() + '\nthis.assignCoverSource = assignLocalCoverSource;', context);

  const song = { current: true };
  const assignment = context.assignCoverSource(song, coverBlob, { cacheKey: 'embedded:song-a' });
  for (let i = 0; i < 4 && !finishConversion; i += 1) await waitForVmTurn();
  assert.equal(conversionCalls, 1);
  song.current = false;
  finishConversion('data:image/png;base64,full');
  const assigned = await assignment;

  assert.equal(assigned, true, '缩略图仍是成功的可持久化结果');
  assert.equal(song.localCoverThumbDataUrl, 'data:image/webp;base64,thumb');
  assert.equal(song.localCoverDataUrl || '', '');
}

test('完整本地封面只跟随当前播放歌曲', testFullCoverFollowsCurrentSongOnly);
test('歌曲克隆不复制完整本地封面', testCloneSongSkipsFullCover);
test('缩略图继续保留内嵌封面元数据', testThumbnailPreservesEmbeddedCoverMetadata);
test('完整封面写入只认当前歌曲对象所有权', testFullCoverRetentionRequiresCurrentOwnership);
test('清空队列释放完整本地封面', testQueueClearReleasesFullCover);
test('缩略图失败时完整封面只由当前歌曲持有', testThumbnailFailureKeepsFullCoverOnlyOnCurrentSong);
test('后台缩略图失败保持前台可重试状态', testBackgroundThumbnailFailureRemainsRetryable);
test('当前完整封面无缩略图时不持久化已加载状态', testCurrentFullCoverWithoutThumbnailIsNotPersistedAsLoaded);
test('后台内嵌封面跳过完整 data URL', testBackgroundEmbeddedCoverSkipsFullDataUrl);
test('内嵌封面转换完成前切歌不会写回旧对象', testEmbeddedCoverConversionRechecksCurrentOwnership);
