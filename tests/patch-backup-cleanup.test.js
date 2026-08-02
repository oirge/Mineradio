'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从本地更新服务截取补丁备份目录清理函数源码。
 * @returns {string} 可在隔离上下文执行的生产源码。
 */
function readRemoveBackupSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = source.indexOf('function removePatchBackupDir(');
  const end = source.indexOf('function backupPatchFileEntries(', start);
  assert.ok(start >= 0 && end > start, '未找到 removePatchBackupDir 实现');
  return source.slice(start, end);
}

/**
 * 在隔离上下文加载 removePatchBackupDir，并注入其依赖的备份根目录、fs、path、console。
 * @param {string} backupRoot 注入的补丁备份根目录。
 * @param {object} [fsOverride] 可选的 fs 覆盖对象，用于模拟清理失败。
 * @returns {{fn: Function, warnings: Array<Array>}} 提取函数与捕获到的警告参数列表。
 */
function loadRemoveBackupDir(backupRoot, fsOverride) {
  const warnings = [];
  const context = {
    fs: fsOverride || fs,
    path,
    UPDATE_PATCH_BACKUP_DIR: backupRoot,
    console: { warn: (...args) => warnings.push(args) },
  };
  vm.runInNewContext(readRemoveBackupSource() + '\nthis.removePatchBackupDir = removePatchBackupDir;', context);
  return { fn: context.removePatchBackupDir, warnings };
}

/**
 * 创建一个临时目录作为补丁备份根，测试结束由调用方清理。
 * @returns {string} 新建的临时目录绝对路径。
 */
function makeTempBackupRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-patch-backup-'));
}

/**
 * 验证补丁应用完成后对应 job.id 的备份目录被彻底删除。
 * @returns {void}
 */
function testRemovesExistingBackupDir() {
  const root = makeTempBackupRoot();
  try {
    const jobId = 'patch-1700000000000-abcd';
    const dir = path.join(root, jobId);
    fs.mkdirSync(path.join(dir, 'public'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'public', 'index.html'), 'backup-bytes');
    assert.ok(fs.existsSync(dir), '前置：备份目录应存在');

    const { fn, warnings } = loadRemoveBackupDir(root);
    fn({ id: jobId });

    assert.equal(fs.existsSync(dir), false, '备份目录应被删除');
    assert.equal(warnings.length, 0, '成功清理不应产生警告');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/**
 * 验证备份目录不存在时静默返回，不抛异常也不误删其它目录。
 * @returns {void}
 */
function testMissingDirIsNoop() {
  const root = makeTempBackupRoot();
  try {
    const sibling = path.join(root, 'patch-other-job');
    fs.mkdirSync(sibling, { recursive: true });

    const { fn, warnings } = loadRemoveBackupDir(root);
    assert.doesNotThrow(() => fn({ id: 'patch-nonexistent' }));

    assert.ok(fs.existsSync(sibling), '不相关的其它 job 备份不应被删除');
    assert.equal(warnings.length, 0, '目录不存在时不应产生警告');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/**
 * 验证 job 缺失或缺 id 时直接返回，绝不删除整个备份根目录。
 * @returns {void}
 */
function testGuardsAgainstMissingJobId() {
  const root = makeTempBackupRoot();
  try {
    const { fn } = loadRemoveBackupDir(root);
    fn(null);
    fn({});
    fn({ id: '' });
    assert.ok(fs.existsSync(root), '无有效 job.id 时不得触碰备份根目录');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

/**
 * 验证清理失败时只记录警告、不向上抛出，避免污染更新成功/回滚结果。
 * @returns {void}
 */
function testCleanupFailureIsSwallowed() {
  const root = makeTempBackupRoot();
  try {
    const fsOverride = {
      existsSync: () => true,
      rmSync: () => {
        throw new Error('EBUSY: resource busy');
      },
    };
    const { fn, warnings } = loadRemoveBackupDir(root, fsOverride);
    assert.doesNotThrow(() => fn({ id: 'patch-locked-job' }));
    assert.equal(warnings.length, 1, '清理失败应记录一次警告');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test('补丁应用后删除对应 job 的备份目录', testRemovesExistingBackupDir);
test('备份目录不存在时静默返回且不误删其它目录', testMissingDirIsNoop);
test('缺失 job.id 时绝不删除备份根目录', testGuardsAgainstMissingJobId);
test('清理失败只记录警告而不抛出', testCleanupFailureIsSwallowed);
