'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 模拟 ipcMain.handle 注册表，仅保留处理器引用供测试直接调用。
 */
class FakeIpcMain {
  /** 创建空处理器表。 */
  constructor() { this.handlers = new Map(); }

  /**
   * @param {string} channel IPC 通道名。
   * @param {Function} handler 处理函数。
   * @returns {void}
   */
  handle(channel, handler) { this.handlers.set(channel, handler); }

  /** ipcMain.on 在本测试中无需真实行为。 */
  on() {}
}

/**
 * 截取导入 JSON 处理器源码，连同随后的同步读取处理器作为稳定结束锚点。
 * @returns {string} 可在隔离 VM 中执行的处理器注册源码。
 */
function readImportHandlerSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const start = source.indexOf("ipcMain.handle('mineradio-import-json-file'");
  const end = source.indexOf("ipcMain.on('mineradio-ui-state-read-sync'", start + 1);
  assert.ok(start >= 0 && end > start, '未找到导入 JSON 处理器接缝');
  return source.slice(start, end);
}

/**
 * 在隔离上下文中注册导入处理器并返回可调用的处理函数与共享状态。
 * @param {{filePath:string|null}} dialogResult showOpenDialog 返回的路径。
 * @returns {Function} 导入处理器。
 */
function loadImportHandler(dialogResult) {
  const ipcMain = new FakeIpcMain();
  const dialog = {
    /** @returns {Promise<{canceled:boolean, filePaths:string[]}>} 预设的选择结果。 */
    async showOpenDialog() {
      if (!dialogResult.filePath) return { canceled: true, filePaths: [] };
      return { canceled: false, filePaths: [dialogResult.filePath] };
    },
  };
  const context = {
    ipcMain,
    dialog,
    fs,
    /** @returns {null} 测试不需要真实父窗口。 */
    getSenderWindow() { return null; },
  };
  vm.runInNewContext(readImportHandlerSource(), context);
  const handler = ipcMain.handlers.get('mineradio-import-json-file');
  assert.equal(typeof handler, 'function', '导入处理器未注册');
  return handler;
}

/**
 * 验证超过 16MB 上限的文件被拒绝，而正常大小文件正常返回文本，避免主进程一次性读入超大文件。
 * @returns {Promise<void>}
 */
async function testImportJsonFileSizeLimit() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mr-import-'));
  try {
    const smallPath = path.join(dir, 'small.json');
    fs.writeFileSync(smallPath, '{"ok":true}', 'utf8');

    const bigPath = path.join(dir, 'big.json');
    const oversize = 16 * 1024 * 1024 + 1024;
    fs.writeFileSync(bigPath, Buffer.alloc(oversize, 0x20));

    const smallResult = await loadImportHandler({ filePath: smallPath })({});
    assert.equal(smallResult.ok, true, '正常大小文件应被接受');
    assert.equal(smallResult.text, '{"ok":true}');

    const bigResult = await loadImportHandler({ filePath: bigPath })({});
    assert.equal(bigResult.ok, false, '超大文件必须被拒绝');
    assert.equal(bigResult.error, 'IMPORT_FILE_TOO_LARGE');

    const canceledResult = await loadImportHandler({ filePath: null })({});
    assert.equal(canceledResult.canceled, true, '未选择文件应返回取消');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('导入 JSON 存档在超过大小上限时拒绝读取', testImportJsonFileSizeLimit);
