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
 * 截取元数据缓存版本判断；旧实现没有该函数时返回空源码以保留红测语义。
 * @param {string} source 完整 renderer 源码。
 * @returns {string} 缓存版本判断源码。
 */
function readMetadataCacheGateSource(source) {
  const start = source.indexOf('function canUseCachedLocalMetadata(');
  if (start < 0) return '';
  const end = source.indexOf('/**\n * 将本地资产缓存记录套用到歌曲对象', start);
  assert.ok(end > start, '未找到元数据缓存版本判断结束位置');
  return source.slice(start, end);
}

/**
 * 截取本地资产缓存补水函数。
 * @param {string} source 完整 renderer 源码。
 * @returns {string} 资产缓存补水源码。
 */
function readAssetCacheApplySource(source) {
  const start = source.indexOf('function applyLocalAssetCacheToSong(');
  const end = source.indexOf('/**\n * 按歌曲范围读取 IndexedDB 资产', start);
  assert.ok(start >= 0 && end > start, '未找到本地资产缓存补水函数');
  return source.slice(start, end);
}

/**
 * 截取本地曲库索引补水函数。
 * @param {string} source 完整 renderer 源码。
 * @returns {string} 曲库索引补水源码。
 */
function readLibraryIndexApplySource(source) {
  const start = source.indexOf('function applyLocalLibraryIndexToSong(');
  const end = source.indexOf('/**\n * 同步曲库索引与当前歌曲列表', start);
  assert.ok(start >= 0 && end > start, '未找到本地曲库索引补水函数');
  return source.slice(start, end);
}

/**
 * 截取单曲元数据加载状态机。
 * @param {string} source 完整 renderer 源码。
 * @returns {string} 元数据加载状态机源码。
 */
function readMetadataEnsureSource(source) {
  const start = source.indexOf('function ensureLocalMetadataForSong(');
  const end = source.indexOf('/**\n * 后台补齐当前播放歌曲元数据', start);
  assert.ok(start >= 0 && end > start, '未找到本地元数据加载状态机');
  return source.slice(start, end);
}

/** @returns {string} 测试不需要外置资产签名。 */
function localAssetFileSignature() { return ''; }

/** @returns {void} 测试忽略同曲对象字段同步。 */
function syncLocalSongAssetFields() {}

/** @returns {void} 测试忽略封面派生缓存失效。 */
function invalidateSongCoverCache() {}

/**
 * 验证旧 FLAC 资产缓存只复用轻量资产，不恢复可能被排序字段污染的元数据。
 * @returns {void}
 */
function testOldFlacAssetCacheForcesMetadataReparse() {
  const source = readRendererSource();
  const context = {
    LOCAL_METADATA_TAG_SCHEMA: 1,
    LOCAL_METADATA_TEXT_FIELDS: ['name', 'artist', 'album', 'albumArtist', 'trackNumber', 'year'],
    LOCAL_METADATA_VALUE_FIELDS: ['duration', 'localFormat', 'localFileSize', 'localBitrateKbps'],
    Object,
    String,
    invalidateSongCoverCache,
    localAssetFileSignature,
    syncLocalSongAssetFields,
  };
  vm.runInNewContext(
    readMetadataCacheGateSource(source)
      + readAssetCacheApplySource(source)
      + '\nthis.applyRecord = applyLocalAssetCacheToSong;',
    context,
  );

  const song = { type: 'local', localKey: 'song-a', localFile: { name: 'song.flac' } };
  const record = {
    id: 'song-a',
    localMetadataLoaded: true,
    albumArtist: 'Beatles, The',
    duration: 180,
    localLyricText: '[00:01.00]缓存歌词',
    localLyricLoaded: true,
    localLyricSource: 'embedded',
    localCoverThumbDataUrl: 'data:image/webp;base64,thumb',
    localCoverLoaded: true,
    localCoverSource: 'embedded',
  };
  context.applyRecord(song, record, {});

  assert.equal(song.localMetadataLoaded || false, false);
  assert.equal(song.albumArtist || '', '');
  assert.equal(song.duration, 180, '音频时长等轻量字段仍应复用');
  assert.equal(song.localLyricText, record.localLyricText, '歌词缓存不应随元数据版本一起失效');
  assert.equal(song.localCoverThumbDataUrl, record.localCoverThumbDataUrl, '封面缓存不应随元数据版本一起失效');
}

/**
 * 验证旧 FLAC 曲库索引同样不会把错误专辑艺术家恢复为已加载元数据。
 * @returns {void}
 */
function testOldFlacLibraryIndexForcesMetadataReparse() {
  const source = readRendererSource();

  /** @returns {boolean} 固定匹配测试歌曲与索引记录。 */
  function localLibraryRecordMatchesSong() { return true; }

  /** @returns {string} 测试不需要真实文件签名。 */
  function localLibraryRecordFileSignature() { return ''; }

  const context = {
    LOCAL_METADATA_TAG_SCHEMA: 1,
    LOCAL_METADATA_TEXT_FIELDS: ['name', 'artist', 'album', 'albumArtist', 'trackNumber', 'year'],
    LOCAL_METADATA_VALUE_FIELDS: ['duration', 'localFormat', 'localFileSize', 'localBitrateKbps'],
    Object,
    String,
    localAssetFileSignature,
    localLibraryRecordFileSignature,
    localLibraryRecordMatchesSong,
  };
  vm.runInNewContext(
    readMetadataCacheGateSource(source)
      + readLibraryIndexApplySource(source)
      + '\nthis.applyRecord = applyLocalLibraryIndexToSong;',
    context,
  );

  const song = { type: 'local', localKey: 'song-a', localFile: { name: 'song.flac' } };
  const record = {
    key: 'song-a',
    localMetadataLoaded: true,
    albumArtist: 'Beatles, The',
    duration: 180,
  };
  context.applyRecord(song, record);

  assert.equal(song.localMetadataLoaded || false, false);
  assert.equal(song.albumArtist || '', '');
  assert.equal(song.duration, 180, '曲库索引中的轻量音频字段仍应复用');
}

/**
 * 验证 M4A 标签解析 schema 变化后不会继续复用错误测试版元数据。
 * @returns {void}
 */
function testOldM4aAssetCacheForcesMetadataReparse() {
  const source = readRendererSource();
  const context = {
    LOCAL_METADATA_TAG_SCHEMA: 2,
    LOCAL_METADATA_TEXT_FIELDS: ['name', 'artist', 'album', 'albumArtist', 'trackNumber', 'year'],
    LOCAL_METADATA_VALUE_FIELDS: ['duration', 'localFormat', 'localFileSize', 'localBitrateKbps'],
    Object,
    String,
    invalidateSongCoverCache() {},
    localAssetFileSignature() { return ''; },
    syncLocalSongAssetFields() {},
  };
  vm.runInNewContext(
    readMetadataCacheGateSource(source)
      + readAssetCacheApplySource(source)
      + '\nthis.applyRecord = applyLocalAssetCacheToSong;',
    context,
  );

  const song = { type: 'local', localKey: 'song-a', localFile: { name: 'song.m4a' } };
  const record = {
    id: 'song-a',
    localMetadataLoaded: true,
    localMetadataTagSchema: 1,
    title: '错误测试版标题',
    duration: 180,
  };
  context.applyRecord(song, record, {});

  assert.equal(song.localMetadataLoaded || false, false);
  assert.equal(song.name || '', '');
  assert.equal(song.duration, 180, 'M4A 时长等轻量字段仍应复用');
}

/**
 * 验证被轻量范围截断的 FLAC 元数据不会写成已完成 schema。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testTruncatedFlacMetadataRemainsRetryable() {
  const source = readRendererSource();
  let cacheWrites = 0;
  let requestedLight = null;

  /** @returns {void} 测试忽略音质字段刷新。 */
  function updateLocalAudioQualityInfo() {}

  /** @returns {Promise<object>} 返回轻量扫描被截断的解析结果。 */
  function extractLocalMetadataTags(_file, opts) {
    requestedLight = !!(opts && opts.light);
    return Promise.resolve({ _mineradioScanComplete: false });
  }

  /** @returns {boolean} 截断夹具没有可应用展示字段。 */
  function applyLocalMetadataTags() { return false; }

  /** @returns {void} 记录不应发生的已完成缓存写入。 */
  function scheduleLocalAssetCacheWrite() { cacheWrites += 1; }

  /** @returns {void} 测试忽略同曲字段同步和界面刷新。 */
  function ignoreSideEffect() {}

  /** @returns {void} 测试忽略预期内告警。 */
  function ignoreWarning() {}

  const context = {
    LOCAL_METADATA_TAG_SCHEMA: 1,
    Promise,
    applyLocalMetadataTags,
    console: { warn: ignoreWarning },
    extractLocalMetadataTags,
    refreshLocalMetadataUi: ignoreSideEffect,
    scheduleLocalAssetCacheWrite,
    syncLocalSongAssetFields: ignoreSideEffect,
    updateLocalAudioQualityInfo,
  };
  vm.runInNewContext(readMetadataEnsureSource(source) + '\nthis.ensureMetadata = ensureLocalMetadataForSong;', context);

  const song = { type: 'local', localFile: { name: 'padded.flac' } };
  const changed = await context.ensureMetadata(song, { background: true, applyCurrent: false });
  assert.equal(changed, false);
  assert.equal(requestedLight, true);
  assert.equal(song.localMetadataLoaded || false, false);
  assert.equal(song.localMetadataTagSchema || 0, 0);
  assert.equal(cacheWrites, 0);
}

test('旧 FLAC 资产缓存强制重新解析元数据', testOldFlacAssetCacheForcesMetadataReparse);
test('旧 FLAC 曲库索引强制重新解析元数据', testOldFlacLibraryIndexForcesMetadataReparse);
test('旧 M4A 资产缓存强制重新解析元数据', testOldM4aAssetCacheForcesMetadataReparse);
test('FLAC 轻量元数据截断保持可重试', testTruncatedFlacMetadataRemainsRetryable);
