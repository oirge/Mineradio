'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从 renderer 主脚本截取 FLAC 元数据解析实现。
 * @returns {string} 可在隔离上下文执行的真实解析源码。
 */
function readFlacMetadataParserSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function asciiFromBytes(');
  const end = source.indexOf('function findZero(', start);
  assert.ok(start >= 0 && end > start, '未找到 FLAC 元数据解析实现');
  return `
/**
 * 测试只隔离解析语义，按生产 light/full 上限建立内存 descriptor 会话。
 * @param {object} file 测试文件记录。
 * @param {{light?:boolean}=} opts 是否使用轻量范围。
 * @returns {Promise<object>} 测试夹具的 descriptor 会话。
 */
async function readFlacMetadataSession(file, opts) {
  opts = opts || {};
  var maxScan = opts.light ? LOCAL_ASSET_LIGHT_SCAN_BYTES : 32 * 1024 * 1024;
  var fileSize = localFileSize(file) || 0;
  var limit = Math.min(fileSize, maxScan);
  var bytes = await readLocalFileBytes(file, 0, limit || maxScan);
  var pos = findFlacMetadataStart(bytes);
  var blocks = [];
  var reachedLastBlock = false;
  var resolvedStop = pos >= 0 ? pos : bytes.length;
  while (pos >= 0 && pos + 4 <= bytes.length) {
    var header = bytes[pos];
    var length = uint24BE(bytes, pos + 1);
    var payloadStart = pos + 4;
    var payloadEnd = payloadStart + length;
    if (payloadEnd > bytes.length) break;
    var last = !!(header & 0x80);
    blocks.push({ type: header & 0x7f, last: last, length: length, payloadStart: payloadStart, payloadEnd: payloadEnd });
    resolvedStop = payloadEnd;
    if (last) { reachedLastBlock = true; break; }
    pos = payloadEnd;
  }
  return { probeBytes: bytes, metadataStart: findFlacMetadataStart(bytes), blocks: blocks, resolvedStop: resolvedStop, reachedLastBlock: reachedLastBlock, fullyRead: !!(fileSize && bytes.length >= fileSize) };
}
/**
 * 从测试会话返回目标 block 的共享字节视图。
 * @param {object} _file 测试文件占位对象。
 * @param {object} session descriptor 会话。
 * @param {object} block 目标 block。
 * @returns {Promise<Uint8Array|null>} 完整 payload 视图。
 */
function readFlacMetadataBlockBytes(_file, session, block) {
  if (block.payloadEnd > session.probeBytes.length) return Promise.resolve(null);
  return Promise.resolve(session.probeBytes.subarray(block.payloadStart, block.payloadEnd));
}
` + source.slice(start, end);
}

/**
 * 构造包含真实 Vorbis comment block 的最小 FLAC 字节。
 * @param {Array<string>} comments Vorbis 注释文本。
 * @returns {Uint8Array} 可交给真实解析器的 FLAC 字节。
 */
function buildFlacVorbisComments(comments) {
  const encoded = new Array(comments.length);
  let payloadLength = 8;
  for (let i = 0; i < comments.length; i += 1) {
    encoded[i] = Buffer.from(comments[i], 'utf8');
    payloadLength += 4 + encoded[i].length;
  }
  const bytes = Buffer.alloc(4 + 4 + payloadLength);
  bytes.write('fLaC', 0, 'ascii');
  bytes[4] = 0x84;
  bytes[5] = (payloadLength >>> 16) & 0xff;
  bytes[6] = (payloadLength >>> 8) & 0xff;
  bytes[7] = payloadLength & 0xff;
  let offset = 8;
  bytes.writeUInt32LE(0, offset);
  offset += 4;
  bytes.writeUInt32LE(encoded.length, offset);
  offset += 4;
  for (let i = 0; i < encoded.length; i += 1) {
    bytes.writeUInt32LE(encoded[i].length, offset);
    offset += 4;
    encoded[i].copy(bytes, offset);
    offset += encoded[i].length;
  }
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * 构造多个按文件顺序排列的 VORBIS_COMMENT block。
 * @param {Array<Array<string>>} commentBlocks 每个 block 的注释列表。
 * @returns {Uint8Array} 带多个 Vorbis block 的 FLAC 字节。
 */
function buildFlacVorbisBlocks(commentBlocks) {
  const parts = [Buffer.from('fLaC', 'ascii')];
  for (let i = 0; i < commentBlocks.length; i += 1) {
    const single = buildFlacVorbisComments(commentBlocks[i]);
    const payload = Buffer.from(single.buffer, single.byteOffset + 8, single.byteLength - 8);
    parts.push(Buffer.from([
      (i === commentBlocks.length - 1 ? 0x80 : 0) | 4,
      (payload.length >>> 16) & 0xff,
      (payload.length >>> 8) & 0xff,
      payload.length & 0xff,
    ]));
    parts.push(payload);
  }
  const bytes = Buffer.concat(parts);
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * 构造在较大 PADDING block 之后才出现 Vorbis comment 的 FLAC。
 * @param {number} paddingLength 前置填充字节数。
 * @param {Array<string>} comments Vorbis 注释文本。
 * @returns {Uint8Array} 带前置填充的完整 FLAC 字节。
 */
function buildFlacVorbisCommentsAfterPadding(paddingLength, comments) {
  const commentOnly = buildFlacVorbisComments(comments);
  const commentPayload = commentOnly.subarray(8);
  const bytes = Buffer.alloc(4 + 4 + paddingLength + 4 + commentPayload.length);
  bytes.write('fLaC', 0, 'ascii');
  bytes[4] = 0x01;
  bytes[5] = (paddingLength >>> 16) & 0xff;
  bytes[6] = (paddingLength >>> 8) & 0xff;
  bytes[7] = paddingLength & 0xff;
  const commentHeader = 8 + paddingLength;
  bytes[commentHeader] = 0x84;
  bytes[commentHeader + 1] = (commentPayload.length >>> 16) & 0xff;
  bytes[commentHeader + 2] = (commentPayload.length >>> 8) & 0xff;
  bytes[commentHeader + 3] = commentPayload.length & 0xff;
  Buffer.from(commentPayload.buffer, commentPayload.byteOffset, commentPayload.byteLength).copy(bytes, commentHeader + 4);
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * 记录真实解析器交给 UTF-8 解码器的每段字节长度。
 */
class TrackingTextDecoder {
  /**
   * 保存解码长度收集器，并复用 Node 原生 TextDecoder 保持文本语义。
   * @param {string} encoding 文本编码。
   */
  constructor(encoding) {
    this.decoder = new TextDecoder(encoding);
  }

  /**
   * 记录本轮输入长度并返回原生解码结果。
   * @param {Uint8Array} bytes 待解码字节。
   * @returns {string} 解码文本。
   */
  decode(bytes) {
    TrackingTextDecoder.lengths.push(bytes.byteLength);
    return this.decoder.decode(bytes);
  }
}
TrackingTextDecoder.lengths = [];

/**
 * 验证未知字段和已命中的重复字段不会解码其大型 value。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFlacMetadataSkipsUnusedLargeCommentValues() {
  const largeDuplicate = 'D'.repeat(512 * 1024);
  const largeUnknown = 'P'.repeat(512 * 1024);
  const bytes = buildFlacVorbisComments([
    'TITLE=实际标题',
    'TITLE=' + largeDuplicate,
    'METADATA_BLOCK_PICTURE=' + largeUnknown,
  ]);

  /**
   * 返回测试 FLAC 的真实夹具大小。
   * @returns {number} 文件大小。
   */
  function localFileSize() { return bytes.byteLength; }

  /**
   * 直接返回内存夹具，避免测试执行任何磁盘或 IPC 读取。
   * @returns {Promise<Uint8Array>} FLAC 字节。
   */
  function readLocalFileBytes() { return Promise.resolve(bytes); }

  /** @returns {void} 测试不输出解析告警。 */
  function ignoreWarning() {}

  TrackingTextDecoder.lengths = [];
  const context = {
    LOCAL_ASSET_LIGHT_SCAN_BYTES: 4 * 1024 * 1024,
    Math,
    Number,
    Object,
    String,
    TextDecoder: TrackingTextDecoder,
    Uint8Array,
    console: { warn: ignoreWarning },
    localFileSize,
    readLocalFileBytes,
  };
  vm.runInNewContext(
    readFlacMetadataParserSource()
      + '\nthis.extractMetadata = extractFlacLocalMetadata;'
      + '\nthis.extractLyrics = extractFlacEmbeddedLyricsText;',
    context,
  );

  const tags = await context.extractMetadata({ name: 'large-comments.flac' }, {});
  let maxDecodedBytes = 0;
  for (const length of TrackingTextDecoder.lengths) {
    if (length > maxDecodedBytes) maxDecodedBytes = length;
  }
  assert.equal(tags.title, '实际标题');
  assert.ok(maxDecodedBytes < 128, '未知或重复大字段不得完整进入 UTF-8 解码器');
}

/**
 * 验证未知且不含时间标签起始符的大字段不会进入歌词文本解码。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFlacLyricsSkipUnrelatedLargeCommentValues() {
  const largePicture = 'P'.repeat(512 * 1024);
  const bytes = buildFlacVorbisComments([
    'LYRICS=[00:01.00]实际歌词',
    'METADATA_BLOCK_PICTURE=' + largePicture,
  ]);

  /** @returns {number} 返回测试 FLAC 夹具大小。 */
  function localFileSize() { return bytes.byteLength; }

  /** @returns {Promise<Uint8Array>} 直接返回内存 FLAC 夹具。 */
  function readLocalFileBytes() { return Promise.resolve(bytes); }

  /** @returns {void} 测试不输出解析告警。 */
  function ignoreWarning() {}

  TrackingTextDecoder.lengths = [];
  const context = {
    LOCAL_ASSET_LIGHT_SCAN_BYTES: 4 * 1024 * 1024,
    Math,
    Number,
    Object,
    String,
    TextDecoder: TrackingTextDecoder,
    Uint8Array,
    console: { warn: ignoreWarning },
    localFileSize,
    readLocalFileBytes,
  };
  vm.runInNewContext(
    readFlacMetadataParserSource() + '\nthis.extractLyrics = extractFlacEmbeddedLyricsText;',
    context,
  );

  const lyricText = await context.extractLyrics({ name: 'large-picture-comment.flac' }, {});
  let maxDecodedBytes = 0;
  for (const length of TrackingTextDecoder.lengths) {
    if (length > maxDecodedBytes) maxDecodedBytes = length;
  }
  assert.equal(lyricText, '[00:01.00]实际歌词');
  assert.ok(maxDecodedBytes < 128, '无时间标签可能性的未知大字段不得进入歌词 UTF-8 解码器');
}

/**
 * 验证未知字段携带时间标签时继续作为低优先级歌词回退。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFlacLyricsPreserveTimedUnknownFieldFallback() {
  const bytes = buildFlacVorbisComments(['CUSTOM_TEXT=[00:02.00]回退歌词']);

  /** @returns {number} 返回测试 FLAC 夹具大小。 */
  function localFileSize() { return bytes.byteLength; }

  /** @returns {Promise<Uint8Array>} 直接返回内存 FLAC 夹具。 */
  function readLocalFileBytes() { return Promise.resolve(bytes); }

  /** @returns {void} 测试不输出解析告警。 */
  function ignoreWarning() {}

  const context = {
    LOCAL_ASSET_LIGHT_SCAN_BYTES: 4 * 1024 * 1024,
    Math,
    Number,
    Object,
    String,
    TextDecoder,
    Uint8Array,
    console: { warn: ignoreWarning },
    localFileSize,
    readLocalFileBytes,
  };
  vm.runInNewContext(
    readFlacMetadataParserSource() + '\nthis.extractLyrics = extractFlacEmbeddedLyricsText;',
    context,
  );

  const lyricText = await context.extractLyrics({ name: 'timed-fallback.flac' }, {});
  assert.equal(lyricText, '[00:02.00]回退歌词');
}

/**
 * 验证空 Vorbis comment 只跳过当前项，不截断后续元数据。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFlacMetadataContinuesAfterEmptyComment() {
  const bytes = buildFlacVorbisComments(['', 'TITLE=空项后的标题']);

  /** @returns {number} 返回测试 FLAC 夹具大小。 */
  function localFileSize() { return bytes.byteLength; }

  /** @returns {Promise<Uint8Array>} 直接返回内存 FLAC 夹具。 */
  function readLocalFileBytes() { return Promise.resolve(bytes); }

  const context = {
    LOCAL_ASSET_LIGHT_SCAN_BYTES: 4 * 1024 * 1024,
    Math,
    Number,
    Object,
    String,
    TextDecoder,
    Uint8Array,
    localFileSize,
    readLocalFileBytes,
  };
  vm.runInNewContext(
    readFlacMetadataParserSource() + '\nthis.extractMetadata = extractFlacLocalMetadata;',
    context,
  );

  const tags = await context.extractMetadata({ name: 'empty-comment.flac' }, {});
  assert.equal(tags.title, '空项后的标题');
}

/**
 * 验证空 Vorbis comment 只跳过当前项，不截断后续歌词。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFlacLyricsContinueAfterEmptyComment() {
  const bytes = buildFlacVorbisComments(['', 'LYRICS=[00:03.00]空项后的歌词']);

  /** @returns {number} 返回测试 FLAC 夹具大小。 */
  function localFileSize() { return bytes.byteLength; }

  /** @returns {Promise<Uint8Array>} 直接返回内存 FLAC 夹具。 */
  function readLocalFileBytes() { return Promise.resolve(bytes); }

  const context = {
    LOCAL_ASSET_LIGHT_SCAN_BYTES: 4 * 1024 * 1024,
    Math,
    Number,
    Object,
    String,
    TextDecoder,
    Uint8Array,
    localFileSize,
    readLocalFileBytes,
  };
  vm.runInNewContext(
    readFlacMetadataParserSource() + '\nthis.extractLyrics = extractFlacEmbeddedLyricsText;',
    context,
  );

  const lyricText = await context.extractLyrics({ name: 'empty-comment-lyrics.flac' }, {});
  assert.equal(lyricText, '[00:03.00]空项后的歌词');
}

/**
 * 验证最高优先级歌词命中后不再解码后续大型重复字段。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFlacLyricsStopAfterMaximumPriorityMatch() {
  const bytes = buildFlacVorbisComments([
    'LYRICS=[00:04.00]最高优先级歌词',
    'LYRICS=' + 'L'.repeat(512 * 1024),
  ]);

  /** @returns {number} 返回测试 FLAC 夹具大小。 */
  function localFileSize() { return bytes.byteLength; }

  /** @returns {Promise<Uint8Array>} 直接返回内存 FLAC 夹具。 */
  function readLocalFileBytes() { return Promise.resolve(bytes); }

  TrackingTextDecoder.lengths = [];
  const context = {
    LOCAL_ASSET_LIGHT_SCAN_BYTES: 4 * 1024 * 1024,
    Math,
    Number,
    Object,
    String,
    TextDecoder: TrackingTextDecoder,
    Uint8Array,
    localFileSize,
    readLocalFileBytes,
  };
  vm.runInNewContext(
    readFlacMetadataParserSource() + '\nthis.extractLyrics = extractFlacEmbeddedLyricsText;',
    context,
  );

  const lyricText = await context.extractLyrics({ name: 'max-priority-lyrics.flac' }, {});
  let maxDecodedBytes = 0;
  for (const length of TrackingTextDecoder.lengths) {
    if (length > maxDecodedBytes) maxDecodedBytes = length;
  }
  assert.equal(lyricText, '[00:04.00]最高优先级歌词');
  assert.ok(maxDecodedBytes < 128, '最高优先级歌词命中后不得解码后续大型字段');
}

/**
 * 验证当前结果已高于字段理论上限时跳过大型低优先级 value。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFlacLyricsSkipFieldThatCannotBeatCurrentBest() {
  const bytes = buildFlacVorbisComments([
    'LYRICS=无时间主歌词',
    'UNSYNCEDLYRICS=' + 'U'.repeat(512 * 1024),
  ]);

  /** @returns {number} 返回测试 FLAC 夹具大小。 */
  function localFileSize() { return bytes.byteLength; }

  /** @returns {Promise<Uint8Array>} 直接返回内存 FLAC 夹具。 */
  function readLocalFileBytes() { return Promise.resolve(bytes); }

  TrackingTextDecoder.lengths = [];
  const context = {
    LOCAL_ASSET_LIGHT_SCAN_BYTES: 4 * 1024 * 1024,
    Math,
    Number,
    Object,
    String,
    TextDecoder: TrackingTextDecoder,
    Uint8Array,
    localFileSize,
    readLocalFileBytes,
  };
  vm.runInNewContext(
    readFlacMetadataParserSource() + '\nthis.extractLyrics = extractFlacEmbeddedLyricsText;',
    context,
  );

  const lyricText = await context.extractLyrics({ name: 'lower-priority-lyrics.flac' }, {});
  let maxDecodedBytes = 0;
  for (const length of TrackingTextDecoder.lengths) {
    if (length > maxDecodedBytes) maxDecodedBytes = length;
  }
  assert.equal(lyricText, '无时间主歌词');
  assert.ok(maxDecodedBytes < 128, '理论上无法超过当前结果的字段不得解码大型 value');
}

/**
 * 验证普通方括号文本不会被误判为未知时间标签字段并完整解码。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFlacLyricsRequireActualTimeTagBeforeUnknownDecode() {
  const bytes = buildFlacVorbisComments([
    'CUSTOM_JSON=[section]' + 'J'.repeat(512 * 1024),
  ]);

  /** @returns {number} 返回测试 FLAC 夹具大小。 */
  function localFileSize() { return bytes.byteLength; }

  /** @returns {Promise<Uint8Array>} 直接返回内存 FLAC 夹具。 */
  function readLocalFileBytes() { return Promise.resolve(bytes); }

  TrackingTextDecoder.lengths = [];
  const context = {
    LOCAL_ASSET_LIGHT_SCAN_BYTES: 4 * 1024 * 1024,
    Math,
    Number,
    Object,
    String,
    TextDecoder: TrackingTextDecoder,
    Uint8Array,
    localFileSize,
    readLocalFileBytes,
  };
  vm.runInNewContext(
    readFlacMetadataParserSource() + '\nthis.extractLyrics = extractFlacEmbeddedLyricsText;',
    context,
  );

  const lyricText = await context.extractLyrics({ name: 'bracketed-unknown.flac' }, {});
  let maxDecodedBytes = 0;
  for (const length of TrackingTextDecoder.lengths) {
    if (length > maxDecodedBytes) maxDecodedBytes = length;
  }
  assert.equal(lyricText, '');
  assert.ok(maxDecodedBytes < 128, '未知字段必须存在真实 LRC 时间标签才允许解码大型 value');
}

/**
 * 验证专辑艺术家排序字段不会抢占展示用专辑艺术家。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFlacAlbumArtistSortDoesNotReplaceAlbumArtist() {
  const bytes = buildFlacVorbisComments([
    'ALBUMARTISTSORT=Beatles, The',
    'ALBUMARTIST=The Beatles',
  ]);

  /** @returns {number} 返回测试 FLAC 夹具大小。 */
  function localFileSize() { return bytes.byteLength; }

  /** @returns {Promise<Uint8Array>} 直接返回内存 FLAC 夹具。 */
  function readLocalFileBytes() { return Promise.resolve(bytes); }

  const context = {
    LOCAL_ASSET_LIGHT_SCAN_BYTES: 4 * 1024 * 1024,
    Math,
    Number,
    Object,
    String,
    TextDecoder,
    Uint8Array,
    localFileSize,
    readLocalFileBytes,
  };
  vm.runInNewContext(
    readFlacMetadataParserSource() + '\nthis.extractMetadata = extractFlacLocalMetadata;',
    context,
  );

  const tags = await context.extractMetadata({ name: 'album-artist-sort.flac' }, {});
  assert.equal(tags.albumArtist, 'The Beatles');
}

/**
 * 验证轻量读取被前置 block 截断时返回可重试状态，完整读取仍能取得真实标签。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFlacLightMetadataScanReportsTruncation() {
  const bytes = buildFlacVorbisCommentsAfterPadding(128, ['ALBUMARTIST=The Beatles']);

  /** @returns {number} 返回完整 FLAC 夹具大小。 */
  function localFileSize() { return bytes.byteLength; }

  /**
   * 按生产范围读取契约返回指定字节视图。
   * @param {object} _file 测试文件占位对象。
   * @param {number} start 起始偏移。
   * @param {number} stop 结束偏移。
   * @returns {Promise<Uint8Array>} 指定范围字节。
   */
  function readLocalFileBytes(_file, start, stop) {
    return Promise.resolve(bytes.subarray(start, Math.min(bytes.length, stop || bytes.length)));
  }

  const context = {
    LOCAL_ASSET_LIGHT_SCAN_BYTES: 64,
    Math,
    Number,
    Object,
    String,
    TextDecoder,
    Uint8Array,
    localFileSize,
    readLocalFileBytes,
  };
  vm.runInNewContext(
    readFlacMetadataParserSource() + '\nthis.extractMetadata = extractFlacLocalMetadata;',
    context,
  );

  const lightTags = await context.extractMetadata({ name: 'padded.flac' }, { light: true });
  const fullTags = await context.extractMetadata({ name: 'padded.flac' }, {});
  assert.equal(lightTags.albumArtist || '', '');
  assert.equal(lightTags._mineradioScanComplete, false);
  assert.equal(fullTags.albumArtist, 'The Beatles');
  assert.equal(fullTags._mineradioScanComplete, true);
}

/**
 * 验证多个 Vorbis block 继续按文件顺序合并展示元数据。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFlacMetadataMergesMultipleVorbisBlocks() {
  const bytes = buildFlacVorbisBlocks([
    ['TITLE=First Title'],
    ['TITLE=Ignored Title', 'ARTIST=Second Artist'],
  ]);

  /** @returns {number} 返回测试 FLAC 夹具大小。 */
  function localFileSize() { return bytes.byteLength; }

  /** @returns {Promise<Uint8Array>} 返回完整多 block FLAC。 */
  function readLocalFileBytes() { return Promise.resolve(bytes); }

  const context = {
    LOCAL_ASSET_LIGHT_SCAN_BYTES: 4 * 1024 * 1024,
    Math,
    Number,
    Object,
    Promise,
    String,
    TextDecoder,
    Uint8Array,
    localFileSize,
    readLocalFileBytes,
  };
  vm.runInNewContext(
    readFlacMetadataParserSource() + '\nthis.extractMetadata = extractFlacLocalMetadata;',
    context,
  );

  const tags = await context.extractMetadata({ name: 'multiple-vorbis.flac' }, {});
  assert.equal(tags.title, 'First Title');
  assert.equal(tags.artist, 'Second Artist');
  assert.equal(tags._mineradioScanComplete, true);
}

/**
 * 验证歌词优先级可以跨多个 Vorbis block 继续提升。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFlacLyricsPrioritizeAcrossVorbisBlocks() {
  const bytes = buildFlacVorbisBlocks([
    ['UNSYNCEDLYRICS=plain lyric'],
    ['LYRICS=[00:01.00]timed lyric'],
  ]);

  /** @returns {number} 返回测试 FLAC 夹具大小。 */
  function localFileSize() { return bytes.byteLength; }

  /** @returns {Promise<Uint8Array>} 返回完整多 block FLAC。 */
  function readLocalFileBytes() { return Promise.resolve(bytes); }

  const context = {
    LOCAL_ASSET_LIGHT_SCAN_BYTES: 4 * 1024 * 1024,
    Math,
    Number,
    Object,
    Promise,
    String,
    TextDecoder,
    Uint8Array,
    localFileSize,
    readLocalFileBytes,
  };
  vm.runInNewContext(
    readFlacMetadataParserSource() + '\nthis.extractLyrics = extractFlacEmbeddedLyricsText;',
    context,
  );

  const lyricText = await context.extractLyrics({ name: 'multiple-lyrics.flac' }, {});
  assert.equal(lyricText, '[00:01.00]timed lyric');
}

test('FLAC 元数据跳过未知和重复大字段 value 解码', testFlacMetadataSkipsUnusedLargeCommentValues);
test('FLAC 歌词跳过无时间标签可能性的未知大字段 value 解码', testFlacLyricsSkipUnrelatedLargeCommentValues);
test('FLAC 歌词保留未知时间标签字段回退', testFlacLyricsPreserveTimedUnknownFieldFallback);
test('FLAC 元数据跳过空 comment 后继续解析', testFlacMetadataContinuesAfterEmptyComment);
test('FLAC 歌词跳过空 comment 后继续解析', testFlacLyricsContinueAfterEmptyComment);
test('FLAC 歌词命中最高优先级后停止解码', testFlacLyricsStopAfterMaximumPriorityMatch);
test('FLAC 歌词跳过无法超过当前结果的字段', testFlacLyricsSkipFieldThatCannotBeatCurrentBest);
test('FLAC 歌词未知字段需真实时间标签才解码', testFlacLyricsRequireActualTimeTagBeforeUnknownDecode);
test('FLAC 专辑艺术家排序字段不覆盖展示字段', testFlacAlbumArtistSortDoesNotReplaceAlbumArtist);
test('FLAC 轻量元数据截断保持完整扫描可重试', testFlacLightMetadataScanReportsTruncation);
test('FLAC 元数据跨多个 Vorbis block 保持 first-wins', testFlacMetadataMergesMultipleVorbisBlocks);
test('FLAC 歌词优先级跨多个 Vorbis block 提升', testFlacLyricsPrioritizeAcrossVorbisBlocks);
