'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从本地更新服务截取 latest.yml 标量提取函数。
 * @returns {string} 可在隔离上下文执行的生产源码。
 */
function readYamlScalarSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const start = source.indexOf('function yamlScalar(');
  const end = source.indexOf('function githubReleaseDownloadUrl(', start);
  assert.ok(start >= 0 && end > start, '未找到 yamlScalar 实现');
  return source.slice(start, end);
}

/**
 * 在隔离上下文加载 yamlScalar。
 * @returns {Function} 提取到的 yamlScalar 函数。
 */
function loadYamlScalar() {
  const context = {};
  vm.runInNewContext(readYamlScalarSource() + '\nthis.yamlScalar = yamlScalar;', context);
  return context.yamlScalar;
}

const SINGLE_FILE_YML = [
  'version: 1.2.54',
  'files:',
  '  - url: Mineradio-1.2.54-Setup.exe',
  '    sha512: SetupHashAAAA==',
  '    size: 104750174',
  'path: Mineradio-1.2.54-Setup.exe',
  'sha512: SetupHashAAAA==',
  'size: 104750174',
  "releaseDate: '2026-07-26T14:40:35.827Z'",
].join('\n');

const MULTI_FILE_YML = [
  'version: 1.2.55',
  'files:',
  '  - url: Mineradio-1.2.55-Setup.exe.blockmap',
  '    sha512: BlockmapHashWRONG==',
  '    size: 111963',
  '  - url: Mineradio-1.2.55-Setup.exe',
  '    sha512: SetupHashCORRECT==',
  '    size: 104750000',
  'path: Mineradio-1.2.55-Setup.exe',
  'sha512: SetupHashCORRECT==',
  'size: 104750000',
  "releaseDate: '2026-07-27T00:00:00.000Z'",
].join('\n');

/**
 * 验证单资产 latest.yml 的顶层字段全部按预期提取。
 * @returns {void}
 */
function testSingleFileFieldsUnchanged() {
  const yamlScalar = loadYamlScalar();
  assert.equal(yamlScalar(SINGLE_FILE_YML, 'version'), '1.2.54');
  assert.equal(yamlScalar(SINGLE_FILE_YML, 'path'), 'Mineradio-1.2.54-Setup.exe');
  assert.equal(yamlScalar(SINGLE_FILE_YML, 'sha512'), 'SetupHashAAAA==');
  assert.equal(yamlScalar(SINGLE_FILE_YML, 'size'), '104750174');
  assert.equal(yamlScalar(SINGLE_FILE_YML, 'releaseDate'), '2026-07-26T14:40:35.827Z');
}

/**
 * 验证多资产 latest.yml 里 sha512/size 取顶层权威值，而不是 files 首项。
 * @returns {void}
 */
function testMultiFilePrefersTopLevel() {
  const yamlScalar = loadYamlScalar();
  assert.equal(yamlScalar(MULTI_FILE_YML, 'sha512'), 'SetupHashCORRECT==');
  assert.equal(yamlScalar(MULTI_FILE_YML, 'size'), '104750000');
  assert.equal(yamlScalar(MULTI_FILE_YML, 'path'), 'Mineradio-1.2.55-Setup.exe');
  assert.equal(yamlScalar(MULTI_FILE_YML, 'version'), '1.2.55');
}

/**
 * 验证顶层缺失时回退到纯缩进（无数组标记）字段仍能取到值。
 * @returns {void}
 */
function testFallsBackToIndentedWhenNoTopLevel() {
  const yamlScalar = loadYamlScalar();
  const indentedOnly = ['files:', '  - name: only.exe', '    sha512: IndentedHash=='].join('\n');
  assert.equal(yamlScalar(indentedOnly, 'sha512'), 'IndentedHash==');
}

/**
 * 验证缺失字段返回空串且不抛异常。
 * @returns {void}
 */
function testMissingKeyReturnsEmpty() {
  const yamlScalar = loadYamlScalar();
  assert.equal(yamlScalar(SINGLE_FILE_YML, 'nonexistent'), '');
  assert.equal(yamlScalar('', 'version'), '');
  assert.equal(yamlScalar(null, 'version'), '');
}

test('单资产 latest.yml 顶层字段提取保持不变', testSingleFileFieldsUnchanged);
test('多资产 latest.yml 优先取顶层 sha512/size', testMultiFilePrefersTopLevel);
test('顶层缺失时回退到缩进字段', testFallsBackToIndentedWhenNoTopLevel);
test('缺失字段返回空串且不抛异常', testMissingKeyReturnsEmpty);
