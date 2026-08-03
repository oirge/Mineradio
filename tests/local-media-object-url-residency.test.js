'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从前端源码截取本地封面解析与懒创建 Object URL 的真实实现。
 * @returns {string} 可在隔离上下文执行的封面源码。
 */
function readLocalCoverUrlSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function songCustomCoverKey(');
  const end = source.indexOf('function songCoverSignature(', start);
  assert.ok(start >= 0 && end > start, '未找到本地封面 URL 实现');
  return source.slice(start, end);
}

/**
 * 从前端源码截取本地歌曲资产同步和音频 Object URL 创建实现。
 * @returns {string} 可在隔离上下文执行的本地音频源码。
 */
function readLocalAudioUrlSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const syncStart = source.indexOf('function shouldRetainLocalLyricText(');
  const syncEnd = source.indexOf('async function readLocalBeatCacheForSong(', syncStart);
  const urlStart = source.indexOf('function assignLocalSongUrl(');
  const urlEnd = source.indexOf('/**\n * 解析本地歌词并标记来源。', urlStart);
  assert.ok(syncStart >= 0 && syncEnd > syncStart, '未找到本地歌曲资产同步实现');
  assert.ok(urlStart >= 0 && urlEnd > urlStart, '未找到本地音频 URL 实现');
  return source.slice(syncStart, syncEnd) + source.slice(urlStart, urlEnd);
}

/**
 * 验证本地歌曲构造只水合用户映射，封面 Blob URL 延迟到实际读取时创建。
 * @returns {void}
 */
function testLocalCoverObjectUrlIsCreatedLazily() {
  const calls = { creates: 0 };
  const coverMap = {};

  /** @returns {object} 返回当前用户自定义封面映射。 */
  function ensureCustomCoverMap() { return coverMap; }

  /** @returns {string} 测试文件没有主进程提供的持久 URL。 */
  function localFileUrlFromEntry() { return ''; }

  /** @param {object} _file 封面文件。 @returns {string} 返回可计数的假 Blob URL。 */
  function createObjectURL(_file) {
    calls.creates += 1;
    return 'blob:local-cover-' + calls.creates;
  }

  /** @param {string} url 原封面地址。 @returns {string} 测试中不改写封面地址。 */
  function coverUrlWithSize(url) { return url; }

  const context = {
    ensureCustomCoverMap,
    localFileUrlFromEntry,
    coverUrlWithSize,
    URL: { createObjectURL },
  };
  vm.runInNewContext(
    readLocalCoverUrlSource()
      + '\nthis.hydrateCover = hydrateCustomCover;'
      + '\nthis.coverSrc = songCoverSrc;',
    context,
  );
  const song = {
    type: 'local',
    localKey: 'song-1',
    localCoverFile: { name: 'cover.jpg', slice: true },
    localCoverFileName: 'cover.jpg',
  };

  context.hydrateCover(song);

  assert.equal(calls.creates, 0);
  assert.equal(song.customCover, undefined);
  assert.equal(song.localCoverObjectUrl, undefined);

  assert.equal(context.coverSrc(song, 80), 'blob:local-cover-1');
  assert.equal(context.coverSrc(song, 80), 'blob:local-cover-1');
  assert.equal(calls.creates, 1);
}

/**
 * 验证首次播放创建的音频 Blob URL 会同步给同曲源对象，后续入队副本直接复用。
 * @returns {void}
 */
function testLocalAudioObjectUrlIsSharedAcrossSongCopies() {
  const calls = { creates: 0 };
  const localFile = { name: 'song.flac', slice: true };
  const librarySong = { type: 'local', localKey: 'song-1', localFile, localUrl: '' };
  const firstQueueSong = Object.assign({}, librarySong);

  /** @returns {string} 测试文件没有主进程提供的持久 URL。 */
  function localFileUrlFromEntry() { return ''; }

  /** @param {object} _file 音频文件。 @returns {string} 返回可计数的假 Blob URL。 */
  function createObjectURL(_file) {
    calls.creates += 1;
    return 'blob:local-audio-' + calls.creates;
  }

  /** @returns {void} 测试歌曲没有需要失效的封面缓存。 */
  function invalidateSongCoverCache() {}

  /** @returns {void} 测试歌曲没有歌词原文需要持久化。 */
  function scheduleLocalAssetCacheWrite() {}

  const context = {
    currentLocalSong: null,
    currentIdx: -1,
    localLibrarySongs: [librarySong],
    playQueue: [firstQueueSong],
    playlist: [],
    localFileUrlFromEntry,
    invalidateSongCoverCache,
    scheduleLocalAssetCacheWrite,
    URL: { createObjectURL },
  };
  vm.runInNewContext(
    readLocalAudioUrlSource() + '\nthis.ensureAudioUrl = ensureLocalSongUrl;',
    context,
  );

  assert.equal(context.ensureAudioUrl(firstQueueSong), 'blob:local-audio-1');
  assert.equal(librarySong.localUrl, 'blob:local-audio-1');

  const secondQueueSong = Object.assign({}, librarySong);
  context.playQueue = [secondQueueSong];
  assert.equal(context.ensureAudioUrl(secondQueueSong), 'blob:local-audio-1');
  assert.equal(calls.creates, 1);
}

test('本地封面 Object URL 只在实际读取时懒创建', testLocalCoverObjectUrlIsCreatedLazily);
test('同一首本地歌曲的队列副本复用音频 Object URL', testLocalAudioObjectUrlIsSharedAcrossSongCopies);
