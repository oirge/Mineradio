'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从主进程源码截取本地文件范围读取实现。
 * @returns {string} 可在隔离上下文执行的范围读取源码。
 */
function readLocalFileRangeSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const start = source.indexOf('async function readAuthorizedLocalFileRange(');
  const end = source.indexOf('async function readAuthorizedLocalFileDataUrl(', start);
  assert.ok(start >= 0 && end > start, '未找到本地文件范围读取实现');
  return source.slice(start, end);
}

/**
 * 从前端源码截取本地文件 base64 分块解码实现。
 * @returns {string} 可在隔离上下文执行的分块解码源码。
 */
function readLocalFileDecoderSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function base64ChunksToBytes(');
  const end = source.indexOf('async function readLocalFileBytes(', start);
  assert.ok(start >= 0 && end > start, '未找到本地文件分块解码实现');
  return source.slice(start, end);
}

/**
 * 从前端源码截取本地文本解码和读取入口。
 * @returns {{decode:string,read:string}} 两段可隔离执行的源码。
 */
function readLocalTextSources() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const decodeStart = source.indexOf('function decodeLocalTextBuffer(');
  const readStart = source.indexOf('async function readLocalTextFile(', decodeStart);
  const readEnd = source.indexOf('function readFileAsDataUrl(', readStart);
  assert.ok(decodeStart >= 0 && readStart > decodeStart && readEnd > readStart, '未找到本地文本解码实现');
  return {
    decode: source.slice(decodeStart, readStart),
    read: source.slice(readStart, readEnd),
  };
}

/**
 * 验证大范围读取只使用固定小块临时 Buffer，并保持完整字节输出。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testLocalFileRangeUsesBoundedChunks() {
  const fileSize = 3 * 1024 * 1024 + 137;
  const sourceBytes = Buffer.alloc(fileSize, 0x5a);
  const allocations = [];

  /** @param {string} filePath 文件路径。 @returns {string} 测试直接授权原路径。 */
  function resolveAuthorizedLocalFile(filePath) { return filePath; }

  /** @returns {Promise<object>} 返回固定文件大小。 */
  async function stat() {
    return { size: fileSize, isFile: isFile };
  }

  /** @returns {boolean} 测试目标始终为普通文件。 */
  function isFile() { return true; }

  /**
   * 把测试源数据复制到主进程复用的小块 Buffer。
   * @param {Buffer} target 目标 Buffer。
   * @param {number} offset 目标起始偏移。
   * @param {number} length 本轮请求长度。
   * @param {number} position 文件起始位置。
   * @returns {Promise<{bytesRead:number}>} 本轮读取字节数。
   */
  async function read(target, offset, length, position) {
    const bytesRead = Math.max(0, Math.min(length, fileSize - position));
    if (bytesRead) sourceBytes.copy(target, offset, position, position + bytesRead);
    return { bytesRead };
  }

  /** @returns {Promise<void>} 假文件句柄无需关闭资源。 */
  async function close() {}

  /** @returns {Promise<object>} 返回可控文件句柄。 */
  async function open() { return { read, close }; }

  /**
   * 记录每次临时 Buffer 分配，便于验证峰值上限。
   * @param {number} size 分配字节数。
   * @returns {Buffer} Node Buffer。
   */
  function allocate(size) {
    allocations.push(size);
    return Buffer.alloc(size);
  }

  const context = {
    resolveAuthorizedLocalFile,
    fs: { promises: { stat, open } },
    Buffer: { alloc: allocate, allocUnsafe: allocate },
    Math,
    Number,
  };
  vm.runInNewContext(
    readLocalFileRangeSource() + '\nthis.readRange = readAuthorizedLocalFileRange;',
    context,
  );

  const result = await context.readRange('virtual.flac', 0, fileSize);
  let maxAllocation = 0;
  for (const size of allocations) {
    if (size > maxAllocation) maxAllocation = size;
  }
  assert.ok(maxAllocation <= 768 * 1024, '临时 Buffer 不得按完整范围一次分配');
  assert.ok(Array.isArray(result.base64Chunks) && result.base64Chunks.length > 1, '大范围结果必须分块编码');
  assert.equal(result.byteLength, fileSize);
  assert.equal(Object.prototype.hasOwnProperty.call(result, 'base64'), false, '不得继续返回完整 base64 大字符串');

  /** @param {string} chunk 单个 base64 块。 @returns {Buffer} 解码后的字节块。 */
  function decodeChunk(chunk) { return Buffer.from(chunk, 'base64'); }
  const decoded = Buffer.concat(result.base64Chunks.map(decodeChunk));
  assert.equal(decoded.length, sourceBytes.length);
  assert.equal(decoded.equals(sourceBytes), true);
}

/**
 * 验证 renderer 分块解码保持完整字节内容。
 * @returns {void}
 */
function testBase64ChunksDecodeIntoSingleByteArray() {
  const sourceBytes = Buffer.alloc(2 * 1024 * 1024 + 29, 0x37);
  const chunks = [];
  const chunkSize = 768 * 1024;
  for (let offset = 0; offset < sourceBytes.length; offset += chunkSize) {
    chunks.push(sourceBytes.subarray(offset, Math.min(sourceBytes.length, offset + chunkSize)).toString('base64'));
  }
  const context = { Array, Error, Math, Number, String, Uint8Array, atob };
  vm.runInNewContext(
    readLocalFileDecoderSource() + '\nthis.decodeChunks = base64ChunksToBytes;',
    context,
  );

  const decoded = context.decodeChunks(chunks, sourceBytes.length);
  const decodedBuffer = Buffer.from(decoded.buffer, decoded.byteOffset, decoded.byteLength);
  assert.equal(decodedBuffer.equals(sourceBytes), true);
}

/**
 * 验证桌面歌词文本路径直接复用范围读取返回的 Uint8Array。
 * @returns {Promise<void>} 测试完成 Promise。
 */
async function testLocalTextDecodeReusesByteView() {
  const sources = readLocalTextSources();
  const backing = new ArrayBuffer(64);
  const byteView = new Uint8Array(backing, 8, 32);
  let decoderInput = null;

  /** @param {Uint8Array} bytes 解码输入。 @returns {string} 固定测试文本。 */
  function decode(bytes) {
    decoderInput = bytes;
    return 'decoded';
  }

  /** @returns {object} 返回可观察输入的解码器。 */
  function localTextDecoder() { return { decode }; }

  /** @returns {number} 测试文本没有替换字符。 */
  function countTextReplacementChars() { return 0; }

  const decodeContext = {
    Uint8Array,
    localTextDecoder,
    countTextReplacementChars,
    window: { TextDecoder },
  };
  vm.runInNewContext(sources.decode + '\nthis.decodeText = decodeLocalTextBuffer;', decodeContext);
  decodeContext.decodeText(byteView);
  assert.equal(decoderInput, byteView, '解码器必须直接复用传入 Uint8Array 视图');

  let readInput = null;
  /** @returns {string} 返回固定桌面文件路径。 */
  function localFullPath() { return 'virtual.lrc'; }

  /** @returns {number} 返回测试视图长度。 */
  function localFileSize() { return byteView.byteLength; }

  /** @returns {Promise<Uint8Array>} 返回范围读取的原始视图。 */
  async function readLocalFileBytes() { return byteView; }

  /** @param {Uint8Array} bytes 文本字节。 @returns {string} 固定解码结果。 */
  function decodeLocalTextBuffer(bytes) {
    readInput = bytes;
    return 'decoded';
  }

  /** @returns {object} 返回具备范围读取能力的桌面 API。 */
  function desktopLocalMusicApi() { return { readLocalFileRange: readLocalFileRange }; }

  /** @returns {void} 仅用于满足能力检测，不在测试中执行。 */
  function readLocalFileRange() {}

  /** @returns {void} 桌面路径不会实例化浏览器 FileReader。 */
  function FileReaderStub() {}

  const readContext = {
    Promise,
    FileReader: FileReaderStub,
    localFullPath,
    localFileSize,
    readLocalFileBytes,
    decodeLocalTextBuffer,
    desktopLocalMusicApi,
  };
  vm.runInNewContext(sources.read + '\nthis.readText = readLocalTextFile;', readContext);
  const text = await readContext.readText({ fullPath: 'virtual.lrc' });
  assert.equal(text, 'decoded');
  assert.equal(readInput, byteView, '桌面歌词读取入口不得复制完整字节范围');
}

test('本地文件范围读取使用固定小块临时 Buffer', testLocalFileRangeUsesBoundedChunks);
test('renderer 分块解码保持完整文件字节', testBase64ChunksDecodeIntoSingleByteArray);
test('本地文本解码复用范围读取字节视图', testLocalTextDecodeReusesByteView);
