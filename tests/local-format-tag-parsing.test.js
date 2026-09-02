'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const LIGHT_SCAN_BYTES = 4 * 1024 * 1024;
const ID3_PROBE_BYTES = 256 * 1024;
const HEADER_WINDOW_BYTES = 64 * 1024;

/**
 * 从前端源码截取本地标签解析实现（含 OGG/OPUS/WAV/APE/DSF 解析器）。
 * @returns {string} 可在隔离上下文执行的真实源码。
 */
function readLocalTagParserSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function base64ChunksToBytes(');
  const end = source.indexOf('function applyLocalMetadataTags(', start);
  assert.ok(start >= 0 && end > start, '未找到本地标签解析实现');
  return source.slice(start, end);
}

/**
 * 从前端源码截取格式能力判定实现。
 * @returns {string} 可在隔离上下文执行的真实源码。
 */
function readFormatCapabilitySource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function localSongFormatName(');
  const end = source.indexOf('function maybeApplyLocalLyricsForSong(', start);
  assert.ok(start >= 0 && end > start, '未找到本地格式能力判定实现');
  return source.slice(start, end);
}

/**
 * 创建按声明范围返回真实字节的标签解析环境。
 * @param {Array<object>} entries 文件夹具描述数组。
 * @returns {object} 隔离执行上下文、底层读取记录与文件记录访问器。
 */
function createFormatTagHarness(entries) {
  const requests = [];
  const table = Object.create(null);
  for (let i = 0; i < (entries || []).length; i += 1) {
    const entry = entries[i];
    const fullPath = 'C:\\Music\\' + entry.name;
    table[fullPath] = {
      name: entry.name,
      fullPath,
      bytes: entry.bytes,
      size: Number(entry.size) || entry.bytes.length,
    };
  }

  /**
   * 返回夹具声明的文件大小，使解析器走真实的越界与截断分支。
   * @param {object} file 测试文件记录。
   * @returns {number} 文件逻辑大小。
   */
  function localFileSize(file) { return Number(file && file.size) || 0; }

  /**
   * 返回稳定绝对路径，用于验证同一文件的读取合并。
   * @param {object} file 测试文件记录。
   * @returns {string} 文件绝对路径。
   */
  function localFullPath(file) { return String((file && file.fullPath) || ''); }

  /**
   * 记录 renderer 发往主进程的实际范围，并只返回夹具中真实存在的字节。
   * @param {string} fullPath 文件绝对路径。
   * @param {number} start 起始偏移。
   * @param {number|null} end 结束偏移。
   * @returns {Promise<object>} 分块 IPC 读取结果。
   */
  function readLocalFileRange(fullPath, start, end) {
    requests.push({ fullPath, start, end });
    const entry = table[fullPath];
    if (!entry) return Promise.resolve({ ok: false, base64Chunks: [], byteLength: 0 });
    const from = Math.min(Math.max(0, start), entry.bytes.length);
    const stop = end == null ? entry.bytes.length : Math.min(entry.bytes.length, end);
    const range = entry.bytes.subarray(from, Math.max(from, stop));
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
   * 忽略夹具中预期内的解析告警。
   * @returns {void}
   */
  function ignoreWarning() {}

  const context = {
    Array,
    Blob,
    Error,
    LOCAL_ASSET_LIGHT_SCAN_BYTES: LIGHT_SCAN_BYTES,
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
    readLocalTagParserSource()
      + '\nthis.extractTags = extractLocalMetadataTags;'
      + '\nthis.extractCover = extractEmbeddedCoverSource;'
      + '\nthis.extractLyrics = extractEmbeddedLyricsText;'
      + '\nthis.lyricSourceLabel = embeddedLyricSourceLabel;'
      + '\nthis.pendingRangeReads = localFileRangeReadBatches;',
    context,
  );

  /**
   * 按文件名取出测试文件记录。
   * @param {string} name 文件名。
   * @returns {object} 测试文件记录。
   */
  function file(name) {
    const entry = table['C:\\Music\\' + name];
    assert.ok(entry, '未注册夹具文件 ' + name);
    return { name: entry.name, fullPath: entry.fullPath, size: entry.size };
  }

  /**
   * 返回落在指定起始偏移上的底层读取范围。
   * @param {number} start 起始偏移。
   * @returns {Array<object>} 匹配的读取记录。
   */
  function requestsAt(start) {
    return requests.filter(function keepStart(item) { return item.start === start; });
  }

  return { context, requests, file, requestsAt };
}

/**
 * 构造小端 16 位整数字节。
 * @param {number} value 数值。
 * @returns {Buffer} 两字节。
 */
function u16le(value) {
  const out = Buffer.alloc(2);
  out.writeUInt16LE(value, 0);
  return out;
}

/**
 * 构造小端 32 位整数字节。
 * @param {number} value 数值。
 * @returns {Buffer} 四字节。
 */
function u32le(value) {
  const out = Buffer.alloc(4);
  out.writeUInt32LE(value >>> 0, 0);
  return out;
}

/**
 * 构造小端 64 位整数字节。
 * @param {number} value 数值。
 * @returns {Buffer} 八字节。
 */
function u64le(value) {
  const out = Buffer.alloc(8);
  out.writeUInt32LE(value % 4294967296, 0);
  out.writeUInt32LE(Math.floor(value / 4294967296), 4);
  return out;
}

/**
 * 构造大端 32 位整数字节。
 * @param {number} value 数值。
 * @returns {Buffer} 四字节。
 */
function u32be(value) {
  const out = Buffer.alloc(4);
  out.writeUInt32BE(value >>> 0, 0);
  return out;
}

/**
 * 把 UTF-8 文本转为 Vorbis comment 项字节。
 * @param {string} text `KEY=VALUE` 文本。
 * @returns {Buffer} 项字节。
 */
function comment(text) {
  return Buffer.from(text, 'utf8');
}

/**
 * 构造 Vorbis comment payload。
 * @param {Array<Buffer>} items 已编码的 comment 项。
 * @param {string=} vendor vendor 字符串。
 * @returns {Buffer} payload 字节。
 */
function buildVorbisComments(items, vendor) {
  const vendorBytes = Buffer.from(vendor || 'mineradio-test', 'utf8');
  const parts = [u32le(vendorBytes.length), vendorBytes, u32le(items.length)];
  for (let i = 0; i < items.length; i += 1) {
    parts.push(u32le(items[i].length));
    parts.push(items[i]);
  }
  return Buffer.concat(parts);
}

/**
 * 构造 FLAC PICTURE block 内容。
 * @param {string} mime 图片 MIME。
 * @param {Buffer} image 图片字节。
 * @returns {Buffer} PICTURE block 内容。
 */
function buildFlacPictureBlock(mime, image) {
  const mimeBytes = Buffer.from(mime, 'ascii');
  return Buffer.concat([
    u32be(3), u32be(mimeBytes.length), mimeBytes, u32be(0),
    u32be(64), u32be(64), u32be(24), u32be(0),
    u32be(image.length), image,
  ]);
}

/**
 * 构造单个 Ogg 页；CRC 留零，解析器不校验。
 * @param {object} options 页参数：serial、seq、granule、flags、lacing、payload。
 * @returns {Buffer} 完整页字节。
 */
function buildOggPage(options) {
  const lacing = Buffer.from(options.lacing);
  const head = Buffer.alloc(27);
  head.write('OggS', 0, 'ascii');
  head[4] = 0;
  head[5] = options.flags || 0;
  if (options.granule < 0) Buffer.alloc(8, 0xff).copy(head, 6);
  else u64le(options.granule || 0).copy(head, 6);
  u32le(options.serial).copy(head, 14);
  u32le(options.seq || 0).copy(head, 18);
  head[26] = lacing.length;
  return Buffer.concat([head, lacing, options.payload || Buffer.alloc(0)]);
}

/**
 * 计算单个完整数据包的 lacing 值序列。
 * @param {number} length 包长度。
 * @returns {Array<number>} lacing 值序列。
 */
function packetLacing(length) {
  const out = [];
  let rest = length;
  while (rest >= 255) {
    out.push(255);
    rest -= 255;
  }
  out.push(rest);
  return out;
}

/**
 * 把一个完整数据包包装成一页。
 * @param {number} serial 逻辑流序号。
 * @param {number} seq 页序号。
 * @param {Buffer} packet 数据包字节。
 * @param {number=} flags 页标志。
 * @returns {Buffer} 页字节。
 */
function buildOggPacketPage(serial, seq, packet, flags) {
  return buildOggPage({
    serial, seq, granule: -1, flags: flags || 0,
    lacing: packetLacing(packet.length), payload: packet,
  });
}

/**
 * 把一个数据包拆成两页，第二页带 continued 标志。
 * @param {number} serial 逻辑流序号。
 * @param {number} seq 首页序号。
 * @param {Buffer} packet 数据包字节。
 * @returns {Buffer} 两页字节。
 */
function buildOggSplitPacketPages(serial, seq, packet) {
  assert.ok(packet.length > 255, '拆页夹具需要超过 255 字节的数据包');
  const head = packet.subarray(0, 255);
  const tail = packet.subarray(255);
  return Buffer.concat([
    buildOggPage({ serial, seq, granule: -1, flags: 0, lacing: [255], payload: head }),
    buildOggPage({ serial, seq: seq + 1, granule: -1, flags: 0x01, lacing: packetLacing(tail.length), payload: tail }),
  ]);
}

/**
 * 构造 Vorbis identification 包。
 * @param {number} channels 声道数。
 * @param {number} sampleRate 采样率。
 * @returns {Buffer} 30 字节标识包。
 */
function buildVorbisIdPacket(channels, sampleRate) {
  const packet = Buffer.alloc(30);
  packet[0] = 1;
  packet.write('vorbis', 1, 'ascii');
  packet[11] = channels;
  u32le(sampleRate).copy(packet, 12);
  packet[28] = 0xb8;
  packet[29] = 1;
  return packet;
}

/**
 * 构造 OpusHead 包。
 * @param {number} channels 声道数。
 * @param {number} preSkip 头部 pre-skip 样本数。
 * @param {number} inputRate 原始输入采样率。
 * @returns {Buffer} 19 字节标识包。
 */
function buildOpusHeadPacket(channels, preSkip, inputRate) {
  const packet = Buffer.alloc(19);
  packet.write('OpusHead', 0, 'ascii');
  packet[8] = 1;
  packet[9] = channels;
  u16le(preSkip).copy(packet, 10);
  u32le(inputRate).copy(packet, 12);
  return packet;
}

/**
 * 构造 FLAC STREAMINFO block 内容。
 * @param {number} sampleRate 采样率。
 * @param {number} channels 声道数。
 * @param {number} bits 位深。
 * @param {number} totalSamples 总样本数。
 * @returns {Buffer} 34 字节 STREAMINFO。
 */
function buildFlacStreamInfo(sampleRate, channels, bits, totalSamples) {
  const info = Buffer.alloc(34);
  info.writeUInt16BE(4096, 0);
  info.writeUInt16BE(4096, 2);
  info[10] = (sampleRate >>> 12) & 0xff;
  info[11] = (sampleRate >>> 4) & 0xff;
  info[12] = ((sampleRate & 0x0f) << 4) | (((channels - 1) & 0x07) << 1) | (((bits - 1) >>> 4) & 0x01);
  info[13] = (((bits - 1) & 0x0f) << 4) | (Math.floor(totalSamples / 4294967296) & 0x0f);
  info.writeUInt32BE(totalSamples % 4294967296, 14);
  return info;
}

/**
 * 构造 FLAC metadata block 头部。
 * @param {number} type block 类型。
 * @param {boolean} last 是否为最后一个 metadata block。
 * @param {number} length block 内容长度。
 * @returns {Buffer} 四字节头部。
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
 * 构造裸 FLAC metadata block（Ogg FLAC 的第二个及后续数据包形态）。
 * @param {number} type block 类型。
 * @param {boolean} last 是否为最后一个 metadata block。
 * @param {Buffer} body block 内容。
 * @returns {Buffer} 完整 block 字节。
 */
function buildFlacMetadataBlock(type, last, body) {
  return Buffer.concat([buildFlacBlockHeader(type, last, body.length), body]);
}

/**
 * 构造 Ogg FLAC 映射首包，内嵌完整 STREAMINFO。
 * @param {Buffer} streamInfo STREAMINFO 内容。
 * @param {number} headerPackets 后续 header 包数量。
 * @returns {Buffer} 51 字节首包。
 */
function buildOggFlacIdPacket(streamInfo, headerPackets) {
  const head = Buffer.alloc(13);
  head[0] = 0x7f;
  head.write('FLAC', 1, 'ascii');
  head[5] = 1;
  head[6] = 0;
  head.writeUInt16BE(headerPackets, 7);
  head.write('fLaC', 9, 'ascii');
  return Buffer.concat([head, buildFlacMetadataBlock(0, false, streamInfo)]);
}

/**
 * 构造 synchsafe 32 位整数。
 * @param {number} value 数值。
 * @returns {Buffer} 四字节 synchsafe 整数。
 */
function synchsafe(value) {
  return Buffer.from([
    (value >>> 21) & 0x7f,
    (value >>> 14) & 0x7f,
    (value >>> 7) & 0x7f,
    value & 0x7f,
  ]);
}

/**
 * 构造 ID3v2 文本帧内容。
 * @param {string} text 文本值。
 * @returns {Buffer} 帧内容，编码为 UTF-8。
 */
function id3TextBody(text) {
  return Buffer.concat([Buffer.from([3]), Buffer.from(text, 'utf8')]);
}

/**
 * 构造 ID3v2 APIC 帧内容。
 * @param {string} mime 图片 MIME。
 * @param {Buffer} image 图片字节。
 * @returns {Buffer} 帧内容。
 */
function id3ApicBody(mime, image) {
  return Buffer.concat([
    Buffer.from([0]), Buffer.from(mime, 'ascii'), Buffer.from([0]),
    Buffer.from([3]), Buffer.from([0]), image,
  ]);
}

/**
 * 构造 ID3v2 USLT 帧内容。
 * @param {string} text 歌词文本。
 * @returns {Buffer} 帧内容。
 */
function id3UsltBody(text) {
  return Buffer.concat([
    Buffer.from([3]), Buffer.from('chi', 'ascii'), Buffer.from([0]),
    Buffer.from(text, 'utf8'),
  ]);
}

/**
 * 构造 ID3v2.3 标签字节。
 * @param {Array<object>} frames 帧数组，元素为 `{id, body}`。
 * @returns {Buffer} 完整标签字节。
 */
function buildId3v2Tag(frames) {
  const parts = [];
  for (let i = 0; i < frames.length; i += 1) {
    parts.push(Buffer.from(frames[i].id, 'ascii'));
    parts.push(u32be(frames[i].body.length));
    parts.push(Buffer.alloc(2));
    parts.push(frames[i].body);
  }
  const body = Buffer.concat(parts);
  const head = Buffer.alloc(10);
  head.write('ID3', 0, 'ascii');
  head[3] = 3;
  head[4] = 0;
  head[5] = 0;
  synchsafe(body.length).copy(head, 6);
  return Buffer.concat([head, body]);
}

/**
 * 构造只含标签头、声明体积远超实际字节的 ID3v2 标签。
 * @param {number} declaredBodyBytes 声明的标签体大小。
 * @returns {Buffer} 10 字节标签头。
 */
function buildId3v2HeaderOnly(declaredBodyBytes) {
  const head = Buffer.alloc(10);
  head.write('ID3', 0, 'ascii');
  head[3] = 3;
  synchsafe(declaredBodyBytes).copy(head, 6);
  return head;
}

/**
 * 构造 128 字节 ID3v1.1 标签。
 * @param {object} fields 字段值：title、artist、album、year、track。
 * @returns {Buffer} 标签字节。
 */
function buildId3v1Tag(fields) {
  const tag = Buffer.alloc(128);
  tag.write('TAG', 0, 'ascii');
  if (fields.title) tag.write(fields.title, 3, 30, 'latin1');
  if (fields.artist) tag.write(fields.artist, 33, 30, 'latin1');
  if (fields.album) tag.write(fields.album, 63, 30, 'latin1');
  if (fields.year) tag.write(String(fields.year), 93, 4, 'ascii');
  if (fields.track) tag[126] = fields.track;
  return tag;
}

/**
 * 构造 RIFF chunk，奇数长度自动补齐填充字节。
 * @param {string} id chunk id。
 * @param {Buffer} body chunk 内容。
 * @returns {Buffer} chunk 字节。
 */
function buildRiffChunk(id, body) {
  const parts = [Buffer.from(id, 'ascii'), u32le(body.length), body];
  if (body.length % 2) parts.push(Buffer.alloc(1));
  return Buffer.concat(parts);
}

/**
 * 构造 LIST/INFO chunk 内容。
 * @param {Array<object>} items INFO 项数组，元素为 `{id, value}`。
 * @returns {Buffer} 含 `INFO` 标识的 chunk 内容。
 */
function buildRiffInfoBody(items) {
  const parts = [Buffer.from('INFO', 'ascii')];
  for (let i = 0; i < items.length; i += 1) {
    const value = Buffer.concat([Buffer.from(items[i].value, 'utf8'), Buffer.alloc(1)]);
    parts.push(Buffer.from(items[i].id, 'ascii'));
    parts.push(u32le(value.length));
    parts.push(value);
    if (value.length % 2) parts.push(Buffer.alloc(1));
  }
  return Buffer.concat(parts);
}

/**
 * 构造 16 字节 PCM `fmt ` chunk 内容。
 * @param {object} format 格式参数：channels、sampleRate、byteRate、bits。
 * @returns {Buffer} fmt chunk 内容。
 */
function buildWavFormatBody(format) {
  return Buffer.concat([
    u16le(1), u16le(format.channels), u32le(format.sampleRate), u32le(format.byteRate),
    u16le(format.channels * Math.ceil(format.bits / 8)), u16le(format.bits),
  ]);
}

/**
 * 把 RIFF chunk 序列包装成完整 WAVE 文件。
 * @param {string} magic 容器魔数，`RIFF` 或 `RF64`。
 * @param {Array<Buffer>} chunks 已构造的 chunk 字节。
 * @returns {Buffer} 完整文件字节。
 */
function buildRiffFile(magic, chunks) {
  const body = Buffer.concat(chunks);
  const declared = magic === 'RIFF' ? 4 + body.length : 0xffffffff;
  return Buffer.concat([Buffer.from(magic, 'ascii'), u32le(declared), Buffer.from('WAVE', 'ascii'), body]);
}

/**
 * 构造 APEv2 标签项。
 * @param {string} key 标签项名。
 * @param {Buffer} value 标签项内容。
 * @param {number} type 项类型：0 文本，1 二进制。
 * @returns {Buffer} 项字节。
 */
function buildApeItem(key, value, type) {
  return Buffer.concat([
    u32le(value.length), u32le((type & 3) << 1),
    Buffer.from(key, 'ascii'), Buffer.alloc(1), value,
  ]);
}

/**
 * 构造 APEv2 二进制封面项内容。
 * @param {string} fileName 图片文件名。
 * @param {Buffer} image 图片字节。
 * @returns {Buffer} 二进制项内容。
 */
function buildApeCoverValue(fileName, image) {
  return Buffer.concat([Buffer.from(fileName, 'utf8'), Buffer.alloc(1), image]);
}

/**
 * 构造 APEv2 footer。
 * @param {number} tagSize 含 footer 自身的标签体积。
 * @param {number} itemCount 标签项数量。
 * @returns {Buffer} 32 字节 footer。
 */
function buildApeFooter(tagSize, itemCount) {
  return Buffer.concat([
    Buffer.from('APETAGEX', 'ascii'), u32le(2000), u32le(tagSize),
    u32le(itemCount), u32le(0), Buffer.alloc(8),
  ]);
}

/**
 * 把 APEv2 标签项拼成带 footer 的完整标签区域。
 * @param {Array<Buffer>} items 已构造的标签项。
 * @returns {Buffer} 标签区域字节。
 */
function buildApeTagRegion(items) {
  const body = Buffer.concat(items);
  return Buffer.concat([body, buildApeFooter(body.length + 32, items.length)]);
}

/**
 * 构造 APE 3.99+ 描述符与头部。
 * @param {object} stream 流参数：version、channels、sampleRate、bps、blocksPerFrame、finalFrameBlocks、totalFrames。
 * @returns {Buffer} 76 字节描述符与头部。
 */
function buildApeModernHeader(stream) {
  const descriptor = Buffer.alloc(52);
  descriptor.write('MAC ', 0, 'ascii');
  u16le(stream.version).copy(descriptor, 4);
  u32le(52).copy(descriptor, 8);
  u32le(24).copy(descriptor, 12);
  const header = Buffer.concat([
    u16le(2000), u16le(0), u32le(stream.blocksPerFrame), u32le(stream.finalFrameBlocks),
    u32le(stream.totalFrames), u16le(stream.bps), u16le(stream.channels), u32le(stream.sampleRate),
  ]);
  return Buffer.concat([descriptor, header]);
}

/**
 * 构造 APE 3.98 及更早版本的头部。
 * @param {object} stream 流参数：version、compressionLevel、formatFlags、channels、sampleRate、totalFrames、finalFrameBlocks。
 * @returns {Buffer} 32 字节旧版头部。
 */
function buildApeLegacyHeader(stream) {
  return Buffer.concat([
    Buffer.from('MAC ', 'ascii'), u16le(stream.version), u16le(stream.compressionLevel),
    u16le(stream.formatFlags), u16le(stream.channels), u32le(stream.sampleRate),
    u32le(0), u32le(0), u32le(stream.totalFrames), u32le(stream.finalFrameBlocks),
  ]);
}

/**
 * 把 APE 各段拼成完整文件。
 * @param {object} options 段落：id3v2、header、frameBytes、tagRegion、id3v1。
 * @returns {Buffer} 完整文件字节。
 */
function buildApeFile(options) {
  const parts = [];
  if (options.id3v2) parts.push(options.id3v2);
  parts.push(options.header);
  parts.push(Buffer.alloc(options.frameBytes == null ? 512 : options.frameBytes, 0x33));
  if (options.tagRegion) parts.push(options.tagRegion);
  if (options.id3v1) parts.push(options.id3v1);
  return Buffer.concat(parts);
}

/**
 * 构造 DSF 文件：DSD 头 + fmt + data + 可选尾部 ID3v2。
 * @param {object} options 参数：channels、sampleRate、bits、sampleCount、audioBytes、tag。
 * @returns {object} `{bytes, metadataOffset}`。
 */
function buildDsfFile(options) {
  const audio = Buffer.alloc(options.audioBytes == null ? 4096 : options.audioBytes, 0x69);
  const dataChunk = Buffer.concat([Buffer.from('data', 'ascii'), u64le(12 + audio.length), audio]);
  const fmt = Buffer.concat([
    Buffer.from('fmt ', 'ascii'), u64le(52), u32le(1), u32le(0),
    u32le(2), u32le(options.channels), u32le(options.sampleRate),
    u32le(options.bits), u64le(options.sampleCount), u32le(4096), u32le(0),
  ]);
  const tag = options.tag || Buffer.alloc(0);
  const metadataOffset = tag.length ? 28 + fmt.length + dataChunk.length : 0;
  const declaredSize = 28 + fmt.length + dataChunk.length + (options.declaredTagBytes || tag.length);
  const dsd = Buffer.concat([
    Buffer.from('DSD ', 'ascii'), u64le(28), u64le(declaredSize), u64le(metadataOffset),
  ]);
  return {
    bytes: Buffer.concat([dsd, fmt, dataChunk, tag]),
    metadataOffset,
    size: declaredSize,
  };
}

/**
 * 构造带内嵌封面、歌词与完整标签的 Ogg Vorbis 夹具；注释包跨两页且中间夹入其它逻辑流页。
 * @returns {object} `{bytes, image, serial}`。
 */
function buildOggVorbisFixture() {
  const image = Buffer.alloc(48, 0x5a);
  const picture = buildFlacPictureBlock('image/png', image);
  const commentPacket = Buffer.concat([
    Buffer.from([3]), Buffer.from('vorbis', 'ascii'),
    buildVorbisComments([
      comment('TITLE=Ogg 标题'),
      comment('ARTIST=Ogg 艺人'),
      comment('ALBUM=Ogg 专辑'),
      comment('GENRE=(17)'),
      comment('DATE=2021'),
      comment('TRACKNUMBER=7'),
      comment('LYRICS=[00:01.50]第一行\n[00:02.00]第二行'),
      comment('METADATA_BLOCK_PICTURE=' + picture.toString('base64')),
    ]),
  ]);
  const serial = 0x1234;
  return {
    image,
    serial,
    bytes: Buffer.concat([
      buildOggPacketPage(serial, 0, buildVorbisIdPacket(2, 44100), 0x02),
      buildOggPacketPage(0x9999, 0, Buffer.from('other logical stream', 'ascii'), 0x02),
      buildOggSplitPacketPages(serial, 1, commentPacket),
      buildOggPage({ serial, seq: 3, granule: 88200, flags: 0x04, lacing: [16], payload: Buffer.alloc(16, 0x11) }),
    ]),
  };
}

/**
 * 构造 Ogg Opus 夹具：预跳采样、旧式 COVERART 封面、以及多个歌词字段。
 * @returns {object} `{bytes, image}`。
 */
function buildOggOpusFixture() {
  const image = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(44, 0x7b)]);
  const commentPacket = Buffer.concat([
    Buffer.from('OpusTags', 'ascii'),
    buildVorbisComments([
      comment('TITLE=Opus 标题'),
      comment('ARTIST=Opus 艺人'),
      comment('UNSYNCEDLYRICS=没有时间轴的歌词'),
      comment('LYRICS=[00:03.00]同步歌词'),
      comment('COVERARTMIME=image/jpeg'),
      comment('COVERART=' + image.toString('base64')),
    ]),
  ]);
  const serial = 0x4321;
  return {
    image,
    bytes: Buffer.concat([
      buildOggPacketPage(serial, 0, buildOpusHeadPacket(2, 312, 48000), 0x02),
      buildOggPacketPage(serial, 1, commentPacket, 0),
      buildOggPage({ serial, seq: 2, granule: 96312, flags: 0x04, lacing: [16], payload: Buffer.alloc(16, 0x22) }),
    ]),
  };
}

/**
 * 构造 Ogg FLAC 夹具：时长来自 STREAMINFO，封面位于靠后的元数据包。
 * @returns {object} `{bytes, image}`。
 */
function buildOggFlacFixture() {
  const image = Buffer.alloc(64, 0x3c);
  const streamInfo = buildFlacStreamInfo(44100, 2, 16, 132300);
  const serial = 0x5678;
  return {
    image,
    bytes: Buffer.concat([
      buildOggPacketPage(serial, 0, buildOggFlacIdPacket(streamInfo, 3), 0x02),
      buildOggPacketPage(serial, 1, buildFlacMetadataBlock(4, false, buildVorbisComments([
        comment('TITLE=OggFLAC 标题'),
        comment('ALBUM=OggFLAC 专辑'),
      ])), 0),
      buildOggPacketPage(serial, 2, buildFlacMetadataBlock(1, false, Buffer.alloc(64, 0)), 0),
      buildOggPacketPage(serial, 3, buildFlacMetadataBlock(6, true, buildFlacPictureBlock('image/jpeg', image)), 0),
      buildOggPage({ serial, seq: 4, granule: 132300, flags: 0x04, lacing: [16], payload: Buffer.alloc(16, 0x33) }),
    ]),
  };
}

/**
 * 把封面 Blob 读成可比较的字节数组。
 * @param {Blob} blob 封面 Blob。
 * @returns {Promise<number[]>} 字节数组。
 */
async function coverByteList(blob) {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}

async function testOggVorbisTagsCoverAndLyrics() {
  const fixture = buildOggVorbisFixture();
  const harness = createFormatTagHarness([{ name: 'vorbis.ogg', bytes: fixture.bytes }]);
  const file = harness.file('vorbis.ogg');
  const tags = await harness.context.extractTags(file, {});
  assert.equal(tags.title, 'Ogg 标题');
  assert.equal(tags.artist, 'Ogg 艺人');
  assert.equal(tags.album, 'Ogg 专辑');
  assert.equal(tags.genre, 'Rock', 'GENRE=(17) 应归一化为 ID3v1 流派名');
  assert.equal(tags.year, '2021');
  assert.equal(tags.track, '7');
  assert.equal(tags.duration, 2, '尾页 granule 88200 / 44100 应得 2 秒');
  assert.equal(harness.requests.length, 2, 'Vorbis 无 totalSamples，应在头窗之外再读一次尾部求时长');
  const cover = await harness.context.extractCover(file, {});
  assert.equal(cover && cover.type, 'image/png');
  assert.deepEqual(await coverByteList(cover), Array.from(fixture.image));
  const lyrics = await harness.context.extractLyrics(file, {});
  assert.equal(lyrics, '[00:01.50]第一行\n[00:02.00]第二行');
}

async function testOggOpusPreSkipDurationAndLegacyCover() {
  const fixture = buildOggOpusFixture();
  const harness = createFormatTagHarness([{ name: 'opus.opus', bytes: fixture.bytes }]);
  const file = harness.file('opus.opus');
  const tags = await harness.context.extractTags(file, {});
  assert.equal(tags.title, 'Opus 标题');
  assert.equal(tags.artist, 'Opus 艺人');
  assert.equal(tags.duration, 2, '(96312 - 312) / 48000 应得 2 秒');
  const cover = await harness.context.extractCover(file, {});
  assert.equal(cover && cover.type, 'image/jpeg', 'COVERARTMIME 应作为旧式封面的 MIME');
  assert.deepEqual(await coverByteList(cover), Array.from(fixture.image));
  const lyrics = await harness.context.extractLyrics(file, {});
  assert.equal(lyrics, '[00:03.00]同步歌词', '带时间轴的 LYRICS 应压过无时间轴的 UNSYNCEDLYRICS');
}

async function testOggFlacStreamInfoDurationSkipsTailRead() {
  const fixture = buildOggFlacFixture();
  const harness = createFormatTagHarness([{ name: 'oggflac.oga', bytes: fixture.bytes }]);
  const file = harness.file('oggflac.oga');
  const tags = await harness.context.extractTags(file, {});
  assert.equal(tags.title, 'OggFLAC 标题');
  assert.equal(tags.album, 'OggFLAC 专辑');
  assert.equal(tags.duration, 3, 'STREAMINFO totalSamples 132300 / 44100 应得 3 秒');
  assert.equal(harness.requests.length, 1, 'STREAMINFO 已给出总采样数时不应再读尾部');
  assert.equal(
    harness.requests[0].end, Math.min(fixture.bytes.length, HEADER_WINDOW_BYTES),
    '头部窗口应按 64KB 上限一次读满',
  );
  const cover = await harness.context.extractCover(file, {});
  assert.equal(cover && cover.type, 'image/jpeg', 'Ogg FLAC 靠后的 PICTURE 元数据包也应解析');
  assert.deepEqual(await coverByteList(cover), Array.from(fixture.image));
}

async function testTruncatedOggMarksScanIncomplete() {
  const fixture = buildOggVorbisFixture();
  const cut = fixture.bytes.subarray(0, fixture.bytes.length - 200);
  const harness = createFormatTagHarness([
    { name: 'cut.ogg', bytes: cut, size: fixture.bytes.length },
  ]);
  const tags = await harness.context.extractTags(harness.file('cut.ogg'), { light: true });
  assert.equal(tags.title, undefined, '注释包读不全时不应给出半截标签');
  assert.equal(tags._mineradioScanComplete, false, '注释包被截断应标记为需要完整重试');
}

/**
 * 构造带 LIST/INFO 与 id3 双标签源的 WAV 夹具。
 * @returns {object} `{bytes, image}`。
 */
function buildWavFixture() {
  const image = Buffer.alloc(40, 0x2b);
  const id3 = buildId3v2Tag([
    { id: 'TIT2', body: id3TextBody('WAV 标题') },
    { id: 'TPE1', body: id3TextBody('WAV 艺人') },
    { id: 'APIC', body: id3ApicBody('image/png', image) },
    { id: 'USLT', body: id3UsltBody('[00:05.00]WAV 歌词') },
  ]);
  return {
    image,
    bytes: buildRiffFile('RIFF', [
      buildRiffChunk('fmt ', buildWavFormatBody({ channels: 2, sampleRate: 44100, byteRate: 176400, bits: 16 })),
      buildRiffChunk('bext', Buffer.alloc(3, 0x41)),
      buildRiffChunk('LIST', buildRiffInfoBody([
        { id: 'INAM', value: 'INFO 标题' },
        { id: 'IART', value: 'INFO 艺人' },
        { id: 'IPRD', value: 'INFO 专辑' },
        { id: 'ICRD', value: '2019' },
        { id: 'ITRK', value: '3' },
      ])),
      buildRiffChunk('id3 ', id3),
      buildRiffChunk('data', Buffer.alloc(176400, 0x08)),
    ]),
  };
}

async function testWavId3ChunkWinsOverInfoChunk() {
  const fixture = buildWavFixture();
  const harness = createFormatTagHarness([{ name: 'sample.wav', bytes: fixture.bytes }]);
  const file = harness.file('sample.wav');
  const tags = await harness.context.extractTags(file, {});
  assert.equal(tags.title, 'WAV 标题', 'id3 chunk 应先写入并压过 LIST/INFO');
  assert.equal(tags.artist, 'WAV 艺人');
  assert.equal(tags.album, 'INFO 专辑', 'id3 里没有的字段应由 LIST/INFO 补齐');
  assert.equal(tags.year, '2019');
  assert.equal(tags.track, '3');
  assert.equal(tags.duration, 1, 'data 176400 / byteRate 176400 应得 1 秒');
  const cover = await harness.context.extractCover(file, {});
  assert.equal(cover && cover.type, 'image/png');
  assert.deepEqual(await coverByteList(cover), Array.from(fixture.image));
  assert.equal(await harness.context.extractLyrics(file, {}), '[00:05.00]WAV 歌词');
}

async function testRf64UsesDs64DataSizeForDuration() {
  const bytes = buildRiffFile('RF64', [
    buildRiffChunk('ds64', Buffer.concat([u64le(0xffffffff), u64le(5760000000), u64le(0), u32le(0)])),
    buildRiffChunk('fmt ', buildWavFormatBody({ channels: 2, sampleRate: 96000, byteRate: 576000, bits: 24 })),
    buildRiffChunk('LIST', buildRiffInfoBody([{ id: 'INAM', value: 'RF64 标题' }])),
    Buffer.concat([Buffer.from('data', 'ascii'), u32le(0xffffffff)]),
  ]);
  const harness = createFormatTagHarness([{ name: 'huge.wav', bytes, size: 5760000000 + bytes.length }]);
  const tags = await harness.context.extractTags(harness.file('huge.wav'), {});
  assert.equal(tags.title, 'RF64 标题');
  assert.equal(tags.duration, 10000, 'ds64 的 64 位 dataSize 应替换 0xFFFFFFFF 参与时长计算');
}

async function testWavOversizedId3ChunkMarksScanIncomplete() {
  const bytes = buildRiffFile('RIFF', [
    buildRiffChunk('fmt ', buildWavFormatBody({ channels: 2, sampleRate: 44100, byteRate: 176400, bits: 16 })),
    buildRiffChunk('data', Buffer.alloc(44100, 0x09)),
    Buffer.concat([Buffer.from('id3 ', 'ascii'), u32le(5 * 1024 * 1024), buildId3v2HeaderOnly(64)]),
  ]);
  const harness = createFormatTagHarness([{ name: 'big-tag.wav', bytes }]);
  const file = harness.file('big-tag.wav');
  const tags = await harness.context.extractTags(file, { light: true });
  assert.equal(tags.title, undefined);
  assert.equal(tags.duration, 0.25, '标签超预算也不应影响 fmt/data 推导的时长');
  assert.equal(tags._mineradioScanComplete, false, 'id3 chunk 超过轻量预算应标记为需要完整重试');
  assert.equal(await harness.context.extractCover(file, { light: true }), null);
  assert.equal(await harness.context.extractLyrics(file, { light: true }), '');
  const beforeCount = harness.requests.length;
  await harness.context.extractTags(file, { light: true });
  assert.equal(
    harness.requests.length - beforeCount, 1,
    '超预算的标签 chunk 只应读目录窗口，不应再发额外范围读取',
  );
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * 构造带 APEv2 + 尾部 ID3v1 的 APE 夹具。
 * @returns {object} `{bytes, image}`。
 */
function buildApeFixture() {
  const image = Buffer.concat([PNG_MAGIC, Buffer.alloc(56, 0x6d)]);
  return {
    image,
    bytes: buildApeFile({
      header: buildApeModernHeader({
        version: 3990, blocksPerFrame: 73728, finalFrameBlocks: 88200,
        totalFrames: 1, bps: 16, channels: 2, sampleRate: 44100,
      }),
      tagRegion: buildApeTagRegion([
        buildApeItem('Title', Buffer.from('APE 标题', 'utf8'), 0),
        buildApeItem('Artist', Buffer.from('APE 艺人', 'utf8'), 0),
        buildApeItem('Genre', Buffer.from('17', 'utf8'), 0),
        buildApeItem('Track', Buffer.from('9', 'utf8'), 0),
        buildApeItem('Lyrics', Buffer.from('[00:07.00]APE 歌词', 'utf8'), 0),
        buildApeItem('Cover Art (Front)', buildApeCoverValue('cover.png', image), 1),
      ]),
      id3v1: buildId3v1Tag({ album: 'ID3v1 Album', year: '2008' }),
    }),
  };
}

async function testApeModernHeaderWithApev2AndId3v1() {
  const fixture = buildApeFixture();
  const harness = createFormatTagHarness([{ name: 'song.ape', bytes: fixture.bytes }]);
  const file = harness.file('song.ape');
  const tags = await harness.context.extractTags(file, {});
  assert.equal(tags.title, 'APE 标题');
  assert.equal(tags.artist, 'APE 艺人');
  assert.equal(tags.genre, 'Rock', '裸数字流派也应还原成 ID3v1 流派名');
  assert.equal(tags.track, '9');
  assert.equal(tags.album, 'ID3v1 Album', 'APEv2 缺失的字段应由尾部 ID3v1 补齐');
  assert.equal(tags.year, '2008');
  assert.equal(tags.duration, 2, 'totalFrames 1 + finalFrameBlocks 88200 / 44100 应得 2 秒');
  assert.equal(tags._mineradioScanComplete, undefined);
  const cover = await harness.context.extractCover(file, {});
  assert.equal(cover && cover.type, 'image/png', '二进制封面项应按图片 magic 嗅探 MIME');
  assert.deepEqual(await coverByteList(cover), Array.from(fixture.image));
  assert.equal(await harness.context.extractLyrics(file, {}), '[00:07.00]APE 歌词');
}

async function testApeLegacyHeaderDerivesBlocksPerFrame() {
  const bytes = buildApeFile({
    header: buildApeLegacyHeader({
      version: 3800, compressionLevel: 4000, formatFlags: 8,
      channels: 2, sampleRate: 44100, totalFrames: 2, finalFrameBlocks: 14472,
    }),
    tagRegion: buildApeTagRegion([buildApeItem('Album', Buffer.from('旧版 APE 专辑', 'utf8'), 0)]),
  });
  const harness = createFormatTagHarness([{ name: 'legacy.ape', bytes }]);
  const tags = await harness.context.extractTags(harness.file('legacy.ape'), {});
  assert.equal(tags.album, '旧版 APE 专辑');
  assert.equal(tags.duration, 2, '3800/level 4000 的 blocksPerFrame 应推为 73728');
}

async function testApeHeadId3v2FallbackWhenJunkPresent() {
  const image = Buffer.concat([PNG_MAGIC, Buffer.alloc(48, 0x4e)]);
  const bytes = buildApeFile({
    id3v2: buildId3v2Tag([
      { id: 'TIT2', body: id3TextBody('前置 ID3 标题') },
      { id: 'APIC', body: id3ApicBody('image/png', image) },
      { id: 'USLT', body: id3UsltBody('[00:09.00]前置 ID3 歌词') },
    ]),
    header: buildApeModernHeader({
      version: 3990, blocksPerFrame: 73728, finalFrameBlocks: 44100,
      totalFrames: 1, bps: 16, channels: 2, sampleRate: 44100,
    }),
  });
  const harness = createFormatTagHarness([{ name: 'junk.ape', bytes }]);
  const file = harness.file('junk.ape');
  const tags = await harness.context.extractTags(file, {});
  assert.equal(tags.title, '前置 ID3 标题', '没有 APEv2 时应回退到文件头 ID3v2');
  assert.equal(tags.duration, 1);
  const cover = await harness.context.extractCover(file, {});
  assert.equal(cover && cover.type, 'image/png');
  assert.deepEqual(await coverByteList(cover), Array.from(image));
  assert.equal(await harness.context.extractLyrics(file, {}), '[00:09.00]前置 ID3 歌词');
}

async function testApeOversizedTagMarksScanIncomplete() {
  const bytes = buildApeFile({
    header: buildApeModernHeader({
      version: 3990, blocksPerFrame: 73728, finalFrameBlocks: 88200,
      totalFrames: 1, bps: 16, channels: 2, sampleRate: 44100,
    }),
    tagRegion: buildApeFooter(8 * 1024 * 1024, 4),
  });
  const harness = createFormatTagHarness([{ name: 'huge-tag.ape', bytes }]);
  const tags = await harness.context.extractTags(harness.file('huge-tag.ape'), { light: true });
  assert.equal(tags.title, undefined);
  assert.equal(tags.duration, 2);
  assert.equal(tags._mineradioScanComplete, false, 'APEv2 声明体积超预算应标记为需要完整重试');
}

/**
 * 构造带尾部 ID3v2 的 DSF 夹具。
 * @param {Buffer=} tag 自定义标签字节。
 * @returns {object} `{bytes, metadataOffset, size, image}`。
 */
function buildDsfFixture(tag) {
  const image = Buffer.concat([PNG_MAGIC, Buffer.alloc(52, 0x1f)]);
  const built = buildDsfFile({
    channels: 2, sampleRate: 2822400, bits: 1, sampleCount: 5644800, audioBytes: 2048,
    tag: tag || buildId3v2Tag([
      { id: 'TIT2', body: id3TextBody('DSD 标题') },
      { id: 'TPE1', body: id3TextBody('DSD 艺人') },
      { id: 'TALB', body: id3TextBody('DSD 专辑') },
      { id: 'TYER', body: id3TextBody('2016') },
      { id: 'APIC', body: id3ApicBody('image/png', image) },
      { id: 'USLT', body: id3UsltBody('[00:11.00]DSD 歌词') },
    ]),
  });
  built.image = image;
  return built;
}

async function testDsfTagsCoverLyricsAndDuration() {
  const fixture = buildDsfFixture();
  const harness = createFormatTagHarness([{ name: 'track.dsf', bytes: fixture.bytes }]);
  const file = harness.file('track.dsf');
  const tags = await harness.context.extractTags(file, {});
  assert.equal(tags.title, 'DSD 标题');
  assert.equal(tags.artist, 'DSD 艺人');
  assert.equal(tags.album, 'DSD 专辑');
  assert.equal(tags.year, '2016');
  assert.equal(tags.duration, 2, 'sampleCount 5644800 / 2822400 应得 2 秒');
  assert.equal(
    harness.requestsAt(fixture.metadataOffset).length, 1,
    '标签落在 256KB 探针内时应直接复用探针字节，不再发第二次范围读取',
  );
  const cover = await harness.context.extractCover(file, {});
  assert.equal(cover && cover.type, 'image/png');
  assert.deepEqual(await coverByteList(cover), Array.from(fixture.image));
  assert.equal(await harness.context.extractLyrics(file, {}), '[00:11.00]DSD 歌词');
}

async function testDsfLargeTagNeedsSecondRead() {
  const fixture = buildDsfFixture(buildId3v2Tag([
    { id: 'TIT2', body: id3TextBody('大封面 DSD') },
    { id: 'APIC', body: id3ApicBody('image/jpeg', Buffer.alloc(300 * 1024, 0x71)) },
  ]));
  const harness = createFormatTagHarness([{ name: 'big.dsf', bytes: fixture.bytes }]);
  const tags = await harness.context.extractTags(harness.file('big.dsf'), {});
  assert.equal(tags.title, '大封面 DSD');
  assert.equal(tags.duration, 2);
  assert.deepEqual(
    harness.requestsAt(fixture.metadataOffset).map((entry) => entry.end - entry.start),
    [ID3_PROBE_BYTES, fixture.bytes.length - fixture.metadataOffset],
    '标签超过探针长度时应先探针、再按声明长度补读一次',
  );
}

async function testDsfWithoutMetadataOffsetSkipsTagRead() {
  const built = buildDsfFile({
    channels: 2, sampleRate: 2822400, bits: 1, sampleCount: 2822400, audioBytes: 1024,
  });
  const harness = createFormatTagHarness([{ name: 'bare.dsf', bytes: built.bytes }]);
  const file = harness.file('bare.dsf');
  const tags = await harness.context.extractTags(file, {});
  assert.equal(tags.title, undefined);
  assert.equal(tags.duration, 1);
  assert.equal(tags._mineradioScanComplete, undefined, 'metadataOffset 为 0 是正常无标签，不该要求重试');
  assert.equal(harness.requests.length, 1, 'metadataOffset 为 0 时不应发起标签读取');
  assert.equal(await harness.context.extractCover(file, {}), null);
  assert.equal(await harness.context.extractLyrics(file, {}), '');
}

async function testDsfOversizedTagMarksScanIncomplete() {
  const built = buildDsfFile({
    channels: 2, sampleRate: 2822400, bits: 1, sampleCount: 5644800, audioBytes: 1024,
    tag: buildId3v2HeaderOnly(5 * 1024 * 1024),
  });
  const harness = createFormatTagHarness([{ name: 'oversize.dsf', bytes: built.bytes }]);
  const tags = await harness.context.extractTags(harness.file('oversize.dsf'), { light: true });
  assert.equal(tags.title, undefined);
  assert.equal(tags.duration, 2);
  assert.equal(tags._mineradioScanComplete, false, 'ID3v2 声明体积超预算应标记为需要完整重试');
}

/**
 * 创建格式能力判定的隔离执行环境。
 * @returns {object} 暴露四个能力判定函数的上下文。
 */
function createFormatCapabilityHarness() {
  const context = { String };
  vm.runInNewContext(
    readFormatCapabilitySource()
      + '\nthis.formatName = localSongFormatName;'
      + '\nthis.canLyrics = canReadEmbeddedLyrics;'
      + '\nthis.canRetryLyrics = canReadTruncatableEmbeddedLyrics;'
      + '\nthis.canCover = canReadEmbeddedCover;'
      + '\nthis.canRetryCover = canReadTruncatableEmbeddedCover;',
    context,
  );
  return context;
}

async function testDispatcherRoutesOggAliasExtensions() {
  const fixture = buildOggVorbisFixture();
  const harness = createFormatTagHarness([
    { name: 'alias.oga', bytes: fixture.bytes },
    { name: 'alias.opus', bytes: fixture.bytes },
    { name: 'alias.OGG', bytes: fixture.bytes },
    { name: 'alias.unknown', bytes: fixture.bytes },
  ]);
  const names = ['alias.oga', 'alias.opus', 'alias.OGG'];
  for (let i = 0; i < names.length; i += 1) {
    const tags = await harness.context.extractTags(harness.file(names[i]), {});
    assert.equal(tags.title, 'Ogg 标题', names[i] + ' 应走 Ogg 解析分支');
  }
  const unknown = await harness.context.extractTags(harness.file('alias.unknown'), {});
  assert.deepEqual(Object.assign({}, unknown), {}, '未识别扩展名不应尝试解析');
  assert.equal(await harness.context.extractCover(harness.file('alias.unknown'), {}), null);
  assert.equal(await harness.context.extractLyrics(harness.file('alias.unknown'), {}), '');
}

function testEmbeddedLyricSourceLabelPerFormat() {
  const harness = createFormatTagHarness([{ name: 'label.ogg', bytes: Buffer.alloc(1) }]);
  const cases = [
    ['song.ogg', 'OGG LYRICS'],
    ['song.oga', 'OGA LYRICS'],
    ['song.opus', 'OPUS LYRICS'],
    ['song.wav', 'WAV LYRICS'],
    ['song.ape', 'APE LYRICS'],
    ['song.dsf', 'DSF LYRICS'],
    ['song', 'LOCAL LYRICS'],
  ];
  for (let i = 0; i < cases.length; i += 1) {
    assert.equal(harness.context.lyricSourceLabel({ localFileName: cases[i][0] }), cases[i][1]);
  }
}

function testFormatCapabilityGatesCoverNewFormats() {
  const capability = createFormatCapabilityHarness();
  const newFormats = ['ogg', 'oga', 'opus', 'wav', 'ape', 'dsf'];
  for (let i = 0; i < newFormats.length; i += 1) {
    const song = { localFile: { name: 'x.' + newFormats[i] } };
    assert.equal(capability.canLyrics(song), true, newFormats[i] + ' 应支持内嵌歌词');
    assert.equal(capability.canRetryLyrics(song), true, newFormats[i] + ' 歌词应可完整重试');
    assert.equal(capability.canCover(song), true, newFormats[i] + ' 应支持内嵌封面');
    assert.equal(capability.canRetryCover(song), true, newFormats[i] + ' 封面应可完整重试');
  }
  const mp3 = { localFile: { name: 'x.mp3' } };
  assert.equal(capability.canLyrics(mp3), true);
  assert.equal(capability.canRetryLyrics(mp3), false, 'MP3 按完整标签长度读取，无需完整重试');
  assert.equal(capability.canRetryCover(mp3), false);
  const aac = { localFile: { name: 'x.aac' } };
  assert.equal(capability.canLyrics(aac), false);
  assert.equal(capability.canCover(aac), false);
  assert.equal(
    capability.formatName({ localFile: {}, localFilePathAbsolute: 'D:\\a\\b.dsf' }),
    'D:\\a\\b.dsf',
    '仅有绝对路径的记录也应能判定格式',
  );
  assert.equal(capability.canCover({ localFile: {}, localPath: 'x/y.ape' }), true);
  assert.equal(capability.formatName(null), '');
}

test('Ogg Vorbis 解析标签、封面与歌词', testOggVorbisTagsCoverAndLyrics);
test('Ogg Opus 按预跳采样算时长并读旧式封面', testOggOpusPreSkipDurationAndLegacyCover);
test('Ogg FLAC 用 STREAMINFO 时长且跳过尾部读取', testOggFlacStreamInfoDurationSkipsTailRead);
test('截断的 Ogg 注释包标记为需要完整重试', testTruncatedOggMarksScanIncomplete);
test('WAV id3 chunk 压过 LIST/INFO 并补齐缺失字段', testWavId3ChunkWinsOverInfoChunk);
test('RF64 用 ds64 的 64 位 dataSize 算时长', testRf64UsesDs64DataSizeForDuration);
test('WAV 超预算 id3 chunk 标记为需要完整重试', testWavOversizedId3ChunkMarksScanIncomplete);
test('APE 新版头部合并 APEv2 与尾部 ID3v1', testApeModernHeaderWithApev2AndId3v1);
test('APE 旧版头部按版本推导 blocksPerFrame', testApeLegacyHeaderDerivesBlocksPerFrame);
test('APE 无 APEv2 时回退文件头 ID3v2', testApeHeadId3v2FallbackWhenJunkPresent);
test('APE 超预算标签标记为需要完整重试', testApeOversizedTagMarksScanIncomplete);
test('DSF 解析标签、封面、歌词与时长', testDsfTagsCoverLyricsAndDuration);
test('DSF 超出探针长度的标签补读一次', testDsfLargeTagNeedsSecondRead);
test('DSF 无 metadataOffset 时不读标签', testDsfWithoutMetadataOffsetSkipsTagRead);
test('DSF 超预算标签标记为需要完整重试', testDsfOversizedTagMarksScanIncomplete);
test('分发器覆盖 oga/opus/大写扩展名', testDispatcherRoutesOggAliasExtensions);
test('歌词来源标签按扩展名生成', testEmbeddedLyricSourceLabelPerFormat);
test('格式能力判定覆盖新增格式', testFormatCapabilityGatesCoverNewFormats);
