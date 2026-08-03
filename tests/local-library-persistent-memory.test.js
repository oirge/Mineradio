'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 截取本地曲库内存缓存的真实生命周期函数，避免测试复制生产实现。
 * @param {string} source 完整 renderer 源码。
 * @returns {string} 生命周期函数源码。
 */
function extractPersistentMemoryLifecycle(source) {
  const start = source.indexOf('function localLibraryPersistentKey(');
  const end = source.indexOf('async function readLocalLibraryPersistentRecord(', start + 1);
  assert.ok(start >= 0 && end > start, '未找到本地曲库持久缓存生命周期接缝');
  return source.slice(start, end);
}

/**
 * 截取本地曲库索引同步函数，用真实实现验证旧索引记录不会挂到歌曲对象。
 * @param {string} source 完整 renderer 源码。
 * @returns {string} 索引同步函数源码。
 */
function extractLocalLibraryIndexSync(source) {
  const start = source.indexOf('function syncLocalLibraryIndexWithSongs(');
  const end = source.indexOf('function applyLocalLibraryIndexToSongs(', start + 1);
  assert.ok(start >= 0 && end > start, '未找到本地曲库索引同步接缝');
  return source.slice(start, end);
}

/**
 * 验证内存只持有当前曲库索引，并拒绝快照或晚完成的旧读取长期占用。
 * @returns {void}
 */
function testPersistentMemoryFollowsActiveLibrary() {
  const file = path.join(__dirname, '..', 'public', 'app.js');
  const source = fs.readFileSync(file, 'utf8');
  const context = {};
  vm.runInNewContext(
    'var localLibraryPersistentMemory = {}; var localLibraryPersistentFolderPath = ""; var localLibraryPersistentGeneration = 0;\n'
      + extractPersistentMemoryLifecycle(source)
      + '\nthis.activate = activateLocalLibraryPersistentMemory;'
      + '\nthis.remember = rememberLocalLibraryPersistentRecord;'
      + '\n/** @returns {object} 返回当前曲库内存记录。 */'
      + '\nthis.memory = function memory(){ return localLibraryPersistentMemory; };'
      + '\n/** @returns {number} 返回当前曲库内存代次。 */'
      + '\nthis.generation = function generation(){ return localLibraryPersistentGeneration; };',
    context,
  );

  const oldSnapshot = {
    id: 'snapshot:A',
    kind: 'snapshot',
    folderPath: 'A',
    data: { files: new Array(4096).fill('old') },
  };
  const oldIndex = {
    id: 'index:A',
    kind: 'index',
    folderPath: 'A',
    data: { records: { old: { key: 'old' } } },
  };

  context.activate('A');
  const firstAGeneration = context.generation();
  assert.equal(context.remember(oldSnapshot, firstAGeneration), false);
  assert.equal(context.remember(oldIndex, firstAGeneration), true);
  assert.deepEqual(Object.keys(context.memory()), ['index:A']);

  context.activate('B');
  assert.equal(Object.keys(context.memory()).length, 0);
  assert.equal(context.remember(oldSnapshot, firstAGeneration), false);
  assert.equal(Object.keys(context.memory()).length, 0);

  context.activate('A');
  const secondAGeneration = context.generation();
  assert.notEqual(secondAGeneration, firstAGeneration);
  assert.equal(context.remember(oldSnapshot, firstAGeneration), false);

  context.activate('B');
  const currentGeneration = context.generation();

  const currentIndex = {
    id: 'index:B',
    kind: 'index',
    folderPath: 'B',
    data: { records: { current: { key: 'current' } } },
  };
  assert.equal(context.remember(currentIndex, currentGeneration), true);
  assert.deepEqual(Object.keys(context.memory()), ['index:B']);
}

/**
 * 验证索引同步只把需要的字段套用到歌曲，不保留无消费者的旧记录对象。
 * @returns {void}
 */
function testIndexSyncReleasesPreviousRecords() {
  const file = path.join(__dirname, '..', 'public', 'app.js');
  const source = fs.readFileSync(file, 'utf8');
  const previousRecord = { key: 'song-key', pathKey: 'song.mp3' };

  /** @returns {object} 返回测试使用的旧索引。 */
  function readIndex() { return { records: { 'song-key': previousRecord } }; }

  /** @returns {{records:Array<object>}} 返回包含旧记录的查找表。 */
  function createLookup() { return { records: [previousRecord] }; }

  /** @param {object} song 歌曲对象。 @returns {string} 返回歌曲路径键。 */
  function songPathKey(song) { return song.pathKey; }

  /** @returns {object} 返回匹配到的旧索引记录。 */
  function findRecord() { return previousRecord; }

  /** @returns {boolean} 模拟旧记录与歌曲未变化。 */
  function recordMatches() { return true; }

  /** @returns {boolean} 模拟没有额外字段需要套用。 */
  function applyRecord() { return false; }

  /** @param {object} record 索引记录。 @returns {string} 返回记录路径键。 */
  function recordPathKey(record) { return record.pathKey; }

  const context = {
    readLocalLibraryIndex: readIndex,
    createLocalLibraryIndexLookup: createLookup,
    localLibraryPathKeyFromSong: songPathKey,
    findLocalLibraryIndexRecordForSong: findRecord,
    localLibraryRecordMatchesSong: recordMatches,
    applyLocalLibraryIndexToSong: applyRecord,
    localLibraryRecordPathKey: recordPathKey,
  };
  vm.runInNewContext(extractLocalLibraryIndexSync(source) + '\nthis.syncIndex = syncLocalLibraryIndexWithSongs;', context);

  const song = { localKey: 'song-key', pathKey: 'song.mp3' };
  const result = context.syncIndex('library', [song]);

  assert.equal(result.stats.unchanged, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(song, 'localLibraryPreviousRecord'), false);
}

test('本地曲库内存缓存只持有当前索引并拒绝旧异步结果', testPersistentMemoryFollowsActiveLibrary);
test('本地曲库索引同步不把旧记录长期挂到歌曲对象', testIndexSyncReleasesPreviousRecords);
