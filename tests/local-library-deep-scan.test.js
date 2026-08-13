'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const url = require('node:url');

function loadFullScan(visitLimit) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  const start = source.indexOf('const LOCAL_LIBRARY_EXTS = new Set(');
  const end = source.indexOf('async function scanLocalMusicFolder(folderPath, options)');
  assert.ok(start >= 0 && end > start, '本地曲库扫描实现缺失');
  const scanSource = source.slice(start, end).replace(
    /const LOCAL_LIBRARY_SCAN_VISIT_LIMIT = \d+;/,
    `const LOCAL_LIBRARY_SCAN_VISIT_LIMIT = ${visitLimit};`,
  );
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
  vm.runInNewContext(`${scanSource}\nthis.scanFull = scanLocalMusicFolderFull;`, context);
  return context.scanFull;
}

test('本地曲库递归扫描三级目录中的 FLAC 文件', async () => {
  const scanFull = loadFullScan(50000);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-scan-deep-'));
  const nested = path.join(root, 'level1', 'level2', 'level3');
  try {
    fs.mkdirSync(nested, { recursive: true });
    fs.writeFileSync(path.join(nested, 'artist - title.flac'), 'x');
    const result = await scanFull(root);
    assert.equal(result.ok, true);
    assert.equal(result.truncated, false);
    assert.equal(result.files.length, 1);
    assert.equal(result.files[0].name, 'artist - title.flac');
    assert.equal(result.files[0].type, 'audio/flac');
    assert.equal(result.files[0].relativePath, `${path.basename(root)}/level1/level2/level3/artist - title.flac`);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
