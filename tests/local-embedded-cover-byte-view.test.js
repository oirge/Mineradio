'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从 renderer 主脚本截取 MP3/FLAC 内嵌封面解析实现。
 * @returns {string} 可在隔离 VM 中执行的真实源码。
 */
function readEmbeddedCoverParserSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function asciiFromBytes(');
  const end = source.indexOf('function applyLocalMetadataTags(', start);
  assert.ok(start >= 0 && end > start, '未找到内嵌封面解析实现');
  return `
/**
 * 测试只隔离封面解析语义，按生产 light/full 上限建立内存 descriptor 会话。
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
 * 把普通整数写为 ID3 使用的四字节 synchsafe 值。
 * @param {Buffer} bytes 目标 Buffer。
 * @param {number} offset 写入偏移。
 * @param {number} value 待写整数。
 * @returns {void}
 */
function writeSynchsafe(bytes, offset, value) {
  bytes[offset] = (value >>> 21) & 0x7f;
  bytes[offset + 1] = (value >>> 14) & 0x7f;
  bytes[offset + 2] = (value >>> 7) & 0x7f;
  bytes[offset + 3] = value & 0x7f;
}

/**
 * 构造带 APIC PNG 封面的最小 ID3v2.3 MP3 标签。
 * @param {Uint8Array} imageBytes 图片字节。
 * @returns {Uint8Array} 可交给真实解析器的标签字节。
 */
function buildMp3ApicTag(imageBytes) {
  const mime = Buffer.from('image/png', 'ascii');
  const payloadLength = 1 + mime.length + 1 + 1 + 1 + imageBytes.length;
  const tagSize = 10 + payloadLength;
  const bytes = Buffer.alloc(10 + tagSize);
  bytes.write('ID3', 0, 'ascii');
  bytes[3] = 3;
  writeSynchsafe(bytes, 6, tagSize);
  bytes.write('APIC', 10, 'ascii');
  bytes.writeUInt32BE(payloadLength, 14);
  let offset = 20;
  bytes[offset] = 0;
  offset += 1;
  mime.copy(bytes, offset);
  offset += mime.length;
  bytes[offset] = 0;
  bytes[offset + 1] = 3;
  bytes[offset + 2] = 0;
  offset += 3;
  Buffer.from(imageBytes.buffer, imageBytes.byteOffset, imageBytes.byteLength).copy(bytes, offset);
  const padded = new Uint8Array(bytes.length + 37);
  padded.set(bytes, 19);
  return new Uint8Array(padded.buffer, 19, bytes.length);
}

/**
 * 构造带 PICTURE JPEG 封面的最小 FLAC metadata block。
 * @param {Uint8Array} imageBytes 图片字节。
 * @returns {Uint8Array} 可交给真实解析器的 FLAC 字节。
 */
function buildFlacPictureBlock(imageBytes) {
  const mime = Buffer.from('image/jpeg', 'ascii');
  const blockLength = 4 + 4 + mime.length + 4 + 16 + 4 + imageBytes.length;
  const bytes = Buffer.alloc(4 + 4 + blockLength);
  bytes.write('fLaC', 0, 'ascii');
  bytes[4] = 0x86;
  bytes[5] = (blockLength >>> 16) & 0xff;
  bytes[6] = (blockLength >>> 8) & 0xff;
  bytes[7] = blockLength & 0xff;
  let offset = 8;
  bytes.writeUInt32BE(3, offset);
  offset += 4;
  bytes.writeUInt32BE(mime.length, offset);
  offset += 4;
  mime.copy(bytes, offset);
  offset += mime.length;
  bytes.writeUInt32BE(0, offset);
  offset += 4;
  bytes.fill(0, offset, offset + 16);
  offset += 16;
  bytes.writeUInt32BE(imageBytes.length, offset);
  offset += 4;
  Buffer.from(imageBytes.buffer, imageBytes.byteOffset, imageBytes.byteLength).copy(bytes, offset);
  const padded = new Uint8Array(bytes.length + 29);
  padded.set(bytes, 13);
  return new Uint8Array(padded.buffer, 13, bytes.length);
}

/**
 * 构造首个损坏、第二个有效的两个 FLAC PICTURE block。
 * @param {Uint8Array} imageBytes 第二个 block 的图片字节。
 * @returns {Uint8Array} 多 PICTURE FLAC 字节。
 */
function buildFlacInvalidThenValidPictures(imageBytes) {
  const valid = buildFlacPictureBlock(imageBytes);
  const validPayload = Buffer.from(valid.buffer, valid.byteOffset + 8, valid.byteLength - 8);
  const invalidPayload = Buffer.alloc(validPayload.length);
  const invalidMime = Buffer.from('image/jpeg', 'ascii');
  let offset = 0;
  invalidPayload.writeUInt32BE(3, offset); offset += 4;
  invalidPayload.writeUInt32BE(invalidMime.length, offset); offset += 4;
  invalidMime.copy(invalidPayload, offset); offset += invalidMime.length;
  invalidPayload.writeUInt32BE(0, offset); offset += 4;
  offset += 16;
  invalidPayload.writeUInt32BE(0, offset);
  const firstHeader = Buffer.from([6, (invalidPayload.length >>> 16) & 0xff, (invalidPayload.length >>> 8) & 0xff, invalidPayload.length & 0xff]);
  const secondHeader = Buffer.from([0x86, (validPayload.length >>> 16) & 0xff, (validPayload.length >>> 8) & 0xff, validPayload.length & 0xff]);
  const bytes = Buffer.concat([Buffer.from('fLaC', 'ascii'), firstHeader, invalidPayload, secondHeader, validPayload]);
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * 构造带 PIC PNG 封面的最小 ID3v2.2 MP3 标签。
 * @param {Uint8Array} imageBytes 图片字节。
 * @returns {Uint8Array} 可交给真实解析器的标签字节。
 */
function buildMp3PicTag(imageBytes) {
  const payloadLength = 1 + 3 + 1 + 1 + imageBytes.length;
  const tagSize = 6 + payloadLength;
  const bytes = Buffer.alloc(10 + tagSize);
  bytes.write('ID3', 0, 'ascii');
  bytes[3] = 2;
  writeSynchsafe(bytes, 6, tagSize);
  bytes.write('PIC', 10, 'ascii');
  bytes[13] = (payloadLength >>> 16) & 0xff;
  bytes[14] = (payloadLength >>> 8) & 0xff;
  bytes[15] = payloadLength & 0xff;
  let offset = 16;
  bytes[offset] = 0;
  bytes.write('PNG', offset + 1, 'ascii');
  bytes[offset + 4] = 3;
  bytes[offset + 5] = 0;
  offset += 6;
  Buffer.from(imageBytes.buffer, imageBytes.byteOffset, imageBytes.byteLength).copy(bytes, offset);
  const padded = new Uint8Array(bytes.length + 31);
  padded.set(bytes, 17);
  return new Uint8Array(padded.buffer, 17, bytes.length);
}

/**
 * 记录 Blob 构造收到的字节视图和 MIME，不复制测试输入。
 */
class ObservedBlob {
  /**
   * 保存 Blob parts，供测试检查视图所有权。
   * @param {Array<Uint8Array>} parts Blob 输入段。
   * @param {{type?:string}=} opts MIME 选项。
   */
  constructor(parts, opts) {
    this.parts = parts;
    this.type = opts && opts.type || '';
    ObservedBlob.instances.push(this);
  }
}
ObservedBlob.instances = [];

/**
 * 验证 MP3 APIC 图片使用完整标签数组的共享视图，而不是复制图片字节。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testMp3CoverUsesSharedByteView() {
  const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x01, 0x02, 0x03]);
  const tagBytes = buildMp3ApicTag(imageBytes);

  /** @returns {number} 返回测试 MP3 标签大小。 */
  function localFileSize() { return tagBytes.byteLength; }

  /** @returns {Promise<Uint8Array>} 直接返回内存 ID3 标签。 */
  function readLocalFileBytes() { return Promise.resolve(tagBytes); }

  ObservedBlob.instances = [];
  const context = {
    Blob: ObservedBlob,
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
    readEmbeddedCoverParserSource() + '\nthis.extractMp3Cover = extractMp3EmbeddedCoverSource;',
    context,
  );

  const blob = await context.extractMp3Cover({ name: 'cover.mp3' });
  const observedBlob = ObservedBlob.instances[0];
  assert.ok(observedBlob, '解析器必须创建封面 Blob');
  assert.equal(blob, observedBlob);
  const imageView = observedBlob.parts[0];
  assert.equal(observedBlob.type, 'image/png');
  assert.equal(imageView.buffer, tagBytes.buffer, 'APIC 图片必须复用完整标签 ArrayBuffer');
  assert.equal(imageView.byteOffset, tagBytes.byteOffset + tagBytes.byteLength - imageBytes.byteLength);
  assert.equal(imageView.byteLength, imageBytes.byteLength);
  assert.deepEqual(Array.from(imageView), Array.from(imageBytes));
}

/**
 * 验证 FLAC PICTURE 图片使用完整标签数组的共享视图，而不是复制图片字节。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFlacCoverUsesSharedByteView() {
  const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x11, 0x22, 0x33, 0x44]);
  const tagBytes = buildFlacPictureBlock(imageBytes);

  /** @returns {number} 返回测试 FLAC 标签大小。 */
  function localFileSize() { return tagBytes.byteLength; }

  /** @returns {Promise<Uint8Array>} 直接返回内存 FLAC metadata。 */
  function readLocalFileBytes() { return Promise.resolve(tagBytes); }

  ObservedBlob.instances = [];
  const context = {
    Blob: ObservedBlob,
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
    readEmbeddedCoverParserSource() + '\nthis.extractFlacCover = extractFlacEmbeddedCoverSource;',
    context,
  );

  const blob = await context.extractFlacCover({ name: 'cover.flac' }, {});
  const observedBlob = ObservedBlob.instances[0];
  assert.ok(observedBlob, '解析器必须创建封面 Blob');
  assert.equal(blob, observedBlob);
  const imageView = observedBlob.parts[0];
  assert.equal(observedBlob.type, 'image/jpeg');
  assert.equal(imageView.buffer, tagBytes.buffer, 'FLAC 图片必须复用完整标签 ArrayBuffer');
  assert.equal(imageView.byteOffset, tagBytes.byteOffset + tagBytes.byteLength - imageBytes.byteLength);
  assert.equal(imageView.byteLength, imageBytes.byteLength);
  assert.deepEqual(Array.from(imageView), Array.from(imageBytes));
}

/**
 * 验证首个损坏 PICTURE 不会阻止后续有效封面解析。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFlacCoverContinuesAfterInvalidPicture() {
  const imageBytes = new Uint8Array([0xff, 0xd8, 0x33, 0x44]);
  const tagBytes = buildFlacInvalidThenValidPictures(imageBytes);

  /** @returns {number} 返回多 PICTURE FLAC 大小。 */
  function localFileSize() { return tagBytes.byteLength; }

  /** @returns {Promise<Uint8Array>} 返回完整多 PICTURE FLAC。 */
  function readLocalFileBytes() { return Promise.resolve(tagBytes); }

  ObservedBlob.instances = [];
  const context = {
    Blob: ObservedBlob,
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
    readEmbeddedCoverParserSource() + '\nthis.extractFlacCover = extractFlacEmbeddedCoverSource;',
    context,
  );

  const blob = await context.extractFlacCover({ name: 'two-pictures.flac' }, {});
  assert.equal(ObservedBlob.instances.length, 1, '损坏 PICTURE 不得创建 Blob');
  assert.equal(blob, ObservedBlob.instances[0]);
  assert.deepEqual(Array.from(blob.parts[0]), Array.from(imageBytes));
}

/**
 * 验证 ID3v2.2 PIC 图片同样复用完整标签数组的共享视图。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testMp3V2CoverUsesSharedByteView() {
  const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xaa, 0xbb]);
  const tagBytes = buildMp3PicTag(imageBytes);

  /** @returns {number} 返回测试 MP3 标签大小。 */
  function localFileSize() { return tagBytes.byteLength; }

  /** @returns {Promise<Uint8Array>} 直接返回内存 ID3v2.2 标签。 */
  function readLocalFileBytes() { return Promise.resolve(tagBytes); }

  ObservedBlob.instances = [];
  const context = {
    Blob: ObservedBlob,
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
    readEmbeddedCoverParserSource() + '\nthis.extractMp3Cover = extractMp3EmbeddedCoverSource;',
    context,
  );

  const blob = await context.extractMp3Cover({ name: 'cover-v2.mp3' });
  const observedBlob = ObservedBlob.instances[0];
  assert.ok(observedBlob, 'ID3v2.2 解析器必须创建封面 Blob');
  assert.equal(blob, observedBlob);
  const imageView = observedBlob.parts[0];
  assert.equal(observedBlob.type, 'image/png');
  assert.equal(imageView.buffer, tagBytes.buffer, 'PIC 图片必须复用完整标签 ArrayBuffer');
  assert.equal(imageView.byteOffset, tagBytes.byteOffset + tagBytes.byteLength - imageBytes.byteLength);
  assert.equal(imageView.byteLength, imageBytes.byteLength);
  assert.deepEqual(Array.from(imageView), Array.from(imageBytes));
}

/**
 * 验证后台缩略图入口可直接取得封面 Blob，不经过完整 data URL 编码。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testMp3CoverSourceSkipsFullDataUrl() {
  const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x10, 0x20]);
  const tagBytes = buildMp3ApicTag(imageBytes);
  let dataUrlReads = 0;

  /** @returns {number} 返回测试 MP3 标签大小。 */
  function localFileSize() { return tagBytes.byteLength; }

  /** @returns {Promise<Uint8Array>} 直接返回内存 ID3 标签。 */
  function readLocalFileBytes() { return Promise.resolve(tagBytes); }

  /**
   * 记录不应发生的完整 data URL 编码。
   * @returns {Promise<string>} 固定结果。
   */
  function readFileAsDataUrl() {
    dataUrlReads += 1;
    return Promise.resolve('data:image/png;base64,unexpected');
  }

  ObservedBlob.instances = [];
  const context = {
    Blob: ObservedBlob,
    LOCAL_ASSET_LIGHT_SCAN_BYTES: 4 * 1024 * 1024,
    Math,
    Number,
    Object,
    Promise,
    String,
    TextDecoder,
    Uint8Array,
    localFileSize,
    readFileAsDataUrl,
    readLocalFileBytes,
  };
  vm.runInNewContext(
    readEmbeddedCoverParserSource() + '\nthis.extractMp3CoverSource = extractMp3EmbeddedCoverSource;',
    context,
  );

  const blob = await context.extractMp3CoverSource({ name: 'background.mp3' });
  assert.equal(dataUrlReads, 0);
  assert.ok(blob instanceof ObservedBlob);
  assert.equal(blob.type, 'image/png');
  assert.deepEqual(Array.from(blob.parts[0]), Array.from(imageBytes));
}

/**
 * 构造 MIME 长度越过 PICTURE block 的损坏 FLAC，并统计解析器字节访问次数。
 * @returns {{bytes:Uint8Array,reads:function():number}} 带访问计数的损坏夹具。
 */
function buildMalformedFlacPictureView() {
  const blockLength = 4088;
  const raw = new Uint8Array(4096);
  raw.set(Buffer.from('fLaC', 'ascii'), 0);
  raw[4] = 0x86;
  raw[5] = (blockLength >>> 16) & 0xff;
  raw[6] = (blockLength >>> 8) & 0xff;
  raw[7] = blockLength & 0xff;
  raw[11] = 3;
  raw[12] = 0;
  raw[13] = 0;
  raw[14] = 0x0f;
  raw[15] = 0xee;
  let reads = 0;
  const bytes = new Proxy(raw, {
    /**
     * 统计数值下标读取，并保持 TypedArray 属性和方法的原始接收者。
     * @param {Uint8Array} target 原始字节数组。
     * @param {string|symbol} property 读取属性。
     * @returns {*} 原始属性值。
     */
    get(target, property) {
      if (typeof property === 'string' && /^\d+$/.test(property)) reads += 1;
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  /** @returns {number} 返回解析器累计读取的数值下标次数。 */
  function readCount() { return reads; }
  return { bytes, reads: readCount };
}

/**
 * 验证 block 内大型 MIME 后缺少剩余结构时，在解码 MIME 前完成全部边界校验。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testFlacPictureRejectsOutOfBoundsMimeLengthEarly() {
  const fixture = buildMalformedFlacPictureView();

  /** @returns {number} 返回损坏 FLAC 夹具大小。 */
  function localFileSize() { return fixture.bytes.length; }

  /** @returns {Promise<Uint8Array>} 返回带访问计数的损坏 FLAC。 */
  function readLocalFileBytes() { return Promise.resolve(fixture.bytes); }

  const context = {
    Blob: ObservedBlob,
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
    readEmbeddedCoverParserSource() + '\nthis.extractFlacCover = extractFlacEmbeddedCoverSource;',
    context,
  );

  const blob = await context.extractFlacCover({ name: 'malformed.flac' }, {});
  assert.equal(blob, null);
  assert.ok(fixture.reads() < 256, '损坏 MIME 长度不得触发 block 边界外的大范围字节扫描');
}

test('MP3 APIC 封面使用共享字节视图', testMp3CoverUsesSharedByteView);
test('FLAC PICTURE 封面使用共享字节视图', testFlacCoverUsesSharedByteView);
test('FLAC 首个损坏 PICTURE 后继续读取有效封面', testFlacCoverContinuesAfterInvalidPicture);
test('ID3v2.2 PIC 封面使用共享字节视图', testMp3V2CoverUsesSharedByteView);
test('后台 MP3 封面直接返回 Blob 而不生成完整 data URL', testMp3CoverSourceSkipsFullDataUrl);
test('FLAC PICTURE 大型 MIME 尾部截断在解码前拒绝', testFlacPictureRejectsOutOfBoundsMimeLengthEarly);
