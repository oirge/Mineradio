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
 * 截取本地资产数据库初始化实现。
 * @param {string} source renderer 主脚本源码。
 * @returns {string} IndexedDB 打开与升级源码。
 */
function readLocalAssetDbOpenSource(source) {
  const start = source.indexOf('function openLocalAssetCacheDb()');
  const end = source.indexOf('function localAssetFileSignature(', start);
  assert.ok(start >= 0 && end > start, '未找到本地资产数据库初始化实现');
  return source.slice(start, end);
}

/**
 * 截取单曲资产快照实现。
 * @param {string} source renderer 主脚本源码。
 * @returns {string} 资产快照源码。
 */
function readAssetSnapshotSource(source) {
  const start = source.indexOf('function localAssetCacheSnapshot(');
  const end = source.indexOf('/**\n * 生成独立歌词持久化快照', start);
  assert.ok(start >= 0 && end > start, '未找到本地资产快照实现');
  return source.slice(start, end);
}

/**
 * 截取本地封面图片解码实现。
 * @param {string} source renderer 主脚本源码。
 * @returns {string} 封面图片来源打开源码。
 */
function readCoverImageSource(source) {
  const start = source.indexOf('async function openLocalCoverImageSource(');
  const end = source.indexOf('function localCoverThumbCacheKey(', start);
  assert.ok(start >= 0 && end > start, '未找到本地封面图片解码实现');
  return source.slice(start, end);
}

/**
 * 截取本地封面缩略图生成实现。
 * @param {string} source renderer 主脚本源码。
 * @returns {string} 封面缩略图源码。
 */
function readCoverThumbnailSource(source) {
  const start = source.indexOf('async function openLocalCoverImageSource(');
  const end = source.indexOf('/**\n * 为歌曲生成本地封面缩略图', start);
  assert.ok(start >= 0 && end > start, '未找到本地封面缩略图实现');
  return source.slice(start, end);
}

/**
 * 截取本地歌曲封面加载状态机。
 * @param {string} source renderer 主脚本源码。
 * @returns {string} 封面加载状态机源码。
 */
function readEnsureCoverSource(source) {
  const start = source.indexOf('function ensureLocalCoverForSong(');
  const end = source.indexOf('function loadLocalCoverForSong(', start);
  assert.ok(start >= 0 && end > start, '未找到本地歌曲封面加载状态机');
  return source.slice(start, end);
}

/**
 * 验证数据库升级到 v3，并为歌词创建独立对象仓库，迁移按 cursor 逐条推进。
 * @returns {void}
 */
function testLocalAssetDbUsesLyricsStoreV3() {
  const source = readRendererSource();
  const openSource = readLocalAssetDbOpenSource(source);

  assert.match(openSource, /indexedDB\.open\(LOCAL_ASSET_CACHE_DB_NAME,\s*3\)/);
  assert.match(openSource, /LOCAL_LYRICS_CACHE_STORE/);
  assert.match(openSource, /oldVersion|oldVersion/);
  assert.match(openSource, /openCursor\(\)/);
  assert.match(openSource, /localLyricText/);
}

/**
 * 验证新的资产快照不再把歌词原文写入 assets store。
 * @returns {void}
 */
function testAssetSnapshotExcludesLyricPayload() {
  const source = readRendererSource();
  const snapshotSource = readAssetSnapshotSource(source);
  assert.doesNotMatch(snapshotSource, /localLyricText\s*:/);
  assert.doesNotMatch(snapshotSource, /localLyricFileName\s*:/);
  assert.match(source, /function localLyricCacheSnapshot\(/);
  assert.match(source, /localLyricText\s*:/);
}

/**
 * 用最小 Image 桩验证 HTTP 本地封面 URL 会在 src 赋值前启用跨源解码。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testLocalCoverUrlSetsCrossOriginBeforeDecode() {
  const source = readRendererSource();
  const imageSource = readCoverImageSource(source);
  const images = [];

  /**
   * 模拟浏览器图片对象，并在设置来源后异步触发成功事件。
   * @returns {object} 图片桩实例。
   */
  function ImageStub() {
    this.onload = null;
    this.onerror = null;
    this.naturalWidth = 640;
    this.naturalHeight = 480;
    this.removeAttribute = () => {};
    images.push(this);
    Object.defineProperty(this, 'src', {
      configurable: true,
      set: (value) => {
        this.source = value;
        queueMicrotask(() => {
          if (typeof this.onload === 'function') this.onload();
        });
      },
    });
  }

  const context = { Blob: class Blob {}, Image: ImageStub, Promise, String, Error, queueMicrotask };
  vm.runInNewContext(imageSource + '\nthis.openCover = openLocalCoverImageSource;', context);

  const lease = await context.openCover('http://127.0.0.1:3210/api/local-file?token=x');
  assert.equal(images.length, 1);
  assert.equal(images[0].crossOrigin, 'anonymous');
  assert.equal(images[0].source, 'http://127.0.0.1:3210/api/local-file?token=x');
  lease.release();
}

/**
 * 用最小 canvas 桩验证本地流 URL 能直接生成缩略图，不退回 data URL 读取。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testLocalCoverUrlCreatesThumbnail() {
  const source = readRendererSource();
  const thumbnailSource = readCoverThumbnailSource(source);

  /** @returns {object} 可触发加载事件的图片桩。 */
  function ImageStub() {
    this.naturalWidth = 640;
    this.naturalHeight = 480;
    this.removeAttribute = () => {};
    Object.defineProperty(this, 'src', {
      configurable: true,
      set: () => queueMicrotask(() => {
        if (typeof this.onload === 'function') this.onload();
      }),
    });
  }

  /** @returns {object} 可记录绘制并返回固定 WebP data URL 的 canvas。 */
  function createCanvas() {
    return {
      width: 0,
      height: 0,
      getContext() {
        return { drawImage() {}, imageSmoothingEnabled: false, imageSmoothingQuality: '' };
      },
      toDataURL() { return 'data:image/webp;base64,thumb'; },
    };
  }

  const context = {
    Blob: class Blob {},
    Image: ImageStub,
    Promise,
    String,
    Error,
    Math,
    Number,
    Object,
    Array,
    console: { warn() {} },
    document: { createElement: createCanvas },
    getRuntimeFramePressureLevel: () => 0,
    LOCAL_COVER_THUMB_MAX_SIZE: 512,
    LOCAL_COVER_THUMB_QUALITY: 0.82,
    LOCAL_COVER_THUMB_RESULT_MAX_BYTES: 18 * 1024 * 1024,
    localCoverThumbPromiseCache: {},
    localCoverThumbPromiseOrder: [],
    localCoverThumbPromiseOrderHead: 0,
    localCoverThumbPromiseCount: 0,
    localCoverThumbResultCache: {},
    localCoverThumbResultOrder: [],
    localCoverThumbResultOrderHead: 0,
    localCoverThumbResultBytes: 0,
    queueMicrotask,
  };
  vm.runInNewContext(thumbnailSource + '\nthis.createThumb = createLocalCoverThumbnailDataUrl;', context);

  const thumb = await context.createThumb('http://127.0.0.1:3210/api/local-file?token=x', { cacheKey: 'cover:url' });
  assert.equal(thumb, 'data:image/webp;base64,thumb');
}

/**
 * 验证桌面本地封面已有 URL 时直接进入缩略图链路，不调用整图 data URL 读取。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testExternalCoverUrlSkipsFullDataUrlRead() {
  const source = readRendererSource();
  let dataUrlReads = 0;
  let assignedSource = '';

  /** @param {object} song 本地歌曲。 @returns {string} 已授权的本地流 URL。 */
  function ensureLocalCoverPreviewUrl(song) {
    return song.localCoverFile.url;
  }

  /** @returns {Promise<string>} 记录不应发生的整图 base64 读取。 */
  function readFileAsDataUrl() {
    dataUrlReads += 1;
    return Promise.resolve('data:image/png;base64,unexpected');
  }

  /**
   * 记录封面来源并模拟缩略图写入。
   * @param {object} song 本地歌曲。
   * @param {string} coverSource 封面 URL。
   * @returns {Promise<boolean>} 固定成功结果。
   */
  function assignLocalCoverSource(song, coverSource) {
    assignedSource = coverSource;
    song.localCoverThumbDataUrl = 'data:image/webp;base64,thumb';
    return Promise.resolve(true);
  }

  /** @returns {boolean} 测试歌曲不依赖内嵌封面。 */
  function canReadEmbeddedFlacCover() { return false; }

  /** @returns {void} 忽略测试不关心的 UI 副作用。 */
  function ignoreSideEffect() {}

  const context = {
    Promise,
    String,
    console: { warn() {} },
    assignLocalCoverSource,
    canReadEmbeddedFlacCover,
    ensureLocalCoverPreviewUrl,
    extractEmbeddedCoverSource: () => Promise.resolve(null),
    invalidateSongCoverCache: ignoreSideEffect,
    localLibraryFileSignatureFromSong: () => 'song.jpg|12|1',
    maybeApplyLocalCoverForSong: ignoreSideEffect,
    readFileAsDataUrl,
    scheduleLocalAssetCacheWrite: ignoreSideEffect,
    scheduleLocalAssetUiRefresh: ignoreSideEffect,
    syncLocalSongAssetFields: ignoreSideEffect,
  };
  vm.runInNewContext(readEnsureCoverSource(source) + '\nthis.ensureCover = ensureLocalCoverForSong;', context);

  const song = {
    type: 'local',
    name: '本地歌曲',
    localCoverFile: { url: 'http://127.0.0.1:3210/api/local-file?token=x' },
    localCoverLoaded: false,
  };
  const loaded = await context.ensureCover(song, { background: true, applyCurrent: false });

  assert.equal(loaded, true);
  assert.equal(dataUrlReads, 0);
  assert.equal(assignedSource, song.localCoverFile.url);
  assert.equal(song.localCoverDataUrl || '', '');
  assert.equal(song.localCoverThumbDataUrl, 'data:image/webp;base64,thumb');
}

test('本地资产数据库使用 v3 独立 lyrics store', testLocalAssetDbUsesLyricsStoreV3);
test('assets 快照排除歌词重载荷', testAssetSnapshotExcludesLyricPayload);
test('本地封面 URL 解码前设置跨源属性', testLocalCoverUrlSetsCrossOriginBeforeDecode);
test('本地封面 URL 可直接生成缩略图', testLocalCoverUrlCreatesThumbnail);
test('外置封面 URL 跳过整图 data URL 读取', testExternalCoverUrlSkipsFullDataUrlRead);
