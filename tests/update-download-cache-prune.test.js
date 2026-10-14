'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

const SERVER_SOURCE = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

/**
 * 从本地更新服务截取一段生产源码。
 * @param {string} startMarker 起始函数签名。
 * @param {string} endMarker 结束函数签名（不含）。
 * @returns {string} 可在隔离上下文执行的生产源码。
 */
function sliceServerSource(startMarker, endMarker) {
  const start = SERVER_SOURCE.indexOf(startMarker);
  const end = SERVER_SOURCE.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, '未找到源码接缝：' + startMarker);
  return SERVER_SOURCE.slice(start, end);
}

/**
 * 在隔离上下文加载安装包缓存清理实现，并注入其依赖的下载目录、fs、path、console。
 * 版本比较同样截取生产的 normalizeVersion/compareVersions，避免测试里另写一套比较逻辑后与生产漂移。
 * @param {string} downloadDir 注入的安装包下载目录。
 * @param {object} [fsOverride] 可选的 fs 覆盖对象，用于模拟删除失败。
 * @returns {{prune: Function, warnings: Array<Array>, logs: Array<Array>}} 提取函数与捕获到的日志参数列表。
 */
function loadPruneUpdateDownloadCache(downloadDir, fsOverride) {
  const warnings = [];
  const logs = [];
  const context = {
    fs: fsOverride || fs,
    path,
    UPDATE_DOWNLOAD_DIR: downloadDir,
    console: {
      warn: (...args) => warnings.push(args),
      log: (...args) => logs.push(args),
    },
  };
  const source = sliceServerSource('function normalizeVersion(', 'function releaseLineEncodingPenalty(')
    + sliceServerSource('function installerCacheVersionFromName(', 'function normalizeInstallerReuseIdentity(');
  vm.runInNewContext(source + '\nthis.pruneUpdateDownloadCache = pruneUpdateDownloadCache;', context);
  return { prune: context.pruneUpdateDownloadCache, warnings, logs };
}

/**
 * 创建一个临时目录当安装包下载目录，测试结束由调用方清理。
 * @returns {string} 新建的临时目录绝对路径。
 */
function makeTempDownloadDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-installer-cache-'));
}

/**
 * 在下载目录里造一个指定大小的假安装包。
 * @param {string} dir 下载目录。
 * @param {string} name 文件名。
 * @param {number} [bytes] 文件字节数，默认 8。
 * @returns {void}
 */
function writeFakeInstaller(dir, name, bytes) {
  fs.writeFileSync(path.join(dir, name), Buffer.alloc(bytes || 8, 1));
}

/**
 * 列出下载目录里剩下的条目名，顺序稳定便于断言。
 * @param {string} dir 下载目录。
 * @returns {Array<string>} 排序后的剩余条目名。
 */
function remaining(dir) {
  return fs.readdirSync(dir).sort();
}

/**
 * 验证比当前版本旧的安装包全部清掉，当前版本本体保留，并且释放字节数如实统计。
 * @returns {void}
 */
function testRemovesSupersededInstallers() {
  const dir = makeTempDownloadDir();
  try {
    writeFakeInstaller(dir, 'Mineradio-oirge-2.4.6-Setup.exe', 1024);
    writeFakeInstaller(dir, 'Mineradio-oirge-2.4.7-Setup.exe', 2048);
    writeFakeInstaller(dir, 'Mineradio-oirge-2.4.8-Setup.exe', 4096);
    writeFakeInstaller(dir, 'Mineradio-1.7.23-Setup.exe', 512);

    const { prune, logs } = loadPruneUpdateDownloadCache(dir);
    const result = prune('2.4.8');

    assert.deepEqual(remaining(dir), ['Mineradio-oirge-2.4.8-Setup.exe'], '只应留下当前版本安装包');
    assert.equal(result.removed.length, 3, '三个旧版本安装包都应被删除');
    assert.equal(result.removedBytes, 1024 + 2048 + 512, '释放字节数应等于被删文件之和');
    assert.equal(logs.length, 1, '删除后应打一条汇总日志');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 验证比当前版本更新的安装包和它的续传半包绝不删除——那是用户还没装的更新。
 * @returns {void}
 */
function testKeepsPendingNewerInstallers() {
  const dir = makeTempDownloadDir();
  try {
    writeFakeInstaller(dir, 'Mineradio-oirge-2.4.7-Setup.exe', 1024);
    writeFakeInstaller(dir, 'Mineradio-oirge-2.4.8-Setup.exe', 1024);
    writeFakeInstaller(dir, 'Mineradio-oirge-2.4.9-Setup.exe', 1024);
    writeFakeInstaller(dir, 'Mineradio-oirge-2.5.0-Setup.exe.download', 256);

    const { prune } = loadPruneUpdateDownloadCache(dir);
    const result = prune('2.4.8');

    assert.deepEqual(remaining(dir), [
      'Mineradio-oirge-2.4.8-Setup.exe',
      'Mineradio-oirge-2.4.9-Setup.exe',
      'Mineradio-oirge-2.5.0-Setup.exe.download',
    ], '当前版本、待装新版本及其续传半包都应保留');
    // result.removed 来自 vm 上下文，原型不同，搬回本 realm 再比对。
    assert.deepEqual(Array.from(result.removed), ['Mineradio-oirge-2.4.7-Setup.exe'], '只应删掉旧版本安装包');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 验证旧版本遗留的续传半包一起清掉——它已经续不成任何有效更新。
 * @returns {void}
 */
function testRemovesSupersededPartialDownload() {
  const dir = makeTempDownloadDir();
  try {
    writeFakeInstaller(dir, 'Mineradio-oirge-2.4.7-Setup.exe.download', 2048);
    writeFakeInstaller(dir, 'Mineradio-oirge-2.4.8-Setup.exe', 1024);

    const { prune } = loadPruneUpdateDownloadCache(dir);
    const result = prune('2.4.8');

    assert.deepEqual(remaining(dir), ['Mineradio-oirge-2.4.8-Setup.exe'], '旧版本半包应被删除');
    assert.equal(result.removedBytes, 2048, '半包字节数应计入释放量');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 验证校验失败被挪开的 `.invalid-*` 残留一律清掉，即使它的版本号不比当前版本旧。
 * @returns {void}
 */
function testRemovesInvalidLeftovers() {
  const dir = makeTempDownloadDir();
  try {
    writeFakeInstaller(dir, 'Mineradio-oirge-2.4.9-Setup.invalid-1789957646846.exe', 4096);
    writeFakeInstaller(dir, 'Mineradio-oirge-2.4.8-Setup.exe', 1024);

    const { prune } = loadPruneUpdateDownloadCache(dir);
    const result = prune('2.4.8');

    assert.deepEqual(remaining(dir), ['Mineradio-oirge-2.4.8-Setup.exe'], '损坏残留应被删除');
    assert.equal(result.removed.length, 1, '只应删掉那一个 .invalid 残留');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 验证版本号认不出来的文件原样不动，避免误删用户自己放进来的东西。
 * @returns {void}
 */
function testKeepsUnparseableNames() {
  const dir = makeTempDownloadDir();
  try {
    writeFakeInstaller(dir, 'README.txt', 32);
    writeFakeInstaller(dir, 'Mineradio-Setup.exe', 64);

    const { prune, warnings, logs } = loadPruneUpdateDownloadCache(dir);
    const result = prune('2.4.8');

    assert.deepEqual(remaining(dir), ['Mineradio-Setup.exe', 'README.txt'], '认不出版本的文件应原样保留');
    assert.equal(result.removed.length, 0, '不应删除任何文件');
    assert.equal(warnings.length, 0, '无删除动作不应产生警告');
    assert.equal(logs.length, 0, '无删除动作不应打汇总日志');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 验证名字像旧版本安装包的子目录不会被当成文件删除。
 * @returns {void}
 */
function testSkipsDirectories() {
  const dir = makeTempDownloadDir();
  try {
    fs.mkdirSync(path.join(dir, 'Mineradio-oirge-2.0.0-Setup.exe'), { recursive: true });

    const { prune, warnings } = loadPruneUpdateDownloadCache(dir);
    const result = prune('2.4.8');

    assert.deepEqual(remaining(dir), ['Mineradio-oirge-2.0.0-Setup.exe'], '子目录不应被删除');
    assert.equal(result.removed.length, 0, '子目录不计入删除');
    assert.equal(warnings.length, 0, '跳过子目录不应产生警告');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 验证下载目录尚未创建时静默返回，不抛异常也不报警。
 * @returns {void}
 */
function testMissingDirIsNoop() {
  const root = makeTempDownloadDir();
  try {
    const { prune, warnings } = loadPruneUpdateDownloadCache(path.join(root, 'downloads'));
    let result;
    assert.doesNotThrow(() => { result = prune('2.4.8'); });
    assert.equal(result.removed.length, 0, '目录不存在时无删除');
    assert.equal(warnings.length, 0, '目录不存在属正常首启，不应报警');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/**
 * 验证当前版本读不到时一个都不删，杜绝把整个缓存误判成旧版本清空。
 * @returns {void}
 */
function testGuardsAgainstMissingCurrentVersion() {
  const dir = makeTempDownloadDir();
  try {
    writeFakeInstaller(dir, 'Mineradio-oirge-2.4.7-Setup.exe', 1024);
    writeFakeInstaller(dir, 'Mineradio-oirge-2.4.8-Setup.exe', 1024);

    const { prune } = loadPruneUpdateDownloadCache(dir);
    const blank = prune('');
    const nullish = prune(null);

    assert.equal(remaining(dir).length, 2, '缺少当前版本时不得删除任何安装包');
    assert.equal(blank.removed.length, 0, '空版本号应原样返回');
    assert.equal(nullish.removed.length, 0, 'null 版本号应原样返回');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 验证单个文件删除失败只记录警告、不向上抛出，也不虚报释放字节数。
 * @returns {void}
 */
function testDeleteFailureIsSwallowed() {
  const dir = makeTempDownloadDir();
  try {
    writeFakeInstaller(dir, 'Mineradio-oirge-2.4.7-Setup.exe', 1024);
    const fsOverride = Object.assign({}, fs, {
      unlinkSync: () => {
        throw new Error('EBUSY: resource busy');
      },
    });

    const { prune, warnings } = loadPruneUpdateDownloadCache(dir, fsOverride);
    let result;
    assert.doesNotThrow(() => { result = prune('2.4.8'); });

    assert.equal(warnings.length, 1, '删除失败应记录一次警告');
    assert.equal(result.removed.length, 0, '删除失败不得计入已删除列表');
    assert.equal(result.removedBytes, 0, '删除失败不得虚报释放字节数');
    assert.equal(remaining(dir).length, 1, '文件应仍然存在');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('旧版本安装包全部清掉且当前版本保留', testRemovesSupersededInstallers);
test('待装的更高版本安装包与续传半包绝不删除', testKeepsPendingNewerInstallers);
test('旧版本遗留的续传半包一起清掉', testRemovesSupersededPartialDownload);
test('校验失败挪开的 .invalid 残留一律清掉', testRemovesInvalidLeftovers);
test('版本号认不出来的文件原样保留', testKeepsUnparseableNames);
test('名字像安装包的子目录不会被删除', testSkipsDirectories);
test('下载目录不存在时静默返回', testMissingDirIsNoop);
test('当前版本缺失时绝不删除任何安装包', testGuardsAgainstMissingCurrentVersion);
test('删除失败只记录警告而不抛出', testDeleteFailureIsSwallowed);
