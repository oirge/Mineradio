'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 用真实的恢复、索引交接和建库入口验证数据库读取次数与异步所有权。
const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

/** 按稳定的函数边界截取生产实现。 */
function slice(startMarker, endMarker) {
  const start = SOURCE.indexOf(startMarker);
  const end = SOURCE.indexOf(endMarker, start + 1);
  assert.ok(start >= 0 && end > start, startMarker);
  return SOURCE.slice(start, end);
}

/** 构造独立曲库响应；每次读取都有新的数组和索引对象。 */
function databaseResult(root, count = 1, label = root) {
  const files = [];
  const records = {};
  for (let i = 0; i < count; i++) {
    files.push({ name: label + i + '.mp3', type: 'local', localKey: label + i });
    records[label + i] = { key: label + i, name: label + i };
  }
  return { ok: true, files, directories: [], index: { records, savedAt: 1 } };
}

/** 在无 GUI 和真实用户数据的环境中运行完整的建库入口。 */
function harness(options = {}) {
  const counts = { loads: 0, digests: 0, legacyReads: 0, constructed: 0 };
  const noop = () => {};
  const context = {
    console: { warn: noop }, Date, Object, Array, Promise,
    localLibraryPersistentMemory: {}, localLibraryPersistentFolderPath: '', localLibraryPersistentGeneration: 0,
    localLibraryPersistentHydrationSerial: 0, localLibraryPersistentHydrationOwner: 0,
    localLibraryDbSnapshotHandoff: null,
    LOCAL_LIBRARY_CACHE_SCHEMA: 1, LOCAL_LIBRARY_SNAPSHOT_STORE_KEY: 'snapshot',
    probeLocalLibraryDb: async () => options.available !== false,
    callLocalLibraryDb: async (_method, root) => {
      counts.loads++;
      return options.load ? options.load(root, counts.loads) : databaseResult(root, options.count || 1);
    },
    readLocalLibraryPersistentRecord: async (root, kind) => {
      counts.legacyReads++;
      if (kind !== 'index') return null;
      const id = 'index:' + root;
      const record = context.localLibraryPersistentMemory[id] || {
        id, kind: 'index', folderPath: root, data: { records: { legacy: { key: 'legacy' } } },
      };
      context.rememberLocalLibraryPersistentRecord(record, context.localLibraryPersistentGeneration);
      return record;
    },
    localLibraryDbIndexDigest: (record) => { counts.digests++; return record.key; },
    resetLocalLibraryDbIndexDigests: noop, localLibraryDbIndexDigests: {},
    localLibrarySnapshotSignature: (files) => String(files.length),
    localStorage: { getItem: () => null },
    createLocalSongsFromFiles: (files) => { counts.constructed += files.length; return files; },
    syncLocalLibraryIndexWithSongs: (_root, songs) => ({ stats: { total: songs.length, unchanged: songs.length, hasIndex: true } }),
    noteLocalLibraryAddedAt: noop,
    savedLocalLibraryFolderPath: () => 'A',
    hydrateLocalAssetCacheForSongs: async () => 0,
    hydrateLocalAssetCacheForSongsChunked: async () => 0,
    yieldToIdle: async () => {}, localAssetInitialBatchSize: () => 1,
    localLibraryAssetProcessingSongs: () => [], startLocalLibraryBackgroundProcessing: () => 0,
    localLibrarySongs: [], playlist: [], playQueue: [], currentIdx: 0, currentLocalSong: null,
    $results: null, $input: null,
    miniQueueOpen: false,
    readSavedLocalPlaybackPlaylistSelection: () => 'library',
    localPlaylistSongs: () => context.localLibrarySongs,
    cloneSongList: (songs) => songs.slice(),
    restorePlaybackSessionForLocalLibrary: () => false,
    document: { getElementById: () => null },
  };
  for (const name of [
    'addLocalLibraryFolderPath', 'saveLocalLibrarySnapshot', 'scheduleLocalLibraryIndexSave', 'finalizeListenSession',
    'revokeDiscardedLocalSongObjectUrls', 'invalidateLocalPlaylistSongLookup', 'setLocalPlaybackPlaylistSelection',
    'resetSearchRenderCache', 'setHomeControlsLocked', 'safeRenderQueuePanel', 'safeSwitchPlaylistTab', 'safeShelfRebuild',
    'renderHomeDiscover', 'registerLocalLibraryWatchRoots', 'renderLocalLibraryFolderSettings', 'reportLocalLibrarySyncedCount',
    'forcePlaybackControlsInteractive', 'startAutoPlayback', 'clearEmptyLocalLibrary', 'showToast',
  ]) context[name] = noop;
  vm.createContext(context);
  vm.runInContext(
    slice('function localLibraryPersistentKey(', 'async function readLocalLibraryPersistentRecord(')
      + slice('async function hydrateLocalLibraryPersistentState(', "scheduleLocalIndexedDbTrim('startup', 9000);")
      + slice('async function readLocalLibrarySnapshot(', '/* ---- 入库时间 ----')
      + slice('async function loadSingleLocalLibraryRoot(', 'async function restoreSavedLocalMusicFolder(')
      + slice('function localLibraryRootGroups(', '/**\n * 清理成功扫描到空文件夹后的旧本地曲库状态。'),
    context,
  );
  return { context, counts };
}

test('一万首同根恢复到建库只读取一次数据库和构造一次摘要，不留下文件快照', async () => {
  const { context: c, counts } = harness({ count: 10000 });
  const loaded = await c.loadSingleLocalLibraryRoot('A', {});
  assert.equal(c.localLibraryDbSnapshotHandoff, null, '快照读取必须消费交接数组');
  const group = { root: 'A', ...loaded };
  await c.handleLocalFolderFiles(null, { rootGroups: [group], restored: true, fromSnapshot: true, persist: false, autoPlay: false });
  assert.equal(counts.loads, 1);
  assert.equal(counts.digests, 10000);
  assert.equal(counts.constructed, 10000);
  assert.equal(c.localLibrarySongs.length, 10000);
  assert.equal(c.localLibrarySongs[9999].name, 'A9999.mp3');
  assert.equal(c.localLibraryDbSnapshotHandoff, null);
  assert.equal(loaded.persistentState.consumed, true);

  await c.handleLocalFolderFiles(null, { rootGroups: [group], restored: true, fromSnapshot: true, persist: false, autoPlay: false });
  assert.equal(counts.loads, 2, '同一凭据不能用于第二次建库');
  assert.equal(c.localLibraryDbSnapshotHandoff, null, '已有文件表的建库入口不能再保留数据库快照');
});

test('普通重新加载会作废旧凭据，旧凭据不能跳过后续真实读取', async () => {
  const { context: c, counts } = harness();
  const loaded = await c.loadSingleLocalLibraryRoot('A', {});
  await c.hydrateLocalLibraryPersistentState('A');
  assert.equal(counts.loads, 2);
  await c.hydrateLocalLibraryPersistentState('A', { reuse: loaded.persistentState, snapshot: false });
  assert.equal(counts.loads, 3);
  assert.equal(c.localLibraryDbSnapshotHandoff, null);
});

test('多根交接凭据仅包含标量，不持有完整索引；A→B→A 不复用旧代次', async () => {
  const { context: c, counts } = harness();
  const a = await c.loadSingleLocalLibraryRoot('A', {});
  const b = await c.loadSingleLocalLibraryRoot('B', {});
  const groups = c.localLibraryRootGroups({ rootGroups: [{ root: 'A', ...a }, { root: 'B', ...b }] });
  for (const group of groups) {
    assert.deepEqual(Object.keys(group.persistentState).sort(), ['consumed', 'folderPath', 'generation', 'token']);
    assert.ok(Object.values(group.persistentState).every((value) => value == null || typeof value !== 'object'));
  }
  assert.deepEqual(Object.keys(c.localLibraryPersistentMemory), ['index:B']);
  await c.hydrateLocalLibraryPersistentState('A', { reuse: a.persistentState, snapshot: false });
  assert.equal(counts.loads, 3);
  assert.notEqual(c.localLibraryPersistentGeneration, a.persistentState.generation);
  assert.deepEqual(Object.keys(c.localLibraryPersistentMemory), ['index:A']);
  assert.equal(c.localLibraryDbSnapshotHandoff, null);
});

test('同根更早的异步读取不能覆盖新索引或重新填回旧快照', async () => {
  let finishOld;
  const old = new Promise((resolve) => { finishOld = resolve; });
  const { context: c, counts } = harness({ load: (_root, number) => number === 1 ? old : databaseResult('A', 1, 'new') });
  const pendingOld = c.hydrateLocalLibraryPersistentState('A');
  await Promise.resolve();
  const latest = await c.hydrateLocalLibraryPersistentState('A', { snapshot: false });
  finishOld(databaseResult('A', 1, 'old'));
  assert.equal(await pendingOld, null);
  assert.equal(counts.loads, 2);
  assert.deepEqual(Object.keys(c.localLibraryPersistentMemory['index:A'].data.records), ['new0']);
  assert.equal(c.localLibraryPersistentHydrationOwner, latest.token);
  assert.equal(c.localLibraryDbSnapshotHandoff, null);
});

test('旧壳从 IndexedDB 取得索引后也可一次性交接，不重复读取', async () => {
  const { context: c, counts } = harness({ available: false });
  const receipt = await c.hydrateLocalLibraryPersistentState('A');
  await c.hydrateLocalLibraryPersistentState('A', { reuse: receipt, snapshot: false });
  assert.equal(counts.loads, 0);
  assert.equal(counts.legacyReads, 1);
  assert.equal(receipt.consumed, true);
});

test('旧壳同根迟到的 IndexedDB 回包也不能覆盖最新恢复索引', async () => {
  const { context: c } = harness({ available: false });
  const requests = [];
  c.LOCAL_LIBRARY_CACHE_STORE = 'library';
  c.openLocalAssetCacheDb = async () => ({
    close() {},
    transaction: () => ({ objectStore: () => ({ get: () => {
      const request = {};
      requests.push(request);
      return request;
    } }) }),
  });
  vm.runInContext(slice('async function readLocalLibraryPersistentRecord(', 'async function writeLocalLibraryPersistentRecord('), c);
  const old = c.hydrateLocalLibraryPersistentState('A');
  await new Promise(setImmediate);
  const latest = c.hydrateLocalLibraryPersistentState('A', { snapshot: false });
  await new Promise(setImmediate);
  assert.equal(requests.length, 2);
  const record = label => ({ id: 'index:A', kind: 'index', folderPath: 'A', data: { records: { [label]: { key: label } } } });
  requests[1].result = record('new');
  requests[1].onsuccess();
  const receipt = await latest;
  requests[0].result = record('old');
  requests[0].onsuccess();
  assert.equal(await old, null);
  assert.deepEqual(Object.keys(c.localLibraryPersistentMemory['index:A'].data.records), ['new']);
  assert.equal(c.localLibraryPersistentHydrationOwner, receipt.token);
});
