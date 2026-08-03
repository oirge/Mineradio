'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从前端源码截取本地标签范围读取与 MP3/FLAC 解析实现。
 * @returns {string} 可在隔离上下文执行的真实源码。
 */
function readLocalTagRangeSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function base64ChunksToBytes(');
  const end = source.indexOf('function applyLocalMetadataTags(', start);
  assert.ok(start >= 0 && end > start, '未找到本地标签范围读取实现');
  return source.slice(start, end);
}

/**
 * 从前端源码截取单曲资产预载入口。
 * @returns {string} 可在隔离上下文执行的预载源码。
 */
function readLocalAssetPreloadSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('async function preloadLocalSongAssets(');
  const end = source.indexOf('function savedLocalLibraryFolderPath(', start);
  assert.ok(start >= 0 && end > start, '未找到本地单曲资产预载实现');
  return source.slice(start, end);
}

/**
 * 从前端源码截取本地元数据加载状态机。
 * @returns {string} 可在隔离上下文执行的真实源码。
 */
function readLocalMetadataEnsureSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function ensureLocalMetadataForSong(');
  const end = source.indexOf('/**\n * 后台补齐当前播放歌曲元数据', start);
  assert.ok(start >= 0 && end > start, '未找到本地元数据加载状态机');
  return source.slice(start, end);
}

/**
 * 创建可由测试精确完成的 Promise。
 * @returns {{promise:Promise<boolean>,resolve:Function}} 可控异步结果。
 */
function createDeferredResult() {
  let resolve;
  /**
   * 保存外部完成入口，便于观察后续资产是否被串行阻塞。
   * @param {Function} done Promise 完成函数。
   * @returns {void}
   */
  function captureResolve(done) { resolve = done; }
  return { promise: new Promise(captureResolve), resolve };
}

/**
 * 写入 FLAC metadata block 头部。
 * @param {number} type block 类型。
 * @param {boolean} last 是否为最后一个 metadata block。
 * @param {number} length block 数据长度。
 * @returns {Buffer} 四字节 block 头部。
 */
function buildFlacBlockHeader(type, last, length) {
  return Buffer.from([
    (last ? 0x80 : 0) | (type & 0x7f),
    (length >>> 16) & 0xff,
    (length >>> 8) & 0xff,
    length & 0xff,
  ]);
}

/**
 * 构造包含 Vorbis comment 和较大 PICTURE 的 FLAC metadata 前缀。
 * @returns {Buffer} 不含音频帧的完整 metadata 前缀。
 */
function buildFlacMetadataPrefix() {
  const streamInfo = Buffer.alloc(34);
  const titleComment = Buffer.from('TITLE=Range Test', 'utf8');
  const vorbis = Buffer.alloc(4 + 4 + 4 + titleComment.length);
  vorbis.writeUInt32LE(0, 0);
  vorbis.writeUInt32LE(1, 4);
  vorbis.writeUInt32LE(titleComment.length, 8);
  titleComment.copy(vorbis, 12);

  const mime = Buffer.from('image/png', 'ascii');
  const image = Buffer.alloc(96 * 1024, 0x5a);
  const picture = Buffer.alloc(4 + 4 + mime.length + 4 + 16 + 4 + image.length);
  let offset = 0;
  picture.writeUInt32BE(3, offset); offset += 4;
  picture.writeUInt32BE(mime.length, offset); offset += 4;
  mime.copy(picture, offset); offset += mime.length;
  picture.writeUInt32BE(0, offset); offset += 4;
  picture.writeUInt32BE(512, offset); offset += 4;
  picture.writeUInt32BE(512, offset); offset += 4;
  picture.writeUInt32BE(24, offset); offset += 4;
  picture.writeUInt32BE(0, offset); offset += 4;
  picture.writeUInt32BE(image.length, offset); offset += 4;
  image.copy(picture, offset);

  return Buffer.concat([
    Buffer.from('fLaC', 'ascii'),
    buildFlacBlockHeader(0, false, streamInfo.length),
    streamInfo,
    buildFlacBlockHeader(4, false, vorbis.length),
    vorbis,
    buildFlacBlockHeader(6, true, picture.length),
    picture,
  ]);
}

/**
 * 构造不物化大 PADDING payload 的稀疏 FLAC 夹具。
 * @returns {{size:number,segments:Array<object>,paddingStart:number,paddingEnd:number,vorbisStart:number,vorbisEnd:number,pictureStart:number,pictureEnd:number,image:Buffer}} 稀疏文件描述。
 */
function buildSparseFlacPaddingFixture() {
  const paddingLength = 12 * 1024 * 1024;
  const streamInfo = Buffer.alloc(34);
  const comments = [
    Buffer.from('TITLE=Range Test', 'utf8'),
    Buffer.from('LYRICS=[00:01.00]Line', 'utf8'),
  ];
  let vorbisLength = 8;
  for (let i = 0; i < comments.length; i += 1) vorbisLength += 4 + comments[i].length;
  const vorbis = Buffer.alloc(vorbisLength);
  vorbis.writeUInt32LE(0, 0);
  vorbis.writeUInt32LE(comments.length, 4);
  let vorbisOffset = 8;
  for (let i = 0; i < comments.length; i += 1) {
    vorbis.writeUInt32LE(comments[i].length, vorbisOffset);
    vorbisOffset += 4;
    comments[i].copy(vorbis, vorbisOffset);
    vorbisOffset += comments[i].length;
  }

  const mime = Buffer.from('image/png', 'ascii');
  const image = Buffer.from([0x11, 0x22, 0x33, 0x44]);
  const picture = Buffer.alloc(4 + 4 + mime.length + 4 + 16 + 4 + image.length);
  let pictureOffset = 0;
  picture.writeUInt32BE(3, pictureOffset); pictureOffset += 4;
  picture.writeUInt32BE(mime.length, pictureOffset); pictureOffset += 4;
  mime.copy(picture, pictureOffset); pictureOffset += mime.length;
  picture.writeUInt32BE(0, pictureOffset); pictureOffset += 4;
  picture.writeUInt32BE(64, pictureOffset); pictureOffset += 4;
  picture.writeUInt32BE(64, pictureOffset); pictureOffset += 4;
  picture.writeUInt32BE(24, pictureOffset); pictureOffset += 4;
  picture.writeUInt32BE(0, pictureOffset); pictureOffset += 4;
  picture.writeUInt32BE(image.length, pictureOffset); pictureOffset += 4;
  image.copy(picture, pictureOffset);

  const prefix = Buffer.concat([
    Buffer.from('fLaC', 'ascii'),
    buildFlacBlockHeader(0, false, streamInfo.length),
    streamInfo,
    buildFlacBlockHeader(1, false, paddingLength),
  ]);
  const paddingStart = prefix.length;
  const paddingEnd = paddingStart + paddingLength;
  const vorbisHeader = buildFlacBlockHeader(4, false, vorbis.length);
  const vorbisStart = paddingEnd + vorbisHeader.length;
  const vorbisEnd = vorbisStart + vorbis.length;
  const pictureHeader = buildFlacBlockHeader(6, true, picture.length);
  const pictureStart = vorbisEnd + pictureHeader.length;
  const pictureEnd = pictureStart + picture.length;
  return {
    size: 40 * 1024 * 1024,
    segments: [
      { start: 0, bytes: prefix },
      { start: paddingEnd, bytes: vorbisHeader },
      { start: vorbisStart, bytes: vorbis },
      { start: vorbisEnd, bytes: pictureHeader },
      { start: pictureStart, bytes: picture },
    ],
    paddingStart,
    paddingEnd,
    vorbisStart,
    vorbisEnd,
    pictureStart,
    pictureEnd,
    image,
  };
}

/**
 * 从稀疏夹具合成指定小范围；异常大范围返回 null，避免红测分配整段 PADDING。
 * @param {{segments:Array<object>}} fixture 稀疏文件描述。
 * @param {number} start 起始偏移。
 * @param {number|null} end 结束偏移。
 * @returns {Buffer|null} 合成字节；范围过大时返回 null。
 */
function readSparseFlacRange(fixture, start, end) {
  const stop = end == null ? start : end;
  const length = Math.max(0, stop - start);
  if (length > 1024 * 1024) return null;
  const out = Buffer.alloc(length);
  for (let i = 0; i < fixture.segments.length; i += 1) {
    const segment = fixture.segments[i];
    const segmentEnd = segment.start + segment.bytes.length;
    const copyStart = Math.max(start, segment.start);
    const copyEnd = Math.min(stop, segmentEnd);
    if (copyEnd <= copyStart) continue;
    segment.bytes.copy(out, copyStart - start, copyStart - segment.start, copyEnd - segment.start);
  }
  return out;
}

/**
 * 创建只记录逻辑范围、不分配大字节数组的标签解析环境。
 * @returns {{context:object,requests:Array<object>}} 隔离执行上下文与底层读取记录。
 */
function createLocalTagRangeHarness(options) {
  options = options || {};
  const requests = [];
  const flacBytes = options.flacBytes || buildFlacMetadataPrefix();
  const flacRangeProvider = options.flacRangeProvider || null;
  const mp3Bytes = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00]);

  /**
   * 返回测试文件声明大小，使解析器走真实的大范围请求分支。
   * @param {object} file 测试文件记录。
   * @returns {number} 文件逻辑大小。
   */
  function localFileSize(file) { return Number(file && file.size) || 0; }

  /**
   * 返回稳定绝对路径，用于验证不同歌曲对象共享同一文件读取。
   * @param {object} file 测试文件记录。
   * @returns {string} 文件绝对路径。
   */
  function localFullPath(file) { return String(file && file.fullPath || ''); }

  /**
   * 记录 renderer 发往主进程的实际范围，并返回最小合法标签头。
   * @param {string} fullPath 文件绝对路径。
   * @param {number} start 起始偏移。
   * @param {number|null} end 结束偏移。
   * @returns {Promise<object>} 分块 IPC 读取结果。
   */
  function readLocalFileRange(fullPath, start, end) {
    requests.push({ fullPath, start, end });
    let range = null;
    if (/\.mp3$/i.test(fullPath)) {
      const stop = end == null ? mp3Bytes.length : Math.min(mp3Bytes.length, end);
      range = mp3Bytes.subarray(Math.min(start, mp3Bytes.length), stop);
    } else if (flacRangeProvider) {
      range = flacRangeProvider(start, end);
    } else {
      const stop = end == null ? flacBytes.length : Math.min(flacBytes.length, end);
      range = flacBytes.subarray(Math.min(start, flacBytes.length), stop);
    }
    if (!range) return Promise.resolve({ ok: false, base64Chunks: [], byteLength: 0 });
    return Promise.resolve({
      ok: true,
      base64Chunks: [range.toString('base64')],
      byteLength: range.length,
    });
  }

  /**
   * 返回带范围读取能力的桌面桥接桩。
   * @returns {object} 桌面本地音乐 API。
   */
  function desktopLocalMusicApi() { return { readLocalFileRange }; }

  /**
   * 忽略测试夹具中预期内的解析告警。
   * @returns {void}
   */
  function ignoreWarning() {}

  const context = {
    Array,
    Blob,
    Error,
    LOCAL_ASSET_LIGHT_SCAN_BYTES: 4 * 1024 * 1024,
    Math,
    Number,
    Object,
    Promise,
    String,
    TextDecoder,
    Uint8Array,
    atob,
    console: { warn: ignoreWarning },
    desktopLocalMusicApi,
    localFileSize,
    localFullPath,
  };
  vm.runInNewContext(
    readLocalTagRangeSource()
      + '\nthis.extractMetadata = extractLocalMetadataTags;'
      + '\nthis.extractLyrics = extractFlacEmbeddedLyricsText;'
      + '\nthis.extractCover = extractEmbeddedCoverSource;'
      + '\nthis.pendingRangeReads = localFileRangeReadBatches;'
      + '\nthis.pendingFlacSessionReads = typeof localFlacMetadataSessionReadBatches === "undefined" ? null : localFlacMetadataSessionReadBatches;',
    context,
  );
  return { context, requests };
}

/**
 * 验证共享 FLAC 扫描只读取目标 block，不把大 PADDING payload 带入 renderer。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFlacConsumersSkipPaddingPayload() {
  const fixture = buildSparseFlacPaddingFixture();
  /**
   * 从稀疏 FLAC 返回请求范围。
   * @param {number} start 起始偏移。
   * @param {number|null} end 结束偏移。
   * @returns {Buffer|null} 合成的小范围字节。
   */
  function provideSparseFlacRange(start, end) {
    return readSparseFlacRange(fixture, start, end);
  }
  const harness = createLocalTagRangeHarness({ flacRangeProvider: provideSparseFlacRange });
  const fileA = { name: 'padded.flac', fullPath: 'C:\\Music\\padded.flac', size: fixture.size };
  const fileB = { name: 'padded.flac', fullPath: fileA.fullPath, size: fixture.size };
  const results = await Promise.all([
    harness.context.extractMetadata(fileA, {}),
    harness.context.extractLyrics(fileB, {}),
    harness.context.extractCover(fileA, {}),
  ]);

  assert.equal(results[0].title, 'Range Test');
  assert.equal(results[1], '[00:01.00]Line');
  assert.equal(results[2] && results[2].type, 'image/png');
  assert.deepEqual(Array.from(new Uint8Array(await results[2].arrayBuffer())), Array.from(fixture.image));
  let paddingOverlap = 0;
  for (let i = 0; i < harness.requests.length; i += 1) {
    const request = harness.requests[i];
    paddingOverlap += Math.max(0, Math.min(request.end, fixture.paddingEnd) - Math.max(request.start, fixture.paddingStart));
  }
  assert.equal(paddingOverlap, 0, 'FLAC 目录扫描不得读取 PADDING payload');
  const requestKeys = new Set();
  let vorbisReads = 0;
  let pictureReads = 0;
  for (let i = 0; i < harness.requests.length; i += 1) {
    const request = harness.requests[i];
    requestKeys.add(request.start + ':' + request.end);
    if (request.start === fixture.vorbisStart && request.end === fixture.vorbisEnd) vorbisReads += 1;
    if (request.start === fixture.pictureStart && request.end === fixture.pictureEnd) pictureReads += 1;
  }
  assert.equal(requestKeys.size, harness.requests.length, '三个消费者不得重复读取同一 header 或 payload 范围');
  assert.equal(vorbisReads, 1);
  assert.equal(pictureReads, 1);
  assert.equal(harness.context.pendingRangeReads.length, 0);
  assert.equal(harness.context.pendingFlacSessionReads.length, 0);
}

/**
 * 验证声明越过文件末尾的 FLAC block 不触发 payload 读取。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testMalformedFlacBlockFailsBeforePayloadRead() {
  const header = Buffer.concat([
    Buffer.from('fLaC', 'ascii'),
    buildFlacBlockHeader(6, true, 0xffffff),
  ]);
  /**
   * 只返回实际存在的八字节损坏文件头。
   * @param {number} start 起始偏移。
   * @param {number|null} end 结束偏移。
   * @returns {Buffer} 文件头范围。
   */
  function provideMalformedFlacRange(start, end) {
    const stop = end == null ? header.length : Math.min(header.length, end);
    return header.subarray(Math.min(start, header.length), stop);
  }
  const harness = createLocalTagRangeHarness({ flacRangeProvider: provideMalformedFlacRange });
  const file = { name: 'malformed.flac', fullPath: 'C:\\Music\\malformed.flac', size: 8 * 1024 * 1024 };
  const cover = await harness.context.extractCover(file, {});
  assert.equal(cover, null);
  assert.deepEqual(harness.requests, [{ fullPath: file.fullPath, start: 0, end: 8 }]);
  assert.equal(harness.context.pendingRangeReads.length, 0);
  assert.equal(harness.context.pendingFlacSessionReads.length, 0);
}

/**
 * 验证当前播放 FLAC 的三个消费者共享 descriptor 扫描和精确 block 读取。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFlacTagConsumersShareMetadataBlockReads() {
  const harness = createLocalTagRangeHarness();
  const fileA = { name: 'track.flac', fullPath: 'C:\\Music\\track.flac', size: 40 * 1024 * 1024 };
  const fileB = { name: 'track.flac', fullPath: fileA.fullPath, size: fileA.size };
  await Promise.all([
    harness.context.extractMetadata(fileA, { light: true }),
    harness.context.extractLyrics(fileB, {}),
    harness.context.extractCover(fileA, {}),
  ]);

  assert.deepEqual(
    harness.requests,
    [
      { fullPath: fileA.fullPath, start: 0, end: 8 },
      { fullPath: fileA.fullPath, start: 42, end: 46 },
      { fullPath: fileA.fullPath, start: 74, end: 78 },
      { fullPath: fileA.fullPath, start: 46, end: 74 },
      { fullPath: fileA.fullPath, start: 78, end: buildFlacMetadataPrefix().length },
    ],
    '大 FLAC 只应共享 block 头和目标 payload，不得读取连续 metadata 前缀',
  );
  assert.equal(harness.context.pendingRangeReads.length, 0, 'FLAC 标签读取完成后必须释放在途批次');
  assert.equal(harness.context.pendingFlacSessionReads.length, 0, 'FLAC metadata descriptor 扫描完成后必须释放共享批次');
}

/**
 * 验证 MP3 元数据和封面共享探针及完整 ID3 标签读取。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testMp3TagConsumersShareProbeAndFullRangeRead() {
  const harness = createLocalTagRangeHarness();
  const fileA = { name: 'track.mp3', fullPath: 'C:\\Music\\track.mp3', size: 8 * 1024 * 1024 };
  const fileB = { name: 'track.mp3', fullPath: fileA.fullPath, size: fileA.size };
  await Promise.all([
    harness.context.extractMetadata(fileA, {}),
    harness.context.extractCover(fileB, {}),
  ]);

  assert.deepEqual(
    harness.requests,
    [
      { fullPath: fileA.fullPath, start: 0, end: 256 * 1024 },
      { fullPath: fileA.fullPath, start: 0, end: 2 * 1024 * 1024 + 10 },
    ],
    '同一 MP3 的探针与完整 ID3 标签都只能各读取一次',
  );
  assert.equal(harness.context.pendingRangeReads.length, 0, 'MP3 标签读取完成后必须释放在途批次');
}

/**
 * 验证后台元数据和封面在同一轮启动，使相同轻量范围可被读取批次合并。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testBackgroundPreloadStartsMetadataAndCoverTogether() {
  const starts = [];
  const metadata = createDeferredResult();

  /**
   * 记录元数据任务并保持挂起，暴露封面是否被串行等待。
   * @returns {Promise<boolean>} 可控元数据结果。
   */
  function ensureLocalMetadataForSong() {
    starts.push('metadata');
    return metadata.promise;
  }

  /**
   * 记录封面任务并立即完成。
   * @returns {Promise<boolean>} 固定成功结果。
   */
  function ensureLocalCoverForSong() {
    starts.push('cover');
    return Promise.resolve(true);
  }

  /**
   * 记录歌词任务；纯后台预载不应调用该入口。
   * @returns {Promise<boolean>} 固定成功结果。
   */
  function ensureLocalLyricsForSong() {
    starts.push('lyrics');
    return Promise.resolve(true);
  }

  /** @returns {boolean} 测试歌曲使用音频内嵌封面。 */
  function canReadEmbeddedCover() { return true; }

  /** @returns {boolean} 测试歌曲允许读取 FLAC 内嵌歌词。 */
  function canReadEmbeddedFlacLyrics() { return true; }

  const context = {
    Promise,
    canReadEmbeddedCover,
    canReadEmbeddedFlacLyrics,
    ensureLocalCoverForSong,
    ensureLocalLyricsForSong,
    ensureLocalMetadataForSong,
    trackSwitchToken: 1,
  };
  vm.runInNewContext(
    readLocalAssetPreloadSource() + '\nthis.preload = preloadLocalSongAssets;',
    context,
  );

  const pending = context.preload({ type: 'local' }, { background: true });
  await Promise.resolve();
  assert.deepEqual(starts, ['metadata', 'cover'], '后台元数据未完成时也应启动封面任务');
  metadata.resolve(true);
  await pending;
  assert.deepEqual(starts, ['metadata', 'cover'], '纯后台预载不应读取歌词');
}

/**
 * 验证外置封面继续等待元数据完成，避免两个不同文件的大结果同时驻留。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testBackgroundPreloadKeepsExternalCoverSequential() {
  const starts = [];
  const metadata = createDeferredResult();

  /**
   * 记录并挂起元数据任务。
   * @returns {Promise<boolean>} 可控元数据结果。
   */
  function ensureLocalMetadataForSong() {
    starts.push('metadata');
    return metadata.promise;
  }

  /**
   * 记录外置封面任务。
   * @returns {Promise<boolean>} 固定成功结果。
   */
  function ensureLocalCoverForSong() {
    starts.push('cover');
    return Promise.resolve(true);
  }

  /**
   * 纯后台预载不应读取歌词。
   * @returns {Promise<boolean>} 固定成功结果。
   */
  function ensureLocalLyricsForSong() {
    starts.push('lyrics');
    return Promise.resolve(true);
  }

  /** @returns {boolean} 外置封面场景不读取音频内嵌封面。 */
  function canReadEmbeddedCover() { return false; }

  /** @returns {boolean} 纯后台场景不读取内嵌歌词。 */
  function canReadEmbeddedFlacLyrics() { return false; }

  const context = {
    Promise,
    canReadEmbeddedCover,
    canReadEmbeddedFlacLyrics,
    ensureLocalCoverForSong,
    ensureLocalLyricsForSong,
    ensureLocalMetadataForSong,
    trackSwitchToken: 1,
  };
  vm.runInNewContext(
    readLocalAssetPreloadSource() + '\nthis.preload = preloadLocalSongAssets;',
    context,
  );

  const pending = context.preload({ type: 'local', localCoverFile: { name: 'cover.jpg' } }, { background: true });
  await Promise.resolve();
  assert.deepEqual(starts, ['metadata'], '外置封面不得与音频元数据并发驻留');
  metadata.resolve(true);
  await pending;
  assert.deepEqual(starts, ['metadata', 'cover']);
}

/**
 * 验证前台请求不会把正在进行的后台轻量元数据结果误当成完整结果。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testForegroundMetadataRetriesAfterPendingLightScan() {
  let fullReads = 0;
  const song = { type: 'local', localFile: { name: 'track.flac' }, localMetadataLoaded: false };

  /** @returns {void} 测试不需要音质副作用。 */
  function updateLocalAudioQualityInfo() {}

  /**
   * 记录后台轻量任务完成后的完整元数据读取。
   * @returns {Promise<object>} 完整扫描结果。
   */
  function extractLocalMetadataTags() {
    fullReads += 1;
    return Promise.resolve({ title: '完整标题', _mineradioScanComplete: true });
  }

  /** @returns {boolean} 模拟标题已写入歌曲。 */
  function applyLocalMetadataTags(target, tags) {
    target.name = tags.title;
    return true;
  }

  /** @returns {void} 测试不需要同步副作用。 */
  function ignoreSideEffect() {}

  const context = {
    LOCAL_METADATA_TAG_SCHEMA: 1,
    Promise,
    applyLocalMetadataTags,
    console: { warn: ignoreSideEffect },
    extractLocalMetadataTags,
    refreshLocalMetadataUi: ignoreSideEffect,
    scheduleLocalAssetCacheWrite: ignoreSideEffect,
    syncLocalSongAssetFields: ignoreSideEffect,
    updateLocalAudioQualityInfo,
  };
  vm.runInNewContext(readLocalMetadataEnsureSource() + '\nthis.ensureMetadata = ensureLocalMetadataForSong;', context);

  /** @returns {void} 模拟生产 finally 在轻量任务结束后释放歌曲级 Promise。 */
  function releasePendingLightMetadata() {
    song.localMetadataPromise = null;
  }
  const pendingLight = Promise.resolve(false);
  song.localMetadataPromise = pendingLight.finally(releasePendingLightMetadata);
  const changed = await context.ensureMetadata(song, { applyCurrent: true });

  assert.equal(changed, true, '前台请求应在轻量任务结束后执行完整元数据读取');
  assert.equal(fullReads, 1);
  assert.equal(song.localMetadataLoaded, true);
  assert.equal(song.name, '完整标题');
}

test('FLAC 标签消费者共享 descriptor 和目标 block 读取', testFlacTagConsumersShareMetadataBlockReads);
test('FLAC 三个消费者共享跳过 PADDING 的 block 读取', testFlacConsumersSkipPaddingPayload);
test('FLAC 越界 block 在 payload 读取前失败', testMalformedFlacBlockFailsBeforePayloadRead);
test('MP3 标签消费者共享探针和完整标签读取', testMp3TagConsumersShareProbeAndFullRangeRead);
test('后台预载同轮启动元数据和封面', testBackgroundPreloadStartsMetadataAndCoverTogether);
test('后台预载保持外置封面串行', testBackgroundPreloadKeepsExternalCoverSequential);
test('前台元数据请求在后台轻量任务后完整重试', testForegroundMetadataRetriesAfterPendingLightScan);
