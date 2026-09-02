'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const store = require('../desktop/local-library-store.js');

/**
 * 在临时目录里开一个真实 SQLite 曲库。测试跑完删掉整个目录，连 WAL 与 shm 一起带走。
 * @param {Function} run 测试体，接收 store 句柄与数据库路径。
 * @returns {Promise<void>} 测试体的结果。
 */
async function withStore(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-library-db-'));
  const handle = store.createLocalLibraryStore({ directory: dir });
  try {
    return await run(handle, dir);
  } finally {
    try { handle.close(); } catch (_e) {}
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) {}
  }
}

/**
 * 构造一条归一化后的扫描条目。
 * @param {string} rel 相对路径。
 * @param {object} extra 覆盖字段。
 * @returns {object} 扫描条目。
 */
function scanEntry(rel, extra) {
  return Object.assign({
    rel: rel,
    pathKey: 'd:/music/' + rel,
    songKey: 'D:\\Music\\' + rel.replace(/\//g, '\\') + ':1024:1700000000000',
    name: rel.split('/').pop(),
    ext: 'mp3',
    mime: 'audio/mpeg',
    isAudio: true,
    size: 1024,
    mtime: 1700000000000,
  }, extra || {});
}

/**
 * 生成扫描负载。
 * @param {string} folderPath 曲库根。
 * @param {Array<object>} files 文件条目。
 * @param {object} extra 覆盖字段。
 * @returns {object} syncRoot 负载。
 */
function scanPayload(folderPath, files, extra) {
  return Object.assign({
    folderPath: folderPath,
    files: files,
    directories: [{ rel: '', mtime: 1700000000000 }],
    scanMode: 'full',
    truncated: false,
  }, extra || {});
}

/**
 * 建库即写好 schema 版本、六张表与组合索引。
 * @returns {Promise<void>}
 */
async function testSchemaAndStatus() {
  await withStore(async (handle) => {
    const status = handle.getStatus();
    assert.equal(status.ok, true);
    assert.equal(status.available, true);
    assert.equal(status.schema, store.LOCAL_LIBRARY_DB_SCHEMA_VERSION);
    assert.equal(status.roots, 0);
    assert.equal(status.files, 0);
    assert.ok(fs.existsSync(handle.filePath));

    const sqlite = require('node:sqlite');
    const probe = new sqlite.DatabaseSync(handle.filePath);
    try {
      assert.equal(Number(probe.prepare('PRAGMA user_version').get().user_version), store.LOCAL_LIBRARY_DB_SCHEMA_VERSION);
      const tables = probe.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map((row) => row.name);
      for (const table of ['assets', 'dirs', 'files', 'lyrics', 'meta', 'roots', 'song_stats']) {
        assert.ok(tables.includes(table), '缺少表 ' + table);
      }
      const indexes = probe.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name").all().map((row) => row.name);
      assert.ok(indexes.includes('idx_files_root_song'));
      assert.ok(indexes.includes('idx_files_root_fingerprint'));
      // 单列索引会被规划器让给 idx_files_root_sort 的 root_id 前缀，必须确认它们已经删掉，不再白付每行索引写。
      assert.equal(indexes.includes('idx_files_song_key'), false);
      assert.equal(indexes.includes('idx_files_fingerprint'), false);
      assert.equal(indexes.includes('idx_files_seen'), false);
    } finally {
      probe.close();
    }
  });
}

/**
 * 索引回写必须走组合索引。这条断言钉死两万首歌 295s 的规划器退化不会回来。
 * @returns {Promise<void>}
 */
async function testIndexUpdatePlanUsesCompositeIndex() {
  await withStore(async (handle) => {
    await handle.syncRoot(scanPayload('D:\\Music', [scanEntry('a.mp3')]));
    const sqlite = require('node:sqlite');
    const probe = new sqlite.DatabaseSync(handle.filePath);
    try {
      const columns = store.FILE_INDEX_COLUMNS.map((column) => column.name + '=?').join(', ');
      const bySong = probe.prepare('EXPLAIN QUERY PLAN UPDATE files SET song_key=?, ' + columns + ' WHERE root_id=? AND song_key=?')
        .all().map((row) => String(row.detail || '')).join(' | ');
      const byFingerprint = probe.prepare('EXPLAIN QUERY PLAN UPDATE files SET song_key=?, ' + columns + ' WHERE root_id=? AND fingerprint=?')
        .all().map((row) => String(row.detail || '')).join(' | ');
      assert.match(bySong, /idx_files_root_song/);
      assert.match(byFingerprint, /idx_files_root_fingerprint/);
      // 退化形态是 SEARCH files USING INDEX idx_files_root_sort (root_id=?)，等于每条索引写扫一遍整根。
      assert.doesNotMatch(bySong, /idx_files_root_sort/);
      assert.doesNotMatch(byFingerprint, /idx_files_root_sort/);
    } finally {
      probe.close();
    }
  });
}

/**
 * 指纹一致时保留已解析元数据，指纹变化时整组清空，避免旧标签套到新文件上。
 * @returns {Promise<void>}
 */
async function testFingerprintReuseAndWipe() {
  await withStore(async (handle) => {
    const folderPath = 'D:\\Music';
    await handle.syncRoot(scanPayload(folderPath, [scanEntry('a.mp3')]));
    const saved = handle.saveIndexRecords(folderPath, [{
      key: scanEntry('a.mp3').songKey,
      pathKey: 'd:/music/a.mp3',
      fileSignature: 'd:/music/a.mp3|1024|1700000000000',
      size: 1024,
      mtime: 1700000000000,
      name: '歌名',
      artist: '歌手',
      album: '专辑',
      albumArtist: '专辑歌手',
      genre: '摇滚',
      year: '2001',
      trackNumber: '3',
      duration: 213.5,
      localFormat: 'mp3',
      localBitrateKbps: 320,
      localMetadataLoaded: true,
      localMetadataTagSchema: 3,
      updatedAt: Date.now(),
    }]);
    assert.equal(saved.ok, true);
    assert.equal(saved.saved, 1);
    assert.equal(saved.missed, 0);

    // 同一份文件重扫：指纹不变，时长 / 格式 / Artist / Album / Genre / Year 全部保留。
    await handle.syncRoot(scanPayload(folderPath, [scanEntry('a.mp3')]));
    let loaded = handle.loadRoot(folderPath);
    assert.equal(loaded.ok, true);
    let record = store.buildIndexRecordFromFileRow(loaded.files[0]);
    assert.equal(record.name, '歌名');
    assert.equal(record.artist, '歌手');
    assert.equal(record.album, '专辑');
    assert.equal(record.genre, '摇滚');
    assert.equal(record.year, '2001');
    assert.equal(record.duration, 213.5);
    assert.equal(record.localFormat, 'mp3');
    assert.equal(record.localMetadataLoaded, true);
    assert.equal(record.fileSignature, 'd:/music/a.mp3|1024|1700000000000');

    // 文件被替换：mtime 变了指纹就变，旧标签必须整组清空。
    await handle.syncRoot(scanPayload(folderPath, [scanEntry('a.mp3', { mtime: 1800000000000 })]));
    loaded = handle.loadRoot(folderPath);
    record = store.buildIndexRecordFromFileRow(loaded.files[0]);
    assert.equal(record.name, '');
    assert.equal(record.artist, '');
    assert.equal(record.genre, '');
    assert.equal(record.duration, 0);
    assert.equal(record.localMetadataLoaded, false);
    assert.equal(record.fileSignature, 'd:/music/a.mp3|1024|1800000000000');
  });
}

/**
 * 换路径但指纹相同（改名 / 移动目录）时按指纹兜底命中，索引不丢。
 * @returns {Promise<void>}
 */
async function testIndexFallsBackToFingerprint() {
  await withStore(async (handle) => {
    const folderPath = 'D:\\Music';
    await handle.syncRoot(scanPayload(folderPath, [scanEntry('a.mp3', { songKey: '' })]));
    const saved = handle.saveIndexRecords(folderPath, [{
      key: '',
      pathKey: 'd:/music/a.mp3',
      fileSignature: 'd:/music/a.mp3|1024|1700000000000',
      name: '按指纹命中',
      updatedAt: Date.now(),
    }]);
    assert.equal(saved.saved, 1);
    const loaded = handle.loadRoot(folderPath);
    assert.equal(store.buildIndexRecordFromFileRow(loaded.files[0]).name, '按指纹命中');

    const missed = handle.saveIndexRecords(folderPath, [{ key: 'not-in-library', fileSignature: 'x|0|0', name: '不该命中' }]);
    assert.equal(missed.saved, 0);
    assert.equal(missed.missed, 1);
  });
}

/**
 * 旧路径 16000 条上限已经拿掉：两万条也必须原样 round-trip。
 * @returns {Promise<void>}
 */
async function testLargeLibraryRoundTrip() {
  await withStore(async (handle) => {
    const folderPath = 'D:\\Big';
    const files = [];
    for (let i = 0; i < 20000; i += 1) {
      files.push(scanEntry('t' + i + '.mp3', {
        pathKey: 'd:/big/t' + i + '.mp3',
        songKey: 'D:\\Big\\t' + i + '.mp3:1024:1700000000000',
        size: 1024 + i,
      }));
    }
    const synced = await handle.syncRoot(scanPayload(folderPath, files));
    assert.equal(synced.ok, true);
    assert.equal(synced.total, 20000);
    assert.equal(synced.audio, 20000);

    const loaded = handle.loadRoot(folderPath);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.files.length, 20000);
    // 有序返回：sort_index 就是扫描顺序，渲染层一次遍历即可组出快照。
    assert.equal(loaded.files[0].rel_path, 't0.mp3');
    assert.equal(loaded.files[19999].rel_path, 't19999.mp3');
    assert.equal(handle.getStatus().files, 20000);
  });
}

/**
 * 完整扫描剔除已删除文件；截断扫描不剔除，避免把没遍历到的文件当成删除。
 * @returns {Promise<void>}
 */
async function testPruneRespectsTruncatedScan() {
  await withStore(async (handle) => {
    const folderPath = 'D:\\Music';
    await handle.syncRoot(scanPayload(folderPath, [scanEntry('a.mp3'), scanEntry('b.mp3'), scanEntry('c.mp3')]));
    assert.equal(handle.loadRoot(folderPath).files.length, 3);

    const truncated = await handle.syncRoot(scanPayload(folderPath, [scanEntry('a.mp3')], { truncated: true }));
    assert.equal(truncated.removed, 0);
    assert.equal(handle.loadRoot(folderPath).files.length, 3);

    const full = await handle.syncRoot(scanPayload(folderPath, [scanEntry('a.mp3'), scanEntry('b.mp3')]));
    assert.equal(full.removed, 1);
    const rels = handle.loadRoot(folderPath).files.map((row) => row.rel_path);
    assert.deepEqual(rels, ['a.mp3', 'b.mp3']);
  });
}

/**
 * 封面以 BLOB 落盘、歌词带上路径键，两类缓存 round-trip 形状不变。
 * @returns {Promise<void>}
 */
async function testAssetAndLyricRoundTrip() {
  await withStore(async (handle) => {
    const cover = 'data:image/jpeg;base64,' + Buffer.from('fake-jpeg-bytes').toString('base64');
    const write = handle.writeAssetRecord({
      id: 'song-a',
      name: '歌名',
      artist: '歌手',
      album: '专辑',
      albumArtist: '专辑歌手',
      genre: '摇滚',
      year: '2001',
      trackNumber: '3',
      duration: 213.5,
      localFormat: 'mp3',
      localFileSize: 4096,
      localFileLastModified: 1700000000000,
      localBitrateKbps: 320,
      localLibraryPathKey: 'd:/music/a.mp3',
      localLibraryFileSignature: 'd:/music/a.mp3|4096|1700000000000',
      localMetadataLoaded: true,
      localMetadataTagSchema: 3,
      localCoverThumbDataUrl: cover,
      localCoverLoaded: true,
      localCoverSource: 'tag',
      schema: 3,
      savedAt: Date.now(),
      futureField: '未知字段也要保留',
    });
    assert.equal(write.ok, true);

    const read = handle.readAssetRecords(['song-a', 'song-missing']);
    assert.equal(read.ok, true);
    const asset = read.records['song-a'];
    assert.equal(asset.localCoverThumbDataUrl, cover);
    assert.equal(asset.genre, '摇滚');
    assert.equal(asset.duration, 213.5);
    assert.equal(asset.localCoverLoaded, true);
    assert.equal(asset.localMetadataTagSchema, 3);
    assert.equal(asset.futureField, '未知字段也要保留');
    assert.equal(read.records['song-missing'], undefined);

    const sqlite = require('node:sqlite');
    const probe = new sqlite.DatabaseSync(handle.filePath);
    try {
      const row = probe.prepare('SELECT cover_mime, cover_bytes, typeof(cover_data) AS kind, path_key FROM assets WHERE song_key=?').get('song-a');
      assert.equal(row.cover_mime, 'image/jpeg');
      assert.equal(row.kind, 'blob');
      assert.equal(Number(row.cover_bytes), Buffer.from('fake-jpeg-bytes').length);
      assert.equal(row.path_key, 'd:/music/a.mp3');
    } finally {
      probe.close();
    }

    assert.equal(handle.writeLyricRecord({
      id: 'song-a',
      localLyricText: '[00:01.00]第一行\n[00:05.00]第二行',
      localLyricLoaded: true,
      localLyricSource: 'tag',
      localLyricFileName: 'a.lrc',
      localLibraryPathKey: 'D:\\Music\\A.mp3',
      localLibraryFileSignature: 'd:/music/a.mp3|4096|1700000000000',
      schema: 1,
      savedAt: Date.now(),
    }).ok, true);
    const lyric = handle.readLyricRecords(['song-a']).records['song-a'];
    assert.equal(lyric.localLyricText, '[00:01.00]第一行\n[00:05.00]第二行');
    assert.equal(lyric.localLyricLoaded, true);
    assert.equal(lyric.localLyricSource, 'tag');

    const probe2 = new sqlite.DatabaseSync(handle.filePath);
    try {
      const row = probe2.prepare('SELECT path_key, fingerprint, bytes FROM lyrics WHERE song_key=?').get('song-a');
      // 渲染层 localLyricCacheSnapshot 必须带上这两个字段，否则歌词行的路径键为空、按路径回收找不到。
      assert.equal(row.path_key, 'd:/music/a.mp3');
      assert.equal(row.fingerprint, 'd:/music/a.mp3|4096|1700000000000');
      assert.ok(Number(row.bytes) > 0);
    } finally {
      probe2.close();
    }
  });
}

/**
 * 播放次数累加、最近播放取最大值、收藏状态可来回切，且都不被重扫清零。
 * @returns {Promise<void>}
 */
async function testPlayStatsAndFavorite() {
  await withStore(async (handle) => {
    const key = 'D:\\Music\\A.mp3:1024:1700000000000';
    assert.equal(handle.bumpPlayStat({}).ok, false);

    const first = handle.bumpPlayStat({ key: key, pathKey: 'D:\\Music\\A.mp3', plays: 1, listenMs: 30000, completed: 0, lastPlayedAt: 1000, name: '歌名', artist: '歌手' });
    assert.equal(first.ok, true);
    assert.equal(first.stat.plays, 1);
    assert.equal(first.stat.listenMs, 30000);
    assert.equal(first.stat.pathKey, 'd:/music/a.mp3');

    const second = handle.bumpPlayStat({ key: key, plays: 1, listenMs: 15000, completed: 1, lastPlayedAt: 5000 });
    assert.equal(second.stat.plays, 2);
    assert.equal(second.stat.listenMs, 45000);
    assert.equal(second.stat.completed, 1);
    assert.equal(second.stat.lastPlayedAt, 5000);
    // 迟到的结算不能把最近播放拉回过去。
    assert.equal(handle.bumpPlayStat({ key: key, plays: 1, lastPlayedAt: 2000 }).stat.lastPlayedAt, 5000);
    // 后续负载没带名字时不覆盖已有的名字。
    assert.equal(handle.readStats({ keys: [key] }).stats[key].name, '歌名');

    assert.equal(handle.setFavorite({ key: key, pathKey: 'D:\\Music\\A.mp3', favorite: true, name: '歌名', artist: '歌手' }).stat.favorite, true);
    // 收藏不动播放次数。
    assert.equal(handle.readStats({ keys: [key] }).stats[key].plays, 3);
    const removed = handle.setFavorite({ key: key, favorite: false });
    assert.equal(removed.stat.favorite, false);
    assert.equal(removed.stat.favoriteAt, 0);

    // 重扫整根后统计仍在：song_stats 独立于 files 表存活。
    await handle.syncRoot(scanPayload('D:\\Music', [scanEntry('a.mp3')]));
    assert.equal(handle.readStats({ keys: [key] }).stats[key].plays, 3);
    assert.equal(handle.clearRoot('D:\\Music').ok, true);
    assert.equal(handle.readStats({ keys: [key] }).stats[key].plays, 3);
    assert.equal(handle.getStatus().stats, 1);
  });
}

/**
 * 回收时受保护键先被顶到最新，因此正在播放的曲目不会被自己触发的这次回收清掉。
 * @returns {Promise<void>}
 */
async function testTrimProtectsActiveKeys() {
  await withStore(async (handle) => {
    const cover = 'data:image/jpeg;base64,' + Buffer.from('x'.repeat(64)).toString('base64');
    const now = Date.now();
    for (let i = 0; i < 5; i += 1) {
      // 时间戳必须落在过期窗口内，否则先被 maxAge 规则清掉，测不到条数上限这条路。
      handle.writeAssetRecord({ id: 'song-' + i, localCoverThumbDataUrl: cover, savedAt: now - i * 1000 });
      handle.writeLyricRecord({ id: 'song-' + i, localLyricText: '歌词', savedAt: now - i * 1000 });
    }
    const trimmed = handle.trim({ assetMaxRecords: 2, lyricMaxRecords: 2, protectedKeys: ['song-4'] });
    assert.equal(trimmed.ok, true);
    const kept = Object.keys(handle.readAssetRecords(['song-0', 'song-1', 'song-2', 'song-3', 'song-4']).records);
    // song-4 本来最旧，受保护后 saved_at 被顶到当前时间，因此这轮回收留下的是它和次新的 song-0。
    assert.ok(kept.includes('song-4'), '受保护键必须留下');
    assert.equal(kept.length, 2);
    assert.equal(Object.keys(handle.readLyricRecords(['song-0', 'song-1', 'song-2', 'song-3', 'song-4']).records).includes('song-4'), true);

    // 按字节上限回收：留下的封面总字节数不超过上限。
    handle.trim({ assetMaxBytes: 1, protectedKeys: [] });
    assert.equal(Object.keys(handle.readAssetRecords(['song-0', 'song-1', 'song-2', 'song-3', 'song-4']).records).length, 0);
  });
}

/**
 * 过期回收按 saved_at 走；未标注时间的记录不被误删。
 * @returns {Promise<void>}
 */
async function testTrimExpiresByAge() {
  await withStore(async (handle) => {
    handle.writeAssetRecord({ id: 'old', localCoverThumbDataUrl: '', savedAt: 1 });
    handle.writeAssetRecord({ id: 'fresh', localCoverThumbDataUrl: '', savedAt: Date.now() });
    handle.writeAssetRecord({ id: 'unstamped', localCoverThumbDataUrl: '' });
    handle.trim({ maxAgeMs: 1000 });
    const records = handle.readAssetRecords(['old', 'fresh', 'unstamped']).records;
    assert.equal(records.old, undefined);
    assert.ok(records.fresh);
    assert.ok(records.unstamped, 'saved_at 为 0 的记录不参与过期回收');
  });
}

/**
 * 运行时缺少 node:sqlite 时整层降级为不可用，所有接口返回错误而不抛异常。
 * @returns {Promise<void>}
 */
async function testGracefulUnavailable() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mineradio-library-db-off-'));
  const modulePath = require.resolve('../desktop/local-library-store.js');
  const Module = require('node:module');
  const originalLoad = Module._load;
  // 内置模块不过 _resolveFilename，只有 _load 这一层能模拟「运行时没有 node:sqlite」。
  Module._load = function blockSqlite(request, parent, isMain) {
    if (request === 'node:sqlite') {
      const error = new Error("Cannot find module 'node:sqlite'");
      error.code = 'MODULE_NOT_FOUND';
      throw error;
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[modulePath];
  try {
    const offline = require(modulePath);
    assert.equal(offline.isLocalLibraryStoreSupported(), false);
    const handle = offline.createLocalLibraryStore({ directory: dir });
    assert.equal(handle.isAvailable(), false);
    const status = handle.getStatus();
    assert.equal(status.ok, false);
    assert.equal(status.available, false);
    assert.equal(status.supported, false);
    assert.equal(status.error, 'SQLITE_UNAVAILABLE');
    assert.equal((await handle.syncRoot(scanPayload('D:\\Music', [scanEntry('a.mp3')]))).ok, false);
    assert.equal(handle.loadRoot('D:\\Music').ok, false);
    assert.equal(handle.saveIndexRecords('D:\\Music', [{ key: 'k' }]).ok, false);
    assert.equal(handle.readAssetRecords(['k']).ok, false);
    assert.equal(handle.writeAssetRecord({ id: 'k' }).ok, false);
    assert.equal(handle.readLyricRecords(['k']).ok, false);
    assert.equal(handle.writeLyricRecord({ id: 'k' }).ok, false);
    assert.equal(handle.bumpPlayStat({ key: 'k' }).ok, false);
    assert.equal(handle.setFavorite({ key: 'k' }).ok, false);
    assert.equal(handle.readStats({}).ok, false);
    assert.equal(handle.trim({}).ok, false);
    assert.equal(handle.clearRoot('D:\\Music').ok, false);
    handle.close();
    assert.equal(fs.existsSync(path.join(dir, offline.LOCAL_LIBRARY_DB_FILE_NAME)), false);
  } finally {
    Module._load = originalLoad;
    delete require.cache[modulePath];
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_e) {}
  }
}

/**
 * 路径键与指纹的构造必须和渲染层同构，否则两侧命不中同一条记录。
 * @returns {void}
 */
function testKeyNormalization() {
  assert.equal(store.normalizeStorePathKey('D:\\Music\\\\A.mp3 '), 'd:/music/a.mp3');
  assert.equal(store.makeStoreFingerprint('d:/music/a.mp3', '1024', '1700000000000'), 'd:/music/a.mp3|1024|1700000000000');
  assert.equal(store.makeStoreFingerprint('', 1024, 1), '');
  assert.equal(store.makeStoreFingerprint('d:/a.mp3', null, undefined), 'd:/a.mp3|0|0');
  assert.deepEqual(store.splitCoverDataUrl('not-a-data-url'), { mime: '', bytes: null });
  assert.equal(store.joinCoverDataUrl('image/png', null), '');
}

test('SQLite 曲库建库写好 schema 版本、表与组合索引', testSchemaAndStatus);
test('索引回写走组合索引而不是整根扫描', testIndexUpdatePlanUsesCompositeIndex);
test('指纹一致保留元数据、指纹变化整组清空', testFingerprintReuseAndWipe);
test('索引回写可按文件指纹兜底命中', testIndexFallsBackToFingerprint);
test('两万首曲库可原样落盘并有序读回', testLargeLibraryRoundTrip);
test('完整扫描剔除删除文件而截断扫描不剔除', testPruneRespectsTruncatedScan);
test('封面 BLOB 与歌词缓存 round-trip 形状不变', testAssetAndLyricRoundTrip);
test('播放次数累加、最近播放取最大值、收藏可切换', testPlayStatsAndFavorite);
test('缓存回收保护正在使用的键并遵守字节上限', testTrimProtectsActiveKeys);
test('缓存回收按 saved_at 过期且跳过未标注记录', testTrimExpiresByAge);
test('缺少 node:sqlite 时整层降级且不抛异常', testGracefulUnavailable);
test('路径键与文件指纹构造与渲染层同构', testKeyNormalization);
