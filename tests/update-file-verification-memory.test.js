'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从本地更新服务截取安装包摘要校验模块。
 * @returns {string} 可在隔离上下文执行的生产源码。
 */
function readUpdateVerificationSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = source.indexOf('const UPDATE_VERIFY_CHUNK_BYTES =');
  const end = source.indexOf('function moveInvalidUpdateFile(', start);
  assert.ok(start >= 0 && end > start, '未找到安装包摘要校验模块');
  return source.slice(start, end);
}

/**
 * 验证完整安装包校验使用固定小块读取，不调用整文件 readFileSync。
 * @returns {Promise<void>}
 */
async function testInstallerVerificationUsesBoundedReads() {
  const payload = Buffer.alloc(3 * 1024 * 1024 + 137, 0x5a);
  let readFileCalls = 0;
  let position = 0;
  let maxRequestedBytes = 0;
  let closeCalls = 0;

  /** @returns {Promise<object>} 返回固定测试文件句柄。 */
  async function openFile() {
    position = 0;
    return {
      /**
       * 模拟异步分块读取并记录单次请求上限。
       * @param {Buffer} target 目标缓冲区。
       * @param {number} offset 目标写入偏移。
       * @param {number} length 请求字节数。
       * @param {number} _position 文件读取位置。
       * @returns {Promise<{bytesRead:number}>} 实际读取字节数。
       */
      async read(target, offset, length, _position) {
        maxRequestedBytes = Math.max(maxRequestedBytes, length);
        const bytesRead = Math.min(length, payload.length - position);
        if (bytesRead <= 0) return { bytesRead: 0 };
        payload.copy(target, offset, position, position + bytesRead);
        position += bytesRead;
        return { bytesRead };
      },
      /** @returns {Promise<void>} 记录文件句柄已关闭。 */
      async close() { closeCalls += 1; },
    };
  }

  /**
   * 模拟同步分块读取并记录单次请求上限。
   * @param {number} _fd 已废弃的同步描述符参数。
   * @param {Buffer} target 目标缓冲区。
   * @param {number} offset 目标写入偏移。
   * @param {number} length 请求字节数。
   * @returns {number} 实际读取字节数。
   */
  function readSync(_fd, target, offset, length) {
    maxRequestedBytes = Math.max(maxRequestedBytes, length);
    const bytesRead = Math.min(length, payload.length - position);
    if (bytesRead <= 0) return 0;
    payload.copy(target, offset, position, position + bytesRead);
    position += bytesRead;
    return bytesRead;
  }

  /** @returns {{size:number}} 返回测试文件大小。 */
  function statSync() { return { size: payload.length }; }

  /** @returns {Buffer} 禁止生产模块执行整文件读取。 */
  function readFileSync() {
    readFileCalls += 1;
    throw new Error('FULL_FILE_READ_FORBIDDEN');
  }

  /**
   * 创建带稳定错误码的测试异常。
   * @param {string} code 错误码。
   * @param {string} message 错误信息。
   * @returns {Error} 更新校验异常。
   */
  function updateError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  /** @param {string} value 摘要文本。 @returns {string} 测试摘要无需额外归一化。 */
  function normalizeDigest(value) { return String(value || ''); }

  /** @param {Buffer} buffer 输入字节。 @returns {string} SHA-256 十六进制。 */
  function sha256Hex(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }

  const context = {
    Buffer,
    crypto,
    updateVerifyChunkBuffer: null,
    fs: {
      promises: {
        stat: async () => ({ isFile: () => true, size: payload.length }),
        open: openFile,
      },
      readFileSync,
    },
    normalizeDigest,
    sha256Hex,
    updateError,
  };
  vm.runInNewContext(readUpdateVerificationSource() + '\nthis.verifyFile = verifyUpdateFile;', context);

  await context.verifyFile('virtual-installer.exe', {
    expectedSize: payload.length,
    sha256: crypto.createHash('sha256').update(payload).digest('hex'),
    sha512: crypto.createHash('sha512').update(payload).digest('base64'),
  });

  assert.equal(readFileCalls, 0, '完整安装包校验不得调用 fs.readFileSync');
  assert.ok(maxRequestedBytes > 0 && maxRequestedBytes <= 1024 * 1024, '单次校验读取必须限制在 1 MiB 内');
  assert.equal(closeCalls, 1, '成功校验后必须关闭文件描述符');
}

test('完整安装包使用固定小块流式校验', testInstallerVerificationUsesBoundedReads);
