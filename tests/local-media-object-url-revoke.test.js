'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 从前端源码截取整批曲库替换时回收 Object URL 的真实实现。
 * @returns {string} 可在隔离上下文执行的回收源码。
 */
function readRevokeSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function revokeDiscardedLocalSongObjectUrls(');
  const end = source.indexOf('/**\n * 解析本地歌词并标记来源。', start);
  assert.ok(start >= 0 && end > start, '未找到 Object URL 回收实现');
  return source.slice(start, end);
}

/**
 * 在隔离上下文加载回收实现，并记录被撤销的 Object URL。
 * @returns {{revoke: Function, revoked: string[]}} 回收函数与撤销记录。
 */
function loadRevoke() {
  const revoked = [];
  const context = {
    URL: {
      revokeObjectURL(url) { revoked.push(url); },
    },
  };
  vm.runInNewContext(
    readRevokeSource() + '\nthis.revoke = revokeDiscardedLocalSongObjectUrls;',
    context,
  );
  return { revoke: context.revoke, revoked };
}

/**
 * 验证被丢弃旧曲库的 blob 地址会被撤销，而新曲库仍引用的同地址被保留。
 * @returns {void}
 */
function testRevokesDiscardedButKeepsLiveUrls() {
  const { revoke, revoked } = loadRevoke();
  const oldA = { localUrl: 'blob:A', localCoverObjectUrl: 'blob:CA' };
  const oldB = { localUrl: 'blob:B' };
  const shared = { localUrl: 'blob:SHARED' };
  const oldLibrary = [oldA, oldB, shared];
  const newLibrary = [{ localUrl: 'blob:A2' }, { localUrl: 'blob:SHARED' }];

  const count = revoke(oldLibrary, [newLibrary, []]);

  assert.deepEqual(revoked.slice().sort(), ['blob:A', 'blob:B', 'blob:CA']);
  assert.equal(count, 3);
  assert.equal(revoked.includes('blob:SHARED'), false);
}

/**
 * 验证仍被存活歌单引用的旧本地歌 blob 地址不会被误撤销。
 * @returns {void}
 */
function testKeepsUrlsReferencedByPlaylist() {
  const { revoke, revoked } = loadRevoke();
  const keptSong = { localUrl: 'blob:KEEP' };
  const oldLibrary = [{ localUrl: 'blob:GONE' }, keptSong];
  const playlist = [keptSong];

  revoke(oldLibrary, [[], playlist]);

  assert.deepEqual(revoked, ['blob:GONE']);
}

/**
 * 验证主进程持久地址（非 blob:）与空值绝不会被撤销。
 * @returns {void}
 */
function testNeverRevokesPersistentOrEmptyUrls() {
  const { revoke, revoked } = loadRevoke();
  const oldLibrary = [
    { localUrl: 'mineradio-local://x/1.mp3' },
    { localUrl: 'http://127.0.0.1:1/a.flac' },
    { localUrl: '' },
    { localCoverObjectUrl: null },
    null,
  ];

  const count = revoke(oldLibrary, [[]]);

  assert.equal(count, 0);
  assert.equal(revoked.length, 0);
}

/**
 * 验证同一个 blob 地址在旧曲库多首歌里共享时只撤销一次。
 * @returns {void}
 */
function testDedupesRepeatedUrls() {
  const { revoke, revoked } = loadRevoke();
  const url = 'blob:DUP';
  const count = revoke([{ localUrl: url }, { localUrl: url }, { localCoverObjectUrl: url }], [[]]);

  assert.equal(count, 1);
  assert.deepEqual(revoked, ['blob:DUP']);
}

/**
 * 验证空的丢弃列表直接返回 0，不触碰任何回收接口。
 * @returns {void}
 */
function testEmptyDiscardListIsNoop() {
  const { revoke, revoked } = loadRevoke();
  assert.equal(revoke([], [[]]), 0);
  assert.equal(revoke(null, [[]]), 0);
  assert.equal(revoked.length, 0);
}

test('整批替换时撤销被丢弃的本地 Object URL 且保留仍引用地址', testRevokesDiscardedButKeepsLiveUrls);
test('存活歌单仍引用的本地 Object URL 不会被误撤销', testKeepsUrlsReferencedByPlaylist);
test('主进程持久地址与空值永不被撤销', testNeverRevokesPersistentOrEmptyUrls);
test('旧曲库中重复的 Object URL 只撤销一次', testDedupesRepeatedUrls);
test('丢弃列表为空时回收是无副作用的空操作', testEmptyDiscardListIsNoop);
