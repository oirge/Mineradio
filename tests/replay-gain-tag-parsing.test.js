'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const LIGHT_SCAN_BYTES = 4 * 1024 * 1024;

/**
 * 从前端源码截取本地标签解析实现，覆盖全部格式的 ReplayGain 采集路径。
 * @returns {string} 可在隔离上下文执行的真实源码。
 */
function readReplayGainParserSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function base64ChunksToBytes(');
  const end = source.indexOf('function applyLocalMetadataTags(', start);
  assert.ok(start >= 0 && end > start, '未找到本地标签解析实现');
  return source.slice(start, end);
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
 * 构造 ID3v2 synchsafe 长度字节。
 * @param {number} value 数值。
 * @returns {Buffer} 四字节。
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
 * 构造 Vorbis comment payload。
 * @param {Array<string>} items `KEY=VALUE` 文本数组。
 * @returns {Buffer} payload 字节。
 */
function buildVorbisComments(items) {
  const vendorBytes = Buffer.from('mineradio-test', 'utf8');
  const parts = [u32le(vendorBytes.length), vendorBytes, u32le(items.length)];
  for (let i = 0; i < items.length; i += 1) {
    const item = Buffer.from(items[i], 'utf8');
    parts.push(u32le(item.length));
    parts.push(item);
  }
  return Buffer.concat(parts);
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
 * 构造 FLAC metadata block。
 * @param {number} type block 类型。
 * @param {boolean} last 是否为最后一个 metadata block。
 * @param {Buffer} body block 内容。
 * @returns {Buffer} 完整 block 字节。
 */
function buildFlacMetadataBlock(type, last, body) {
  const header = Buffer.from([
    (last ? 0x80 : 0) | (type & 0x7f),
    (body.length >>> 16) & 0xff,
    (body.length >>> 8) & 0xff,
    body.length & 0xff,
  ]);
  return Buffer.concat([header, body]);
}

/**
 * 构造带 VORBIS_COMMENT 的最小 FLAC 文件。
 * @param {Array<string>} comments `KEY=VALUE` 文本数组。
 * @returns {Buffer} 完整文件字节。
 */
function buildFlacFixture(comments) {
  return Buffer.concat([
    Buffer.from('fLaC', 'ascii'),
    buildFlacMetadataBlock(0, false, buildFlacStreamInfo(44100, 2, 16, 44100 * 200)),
    buildFlacMetadataBlock(4, true, buildVorbisComments(comments)),
    Buffer.alloc(2048, 0x5a),
  ]);
}

/**
 * 构造 ID3v2.3 TXXX 帧内容。
 * @param {string} description 描述符。
 * @param {string} value 取值文本。
 * @returns {Buffer} 帧内容。
 */
function id3TxxxBody(description, value) {
  return Buffer.concat([
    Buffer.from([0]),
    Buffer.from(description, 'latin1'), Buffer.from([0]),
    Buffer.from(value, 'latin1'),
  ]);
}

/**
 * 构造 ID3v2.4 RVA2 帧内容。
 * @param {string} identification 标识串。
 * @param {Array<object>} channels 声道数组，元素为 `{channel, gainDb, peakBits}`。
 * @returns {Buffer} 帧内容。
 */
function id3Rva2Body(identification, channels) {
  const parts = [Buffer.from(identification, 'latin1'), Buffer.from([0])];
  for (let i = 0; i < channels.length; i += 1) {
    const entry = channels[i];
    const peakBits = entry.peakBits || 0;
    const head = Buffer.alloc(4);
    head[0] = entry.channel;
    head.writeInt16BE(Math.round(entry.gainDb * 512), 1);
    head[3] = peakBits;
    parts.push(head);
    if (peakBits) parts.push(Buffer.alloc(Math.ceil(peakBits / 8), 0xff));
  }
  return Buffer.concat(parts);
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
  synchsafe(body.length).copy(head, 6);
  return Buffer.concat([head, body]);
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
 * 构造带 id3 chunk 的最小 WAV 文件。
 * @param {Buffer} id3 ID3v2 标签字节。
 * @returns {Buffer} 完整文件字节。
 */
function buildWavFixture(id3) {
  const fmt = Buffer.concat([
    u16le(1), u16le(2), u32le(44100), u32le(176400), u16le(4), u16le(16),
  ]);
  const body = Buffer.concat([
    buildRiffChunk('fmt ', fmt),
    buildRiffChunk('data', Buffer.alloc(4096, 0x21)),
    buildRiffChunk('id3 ', id3),
  ]);
  return Buffer.concat([
    Buffer.from('RIFF', 'ascii'), u32le(4 + body.length), Buffer.from('WAVE', 'ascii'), body,
  ]);
}

/**
 * 构造 APEv2 文本标签项。
 * @param {string} key 标签项名。
 * @param {string} value 标签项文本。
 * @returns {Buffer} 项字节。
 */
function buildApeItem(key, value) {
  const payload = Buffer.from(value, 'utf8');
  return Buffer.concat([
    u32le(payload.length), u32le(0), Buffer.from(key, 'ascii'), Buffer.alloc(1), payload,
  ]);
}

/**
 * 构造带 APEv2 尾部标签的最小 APE 文件。
 * @param {Array<Buffer>} items 已构造的标签项。
 * @returns {Buffer} 完整文件字节。
 */
function buildApeFixture(items) {
  const descriptor = Buffer.alloc(52);
  descriptor.write('MAC ', 0, 'ascii');
  u16le(3990).copy(descriptor, 4);
  u32le(52).copy(descriptor, 8);
  u32le(24).copy(descriptor, 12);
  const header = Buffer.concat([
    u16le(2000), u16le(0), u32le(73728), u32le(1024), u32le(20),
    u16le(16), u16le(2), u32le(44100),
  ]);
  const body = Buffer.concat(items);
  const footer = Buffer.concat([
    Buffer.from('APETAGEX', 'ascii'), u32le(2000), u32le(body.length + 32),
    u32le(items.length), u32le(0), Buffer.alloc(8),
  ]);
  return Buffer.concat([descriptor, header, Buffer.alloc(512, 0x33), body, footer]);
}

/**
 * 创建一个带四字节类型和 payload 的 MP4 atom。
 * @param {string} type atom 类型。
 * @param {Buffer} payload atom 数据。
 * @returns {Buffer} 完整 atom 字节。
 */
function atom(type, payload) {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + payload.length, 0);
  header.write(type, 4, 4, 'latin1');
  return Buffer.concat([header, payload]);
}

/**
 * 构造 MP4 `----` 自定义标签项。
 * @param {string} name 自定义标签名。
 * @param {string} value 取值文本。
 * @returns {Buffer} ilst 项字节。
 */
function m4aFreeformItem(name, value) {
  const mean = atom('mean', Buffer.concat([Buffer.alloc(4), Buffer.from('com.apple.iTunes', 'utf8')]));
  const nameAtom = atom('name', Buffer.concat([Buffer.alloc(4), Buffer.from(name, 'utf8')]));
  const descriptor = Buffer.alloc(8);
  descriptor.writeUInt32BE(1, 0);
  const data = atom('data', Buffer.concat([descriptor, Buffer.from(value, 'utf8')]));
  return atom('----', Buffer.concat([mean, nameAtom, data]));
}

/**
 * 构造带 `----` 自定义标签的最小 M4A 文件。
 * @param {Array<Buffer>} items ilst 项字节数组。
 * @param {number=} mdatBytes mdat 填充字节数，用于把 moov 推出轻量扫描范围。
 * @returns {Buffer} 完整文件字节。
 */
function buildM4aFixture(items, mdatBytes) {
  const ilst = Buffer.concat(items);
  const meta = atom('meta', Buffer.concat([Buffer.alloc(4), atom('ilst', ilst)]));
  const moov = atom('moov', atom('udta', meta));
  const ftyp = atom('ftyp', Buffer.from('M4A \x00\x00\x00\x00isom', 'latin1'));
  return Buffer.concat([ftyp, atom('mdat', Buffer.alloc(mdatBytes == null ? 4096 : mdatBytes, 0x11)), moov]);
}

/**
 * 创建按声明范围返回真实字节的标签解析环境。
 * @param {Array<object>} entries 文件夹具描述数组，元素为 `{name, bytes}`。
 * @returns {object} 隔离执行上下文与文件记录访问器。
 */
function createReplayGainHarness(entries) {
  const table = Object.create(null);
  for (let i = 0; i < entries.length; i += 1) {
    const fullPath = 'C:\\Music\\' + entries[i].name;
    table[fullPath] = { name: entries[i].name, fullPath, bytes: entries[i].bytes };
  }

  /**
   * 返回夹具声明的文件大小。
   * @param {object} file 测试文件记录。
   * @returns {number} 文件逻辑大小。
   */
  function localFileSize(file) { return Number(file && file.size) || 0; }

  /**
   * 返回稳定绝对路径。
   * @param {object} file 测试文件记录。
   * @returns {string} 文件绝对路径。
   */
  function localFullPath(file) { return String((file && file.fullPath) || ''); }

  /**
   * 按生产 IPC 契约返回指定范围字节。
   * @param {string} fullPath 文件绝对路径。
   * @param {number} start 起始偏移。
   * @param {number|null} end 结束偏移。
   * @returns {Promise<object>} 分块 IPC 读取结果。
   */
  function readLocalFileRange(fullPath, start, end) {
    const entry = table[fullPath];
    if (!entry) return Promise.resolve({ ok: false, base64Chunks: [], byteLength: 0 });
    const from = Math.min(Math.max(0, start), entry.bytes.length);
    const stop = end == null ? entry.bytes.length : Math.min(entry.bytes.length, end);
    const range = entry.bytes.subarray(from, Math.max(from, stop));
    return Promise.resolve({ ok: true, base64Chunks: [range.toString('base64')], byteLength: range.length });
  }

  /** @returns {object} 桌面本地音乐桥接对象。 */
  function desktopLocalMusicApi() { return { readLocalFileRange }; }

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
    console: { warn() {} },
    desktopLocalMusicApi,
    localFileSize,
    localFullPath,
  };
  vm.runInNewContext(
    readReplayGainParserSource()
      + '\nthis.extractTags = extractLocalMetadataTags;'
      + '\nthis.tagField = replayGainTagField;'
      + '\nthis.parseDb = parseReplayGainDb;'
      + '\nthis.parsePeak = parseReplayGainPeak;'
      + '\nthis.normalizeInfo = normalizeReplayGainInfo;',
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
    return { name: entry.name, fullPath: entry.fullPath, size: entry.bytes.length };
  }

  return { context, file };
}

/**
 * 验证 FLAC/OGG 共用的 Vorbis comment 通道能取到整轨与整专辑增益和峰值。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testVorbisCommentReplayGain() {
  const harness = createReplayGainHarness([{
    name: 'rg.flac',
    bytes: buildFlacFixture([
      'TITLE=均衡测试',
      'REPLAYGAIN_TRACK_GAIN=-7.06 dB',
      'REPLAYGAIN_TRACK_PEAK=0.988525',
      'REPLAYGAIN_ALBUM_GAIN=+3.21dB',
      'REPLAYGAIN_ALBUM_PEAK=1.023000',
    ]),
  }]);

  const tags = await harness.context.extractTags(harness.file('rg.flac'), {});
  assert.equal(tags.title, '均衡测试', 'ReplayGain 采集不得影响展示标签');
  assert.deepEqual(Object.assign({}, tags.replayGain), {
    resolved: 1,
    trackGainDb: -7.06,
    albumGainDb: 3.21,
    trackPeak: 0.988525,
    albumPeak: 1.023,
  });
}

/**
 * 验证 Opus 的 R128 Q7.8 增益按 -18 LUFS 参考折算；Ogg 与 FLAC 共用同一段注释解析代码。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testR128GainReferenceShift() {
  const harness = createReplayGainHarness([{
    name: 'r128.flac',
    bytes: buildFlacFixture(['R128_TRACK_GAIN=-1536', 'R128_ALBUM_GAIN=256']),
  }]);

  const tags = await harness.context.extractTags(harness.file('r128.flac'), {});
  // -1536/256 = -6 dB，叠加 R128 与 ReplayGain 之间的 5 dB 参考差。
  assert.deepEqual(Object.assign({}, tags.replayGain), {
    resolved: 1,
    trackGainDb: -1,
    albumGainDb: 6,
  });
}

/**
 * 验证真实 ReplayGain 标签优先于同文件里的 R128 折算值。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testRealReplayGainWinsOverR128() {
  const harness = createReplayGainHarness([{
    name: 'both.flac',
    bytes: buildFlacFixture(['R128_TRACK_GAIN=-1536', 'REPLAYGAIN_TRACK_GAIN=-2.50 dB']),
  }]);

  const tags = await harness.context.extractTags(harness.file('both.flac'), {});
  assert.equal(tags.replayGain.trackGainDb, -2.5);
}

/**
 * 验证 MP3 的 TXXX 帧同时取到增益与峰值，且 ReplayGain 描述符不污染展示标签。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testMp3TxxxReplayGain() {
  const id3 = buildId3v2Tag([
    { id: 'TIT2', body: Buffer.concat([Buffer.from([0]), Buffer.from('MP3 Title', 'latin1')]) },
    { id: 'TXXX', body: id3TxxxBody('replaygain_track_gain', '-9.34 dB') },
    { id: 'TXXX', body: id3TxxxBody('REPLAYGAIN_TRACK_PEAK', '0.750000') },
    { id: 'TXXX', body: id3TxxxBody('replaygain_album_gain', '-8.10 dB') },
  ]);
  const harness = createReplayGainHarness([{
    name: 'rg.mp3',
    bytes: Buffer.concat([id3, Buffer.from([0xff, 0xfb, 0x90, 0x00]), Buffer.alloc(2048, 0x44)]),
  }]);

  const tags = await harness.context.extractTags(harness.file('rg.mp3'), {});
  assert.equal(tags.title, 'MP3 Title');
  assert.deepEqual(Object.assign({}, tags.replayGain), {
    resolved: 1,
    trackGainDb: -9.34,
    albumGainDb: -8.1,
    trackPeak: 0.75,
  });
}

/**
 * 验证 RVA2 帧只取主音量声道增益，并忽略各家不一致的峰值字段。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testMp3Rva2MasterChannelOnly() {
  const id3 = buildId3v2Tag([
    {
      id: 'RVA2',
      body: id3Rva2Body('track', [
        { channel: 3, gainDb: 6, peakBits: 16 },
        { channel: 1, gainDb: -4.5, peakBits: 16 },
      ]),
    },
  ]);
  const harness = createReplayGainHarness([{
    name: 'rva2.mp3',
    bytes: Buffer.concat([id3, Buffer.from([0xff, 0xfb, 0x90, 0x00]), Buffer.alloc(2048, 0x44)]),
  }]);

  const tags = await harness.context.extractTags(harness.file('rva2.mp3'), {});
  assert.deepEqual(Object.assign({}, tags.replayGain), { resolved: 1, trackGainDb: -4.5 });
}

/**
 * 验证 WAV 的 id3 chunk 也能取到 ReplayGain。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testWavId3ChunkReplayGain() {
  const id3 = buildId3v2Tag([{ id: 'TXXX', body: id3TxxxBody('replaygain_track_gain', '-3.00 dB') }]);
  const harness = createReplayGainHarness([{ name: 'rg.wav', bytes: buildWavFixture(id3) }]);

  const tags = await harness.context.extractTags(harness.file('rg.wav'), {});
  assert.deepEqual(Object.assign({}, tags.replayGain), { resolved: 1, trackGainDb: -3 });
}

/**
 * 验证 APEv2 文本项能取到 ReplayGain，且不占用展示字段。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testApeV2ReplayGain() {
  const harness = createReplayGainHarness([{
    name: 'rg.ape',
    bytes: buildApeFixture([
      buildApeItem('Title', 'APE 标题'),
      buildApeItem('REPLAYGAIN_TRACK_GAIN', '-5.20 dB'),
      buildApeItem('REPLAYGAIN_TRACK_PEAK', '0.999000'),
    ]),
  }]);

  const tags = await harness.context.extractTags(harness.file('rg.ape'), {});
  assert.equal(tags.title, 'APE 标题');
  assert.deepEqual(Object.assign({}, tags.replayGain), {
    resolved: 1,
    trackGainDb: -5.2,
    trackPeak: 0.999,
  });
}

/**
 * 验证 M4A `----` 自定义项能取到 iTunes 风格的 ReplayGain。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testM4aFreeformReplayGain() {
  const harness = createReplayGainHarness([{
    name: 'rg.m4a',
    bytes: buildM4aFixture([
      atom('\xa9nam', atom('data', Buffer.concat([u32be(1), Buffer.alloc(4), Buffer.from('M4A 标题', 'utf8')]))),
      m4aFreeformItem('replaygain_track_gain', '-11.42 dB'),
      m4aFreeformItem('replaygain_track_peak', '0.912345'),
    ]),
  }]);

  const tags = await harness.context.extractTags(harness.file('rg.m4a'), {});
  assert.equal(tags.title, 'M4A 标题');
  assert.deepEqual(Object.assign({}, tags.replayGain), {
    resolved: 1,
    trackGainDb: -11.42,
    trackPeak: 0.912345,
  });
}

/**
 * 验证轻量扫描没读全时不会落下半截 ReplayGain，避免把错误增益写进缓存。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testIncompleteScanDropsReplayGain() {
  const harness = createReplayGainHarness([{
    name: 'huge.m4a',
    bytes: buildM4aFixture([m4aFreeformItem('replaygain_track_gain', '-6.00 dB')], 5 * 1024 * 1024),
  }]);

  const light = await harness.context.extractTags(harness.file('huge.m4a'), { light: true });
  assert.equal(light._mineradioScanComplete, false, 'moov 超出轻量范围时必须保持可重试');
  assert.equal(light.replayGain, undefined, '扫描未完成时不得落下 ReplayGain');

  const full = await harness.context.extractTags(harness.file('huge.m4a'), {});
  assert.equal(full.replayGain.trackGainDb, -6, '完整扫描应补齐 ReplayGain');
}

/**
 * 验证标签取值解析的边界：单位后缀、非法值、越界值与首个可解析值胜出。
 * @returns {void}
 */
function testReplayGainValueParsing() {
  const harness = createReplayGainHarness([]);
  const ctx = harness.context;

  assert.equal(ctx.tagField('replaygain_track_gain'), 'trackGainDb');
  assert.equal(ctx.tagField('REPLAYGAIN TRACK PEAK'), 'trackPeak');
  assert.equal(ctx.tagField('R128_ALBUM_GAIN'), 'r128AlbumGainDb');
  assert.equal(ctx.tagField('iTunNORM'), '', 'iTunNORM 的响度参考不同，不能混入 ReplayGain');

  assert.equal(ctx.parseDb('-7.06 dB'), -7.06);
  assert.equal(ctx.parseDb('+3.2dB'), 3.2);
  assert.equal(ctx.parseDb('0'), 0, '0 dB 是合法增益，不能被当作缺失值丢掉');
  assert.equal(ctx.parseDb('abc'), null);
  assert.equal(ctx.parseDb('999 dB'), null, '越界增益说明标签损坏');

  assert.equal(ctx.parsePeak('0.988525'), 0.988525);
  assert.equal(ctx.parsePeak('0'), null);
  assert.equal(ctx.parsePeak('-1'), null);

  assert.equal(ctx.normalizeInfo({ trackPeak: 0.9 }), null, '只有峰值没有增益时无从均衡');
  assert.deepEqual(Object.assign({}, ctx.normalizeInfo({ trackGainDb: 0 })), { resolved: 1, trackGainDb: 0 });
}

test('Vorbis comment 取到整轨与整专辑增益峰值', testVorbisCommentReplayGain);
test('R128 增益按 Q7.8 与参考响度折算', testR128GainReferenceShift);
test('真实 ReplayGain 优先于 R128 折算值', testRealReplayGainWinsOverR128);
test('MP3 TXXX 取到增益与峰值', testMp3TxxxReplayGain);
test('RVA2 只取主音量声道增益', testMp3Rva2MasterChannelOnly);
test('WAV id3 chunk 取到 ReplayGain', testWavId3ChunkReplayGain);
test('APEv2 文本项取到 ReplayGain', testApeV2ReplayGain);
test('M4A `----` 自定义项取到 ReplayGain', testM4aFreeformReplayGain);
test('扫描未完成时不落下半截 ReplayGain', testIncompleteScanDropsReplayGain);
test('ReplayGain 取值解析覆盖单位与越界', testReplayGainValueParsing);

