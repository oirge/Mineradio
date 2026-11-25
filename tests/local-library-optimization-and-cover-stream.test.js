'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const vm = require('node:vm');

const storeModule = require('../desktop/local-library-store.js');
const appSource = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');

function slice(startMarker, endMarker) {
  const from = appSource.indexOf(startMarker);
  const to = appSource.indexOf(endMarker, from + 1);
  assert.ok(from >= 0 && to > from, `Missing slice markers: ${startMarker} -> ${endMarker}`);
  return appSource.slice(from, to);
}

test('SQLite 批量写入单事务保存并支持流式封面标记与 BLOB 保留', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mnr-opt-store-'));
  const handle = storeModule.createLocalLibraryStore({ directory: dir });
  try {
    const coverA = 'data:image/jpeg;base64,' + Buffer.from('jpeg-cover-bytes-a').toString('base64');
    const coverB = 'data:image/png;base64,' + Buffer.from('png-cover-bytes-b').toString('base64');
    const batchWrite = handle.writeAssetRecords([
      { id: 'song-a', name: 'A', artist: 'Artist A', localCoverThumbDataUrl: coverA, localCoverLoaded: true, savedAt: Date.now() },
      { id: 'song-b', name: 'B', artist: 'Artist B', localCoverThumbDataUrl: coverB, localCoverLoaded: true, savedAt: Date.now() },
      { id: 'song-no-cover', name: 'C', artist: 'Artist C', localCoverThumbDataUrl: '', localCoverLoaded: true, savedAt: Date.now() },
    ]);
    assert.deepEqual(batchWrite, { ok: true, saved: 3, total: 3 });

    // 元数据轻量回写通知保留既有 BLOB，不可清空之前存储的封面字节。
    const preserveWrite = handle.writeAssetRecords([
      { id: 'song-a', name: 'A Updated', artist: 'Artist A', localCoverThumbDataUrl: '', localCoverLoaded: true, preserveExistingCover: true, savedAt: Date.now() },
    ]);
    assert.deepEqual(preserveWrite, { ok: true, saved: 1, total: 1 });

    const streamedRead = handle.readAssetRecords(['song-a', 'song-b', 'song-no-cover'], { skipInlineCover: true });
    assert.equal(streamedRead.ok, true);
    assert.equal(streamedRead.records['song-a'].name, 'A Updated');
    assert.equal(streamedRead.records['song-a'].localCoverThumbDataUrl, '');
    assert.equal(streamedRead.records['song-a'].localCoverHasThumb, true);
    assert.equal(streamedRead.records['song-no-cover'].localCoverHasThumb, false);

    const coverBlobA = handle.readAssetCover('song-a');
    assert.equal(coverBlobA.mime, 'image/jpeg');
    assert.equal(coverBlobA.bytes.toString('utf8'), 'jpeg-cover-bytes-a');
    assert.equal(handle.readAssetCover('song-no-cover'), null);

    const batchLyrics = handle.writeLyricRecords([
      { id: 'song-a', localLyricText: '[00:01.00]Row 1', localLyricLoaded: true, savedAt: Date.now() },
      { id: 'song-b', localLyricText: '[00:02.00]Row 2', localLyricLoaded: true, savedAt: Date.now() },
    ]);
    assert.deepEqual(batchLyrics, { ok: true, saved: 2, total: 2 });
    const lyricRead = handle.readLyricRecords(['song-a', 'song-b']);
    assert.equal(lyricRead.records['song-a'].localLyricText, '[00:01.00]Row 1');
    assert.equal(lyricRead.records['song-b'].localLyricText, '[00:02.00]Row 2');
  } finally {
    handle.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('hydrateLocalAssetCacheForSongRange 采用 O(N) 批量同步且支持 localCoverThumbUrl 传递', async () => {
  const count = 600;
  const songs = [];
  const queueCopies = [];
  const records = {};
  let maintenanceInvalidations = 0;
  let coverLookupReads = 0;
  for (let i = 0; i < count; i++) {
    const key = 'song-' + i;
    const rawSong = {
      type: 'local', localKey: key, name: 'Raw ' + i,
      localCoverThumbDataUrl: '', localCoverThumbUrl: '', localMetadataLoaded: false,
      localCoverLoaded: false, localCoverFile: null, localLyricFile: null,
    };
    songs.push(new Proxy(rawSong, {
      get(target, prop) {
        if (prop === 'localKey') coverLookupReads++;
        return target[prop];
      },
    }));
    queueCopies.push({ type: 'local', localKey: key, name: 'Raw ' + i, localCoverThumbDataUrl: '', localCoverThumbUrl: '' });
    records[key] = {
      id: key, name: 'Tag ' + i, artist: 'Artist ' + i, localMetadataLoaded: true, localMetadataTagSchema: 9,
      localCoverLoaded: true, localCoverHasThumb: true,
      localCoverThumbUrl: 'http://127.0.0.1:3000/api/local-cover?token=t&key=' + key,
    };
  }
  const hydrationSrc = slice('function applyLocalAssetCacheToSong(', 'async function hydrateLocalAssetCacheForSongs(');
  const syncSrc = slice('function syncLocalSongAssetFields(', 'async function readLocalBeatCacheForSong(');
  const context = {
    Object, Array, Promise, Math, Number, String, console,
    localLibrarySongs: songs,
    playQueue: queueCopies,
    playlist: queueCopies,
    LOCAL_METADATA_TAG_SCHEMA: 9,
    LOCAL_METADATA_TEXT_FIELDS: ['name', 'artist', 'album', 'albumArtist', 'trackNumber', 'genre', 'year'],
    LOCAL_METADATA_VALUE_FIELDS: ['duration', 'localFormat', 'localFileSize', 'localFileLastModified', 'localBitrateKbps'],
    localAssetCacheKey: (song) => song && song.localKey,
    canUseCachedLocalMetadata: () => true,
    localAssetFileSignature: () => '',
    invalidateSongCoverCache: () => {},
    noteLocalLibraryMaintenanceAssetChange: () => { maintenanceInvalidations++; },
    shouldRetainLocalLyricText: () => false,
    releaseLocalLyricText: () => false,
    clearLocalLyricTextResidency: () => {},
    isLocalSourcePlaceholderMetadata: () => false,
    readLocalAssetCacheRecords: async () => records,
    readLocalLyricCacheRecords: async () => ({}),
  };
  vm.runInNewContext(syncSrc + '\n' + hydrationSrc + '\nthis.hydrateRange = hydrateLocalAssetCacheForSongRange;', context);

  const updated = await context.hydrateRange(songs, 0, count, { includeLyrics: false });
  assert.equal(updated, count);
  assert.equal(maintenanceInvalidations, 1, '整块水合应仅通知一次维护名单失效');
  assert.equal(queueCopies[0].name, 'Tag 0');
  assert.equal(queueCopies[599].localCoverThumbUrl, 'http://127.0.0.1:3000/api/local-cover?token=t&key=song-599');
  assert.equal(queueCopies[599].localCoverThumbDataUrl, '');
  assert.ok(coverLookupReads < count * 12, `线性批同步不应出现 O(N²) 键读取，实际=${coverLookupReads}`);
});

test('/api/local-cover 校验令牌并返回隔离安全响应头', async () => {
  const token = 'test-local-cover-token-123456';
  process.env.MINERADIO_LOCAL_FILE_TOKEN = token;
  process.env.HOST = '127.0.0.1';
  process.env.PORT = '0';
  const server = require('../server.js');
  if (!server.listening) await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  const port = server.address().port;
  const get = (p) => new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: p }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
  try {
    server.setLocalCoverReader((key) => key === 'cover-k' ? { mime: 'image/png', bytes: Buffer.from('PNG_BYTES') } : null);
    const denied = await get('/api/local-cover?token=bad&key=cover-k');
    assert.equal(denied.status, 403);
    const missing = await get('/api/local-cover?token=' + token + '&key=unknown');
    assert.equal(missing.status, 404);
    const hit = await get('/api/local-cover?token=' + token + '&key=cover-k');
    assert.equal(hit.status, 200);
    assert.equal(hit.headers['content-type'], 'image/png');
    assert.equal(hit.headers['x-content-type-options'], 'nosniff');
    assert.match(hit.headers['content-security-policy'], /sandbox/);
    assert.equal(hit.body.toString('utf8'), 'PNG_BYTES');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('renderLocalLibraryPlaylistPanel 在超过 120 个分组时启用 MineradioWindowedList', () => {
  const fnSrc = slice('function renderLocalLibraryPlaylistPanel(', 'function toggleLocalLibraryLike(');
  const groupEntries = Array.from({ length: 160 }, (_, idx) => ({ value: 'Artist ' + idx, count: idx + 1, cover: null }));
  let renderedWindow = null;
  const headEl = { innerHTML: '', __windowedHtml: '' };
  const windowEl = { getClientRects: () => [{ width: 320, height: 480 }] };
  const plEl = {
    innerHTML: '',
    querySelector: (sel) => (sel === '[data-windowed-library]' ? windowEl : (sel === '[data-windowed-library-head]' ? headEl : null)),
  };
  const context = {
    document: { getElementById: (id) => (id === 'pl-list' ? plEl : { id }) },
    window: {
      MineradioWindowedList: {
        supported: (_el, count) => count > 120,
        render: (_el, opts) => { renderedWindow = opts; },
        clear: () => {},
      },
    },
    localLibraryPlaylistSelection: 'library-group:artist',
    playlistPanelDirty: false,
    playlistRenderSeq: 0,
    playlistPanelLastDomSignature: '',
    SPECIAL_LIKED_PLAYLIST_ID: 'special-liked',
    normalizeLocalPlaylistKind: (k) => k,
    localPlaylistById: () => null,
    isLocalLibraryCategoryKind: () => true,
    localLibraryCategoryView: () => ({ mode: 'group', title: '艺术家', parent: 'library-home', def: { field: 'artist', icon: '♪', title: '艺术家' } }),
    isPlaylistPaneVisibleForRender: () => true,
    getSpecialLikedSongs: () => [],
    readLocalPlaylists: () => [],
    localPlaylistSongs: () => [],
    localLibraryCategoryStatMode: () => '',
    localLibraryGroupEntries: () => groupEntries,
    localLibraryCategoryHeadHtml: () => '<div>Head</div>',
    localLibraryCategoryCardHtml: (_k, _i, title) => '<div>' + title + '</div>',
    localLibraryValueKind: (_f, v) => 'library-value:' + v,
    songCoverSrc: () => '',
    songCoverSignature: () => '',
    localPlaylistsDomSignature: () => '0',
    localLibraryPlaylistDomSignature: () => '0',
    localLibraryCategoryDomSignature: () => 'group:160',
  };
  vm.runInNewContext(fnSrc + '\nthis.render = renderLocalLibraryPlaylistPanel;', context);
  context.render();
  assert.ok(renderedWindow, '超过 120 个分组应交给 MineradioWindowedList 分片渲染');
  assert.equal(renderedWindow.count, 160);
  assert.equal(renderedWindow.renderRow(12), '<div>Artist 12</div>');
});
