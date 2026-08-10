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

test('控制栏按钮在普通歌单和特别喜欢之间切换', () => {
  const source = readFile('public/app.js');
  const toggleSource = readFunctionSource(
    source,
    'function toggleLocalPlaybackPlaylistSource()',
    'function selectLocalPlaylist(kind)',
  );
  const calls = [];
  const context = {
    SPECIAL_LIKED_PLAYLIST_ID: 'special-liked',
    localLibraryPlaybackSelection: 'library',
    localPlaylistSongs: (kind) => kind === 'special-liked' ? [{ name: '喜欢一' }] : [{ name: '普通一' }],
    playLocalLibrarySong: (index, kind) => { calls.push([index, kind]); return true; },
    showToast: () => {},
  };
  vm.runInNewContext(`${toggleSource}\nthis.toggleSource = toggleLocalPlaybackPlaylistSource;`, context);

  context.toggleSource();
  context.localLibraryPlaybackSelection = 'special-liked';
  context.toggleSource();

  assert.deepEqual(calls, [[0, 'special-liked'], [0, 'library']]);

  context.localLibraryPlaybackSelection = 'library';
  context.localPlaylistSongs = () => [];
  context.toggleSource();
  assert.deepEqual(calls, [[0, 'special-liked'], [0, 'library']]);
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
