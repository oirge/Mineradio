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
 * 截取资产记录应用与批量补水函数。
 * @returns {string} 可在隔离 VM 中执行的生产源码。
 */
function readAssetHydrationSource() {
  const source = readRendererSource();
  const start = source.indexOf('function canUseCachedLocalMetadata(');
  const end = source.indexOf('/**\n * 把已捕获的单曲资产快照写入 IndexedDB', start + 1);
  assert.ok(start >= 0 && end > start, '未找到本地资产补水接缝');
  return source.slice(start, end);
}

/**
 * 截取单曲歌词缓存按需恢复与歌词加载函数。
 * @returns {string} 可在隔离 VM 中执行的生产源码。
 */
function readLazyLyricSource() {
  const source = readRendererSource();
  const start = source.indexOf('function hydrateLocalLyricCacheForSong(');
  const end = source.indexOf('function loadLocalLyricsForSong(', start + 1);
  assert.ok(start >= 0 && end > start, '未找到单曲歌词按需恢复接缝');
  return source.slice(start, end);
}

/**
 * 截取后台资产候选判断与单曲预载函数。
 * @returns {string} 可在隔离 VM 中执行的生产源码。
 */
function readBackgroundAssetSource() {
  const source = readRendererSource();
  const needsStart = source.indexOf('function localSongNeedsAssetPreload(');
  const needsEnd = source.indexOf('function localAssetQueuePositionMap(', needsStart + 1);
  const preloadStart = source.indexOf('async function preloadLocalSongAssets(');
  const preloadEnd = source.indexOf('function savedLocalLibraryFolderPath(', preloadStart + 1);
  assert.ok(needsStart >= 0 && needsEnd > needsStart, '未找到后台资产候选函数');
  assert.ok(preloadStart >= 0 && preloadEnd > preloadStart, '未找到后台单曲预载函数');
  return source.slice(needsStart, needsEnd) + '\n' + source.slice(preloadStart, preloadEnd);
}

/**
 * 截取本地资产缓存的延迟写入调度接缝。
 * @returns {string} 可在隔离 VM 中执行的生产源码。
 */
function readAssetWriteSchedulingSource() {
  const source = readRendererSource();
  const start = source.indexOf('function scheduleLocalAssetCacheWrite(');
  const end = source.indexOf('var colorLabState =', start + 1);
  assert.ok(start >= 0 && end > start, '未找到本地资产缓存写入调度接缝');
  return source.slice(start, end);
}

/**
 * 截取已释放歌词记录的 IndexedDB 合并写入接缝。
 * @returns {string} 可在隔离 VM 中执行的生产源码。
 */
function readAssetRecordWriteSource() {
  const source = readRendererSource();
  const start = source.indexOf('function copyLocalLyricCachePayload(');
  const end = source.indexOf('/**\n * 延迟写入单曲资产', start + 1);
  assert.ok(start >= 0 && end > start, '未找到歌词缓存合并写入接缝');
  return source.slice(start, end);
}

/**
 * 截取本地歌词原文播放租约接缝。
 * @returns {string} 可在隔离 VM 中执行的生产源码。
 */
function readLyricResidencySource() {
  const source = readRendererSource();
  const start = source.indexOf('function shouldRetainLocalLyricText(');
  const end = source.indexOf('function syncLocalSongAssetFields(', start + 1);
  assert.ok(start >= 0 && end > start, '未找到本地歌词原文播放租约接缝');
  return source.slice(start, end);
}

/**
 * 截取歌词原文租约及同曲资产同步实现。
 * @returns {string} 可在隔离 VM 中执行的生产源码。
 */
function readLyricResidencyAndSyncSource() {
  const source = readRendererSource();
  const start = source.indexOf('function shouldRetainLocalLyricText(');
  const end = source.indexOf('async function readLocalBeatCacheForSong(', start + 1);
  assert.ok(start >= 0 && end > start, '未找到本地歌词租约与资产同步接缝');
  return source.slice(start, end);
}

/**
 * 截取本地曲库资产状态与索引记录生成函数。
 * @returns {string} 可在隔离 VM 中执行的生产源码。
 */
function readLocalLibraryIndexRecordSource() {
  const source = readRendererSource();
  const start = source.indexOf('function localLibraryAssetStatus(');
  const end = source.indexOf('function localLibraryRecordMatchesSong(', start + 1);
  assert.ok(start >= 0 && end > start, '未找到本地曲库索引记录接缝');
  return source.slice(start, end);
}

/**
 * 在调度隔离测试中复制歌词缓存字段，保持与生产调度依赖一致。
 * @param {object} sourceRecord 已持有歌词的记录。
 * @param {object} targetRecord 新的轻量记录。
 * @returns {void}
 */
function copyTestLyricCachePayload(sourceRecord, targetRecord) {
  targetRecord.localLyricText = sourceRecord.localLyricText || '';
  targetRecord.localLyricLoaded = !!sourceRecord.localLyricLoaded;
  targetRecord.localLyricFileName = sourceRecord.localLyricFileName || '';
  targetRecord.localLyricTagName = sourceRecord.localLyricTagName || '';
  targetRecord.localLyricFileSignature = sourceRecord.localLyricFileSignature || '';
  targetRecord.localLyricSource = sourceRecord.localLyricSource || '';
}

/**
 * 验证全曲库补水保留封面缩略图，但不把每首歌词文本挂入歌曲对象。
 * @returns {Promise<void>}
 */
async function testBulkHydrationSkipsLyrics() {
  const lyricText = '[00:01.00]' + '长歌词'.repeat(64 * 1024);
  const record = {
    id: 'song-1',
    localLyricText: lyricText,
    localLyricLoaded: true,
    localLyricSource: 'embedded',
    localCoverThumbDataUrl: 'data:image/webp;base64,AAAA',
    localCoverLoaded: true,
    localCoverSource: 'embedded',
  };

  /**
   * 返回固定 IndexedDB 记录表。
   * @returns {Promise<object>} 以歌曲 key 索引的记录。
   */
  async function readLocalAssetCacheRecords() {
    return { 'song-1': record };
  }

  /** @returns {string} 测试歌曲没有外部文件签名。 */
  function localAssetFileSignature() { return ''; }

  /** @returns {string} 直接使用歌曲 localKey。 */
  function localAssetCacheKey(song) { return song && song.localKey || ''; }

  /** @returns {void} 测试不需要同步副本。 */
  function noop() {}

  /** @returns {Promise<void>} 测试无需等待真实空闲调度。 */
  function yieldToIdle() { return Promise.resolve(); }

  const context = {
    LOCAL_METADATA_TAG_SCHEMA: 1,
    LOCAL_METADATA_TEXT_FIELDS: [],
    LOCAL_METADATA_VALUE_FIELDS: [],
    Number,
    String,
    readLocalAssetCacheRecords,
    localAssetFileSignature,
    localAssetCacheKey,
    invalidateSongCoverCache: noop,
    syncLocalSongAssetFields: noop,
    yieldToIdle,
    console,
  };
  vm.runInNewContext(
    readAssetHydrationSource()
      + '\nthis.hydrate = hydrateLocalAssetCacheForSongs;',
    context,
  );

  const bulkSong = { localKey: 'song-1', localLyricText: '', localLyricLoaded: false };
  await context.hydrate([bulkSong], { includeLyrics: false });
  assert.equal(bulkSong.localCoverThumbDataUrl, record.localCoverThumbDataUrl);
  assert.equal(bulkSong.localLyricText, '');
  assert.equal(bulkSong.localLyricLoaded, false);

  const singleSong = { localKey: 'song-1', localLyricText: '', localLyricLoaded: false };
  await context.hydrate([singleSong]);
  assert.equal(singleSong.localLyricText, lyricText);
  assert.equal(singleSong.localLyricLoaded, true);
}

/**
 * 验证歌曲真正播放时先单条读取 IndexedDB 歌词，再走现有应用路径。
 * @returns {Promise<void>}
 */
async function testPlaybackHydratesOneCachedLyric() {
  const calls = { reads: 0, applied: 0, options: null };

  /**
   * 模拟单条 IndexedDB 补水并写回歌词字段。
   * @param {object[]} songs 待补水歌曲。
   * @param {number} _start 起始位置。
   * @param {number} _end 结束位置。
   * @param {object} options 补水字段选项。
   * @returns {Promise<number>} 命中一条记录。
   */
  async function hydrateLocalAssetCacheForSongRange(songs, _start, _end, options) {
    calls.reads += 1;
    calls.options = options;
    songs[0].localLyricText = '[00:01.00]缓存歌词';
    songs[0].localLyricLoaded = true;
    return 1;
  }

  /** @returns {void} 记录歌词应用次数。 */
  function maybeApplyLocalLyricsForSong() { calls.applied += 1; }

  /** @returns {boolean} 测试不需要读取 FLAC 内嵌歌词。 */
  function canReadEmbeddedFlacLyrics() { return false; }

  /** @returns {void} 测试不需要持久化或同步副本。 */
  function noop() {}

  /** @returns {boolean} 测试歌曲始终视为当前播放项。 */
  function isCurrentLocalQueueSong() { return true; }

  const context = {
    hydrateLocalAssetCacheForSongRange,
    maybeApplyLocalLyricsForSong,
    canReadEmbeddedFlacLyrics,
    scheduleLocalAssetCacheWrite: noop,
    syncLocalSongAssetFields: noop,
    scheduleLocalAssetUiRefresh: noop,
    isCurrentLocalQueueSong,
    shouldRetainLocalLyricText: isCurrentLocalQueueSong,
    updateCustomLyricControls: noop,
    trackSwitchToken: 1,
    Promise,
  };
  vm.runInNewContext(
    readLazyLyricSource()
      + '\nthis.ensureLyrics = ensureLocalLyricsForSong;',
    context,
  );

  const song = {
    localKey: 'song-1',
    localIndexedLyricStatus: 'ready',
    localLyricText: '',
    localLyricLoaded: false,
  };
  const loaded = await context.ensureLyrics(song, { token: 1, applyCurrent: true });

  assert.equal(loaded, true);
  assert.equal(calls.reads, 1);
  assert.equal(calls.options.includeLyrics, true);
  assert.equal(calls.options.includeCover, false);
  assert.equal(calls.applied, 1);
}

/**
 * 验证后台批处理只准备元数据和封面，不为未播放歌曲批量读取歌词文件。
 * @returns {Promise<void>}
 */
async function testBackgroundProcessingSkipsInactiveLyrics() {
  const calls = { metadata: 0, covers: 0, lyrics: 0 };

  /** @returns {boolean} 测试歌曲不需要读取内嵌 FLAC 歌词。 */
  function canReadEmbeddedFlacLyrics() { return false; }

  /** @returns {boolean} 测试歌曲不需要读取内嵌封面。 */
  function canReadEmbeddedCover() { return false; }

  /** @returns {boolean} 测试不等待历史缓存。 */
  function localIndexedAssetCanWaitForCache() { return false; }

  /** @returns {Promise<boolean>} 记录元数据准备。 */
  function ensureLocalMetadataForSong() {
    calls.metadata += 1;
    return Promise.resolve(true);
  }

  /** @returns {Promise<boolean>} 记录封面准备。 */
  function ensureLocalCoverForSong() {
    calls.covers += 1;
    return Promise.resolve(true);
  }

  /** @returns {Promise<boolean>} 记录歌词读取。 */
  function ensureLocalLyricsForSong() {
    calls.lyrics += 1;
    return Promise.resolve(true);
  }

  const context = {
    canReadEmbeddedFlacLyrics,
    canReadEmbeddedCover,
    localIndexedAssetCanWaitForCache,
    ensureLocalMetadataForSong,
    ensureLocalCoverForSong,
    ensureLocalLyricsForSong,
    trackSwitchToken: 1,
  };
  vm.runInNewContext(
    readBackgroundAssetSource()
      + '\nthis.needsPreload = localSongNeedsAssetPreload;'
      + '\nthis.preload = preloadLocalSongAssets;',
    context,
  );

  const lyricOnlySong = {
    type: 'local',
    localMetadataLoaded: true,
    localLyricLoaded: false,
    localLyricLightScanned: false,
    localLyricFile: { name: 'song.lrc' },
    localCoverLoaded: true,
  };
  assert.equal(context.needsPreload(lyricOnlySong), false);

  const coverSong = {
    type: 'local',
    localMetadataLoaded: true,
    localCoverLoaded: false,
    localCoverLightScanned: false,
    localCoverFile: { name: 'cover.jpg' },
  };
  await context.preload(coverSong, { background: true, applyCurrent: false });
  assert.equal(calls.metadata, 1);
  assert.equal(calls.covers, 1);
  assert.equal(calls.lyrics, 0);

  await context.preload(coverSong, { background: true, applyCurrent: true });
  assert.equal(calls.lyrics, 1);
}

/**
 * 验证延迟缓存写入在调度时捕获歌词，切歌释放歌曲字段后仍写入完整原文。
 * @returns {Promise<void>}
 */
async function testScheduledAssetWriteCapturesLyricSnapshot() {
  let scheduledCallback = null;
  let writtenRecord = null;

  /**
   * 保存唯一调度回调，避免测试创建真实后台定时器。
   * @param {Function} callback 待执行写入回调。
   * @returns {number} 固定测试句柄。
   */
  function fakeSetTimeout(callback) {
    scheduledCallback = callback;
    return 1;
  }

  /** @returns {void} 测试只有一次调度，无需执行真实取消。 */
  function fakeClearTimeout() {}

  /**
   * 使用歌曲 key 作为资产缓存键。
   * @param {object} song 本地歌曲。
   * @returns {string} 缓存键。
   */
  function localAssetCacheKey(song) {
    return song.localKey;
  }

  /**
   * 捕获调度时歌曲字段，模拟完整生产快照。
   * @param {object} song 本地歌曲。
   * @returns {object} 最小测试快照。
   */
  function localAssetCacheSnapshot(song) {
    return { id: song.localKey, localLyricText: song.localLyricText, localLyricLoaded: song.localLyricLoaded };
  }

  /**
   * 记录新接缝写入的不可变快照。
   * @param {object} record 待写记录。
   * @returns {Promise<boolean>} 固定成功。
   */
  function writeLocalAssetCacheRecord(record) {
    writtenRecord = record;
    return Promise.resolve(true);
  }

  /**
   * 模拟旧实现从已释放歌曲现场构造记录，用于证明红测确实覆盖竞态。
   * @param {object} song 本地歌曲。
   * @returns {Promise<boolean>} 固定成功。
   */
  function writeLocalAssetCacheForSong(song) {
    writtenRecord = localAssetCacheSnapshot(song);
    return Promise.resolve(true);
  }

  /** @returns {void} 测试不需要写曲库索引。 */
  function scheduleLocalLibraryIndexSave() {}

  /** @returns {string} 测试不需要真实文件夹路径。 */
  function savedLocalLibraryFolderPath() { return ''; }

  const context = {
    localAssetCacheWriteTimers: {},
    localAssetCacheWriteRecords: {},
    localLibrarySongs: [],
    localAssetCacheKey,
    localAssetCacheSnapshot,
    copyLocalLyricCachePayload: copyTestLyricCachePayload,
    writeLocalAssetCacheRecord,
    writeLocalAssetCacheForSong,
    scheduleLocalLibraryIndexSave,
    savedLocalLibraryFolderPath,
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    Promise,
  };
  vm.runInNewContext(
    readAssetWriteSchedulingSource() + '\nthis.scheduleWrite = scheduleLocalAssetCacheWrite;',
    context,
  );

  const song = {
    localKey: 'song-1',
    localLyricText: '[00:01.00]' + '长歌词'.repeat(1024),
    localLyricLoaded: true,
  };
  const expectedText = song.localLyricText;
  context.scheduleWrite(song);
  song.localLyricText = '';
  song.localLyricLoaded = false;
  scheduledCallback();
  await Promise.resolve();

  assert.equal(writtenRecord.localLyricText, expectedText);
  assert.equal(writtenRecord.localLyricLoaded, true);
}

/**
 * 验证同 key 的后续轻量调度不会用已释放空字段覆盖待写歌词快照。
 * @returns {Promise<void>}
 */
async function testReleasedLyricKeepsPendingAssetSnapshot() {
  let scheduledCallback = null;
  let writtenRecord = null;

  /**
   * 始终保留最新调度回调，模拟同 key debounce 替换。
   * @param {Function} callback 待执行写入回调。
   * @returns {number} 固定测试句柄。
   */
  function fakeSetTimeout(callback) {
    scheduledCallback = callback;
    return 1;
  }

  /** @returns {void} 测试通过覆盖回调模拟定时器取消。 */
  function fakeClearTimeout() {}

  /** @param {object} song 本地歌曲。 @returns {string} 资产键。 */
  function localAssetCacheKey(song) { return song.localKey; }

  /**
   * 捕获歌词与轻量元数据的最小资产快照。
   * @param {object} song 本地歌曲。
   * @returns {object} 测试资产快照。
   */
  function localAssetCacheSnapshot(song) {
    return {
      id: song.localKey,
      name: song.name || '',
      localLyricText: song.localLyricText || '',
      localLyricLoaded: !!song.localLyricLoaded,
      localLyricFileName: song.localLyricFileName || '',
      localLyricTagName: song.localLyricTagName || '',
      localLyricFileSignature: 'sig',
      localLyricSource: 'file',
    };
  }

  /**
   * 记录最终写入快照。
   * @param {object} record 资产记录。
   * @returns {Promise<boolean>} 固定成功。
   */
  function writeLocalAssetCacheRecord(record) {
    writtenRecord = record;
    return Promise.resolve(true);
  }

  /** @returns {Promise<boolean>} 测试不走立即写入接缝。 */
  function writeLocalAssetCacheForSong() { return Promise.resolve(true); }

  /** @returns {void} 测试不需要索引同步。 */
  function scheduleLocalLibraryIndexSave() {}

  /** @returns {string} 测试不需要真实目录。 */
  function savedLocalLibraryFolderPath() { return ''; }

  const context = {
    localAssetCacheWriteTimers: {},
    localAssetCacheWriteRecords: {},
    localLibrarySongs: [],
    localAssetCacheKey,
    localAssetCacheSnapshot,
    copyLocalLyricCachePayload: copyTestLyricCachePayload,
    writeLocalAssetCacheRecord,
    writeLocalAssetCacheForSong,
    scheduleLocalLibraryIndexSave,
    savedLocalLibraryFolderPath,
    setTimeout: fakeSetTimeout,
    clearTimeout: fakeClearTimeout,
    Promise,
  };
  vm.runInNewContext(
    readAssetWriteSchedulingSource() + '\nthis.scheduleWrite = scheduleLocalAssetCacheWrite;',
    context,
  );

  const lyricText = '[00:01.00]' + '歌词'.repeat(2048);
  const song = {
    localKey: 'song-1',
    name: '旧标题',
    localLyricText: lyricText,
    localLyricLoaded: true,
    localLyricFileName: 'song.lrc',
    localLyricTagName: '外置歌词',
  };
  context.scheduleWrite(song);
  song.localLyricText = '';
  song.localLyricLoaded = false;
  song.localLyricResidencyReleased = true;
  song.localIndexedLyricStatus = 'ready';
  song.name = '新标题';
  context.scheduleWrite(song);
  scheduledCallback();
  await Promise.resolve();

  assert.equal(writtenRecord.name, '新标题');
  assert.equal(writtenRecord.localLyricText, lyricText);
  assert.equal(writtenRecord.localLyricLoaded, true);
}

/**
 * 验证待写队列已释放后，后续轻量记录会从 IndexedDB 合并既有歌词原文。
 * @returns {Promise<void>}
 */
async function testReleasedLyricMergesPersistedAssetPayload() {
  const lyricText = '[00:01.00]' + '已落盘歌词'.repeat(1024);
  let writtenRecord = null;

  /**
   * 返回已有完整歌词的 IndexedDB 记录。
   * @returns {Promise<object>} 以歌曲 key 索引的记录。
   */
  function readLocalAssetCacheRecords() {
    return Promise.resolve({
      'song-1': {
        id: 'song-1',
        localLyricText: lyricText,
        localLyricLoaded: true,
        localLyricFileName: 'song.lrc',
        localLyricTagName: '外置歌词',
        localLyricFileSignature: 'sig',
        localLyricSource: 'file',
      },
    });
  }

  /**
   * 记录合并后的最终写入值。
   * @param {object} record 最终资产记录。
   * @returns {Promise<boolean>} 固定成功。
   */
  function putLocalAssetCacheRecord(record) {
    writtenRecord = record;
    return Promise.resolve(true);
  }

  /** @returns {object|null} 本测试不调用歌曲即时快照入口。 */
  function localAssetCacheSnapshot() { return null; }

  const context = {
    readLocalAssetCacheRecords,
    putLocalAssetCacheRecord,
    localAssetCacheSnapshot,
    console,
    Promise,
  };
  vm.runInNewContext(
    readAssetRecordWriteSource() + '\nthis.writeRecord = writeLocalAssetCacheRecord;',
    context,
  );

  await context.writeRecord({
    id: 'song-1',
    name: '新标题',
    localLyricText: '',
    localLyricLoaded: false,
    _preserveLocalLyricPayload: true,
  }, '新标题');

  assert.equal(writtenRecord.name, '新标题');
  assert.equal(writtenRecord.localLyricText, lyricText);
  assert.equal(writtenRecord.localLyricLoaded, true);
  assert.equal(Object.prototype.hasOwnProperty.call(writtenRecord, '_preserveLocalLyricPayload'), false);
}

/**
 * 验证切到不同歌曲后，旧歌曲及同 key 副本释放歌词原文但保留按需恢复信息。
 * @returns {void}
 */
function testLyricResidencyReleasesPreviousCopies() {
  const lyricText = '[00:01.00]' + '旧歌词'.repeat(4096);
  const previous = {
    localKey: 'song-a',
    localLyricText: lyricText,
    localLyricLoaded: true,
    localLyricCacheHydrated: true,
    localIndexedLyricStatus: 'ready',
    localLyricFile: { name: 'a.lrc' },
    localLyricFileName: 'a.lrc',
    localLyricTagName: '外置歌词',
  };
  const libraryCopy = { ...previous };
  const playlistCopy = { ...previous };
  const next = { localKey: 'song-b', localLyricText: '', localLyricLoaded: false };
  const writes = [];

  /**
   * 记录释放前持久化请求，证明原文不是直接丢弃。
   * @param {object} song 待持久化歌曲。
   * @returns {void}
   */
  function scheduleLocalAssetCacheWrite(song) {
    writes.push({ key: song.localKey, text: song.localLyricText });
  }

  const context = {
    currentLocalSong: previous,
    currentIdx: 1,
    localLibrarySongs: [libraryCopy],
    playQueue: [previous, next],
    playlist: [playlistCopy],
    scheduleLocalAssetCacheWrite,
  };
  vm.runInNewContext(
    readLyricResidencySource() + '\nthis.handoffLyrics = handoffLocalLyricText;',
    context,
  );

  context.handoffLyrics(previous, next);

  for (const song of [previous, libraryCopy, playlistCopy]) {
    assert.equal(song.localLyricText, '');
    assert.equal(song.localLyricLoaded, false);
    assert.equal(song.localLyricCacheHydrated, false);
    assert.equal(song.localIndexedLyricStatus, 'ready');
    assert.equal(song.localLyricFileName, 'a.lrc');
    assert.equal(song.localLyricTagName, '外置歌词');
  }
  assert.equal(next.localLyricText, '');
  let capturedFullLyric = false;
  for (const record of writes) {
    if (record.key === 'song-a' && record.text === lyricText) capturedFullLyric = true;
  }
  assert.equal(capturedFullLyric, true);
}

/**
 * 验证同 key 队列对象切换时只有新当前对象接管歌词原文。
 * @returns {void}
 */
function testLyricResidencyTransfersSameSongObject() {
  const lyricText = '[00:01.00]' + '同曲歌词'.repeat(2048);
  const previous = {
    localKey: 'song-a',
    localLyricText: lyricText,
    localLyricLoaded: true,
    localLyricCacheHydrated: true,
    localIndexedLyricStatus: 'ready',
  };
  const next = { localKey: 'song-a', localLyricText: '', localLyricLoaded: false };
  const duplicate = { ...previous };

  /** @returns {void} 测试不需要观察具体缓存写入。 */
  function scheduleLocalAssetCacheWrite() {}

  const context = {
    currentLocalSong: previous,
    currentIdx: 1,
    localLibrarySongs: [duplicate],
    playQueue: [previous, next],
    playlist: [],
    scheduleLocalAssetCacheWrite,
  };
  vm.runInNewContext(
    readLyricResidencySource() + '\nthis.handoffLyrics = handoffLocalLyricText;',
    context,
  );

  context.handoffLyrics(previous, next);

  assert.equal(next.localLyricText, lyricText);
  assert.equal(next.localLyricLoaded, true);
  assert.equal(next.localLyricCacheHydrated, true);
  assert.equal(next.localLyricResidencyReleased || false, false);
  assert.equal(previous.localLyricText, '');
  assert.equal(duplicate.localLyricText, '');
}

/**
 * 验证已确认无歌词的轻量状态不会被误改成待恢复。
 * @returns {void}
 */
function testNoLyricStateDoesNotBecomePending() {
  const previous = {
    localKey: 'song-a',
    localLyricText: '',
    localLyricLoaded: true,
    localLyricCacheHydrated: true,
    localIndexedLyricStatus: 'none',
  };
  const next = { localKey: 'song-b' };
  let writes = 0;

  /** @returns {void} 无歌词状态不应触发重载荷持久化。 */
  function scheduleLocalAssetCacheWrite() { writes += 1; }

  const context = {
    currentLocalSong: previous,
    currentIdx: 1,
    localLibrarySongs: [previous],
    playQueue: [previous, next],
    playlist: [],
    scheduleLocalAssetCacheWrite,
  };
  vm.runInNewContext(
    readLyricResidencySource() + '\nthis.handoffLyrics = handoffLocalLyricText;',
    context,
  );

  context.handoffLyrics(previous, next);

  assert.equal(previous.localLyricLoaded, true);
  assert.equal(previous.localLyricCacheHydrated, true);
  assert.equal(previous.localIndexedLyricStatus, 'none');
  assert.equal(writes, 0);
}

/**
 * 验证旧歌曲文件读取迟到完成时只持久化原文，不恢复 renderer 常驻引用。
 * @returns {Promise<void>}
 */
async function testLateLyricFileReadDoesNotRestoreOldResidency() {
  let resolveLyricRead;
  const snapshots = [];

  /**
   * 捕获歌词文件读取完成函数。
   * @param {Function} resolve Promise 完成函数。
   * @returns {void}
   */
  function captureLyricResolve(resolve) {
    resolveLyricRead = resolve;
  }

  const lyricRead = new Promise(captureLyricResolve);

  /** @returns {Promise<string>} 返回受控歌词读取任务。 */
  function readLocalTextFile() { return lyricRead; }

  /** @returns {boolean} 测试使用外置歌词，不读取 FLAC 内嵌字段。 */
  function canReadEmbeddedFlacLyrics() { return false; }

  /** @returns {Promise<string>} 测试不会调用内嵌歌词解析。 */
  function extractFlacEmbeddedLyricsText() { return Promise.resolve(''); }

  /**
   * 在释放前捕获持久化歌词快照。
   * @param {object} song 本地歌曲。
   * @returns {void}
   */
  function scheduleLocalAssetCacheWrite(song) {
    snapshots.push({ text: song.localLyricText, loaded: song.localLyricLoaded });
  }

  /** @returns {void} 测试不需要封面缓存失效。 */
  function invalidateSongCoverCache() {}

  /** @returns {void} 测试不需要界面刷新。 */
  function scheduleLocalAssetUiRefresh() {}

  /** @returns {void} 迟到任务不得应用歌词界面。 */
  function maybeApplyLocalLyricsForSong() {}

  /** @returns {void} 测试不需要更新歌词控制。 */
  function updateCustomLyricControls() {}

  /** @returns {boolean} 切歌后旧歌曲不再是当前项。 */
  function isCurrentLocalQueueSong() { return false; }

  /** @returns {Promise<number>} 测试不会进入 IndexedDB 水合。 */
  function hydrateNothing() { return Promise.resolve(0); }

  const oldSong = {
    localKey: 'song-a',
    localLyricFile: { name: 'a.lrc' },
    localLyricText: '',
    localLyricLoaded: false,
  };
  const oldCopy = { ...oldSong };
  const nextSong = { localKey: 'song-b' };
  const context = {
    currentLocalSong: oldSong,
    currentIdx: 0,
    localLibrarySongs: [oldCopy],
    playQueue: [oldSong, nextSong],
    playlist: [],
    trackSwitchToken: 1,
    readLocalTextFile,
    canReadEmbeddedFlacLyrics,
    extractFlacEmbeddedLyricsText,
    scheduleLocalAssetCacheWrite,
    invalidateSongCoverCache,
    scheduleLocalAssetUiRefresh,
    maybeApplyLocalLyricsForSong,
    updateCustomLyricControls,
    isCurrentLocalQueueSong,
    hydrateLocalAssetCacheForSongRange: hydrateNothing,
    Promise,
    String,
  };
  vm.runInNewContext(
    readLyricResidencyAndSyncSource()
      + '\n'
      + readLazyLyricSource()
      + '\nthis.ensureLyrics = ensureLocalLyricsForSong;',
    context,
  );

  const loading = context.ensureLyrics(oldSong, { token: 1, applyCurrent: true });
  context.currentLocalSong = nextSong;
  context.currentIdx = 1;
  context.trackSwitchToken = 2;
  const lyricText = '[00:01.00]' + '迟到歌词'.repeat(2048);
  resolveLyricRead(lyricText);
  await loading;

  assert.equal(oldSong.localLyricText, '');
  assert.equal(oldSong.localLyricLoaded, false);
  assert.equal(oldSong.localLyricCacheHydrated, false);
  assert.equal(oldCopy.localLyricText, '');
  assert.equal(snapshots[snapshots.length - 1].text, lyricText, '最后一次调度也必须保留完整歌词');
  assert.equal(nextSong.localLyricText || '', '');
}

/**
 * 验证迟到的 IndexedDB 水合不会把旧歌曲重新标记为已驻留。
 * @returns {Promise<void>}
 */
async function testLateLyricHydrationDoesNotRestoreOldResidency() {
  let resolveHydration;

  /**
   * 捕获 IndexedDB 水合完成函数。
   * @param {Function} resolve Promise 完成函数。
   * @returns {void}
   */
  function captureHydrationResolve(resolve) {
    resolveHydration = resolve;
  }

  const hydrationPending = new Promise(captureHydrationResolve);
  const oldSong = {
    localKey: 'song-a',
    localIndexedLyricStatus: 'ready',
    localLyricText: '',
    localLyricLoaded: false,
  };
  const nextSong = { localKey: 'song-b' };

  /** @returns {void} 测试不观察持久化副作用。 */
  function ignoreWrite() {}

  /** @returns {void} 测试没有封面派生缓存。 */
  function ignoreCoverInvalidation() {}

  const context = {
    currentLocalSong: oldSong,
    currentIdx: 0,
    localLibrarySongs: [],
    playQueue: [oldSong, nextSong],
    playlist: [],
    scheduleLocalAssetCacheWrite: ignoreWrite,
    invalidateSongCoverCache: ignoreCoverInvalidation,
    Promise,
    String,
  };

  /**
   * 模拟 IndexedDB 在切歌后把歌词写回旧对象，并走真实同步租约。
   * @param {object[]} songs 待水合歌曲。
   * @returns {Promise<number>} 命中一条记录。
   */
  async function hydrateLocalAssetCacheForSongRange(songs) {
    await hydrationPending;
    songs[0].localLyricText = '[00:01.00]缓存歌词';
    songs[0].localLyricLoaded = true;
    context.syncAssets(songs[0]);
    return 1;
  }

  context.hydrateLocalAssetCacheForSongRange = hydrateLocalAssetCacheForSongRange;
  vm.runInNewContext(
    readLyricResidencyAndSyncSource()
      + '\nthis.syncAssets = syncLocalSongAssetFields;'
      + '\n'
      + readLazyLyricSource()
      + '\nthis.hydrateLyrics = hydrateLocalLyricCacheForSong;',
    context,
  );

  const hydration = context.hydrateLyrics(oldSong);
  context.currentLocalSong = nextSong;
  context.currentIdx = 1;
  resolveHydration();
  const loaded = await hydration;

  assert.equal(loaded, false);
  assert.equal(oldSong.localLyricText, '');
  assert.equal(oldSong.localLyricLoaded, false);
  assert.equal(oldSong.localLyricCacheHydrated, false);
}

/**
 * 验证切歌和清空队列入口都在丢失旧对象引用前移交歌词播放租约。
 * @returns {void}
 */
function testLyricResidencyIsWiredIntoPlaybackLifecycle() {
  const source = readRendererSource();
  const playStart = source.indexOf('async function playQueueAt(');
  const playEnd = source.indexOf('async function attemptAudioPlay(', playStart + 1);
  const clearStart = source.indexOf('function clearQueue(');
  const clearEnd = source.indexOf('function removeFromQueue(', clearStart + 1);
  assert.ok(playStart >= 0 && playEnd > playStart, '未找到切歌生命周期入口');
  assert.ok(clearStart >= 0 && clearEnd > clearStart, '未找到清空队列入口');
  const playSource = source.slice(playStart, playEnd);
  const clearSource = source.slice(clearStart, clearEnd);
  const playHandoff = playSource.indexOf('handoffLocalLyricText(currentLocalSong, song);');
  const playRelease = playSource.indexOf('currentLocalSong = null;');
  const clearHandoff = clearSource.indexOf('handoffLocalLyricText(currentLocalSong, null);');
  const clearRelease = clearSource.indexOf('playQueue = [];');
  assert.ok(
    playHandoff >= 0 && playRelease > playHandoff,
    '切歌必须在清空当前歌曲引用前移交歌词原文',
  );
  assert.ok(
    clearHandoff >= 0 && clearRelease > clearHandoff,
    '清空队列必须在丢弃队列副本前释放歌词原文',
  );
}

/**
 * 验证歌词原文释放后，既有 ready 摘要不会在曲库索引中退化为 pending。
 * @returns {void}
 */
function testReleasedReadyLyricKeepsLibraryIndexStatus() {
  const song = {
    localKey: 'song-1',
    localLyricText: '',
    localLyricLoaded: false,
    localLyricLightScanned: false,
    localLyricResidencyReleased: true,
    localIndexedLyricStatus: 'ready',
  };
  const context = {
    updateLocalAudioQualityInfo() {},
    localLibraryPathKeyFromSong() { return 'song.flac'; },
    localLibraryFileSignatureFromSong() { return 'song.flac:1:1'; },
    localFileLastModified() { return 1; },
    localAssetFileSignature() { return ''; },
    Date,
    Number,
  };
  vm.runInNewContext(
    readLocalLibraryIndexRecordSource() + '\nthis.createIndexRecord = localLibraryIndexRecord;',
    context,
  );

  const record = context.createIndexRecord(song);

  assert.equal(record.lyricStatus, 'ready');
}

test('全曲库资产补水不常驻全部歌词文本', testBulkHydrationSkipsLyrics);
test('播放歌曲时按需恢复单条缓存歌词', testPlaybackHydratesOneCachedLyric);
test('后台资产处理不预载未播放歌曲歌词', testBackgroundProcessingSkipsInactiveLyrics);
test('资产缓存延迟写入捕获释放前歌词快照', testScheduledAssetWriteCapturesLyricSnapshot);
test('歌词释放后的轻量调度保留待写原文', testReleasedLyricKeepsPendingAssetSnapshot);
test('歌词释放后的后续写入合并已落盘原文', testReleasedLyricMergesPersistedAssetPayload);
test('切歌释放旧歌曲及同 key 副本歌词原文', testLyricResidencyReleasesPreviousCopies);
test('同 key 切换只把歌词原文移交给新当前对象', testLyricResidencyTransfersSameSongObject);
test('已确认无歌词状态切歌后保持轻量完成态', testNoLyricStateDoesNotBecomePending);
test('迟到歌词文件读取不恢复旧歌曲原文驻留', testLateLyricFileReadDoesNotRestoreOldResidency);
test('迟到歌词缓存水合不恢复旧歌曲原文驻留', testLateLyricHydrationDoesNotRestoreOldResidency);
test('歌词原文租约接入切歌和清空队列生命周期', testLyricResidencyIsWiredIntoPlaybackLifecycle);
test('歌词释放后曲库索引仍保持 ready 摘要', testReleasedReadyLyricKeepsLibraryIndexStatus);
