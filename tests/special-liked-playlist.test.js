'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function readFile(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function readFunctionSource(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `未找到函数源码: ${startMarker}`);
  return source.slice(start, end);
}

function createSpecialLikedContext(initialStorage = '[]') {
  const source = readFile('public/app.js');
  const functions = readFunctionSource(
    source,
    'function specialLikedSongPath(song)',
    'function isSongLiked(song)',
  );
  const storage = new Map([['mineradio-special-liked-playlist-v1', initialStorage]]);
  const context = {
    Array,
    Object,
    String,
    SPECIAL_LIKED_PLAYLIST_STORE_KEY: 'mineradio-special-liked-playlist-v1',
    specialLikedSongRefs: null,
    localLibraryReady: false,
    localLibrarySongs: [],
    playQueue: [],
    localStorage: {
      getItem: (key) => storage.get(key) || null,
    },
    setPersistentLocalStorageItem: (key, value) => storage.set(key, value),
    showToast: () => {},
  };
  vm.runInNewContext(`${functions}\nthis.api = { compactSpecialLikedSongRefs, readSpecialLikedSongRefs, toggleSpecialLikedSong, specialLikedSongRefIndex, getSpecialLikedSongs };`, context);
  return { context, storage };
}

test('特别喜欢支持添加、移除和引用去重', () => {
  const { context, storage } = createSpecialLikedContext();
  const song = { type: 'local', localKey: 'track-a', localPath: 'D:\\Music\\A.mp3', name: 'A', artist: '歌手' };

  assert.equal(context.api.toggleSpecialLikedSong(song), true);
  assert.equal(context.api.specialLikedSongRefIndex(song), 0);
  assert.equal(JSON.parse(storage.get('mineradio-special-liked-playlist-v1')).length, 1);

  const compacted = context.api.compactSpecialLikedSongRefs([
    { key: 'local-key:track-a', path: 'D:/Music/A.mp3' },
    { key: 'local-key:track-a', path: 'D:/Music/A.mp3' },
  ]);
  assert.equal(compacted.length, 1);

  assert.equal(context.api.toggleSpecialLikedSong(song), false);
  assert.equal(context.api.specialLikedSongRefIndex(song), -1);
  assert.equal(JSON.parse(storage.get('mineradio-special-liked-playlist-v1')).length, 0);
});

test('特别喜欢可按本地路径回退恢复歌曲', () => {
  const refs = JSON.stringify([{ key: 'local-key:old-key', path: 'd:/music/a.mp3', name: 'A', artist: '歌手' }]);
  const { context } = createSpecialLikedContext(refs);
  const restored = { type: 'local', localKey: 'new-key', localPath: 'D:\\Music\\A.mp3', name: 'A', artist: '歌手' };
  context.localLibrarySongs = [restored];

  const songs = context.api.getSpecialLikedSongs();

  assert.equal(songs.length, 1);
  assert.strictEqual(songs[0], restored);
});

test('特别喜欢按保存引用顺序生成播放列表', () => {
  const refs = JSON.stringify([
    { key: 'local-key:b', path: 'd:/music/b.mp3' },
    { key: 'local-key:a', path: 'd:/music/a.mp3' },
    { key: 'local-key:stale', path: 'd:/music/a.mp3' },
  ]);
  const { context } = createSpecialLikedContext(refs);
  const songA = { type: 'local', localKey: 'a', localPath: 'D:\\Music\\A.mp3', name: 'A' };
  const songB = { type: 'local', localKey: 'b', localPath: 'D:\\Music\\B.mp3', name: 'B' };
  context.localLibraryReady = true;
  context.localLibrarySongs = [songA, songB];

  const songs = context.api.getSpecialLikedSongs();

  assert.deepEqual(Array.from(songs, (song) => song.name), ['B', 'A']);
});

test('选择特别喜欢后播放范围只使用该歌单', () => {
  const source = readFile('public/app.js');
  const playbackSource = readFunctionSource(
    source,
    'function normalizeLocalPlaylistKind(kind)',
    'function updateLocalPlaybackPlaylistSourceButton()',
  );
  const likedSongs = [{ name: '喜欢一' }, { name: '喜欢二' }];
  const librarySongs = [{ name: '全部一' }];
  const context = {
    SPECIAL_LIKED_PLAYLIST_ID: 'special-liked',
    localLibraryPlaylistSelection: 'special-liked',
    localLibraryPlaybackSelection: 'special-liked',
    getSpecialLikedSongs: () => likedSongs,
    localSearchPool: () => librarySongs,
  };
  vm.runInNewContext(`${playbackSource}\nthis.playlistSongs = localLibraryPlaylistSongs;this.playbackSongs = localLibraryPlaybackSongs;`, context);

  assert.strictEqual(context.playbackSongs(), likedSongs);
  context.localLibraryPlaylistSelection = 'library';
  assert.strictEqual(context.playlistSongs(), librarySongs);
  assert.strictEqual(context.playbackSongs(), likedSongs);
  context.localLibraryPlaybackSelection = 'library';
  assert.strictEqual(context.playbackSongs(), librarySongs);
});

test('播放来源选择会持久化，并在本地曲库恢复时优先读取', () => {
  const appSource = readFile('public/app.js');

  assert.match(appSource, /var LOCAL_PLAYBACK_SOURCE_STORE_KEY = 'mineradio-local-playback-source-v1';/);
  assert.match(appSource, /LOCAL_PLAYBACK_SOURCE_STORE_KEY,\n/);
  assert.match(appSource, /function readSavedLocalPlaybackPlaylistSelection\(\)/);
  assert.match(appSource, /setPersistentLocalStorageItem\(LOCAL_PLAYBACK_SOURCE_STORE_KEY, localLibraryPlaybackSelection\)/);
  assert.match(appSource, /var playbackSource = opts\.restored \? readSavedLocalPlaybackPlaylistSelection\(\) : 'library';/);
  assert.match(appSource, /restorePlaybackSessionForLocalLibrary\(playQueue,/);
});

test('控制栏按钮在普通歌单和特别喜欢之间切换', () => {
  const source = readFile('public/app.js');
  const helperSource = readFunctionSource(
    source,
    'function localSongIndexByKey(songs, key)',
    'function localPlaybackQueueMatchesSongs(songs)',
  );
  const toggleSource = readFunctionSource(
    source,
    'function toggleLocalPlaybackPlaylistSource()',
    'function selectLocalPlaylist(kind)',
  );
  const calls = [];
  const context = {
    SPECIAL_LIKED_PLAYLIST_ID: 'special-liked',
    localLibraryPlaybackSelection: 'library',
    currentCoverSong: () => ({ localKey: 'current' }),
    audio: { currentTime: 18.25 },
    queueItemKey: (song) => song && song.localKey ? `local:${song.localKey}` : '',
    localPlaylistSongs: (kind) => kind === 'special-liked' ? [{ name: '喜欢一' }] : [{ name: '普通一', localKey: 'current' }],
    playLocalLibrarySong: (index, kind, opts) => { calls.push([index, kind, opts]); return true; },
    showToast: () => {},
  };
  vm.runInNewContext(`${helperSource}\n${toggleSource}\nthis.toggleSource = toggleLocalPlaybackPlaylistSource;`, context);

  context.toggleSource();
  context.localLibraryPlaybackSelection = 'special-liked';
  context.toggleSource();

  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 0);
  assert.equal(calls[0][1], 'special-liked');
  assert.equal(calls[0][2].resumeAt, 0);
  assert.equal(calls[1][0], 0);
  assert.equal(calls[1][1], 'library');
  assert.equal(calls[1][2].resumeAt, 18.25);

  context.localLibraryPlaybackSelection = 'library';
  context.localPlaylistSongs = () => [];
  context.toggleSource();
  assert.equal(calls.length, 2);
});

test('播放队列顺序变化会判定为不一致', () => {
  const source = readFile('public/app.js');
  const helperSource = readFunctionSource(
    source,
    'function localSongIndexByKey(songs, key)',
    'function toggleLocalPlaybackPlaylistSource()',
  );
  const context = {
    playQueue: [{ localKey: 'a' }, { localKey: 'b' }],
    queueItemKey: (song) => song && song.localKey ? `local:${song.localKey}` : '',
  };
  vm.runInNewContext(`${helperSource}\nthis.matches = localPlaybackQueueMatchesSongs;`, context);

  assert.equal(context.matches([{ localKey: 'a' }, { localKey: 'b' }]), true);
  assert.equal(context.matches([{ localKey: 'b' }, { localKey: 'a' }]), false);
});

test('播放来源未变化时不会重复持久化', () => {
  const source = readFile('public/app.js');
  const selectionSource = readFunctionSource(
    source,
    'function setLocalPlaybackPlaylistSelection(kind)',
    'function localSongIndexByKey(songs, key)',
  );
  const writes = [];
  const context = {
    localLibraryPlaybackSelection: 'library',
    normalizeLocalPlaylistKind: (kind) => kind === 'special-liked' ? 'special-liked' : 'library',
    setPersistentLocalStorageItem: (key, value) => writes.push([key, value]),
    updateLocalPlaybackPlaylistSourceButton: () => {},
    LOCAL_PLAYBACK_SOURCE_STORE_KEY: 'playback-source',
  };
  vm.runInNewContext(`${selectionSource}\nthis.select = setLocalPlaybackPlaylistSelection;`, context);

  context.select('library');
  context.select('library');
  context.select('special-liked');

  assert.deepEqual(writes, [['playback-source', 'special-liked']]);
});

test('失效喜欢引用会清理，曲库未加载时不会误清理', () => {
  const refs = JSON.stringify([
    { key: 'local-key:valid', path: 'd:/music/valid.mp3' },
    { key: 'local-key:stale', path: 'd:/music/stale.mp3' },
  ]);
  const { context, storage } = createSpecialLikedContext(refs);
  const valid = { type: 'local', localKey: 'valid', localPath: 'D:\\Music\\Valid.mp3', name: 'Valid' };
  context.localLibraryReady = true;
  context.localLibrarySongs = [valid];

  const restored = context.api.getSpecialLikedSongs();
  assert.equal(restored.length, 1);
  assert.equal(restored[0].localKey, 'valid');
  const cleanedRefs = JSON.parse(storage.get('mineradio-special-liked-playlist-v1'));
  assert.equal(cleanedRefs.length, 1);
  assert.equal(cleanedRefs[0].key, 'local-key:valid');
  assert.equal(cleanedRefs[0].path, 'd:/music/valid.mp3');

  const unloaded = createSpecialLikedContext(refs);
  unloaded.context.localLibrarySongs = [];
  unloaded.context.playQueue = [];
  assert.equal(unloaded.context.api.getSpecialLikedSongs().length, 0);
  assert.equal(unloaded.storage.get('mineradio-special-liked-playlist-v1'), refs);
});

test('喜欢来源移除当前歌曲后重建队列并继续下一首', async () => {
  const source = readFile('public/app.js');
  const helperSource = readFunctionSource(
    source,
    'function localSongIndexByKey(songs, key)',
    'function localPlaybackQueueMatchesSongs(songs)',
  );
  const toggleSource = readFunctionSource(
    source,
    'async function toggleLikeSong(song)',
    'function toggleLikeCurrent()',
  );
  const current = { type: 'local', localKey: 'current', name: '当前' };
  const next = { type: 'local', localKey: 'next', name: '下一首' };
  const calls = [];
  const context = {
    SPECIAL_LIKED_PLAYLIST_ID: 'special-liked',
    localLibraryPlaybackSelection: 'special-liked',
    currentIdx: 0,
    playing: true,
    playQueue: [current],
    currentCoverSong: () => context.playQueue[context.currentIdx],
    queueItemKey: (song) => song && song.localKey ? `local:${song.localKey}` : '',
    isSongLiked: () => true,
    toggleSpecialLikedSong: () => { context.likedSongs = [next]; },
    localPlaylistSongs: () => context.likedSongs || [],
    setLocalPlaybackPlaylistSelection: (kind) => { context.localLibraryPlaybackSelection = kind; },
    cloneSongList: (songs) => songs.slice(),
    markQueueContentChanged: () => {},
    playQueueAt: (index, opts) => { calls.push([index, opts]); return Promise.resolve(); },
    updateControlTrackInfo: () => {},
    updateLikeButtons: () => {},
    refreshSearchResultActionStates: () => {},
    safeRenderQueuePanel: () => {},
    queueViewTab: 'queue',
    refreshUserPlaylists: () => {},
    miniQueueOpen: false,
    showToast: () => {},
  };
  vm.runInNewContext(`${helperSource}\n${toggleSource}\nthis.toggle = toggleLikeSong;`, context);

  await context.toggle(current);

  assert.deepEqual(context.playQueue, [next]);
  assert.equal(context.currentIdx, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 0);
  assert.equal(calls[0][1].manual, true);
});

test('本地模式显示歌单与红心入口并绑定特别喜欢事件', () => {
  const appSource = readFile('public/app.js');
  const css = readFile('public/app.css');
  const html = readFile('public/index.html');
  const localModeRule = readFunctionSource(
    css,
    'body.local-only-mode #user-btn,',
    'body.local-only-mode .tag-source.local',
  );

  assert.match(html, /id="tab-pl"[^>]*>歌单<\/button>/);
  assert.match(html, /id="playlist-source-btn"[^>]*onclick="toggleLocalPlaybackPlaylistSource\(\)"/);
  assert.match(html, /id="playlist-source-label">普通<\/span>/);
  assert.doesNotMatch(localModeRule, /#tab-pl|#pl-pane|#heart-btn|#search-results \.song-action-btn|#queue-pane/);
  assert.match(css, /#bottom-bar #playlist-source-btn\.special\{/);
  assert.match(css, /#bottom-bar #playlist-source-btn\.special:hover\{/);
  assert.match(appSource, /closest\('\[data-special-liked-play\]'\)/);
  assert.match(appSource, /closest\('\[data-special-liked-playlist\]'\)/);
  assert.doesNotMatch(appSource, /data-special-liked-play="1"[^>]*onclick="event\.stopPropagation\(\)"/);
});
