'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// 本地曲库后台队列与单曲索引同步的规模、顺序和异步所有权回归。
const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');

function slice(startMarker, endMarker) {
  const start = SOURCE.indexOf(startMarker);
  const end = SOURCE.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, 'missing source seam: ' + startMarker);
  return SOURCE.slice(start, end);
}

/** 执行生产后台循环，测试中只替换 I/O 与空闲等待。 */
function backgroundContext(songs, active, onPreload) {
  const preloaded = [];
  const context = {
    playQueue: active ? [active] : [], currentIdx: active ? 0 : -1,
    localLibraryProcessToken: 1, localLibraryProcessSongs: songs,
    localLibraryProcessing: { active: true, assetsDone: 0 }, miniQueueOpen: false,
    waitForLocalAssetPreloadTurn: async () => {},
    isCurrentLocalQueueSong: song => context.playQueue[0] === song,
    preloadLocalSongAssets: async song => {
      preloaded.push(song.id);
      if (onPreload) onPreload(song, context);
    },
    shouldUpdateLocalAssetProgressUi: () => false,
    shouldRefreshLocalAssetUiBatch: () => false,
    updateLocalLibraryProcessingProgress: () => {},
    scheduleLocalAssetUiRefresh: () => {},
    safeRenderQueuePanel: () => {}, scheduleShelfRebuild: () => {},
    yieldToIdle: async () => {}, localAssetBackgroundDelayMs: () => 0,
  };
  vm.runInNewContext(
    slice('function promoteCurrentLocalAssetInQueue(', 'async function waitForLocalAssetPreloadTurn(')
      + slice('async function runLocalLibraryBackgroundProcessing(', 'function prepareLocalBeatAnalysis(')
      + '\nthis.run = runLocalLibraryBackgroundProcessing;', context);
  return { context, preloaded };
}

test('一万首后台预载不会为已处理的当前歌曲反复扫描剩余队列', async () => {
  let keyReads = 0;
  const songs = Array.from({ length: 10000 }, (_, i) => ({
    id: i, get localKey() { keyReads++; return 'song-' + i; },
  }));
  const { context, preloaded } = backgroundContext(songs, { localKey: 'song-0' });
  await context.run(songs, 1, {});
  assert.equal(preloaded.length, 10000);
  assert.equal(preloaded[9999], 9999);
  assert.equal(keyReads, 10000, '当前歌曲已处理后只允许一次剩余队列扫描');
  assert.equal(context.localLibraryProcessing.active, false);
  assert.equal(context.localLibraryProcessSongs, null);
});

test('后台处理仍优先当前切换歌曲，并保留重复键的原有提升顺序', async () => {
  const songs = Array.from({ length: 5 }, (_, i) => ({ id: i, localKey: 'song-' + i }));
  const { context, preloaded } = backgroundContext(songs, songs[0], (song, ctx) => {
    if (song.id === 0) ctx.playQueue[0] = songs[4];
    if (song.id === 4) ctx.playQueue[0] = songs[0];
  });
  await context.run(songs, 1, {});
  assert.deepEqual(preloaded, [0, 4, 1, 2, 3]);
  const repeated = [
    { id: 'a1', localKey: 'a' }, { id: 'b', localKey: 'b' },
    { id: 'a2', localKey: 'a' }, { id: 'c', localKey: 'c' },
  ];
  const duplicateRun = backgroundContext(repeated, repeated[0]);
  await duplicateRun.context.run(repeated, 1, {});
  assert.deepEqual(duplicateRun.preloaded, ['a1', 'a2', 'b', 'c']);
});

/** 为生产单曲索引入口建立可计数的 SQLite 与驻留索引环境。 */
function indexContext(songs, write) {
  let recordsBuilt = 0;
  let digestsBuilt = 0;
  const calls = [];
  const existing = {};
  for (const song of songs) existing[song.localKey] = { key: song.localKey, name: 'old' };
  const cached = {
    folderPath: 'root-a', savedAt: 1,
    data: { count: songs.length, records: existing, savedAt: 1 },
  };
  const context = {
    localLibrarySongs: songs, localLibraryPersistentGeneration: 1,
    localLibraryPersistentFolderPath: 'root-a', localLibraryDbIndexDigests: {}, localLibraryDbIndexWriteOwners: {},
    localLibraryPersistentMemory: { 'index:root-a': cached },
    localLibraryDbActive: () => true,
    localLibraryRootForSong: song => song.root || 'root-a',
    localLibraryPersistentKey: (root, kind) => kind + ':' + root,
    localLibraryIndexRecord: song => {
      recordsBuilt++;
      return { key: song.localKey, name: song.name, updatedAt: 99 };
    },
    localLibraryDbIndexDigest: record => { digestsBuilt++; return record.name; },
    callLocalLibraryDb: async (method, root, rows) => {
      calls.push({ method, root, rows });
      return write ? write(rows) : { ok: true, saved: rows.length };
    },
    console: { warn: () => {} },
  };
  vm.runInNewContext(slice('async function saveLocalLibrarySongIndex(', 'function scheduleLocalLibraryIndexSave(')
    + '\nthis.save = saveLocalLibrarySongIndex;', context);
  return { context, cached, calls, counts: () => ({ recordsBuilt, digestsBuilt }) };
}

test('一万首曲库的十次单曲资产更新只构造十条索引并原位更新记录', async () => {
  const songs = Array.from({ length: 10000 }, (_, i) => ({ localKey: 'song-' + i, name: 'name-' + i }));
  const run = indexContext(songs);
  const unchanged = run.cached.data.records['song-9999'];
  const originalRecords = run.cached.data.records;
  for (let i = 0; i < 10; i++) assert.equal(await run.context.save(songs[i], songs), true);
  assert.deepEqual(run.counts(), { recordsBuilt: 10, digestsBuilt: 10 });
  assert.equal(run.calls.length, 10);
  assert.ok(run.calls.every(call => call.rows.length === 1 && call.method === 'saveLocalLibraryDbIndex'));
  assert.equal(run.cached.data.records, originalRecords);
  assert.equal(run.cached.data.records['song-9999'], unchanged);
  assert.equal(run.cached.data.count, 10000);
  assert.equal(run.cached.data.records['song-0'].name, 'name-0');
  assert.equal(run.cached.data.savedAt, 99);
  assert.equal(await run.context.save(songs[0], songs), true);
  assert.equal(run.calls.length, 10, '已成功同步的同一摘要不能重复写盘');
});

test('单曲索引使用真实所属根，补入新记录不会复制或污染其它根', async () => {
  const songs = [{ localKey: 'a', name: 'a' }];
  const run = indexContext(songs);
  await run.context.save({ localKey: 'new-a', name: 'new' }, songs);
  assert.equal(run.cached.data.count, 2);
  await run.context.save({ localKey: 'b', name: 'b', root: 'root-b' }, songs);
  assert.equal(run.calls[1].root, 'root-b');
  assert.equal(run.cached.data.count, 2);
  assert.equal(run.cached.data.records.b, undefined);
});

test('索引异常或空更新不确认摘要，后续同曲同步可以重试', async () => {
  const songs = [{ localKey: 'a', name: 'new' }];
  let attempt = 0;
  const run = indexContext(songs, () => {
    attempt++;
    if (attempt === 1) throw new Error('temporary write error');
    if (attempt === 2) return { ok: true, saved: 0, missed: 1 };
    return { ok: true, saved: 1 };
  });
  assert.equal(await run.context.save(songs[0], songs), false);
  assert.equal(run.context.localLibraryDbIndexDigests.a, undefined);
  assert.equal(await run.context.save(songs[0], songs), false);
  assert.equal(run.context.localLibraryDbIndexDigests.a, undefined);
  assert.equal(await run.context.save(songs[0], songs), true);
  assert.equal(run.context.localLibraryDbIndexDigests.a, 'new');
});

test('换库后的旧单曲回调与迟到回复不会污染新曲库摘要', async () => {
  const songs = [{ localKey: 'a', name: 'old' }];
  let resolve;
  const run = indexContext(songs, () => new Promise(done => { resolve = done; }));
  const pending = run.context.save(songs[0], songs);
  run.context.localLibrarySongs = [{ localKey: 'b' }];
  run.context.localLibraryPersistentGeneration++;
  run.context.localLibraryDbIndexDigests = { b: 'new' };
  resolve({ ok: true, saved: 1 });
  assert.equal(await pending, true);
  assert.deepEqual(run.context.localLibraryDbIndexDigests, { b: 'new' });
  assert.equal(await run.context.save(songs[0], songs), true);
  assert.equal(run.calls.length, 1, '旧数组的迟到回调不得再次写入');
});

test('不同版本的迟到写入回复不把更晚已确认的摘要倒退', async () => {
  const songs = [{ localKey: 'a', name: 'old' }];
  const pending = [];
  const run = indexContext(songs, () => new Promise(resolve => pending.push(resolve)));
  const first = run.context.save(songs[0], songs);
  songs[0].name = 'new';
  const second = run.context.save(songs[0], songs);
  pending[1]({ ok: true, saved: 1 });
  await second;
  pending[0]({ ok: true, saved: 1 });
  await first;
  assert.equal(run.context.localLibraryDbIndexDigests.a, 'new');
  assert.equal(Object.keys(run.context.localLibraryDbIndexWriteOwners).length, 0);
});

test('已保存 A 到在途 B 再回 A 必须重新写入，不能命中旧摘要漏更新', async () => {
  const songs = [{ localKey: 'a', name: 'A' }];
  const pending = [];
  const run = indexContext(songs, () => new Promise(resolve => pending.push(resolve)));
  run.context.localLibraryDbIndexDigests.a = 'A';
  songs[0].name = 'B';
  const first = run.context.save(songs[0], songs);
  songs[0].name = 'A';
  const second = run.context.save(songs[0], songs);
  assert.equal(run.calls.length, 2);
  assert.equal(run.calls[0].rows[0].name, 'B');
  assert.equal(run.calls[1].rows[0].name, 'A');
  pending[0]({ ok: true, saved: 1 });
  await first;
  pending[1]({ ok: true, saved: 1 });
  await second;
  assert.equal(run.context.localLibraryDbIndexDigests.a, 'A');
  assert.equal(Object.keys(run.context.localLibraryDbIndexWriteOwners).length, 0);
});

test('SQLite 不可用时单曲入口允许原有整库保存回退', async () => {
  const songs = [{ localKey: 'a', name: 'a' }];
  const run = indexContext(songs);
  run.context.localLibraryDbActive = () => false;
  assert.equal(await run.context.save(songs[0], songs), false);
  assert.equal(run.calls.length, 0);
  assert.equal(run.counts().recordsBuilt, 0);
});

/** 执行真实资产落盘定时器，检查完成回调调用单曲入口或旧壳回退。 */
async function cacheWriteRun(options) {
  const opts = options || {};
  const song = { localKey: 'a', name: 'a' };
  const songs = [song];
  const calls = { singles: [], full: [] };
  let flush;
  let resolveWrite;
  const write = opts.pending ? new Promise(resolve => { resolveWrite = resolve; }) : Promise.resolve(true);
  const context = {
    localLibrarySongs: songs,
    localAssetCacheSnapshot: () => ({ id: 'a', name: 'a' }),
    localLyricCacheSnapshot: () => null,
    localAssetCacheWriteRecords: {}, localLyricCacheWriteRecords: {}, localAssetCacheWriteTimers: {},
    writeLocalAssetCacheRecord: () => write,
    setTimeout: callback => { flush = callback; return 1; }, clearTimeout: () => {},
    savedLocalLibraryFolderPath: () => 'root-a',
    localLibraryDbActive: () => opts.dbActive !== false,
    scheduleLocalLibraryIndexSave: (root, source) => { calls.full.push({ root, source }); },
    saveLocalLibrarySongIndex: async (item, source) => { calls.singles.push({ item, source }); return opts.saved !== false; },
  };
  vm.runInNewContext(slice('function scheduleLocalAssetCacheWrite(', 'var colorLabState =')
    + '\nthis.schedule = scheduleLocalAssetCacheWrite;', context);
  context.schedule(song);
  flush();
  if (opts.pending) {
    context.localLibrarySongs = [{ localKey: 'b' }];
    resolveWrite(true);
  }
  await new Promise(resolve => setImmediate(resolve));
  return { calls, songs, song };
}

test('资产完成实际接入单曲索引，旧壳回退且换库后不继续索引同步', async () => {
  const successful = await cacheWriteRun({});
  assert.equal(successful.calls.singles.length, 1);
  assert.equal(successful.calls.singles[0].item, successful.song);
  assert.equal(successful.calls.singles[0].source, successful.songs);
  assert.equal(successful.calls.full.length, 0);
  const fallback = await cacheWriteRun({ saved: false, dbActive: false });
  assert.equal(fallback.calls.full.length, 1);
  assert.equal(fallback.calls.full[0].source, fallback.songs);
  const stale = await cacheWriteRun({ pending: true });
  assert.equal(stale.calls.singles.length, 0);
  assert.equal(stale.calls.full.length, 0);
});

test('SQLite 单曲写失败经真实资产回调后仍能重试，不能被整库回退提前确认摘要', async () => {
  const songs = [{ localKey: 'a', name: 'new' }];
  let attempt = 0, fullSaves = 0, flush;
  const run = indexContext(songs, () => ++attempt === 1
    ? { ok: false, error: 'SQLITE_WRITE_FAILED' } : { ok: true, saved: 1 });
  const context = run.context;
  context.localAssetCacheSnapshot = () => ({ id: 'a', name: 'new' });
  context.localLyricCacheSnapshot = () => null;
  context.localAssetCacheWriteRecords = {};
  context.localLyricCacheWriteRecords = {};
  context.localAssetCacheWriteTimers = {};
  context.writeLocalAssetCacheRecord = async () => true;
  context.setTimeout = callback => { flush = callback; return 1; };
  context.clearTimeout = () => {};
  context.savedLocalLibraryFolderPath = () => 'root-a';
  context.LOCAL_LIBRARY_CACHE_SCHEMA = 1;
  context.LOCAL_LIBRARY_INDEX_STORE_KEY = 'legacy-index';
  context.localStorage = { removeItem() {} };
  context.rememberLocalLibraryPersistentRecord = record => { context.localLibraryPersistentMemory[record.id] = record; };
  vm.runInNewContext(slice('function saveLocalLibraryIndex(folderPath, songs)', 'var localLibraryDbIndexWriteOwners ='), context);
  context.scheduleLocalLibraryIndexSave = (root, source) => { fullSaves++; context.saveLocalLibraryIndex(root, source); };
  vm.runInNewContext(slice('function scheduleLocalAssetCacheWrite(', 'var colorLabState ='), context);

  context.scheduleLocalAssetCacheWrite(songs[0]);
  flush();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fullSaves, 0);
  assert.equal(run.calls.length, 1);
  assert.equal(context.localLibraryDbIndexDigests.a, undefined);
  assert.equal(Object.keys(context.localLibraryDbIndexWriteOwners).length, 0);

  context.scheduleLocalAssetCacheWrite(songs[0]);
  flush();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(fullSaves, 0);
  assert.equal(run.calls.length, 2, '同一摘要在失败后的再次资产保存必须真正重试 SQLite');
  assert.equal(context.localLibraryDbIndexDigests.a, 'new');
  assert.equal(await context.save(songs[0], songs), true);
  assert.equal(run.calls.length, 2, '成功后的重复保存才可跳过写盘');
});

test('SQLite 已接管时无有效所属根仍返回失败且不安排错根整库保存', async () => {
  const songs = [{ localKey: 'a', name: 'a' }];
  const run = indexContext(songs);
  run.context.localLibraryRootForSong = () => '';
  assert.equal(await run.context.save(songs[0], songs), false);
  assert.equal(run.calls.length, 0);
  assert.equal(run.context.localLibraryDbIndexDigests.a, undefined);
  const callback = await cacheWriteRun({ saved: false, dbActive: true });
  assert.equal(callback.calls.singles.length, 1);
  assert.equal(callback.calls.full.length, 0, 'SQLite 单曲失败不应把混合曲库写到默认根');
});
