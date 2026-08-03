'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 截取本地节奏缓存打包、保存和写入函数。
 * @returns {string} 可在隔离 VM 中执行的生产源码。
 */
function readLocalBeatCacheSource() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
  const start = source.indexOf('function packLocalBeatCache(');
  const end = source.indexOf('function setLocalBeatStatus(', start + 1);
  assert.ok(start >= 0 && end > start, '未找到本地节奏缓存接缝');
  return source.slice(start, end);
}

/**
 * 验证连续分析多首本地歌曲后，renderer 内存与持久化都只保留最近 12 条节奏图。
 * @returns {void}
 */
function testLocalBeatMemoryCacheIsBounded() {
  const cache = {};
  const prefs = {};
  const beatMapCache = {};
  const djBeatMapCache = {};
  let now = 0;
  let persisted = '';

  /** @returns {object} 返回测试使用的内存节奏缓存。 */
  function ensureLocalBeatMapCache() { return cache; }

  /** @returns {object} 返回测试使用的模式偏好。 */
  function ensureLocalBeatPrefsCache() { return prefs; }

  /** @returns {object} 测试无需压缩节奏图结构。 */
  function packLocalBeatMap(map) { return map; }

  /** @returns {void} 测试不需要写偏好或磁盘缓存。 */
  function noop() {}

  /** @returns {number} 为每次写入提供严格递增的更新时间。 */
  function currentTime() { now += 1; return now; }

  /**
   * 捕获本地节奏缓存持久化结果。
   * @param {string} key 本地存储键。
   * @param {string} value 序列化后的节奏缓存。
   * @returns {void}
   */
  function rememberPersistedCache(key, value) {
    if (value && typeof value === 'object') persisted = JSON.stringify(value);
  }

  const context = {
    ensureLocalBeatMapCache,
    ensureLocalBeatPrefsCache,
    packLocalBeatMap,
    saveLocalBeatPrefs: noop,
    scheduleLocalUserStateWrite: rememberPersistedCache,
    writeBeatDiskCache: noop,
    beatMapCache,
    djBeatMapCache,
    LOCAL_USER_STATE_LOCAL_BEATMAPS: 'local-beatmaps',
    LOCAL_BEATMAP_STORE_KEY: 'legacy-beat-cache',
    Date: { now: currentTime },
  };
  vm.runInNewContext(
    readLocalBeatCacheSource()
      + '\nthis.storeBeat = storeLocalBeatEntry;',
    context,
  );

  for (let index = 0; index < 20; index += 1) {
    const key = 'song-' + index;
    const map = { beats: new Array(1024).fill(index) };
    context.storeBeat(key, 'mr', map, { type: 'local' }, { skipDisk: true });
    beatMapCache['local:' + key] = map;
  }

  assert.equal(Object.keys(cache).length, 12);
  assert.equal(Object.keys(beatMapCache).length, 12);
  for (let index = 0; index < 20; index += 1) {
    const shouldRemain = index >= 8;
    assert.equal(!!cache['song-' + index], shouldRemain);
    assert.equal(!!beatMapCache['local:song-' + index], shouldRemain);
  }
  assert.equal(Object.keys(JSON.parse(persisted)).length, 12);

  const djMap = { beats: ['dj'] };
  context.storeBeat('song-19', 'dj', djMap, { type: 'local' }, { skipDisk: true });
  djBeatMapCache['local:song-19'] = djMap;
  assert.equal(Object.keys(cache).length, 12);
  assert.ok(cache['song-19'].mr);
  assert.equal(cache['song-19'].dj, djMap);

  const refreshedMap = { beats: ['refreshed'] };
  context.storeBeat('song-8', 'mr', refreshedMap, { type: 'local' }, { skipDisk: true });
  beatMapCache['local:song-8'] = refreshedMap;
  context.storeBeat('song-20', 'mr', { beats: ['new'] }, { type: 'local' }, { skipDisk: true });
  beatMapCache['local:song-20'] = cache['song-20'].mr;
  assert.equal(cache['song-8'].mr, refreshedMap);
  assert.equal(cache['song-9'], undefined);
  assert.ok(cache['song-20']);
  assert.equal(Object.keys(cache).length, 12);
  assert.equal(Object.keys(JSON.parse(persisted)).length, 12);
}

/**
 * 验证刚写入条目即使时间戳异常偏旧，也不会在本轮裁剪中被删除。
 * @returns {void}
 */
function testLocalBeatTrimProtectsCurrentWrite() {
  const cache = { protected: { updatedAt: 0 } };
  const beatMapCache = { 'local:protected': {} };
  const djBeatMapCache = { 'local:protected': {} };
  for (let index = 0; index < 12; index += 1) {
    cache['song-' + index] = { updatedAt: index + 1 };
    beatMapCache['local:song-' + index] = {};
    djBeatMapCache['local:song-' + index] = {};
  }

  /** @returns {object} 返回预置的本地节奏缓存。 */
  function ensureLocalBeatMapCache() { return cache; }

  const context = { ensureLocalBeatMapCache, beatMapCache, djBeatMapCache };
  vm.runInNewContext(readLocalBeatCacheSource() + '\nthis.trimBeat = trimLocalBeatMapMemoryCache;', context);
  context.trimBeat(12, 'protected');

  assert.equal(Object.keys(cache).length, 12);
  assert.ok(cache.protected);
  assert.ok(beatMapCache['local:protected']);
  assert.ok(djBeatMapCache['local:protected']);
}

test('本地节奏图内存缓存与落盘上限一致', testLocalBeatMemoryCacheIsBounded);
test('本地节奏图裁剪保护本轮写入条目', testLocalBeatTrimProtectsCurrentWrite);
