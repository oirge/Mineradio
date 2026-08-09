'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 读取本地曲库资产后台处理源码，供排序行为和分配契约检查使用。
 * @returns {string} 主渲染器源码。
 */
function readRendererSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
}

/**
 * 截取两个标记之间的源码，避免将无关状态机混入测试上下文。
 * @param {string} source 主渲染器源码。
 * @param {string} startMarker 起始标记。
 * @param {string} endMarker 结束标记。
 * @returns {string} 目标源码片段。
 */
function readSourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `未找到源码区段：${startMarker}`);
  return source.slice(start, end);
}

/**
 * 验证本地资产后台队列仍按当前歌曲、播放邻近度和原始顺序排序。
 * @returns {void}
 */
function testLocalAssetPreloadOrder() {
  const source = readRendererSource();
  const helperSource = readSourceBetween(source, 'function localAssetQueuePositionMap()', 'function promoteCurrentLocalAssetInQueue');
  const active = { localKey: 'active', needs: true };
  const queue = [
    { localKey: 'far', needs: true },
    { localKey: 'near', needs: true },
    active,
  ];
  const songs = [
    { localKey: 'unqueued-first', needs: true },
    active,
    { localKey: 'far', needs: true },
    { localKey: 'skip', needs: false },
    { localKey: 'near', needs: true },
    { localKey: 'unqueued-last', needs: true },
  ];
  const context = {
    Math,
    playQueue: queue,
    currentIdx: 2,
    localSongNeedsAssetPreload: (song) => !!song.needs,
  };
  const resultContext = { ...context, songs };
  vm.runInNewContext(`${helperSource}\nthis.sorted = sortLocalAssetPreloadQueue(songs);`, resultContext);
  assert.equal(resultContext.sorted.map((song) => song.localKey).join('|'), [
    'active',
    'near',
    'far',
    'unqueued-first',
    'unqueued-last',
  ].join('|'));
}

/**
 * 验证排序热点使用数字排序键，不为每首候选歌曲创建装饰对象。
 * @returns {void}
 */
function testLocalAssetPreloadSortAllocationContract() {
  const source = readRendererSource();
  const helperSource = readSourceBetween(source, 'function localAssetQueuePositionMap()', 'function promoteCurrentLocalAssetInQueue');
  assert.match(helperSource, /ranked\.sort\(function\(a, b\)\{\s*return a - b;/);
  assert.doesNotMatch(helperSource, /ranked\.push\(\{\s*song:/);
}

/**
 * 验证 IndexedDB 清理只保留必要的紧凑元数据，不同时持有三套完整记录数组。
 * @returns {void}
 */
function testIndexedDbTrimMetadataContract() {
  const source = readRendererSource();
  const trimSource = readSourceBetween(source, 'async function trimLocalIndexedDbCaches(reason)', '/**\n * 生成本地库持久化记录');
  assert.match(trimSource, /var assetIds = \[\];/);
  assert.match(trimSource, /var assetSavedAt = \[\];/);
  assert.match(trimSource, /var assetBytes = \[\];/);
  assert.match(trimSource, /var assetIndexById = Object\.create\(null\);/);
  assert.match(trimSource, /deleteAssetStore\.openCursor\(\)/);
  assert.match(trimSource, /deleteLyricStore\.openCursor\(\)/);
  assert.match(trimSource, /deleteLibraryStore\.openCursor\(\)/);
  assert.doesNotMatch(trimSource, /var lyricEntries = \[\];/);
  assert.doesNotMatch(trimSource, /var libraryEntries = \[\];/);
  assert.doesNotMatch(trimSource, /var orphanLyricIds = \[\];/);
}

test('本地资产后台队列保持播放邻近排序', testLocalAssetPreloadOrder);
test('本地资产排序不为每首歌曲创建装饰对象', testLocalAssetPreloadSortAllocationContract);
test('IndexedDB 清理使用紧凑元数据和游标删除', testIndexedDbTrimMetadataContract);
