'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

/**
 * 读取 renderer 主脚本源码。
 * @returns {string} 完整 index.html 文本。
 */
function readRendererSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
}

/**
 * 截取从指定函数开始到下一个标记前的源码。
 * @param {string} source renderer 主脚本源码。
 * @param {string} startMarker 起始函数标记。
 * @param {string} endMarker 结束标记。
 * @returns {string} 可在隔离上下文执行的函数源码。
 */
function readFunctionSource(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `未找到函数源码: ${startMarker}`);
  return source.slice(start, end);
}

/**
 * 验证混合队列筛选仍保留首个非本地项之前的本地歌曲。
 * @returns {void}
 */
function testLocalSearchWarmupSourcePreservesMixedQueue() {
  const source = readRendererSource();
  const warmupSource = readFunctionSource(
    source,
    'function localSearchWarmupSource(songs)',
    '/**\n * 在空闲切片里预热本地搜索归一化索引',
  );
  const songs = [
    { type: 'local', name: '本地一' },
    { type: 'remote', name: '在线项' },
    { type: 'local', name: '本地二' },
    { type: 'local', name: '本地三' },
  ];
  const context = { Array, Object };
  vm.runInNewContext(`${warmupSource}\nthis.filter = localSearchWarmupSource;`, context);

  const filtered = context.filter(songs);

  assert.deepEqual(Array.from(filtered, (song) => song.name), ['本地一', '本地二', '本地三']);
}

/**
 * 验证搜索池只筛选一次，并把同一数组身份交给预热任务。
 * @returns {void}
 */
function testLocalSearchPoolReusesFilteredArrayForWarmup() {
  const source = readRendererSource();
  const poolSource = readFunctionSource(
    source,
    'function localSearchPool()',
    '/**\n * 拼接本地搜索索引文本',
  );
  const songs = [{ type: 'local', name: '本地歌曲' }];
  let warmupCalls = 0;
  let scheduledSongs = null;
  const context = {
    localLibrarySongs: songs,
    playQueue: [],
    queueRenderFingerprint: () => 'queue',
    localSearchPoolCache: { source: null, signature: '', items: [] },
    localSearchWarmupSource: (items) => {
      warmupCalls += 1;
      return items;
    },
    scheduleLocalSearchIndexWarmup: (items) => {
      scheduledSongs = items;
    },
  };
  vm.runInNewContext(`${poolSource}\nthis.getPool = localSearchPool;`, context);

  const first = context.getPool();
  const second = context.getPool();

  assert.strictEqual(first, second);
  assert.strictEqual(scheduledSongs, first);
  assert.equal(warmupCalls, 1);
}

/**
 * 验证同一曲库签名下的空查询返回同一个结果数组，曲库变化后才重建。
 * @returns {void}
 */
function testEmptyLocalSearchResultsReuseIdentity() {
  const source = readRendererSource();
  const defaultSource = readFunctionSource(
    source,
    'function localSearchDefaultResults(pool)',
    'function cancelLocalSearchIndexWarmup',
  );
  const searchSource = readFunctionSource(
    source,
    'function searchLocalSongs(q)',
    'function renderLocalLibraryResults',
  );
  const songs = Array.from({ length: 90 }, (_, index) => ({ type: 'local', name: `歌曲${index}` }));
  const context = {
    Array,
    Math,
    String,
    LOCAL_SEARCH_RESULT_LIMIT: 80,
    localSearchPoolCache: { signature: 'library:90' },
    localSearchResultCache: { signature: '', normalizedQuery: '', results: [], exhaustive: false },
    localSearchPool: () => songs,
    simpleSearchNorm: (value) => String(value || '').toLowerCase(),
    cachedLocalSongSearchText: (song) => song.name,
  };
  vm.runInNewContext(`${defaultSource}\n${searchSource}\nthis.search = searchLocalSongs;`, context);

  const first = context.search('');
  const second = context.search('   ');
  context.localSearchPoolCache.signature = 'library:91';
  songs.push({ type: 'local', name: '新增歌曲' });
  const third = context.search('');

  assert.strictEqual(first, second);
  assert.notStrictEqual(first, third);
  assert.equal(first.length, 80);
  assert.equal(third.length, 80);
}

function testLocalSearchPrioritizesSongArtistAndFileName() {
  const source = readRendererSource();
  const indexSource = readFunctionSource(
    source,
    'function localSongSearchFileName(song)',
    'function localSearchDefaultResults(pool)',
  );
  const searchSource = readFunctionSource(
    source,
    'function cachedLocalSongSearchFields(song)',
    'function renderLocalLibraryResults',
  );
  const songs = [
    { type: 'local', name: '普通歌曲', artist: '目标词', localPath: 'D:\\music\\artist.mp3' },
    { type: 'local', name: '目标词', artist: '普通歌手', localPath: 'D:\\music\\title.mp3' },
    { type: 'local', name: '另一首歌', artist: '普通歌手', localPath: 'D:\\music\\目标词.mp3' },
    { type: 'local', name: '专辑之外', artist: '其他歌手', album: '目标词', localPath: 'D:\\music\\album.mp3' },
  ];
  const context = {
    Array,
    Math,
    String,
    LOCAL_SEARCH_RESULT_LIMIT: 80,
    localSearchPoolCache: { signature: 'library:4' },
    localSearchResultCache: { signature: '', normalizedQuery: '', results: [], exhaustive: false },
    localSearchPool: () => songs,
    simpleSearchNorm: (value) => String(value || '').toLowerCase().replace(/[\s·・,，。.!！?？'"“”‘’|\-_/]+/g, ''),
  };
  vm.runInNewContext(`${indexSource}\n${searchSource}\nthis.search = searchLocalSongs;`, context);

  const results = context.search('目标词');

  assert.deepEqual(Array.from(results, (song) => song.name), ['目标词', '普通歌曲', '另一首歌']);
  assert.equal(results.some((song) => song.album === '目标词'), false);
}

test('混合本地搜索池筛选保留本地歌曲', testLocalSearchWarmupSourcePreservesMixedQueue);
test('本地搜索池把同一筛选数组交给预热任务', testLocalSearchPoolReusesFilteredArrayForWarmup);
test('空查询搜索结果按曲库签名复用数组', testEmptyLocalSearchResultsReuseIdentity);
test('local search prioritizes song artist and file name', testLocalSearchPrioritizesSongArtistAndFileName);
