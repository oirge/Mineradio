'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

/**
 * 验证 renderer 不再保存无读取方的本地资产镜像，同时保留 IndexedDB 持久化入口。
 * @returns {void}
 */
function testLocalAssetRecordsHaveSingleRuntimeOwner() {
  const file = path.join(__dirname, '..', 'public', 'app.js');
  const source = fs.readFileSync(file, 'utf8');
  const recordWriteStart = source.indexOf('async function writeLocalAssetCacheRecord(');
  const writeStart = source.indexOf('async function writeLocalAssetCacheForSong(');
  const writeEnd = source.indexOf('function scheduleLocalAssetCacheWrite(', writeStart + 1);
  const putStart = source.indexOf('async function putLocalAssetCacheRecord(');
  const putEnd = source.indexOf('/**\n * 将本地资产缓存记录套用到歌曲对象', putStart + 1);

  assert.doesNotMatch(source, /\blocalAssetCacheMemory\b/);
  assert.ok(recordWriteStart >= 0 && writeStart > recordWriteStart, '未找到资产快照写入函数');
  assert.ok(writeStart >= 0 && writeEnd > writeStart, '未找到歌曲资产写入函数');
  assert.ok(putStart >= 0 && putEnd > putStart, '未找到 IndexedDB 资产写入函数');
  assert.match(source.slice(recordWriteStart, writeStart), /return await putLocalAssetCacheRecord\(record\)/);
  assert.match(source.slice(writeStart, writeEnd), /writeLocalAssetCacheRecord\(localAssetCacheSnapshot\(song\)/);
  assert.match(source.slice(putStart, putEnd), /objectStore\(LOCAL_ASSET_CACHE_STORE\)\.put\(record\)/);
  assert.match(source, /function applyLocalAssetCacheToSong\(song, record, opts\)/);
}

test('本地资产记录只由歌曲对象和 IndexedDB 持有', testLocalAssetRecordsHaveSingleRuntimeOwner);
