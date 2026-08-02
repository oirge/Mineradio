'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const url = require('node:url');

/**
 * 截取主进程本地曲库扫描的真实实现，避免测试复制生产逻辑。
 * @param {string} source desktop/main.js 完整源码。
 * @param {number} visitLimit 注入的访问上限，用少量文件即可触发截断。
 * @returns {string} 从常量声明到增量扫描结束的扫描相关源码。
 */
function extractScanLifecycle(source, visitLimit) {
  const start = source.indexOf("const LOCAL_LIBRARY_EXTS = new Set(");
  const end = source.indexOf('async function scanLocalMusicFolder(folderPath, options)');
  assert.ok(start >= 0 && end > start, '未找到本地曲库扫描接缝');
  const slice = source.slice(start, end);
  const marker = /const LOCAL_LIBRARY_SCAN_VISIT_LIMIT = \d+;/;
  assert.ok(marker.test(slice), '未找到访问上限常量');
  return slice.replace(marker, `const LOCAL_LIBRARY_SCAN_VISIT_LIMIT = ${visitLimit};`);
}

/**
 * 在 vm 中载入真实扫描实现，注入生产运行时依赖。
 * @param {number} visitLimit 注入的访问上限。
 * @returns {{scanIncremental: Function, scanFull: Function}} 扫描入口。
 */
function loadScan(visitLimit) {
  const file = path.join(__dirname, '..', 'desktop', 'main.js');
  const source = fs.readFileSync(file, 'utf8');
  const context = {
    path,
    fs,
    Intl,
    Promise,
    Math,
    Number,
    Set,
    Map,
    Array,
    Date,
    setImmediate,
    pathToFileURL: url.pathToFileURL,
    mainServerPort: 0,
    LOCAL_FILE_TOKEN: 'test-token',
    authorizedLocalMusicRoots: new Set(),
  };
  vm.runInNewContext(
    extractScanLifecycle(source, visitLimit)
      + '\nthis.scanIncremental = scanLocalMusicFolderIncremental;'
      + '\nthis.scanFull = scanLocalMusicFolderFull;',
    context,
  );
  return { scanIncremental: context.scanIncremental, scanFull: context.scanFull };
}

/**
 * 在临时目录写入指定数量的 mp3 文件。
 * @param {string} dir 目标目录。
 * @param {number} count 文件数量。
 * @returns {void}
 */
function writeTracks(dir, count) {
  for (let i = 0; i < count; i++) {
    fs.writeFileSync(path.join(dir, `track-${String(i).padStart(4, '0')}.mp3`), 'x');
  }
}

/**
 * 构造一次完整快照（未截断），供增量扫描作为基线。
 * @param {string} root 曲库根目录。
 * @returns {object} 快照对象。
 */
function makeBaselineSnapshot(root) {
  return {
    files: [{ fullPath: path.join(root, 'track-0000.mp3'), name: 'track-0000.mp3' }],
    directories: [{ relativePath: '', lastModified: 1 }],
    truncated: false,
    savedAt: Date.now(),
  };
}

/**
 * 验证：上次快照完整、本次遍历达到访问上限时，增量扫描回退为全量语义，
 * 且以 truncated=true 返回，避免把残缺增量结果当完整结果覆盖当前会话与持久快照。
 * @returns {void}
 */
async function testIncrementalFallsBackToFullOnTruncation() {
  const { scanIncremental } = loadScan(6);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-scan-'));
  try {
    writeTracks(root, 12);
    const result = await scanIncremental(root, makeBaselineSnapshot(root));
    assert.equal(result.ok, true);
    assert.equal(result.truncated, true, '本次截断必须透传 truncated');
    assert.equal(result.scanMode, 'full', '本次截断必须以全量语义返回而非增量');
    assert.equal(Object.prototype.hasOwnProperty.call(result, 'reused'), false, '截断回退不应保留增量统计字段');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/**
 * 验证：本次未截断时仍走增量路径，返回 scanMode='incremental' 且 truncated=false。
 * @returns {void}
 */
async function testIncrementalStaysIncrementalWhenNotTruncated() {
  const { scanIncremental } = loadScan(50000);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-scan-'));
  try {
    writeTracks(root, 3);
    const result = await scanIncremental(root, makeBaselineSnapshot(root));
    assert.equal(result.ok, true);
    assert.equal(result.truncated, false);
    assert.equal(result.scanMode, 'incremental');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('增量扫描在本次遍历截断时回退全量语义并透传 truncated', testIncrementalFallsBackToFullOnTruncation);
test('增量扫描在本次未截断时保持增量语义', testIncrementalStaysIncrementalWhenNotTruncated);
