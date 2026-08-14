'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function readAppSource() {
  return fs.readFileSync(path.join(__dirname, '..', 'public', 'app.js'), 'utf8');
}

function readFunctionBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `未找到源码块: ${startMarker}`);
  return source.slice(start, end);
}

function createContext(initialPlaylists = []) {
  const source = readAppSource();
  const functions = readFunctionBlock(
    source,
    'function normalizeLocalPlaylistKind(kind)',
    'function localSongIndexByKey(songs, key)',
  );
  const storage = new Map([
    ['mineradio-local-playlists-v1', JSON.stringify(initialPlaylists)],
  ]);
  const songPath = (song) => String(song && (song.localFilePathAbsolute || song.localPath) || '').replace(/\\/g, '/').toLowerCase();
  const songKey = (song) => {
    if (!song) return '';
    if (song.localKey) return `local-key:${song.localKey}`;
    const localPath = songPath(song);
    return localPath ? `local-path:${localPath}` : `local-meta:${song.name || ''}|${song.artist || ''}`;
  };
  const context = {
    Array,
    Date,
    Math,
    Number,
    Object,
    String,
    SPECIAL_LIKED_PLAYLIST_ID: 'special-liked',
    LOCAL_PLAYLISTS_STORE_KEY: 'mineradio-local-playlists-v1',
    LOCAL_PLAYBACK_SOURCE_STORE_KEY: 'mineradio-local-playback-source-v1',
    localPlaylists: null,
    localPlaylistSongLookupCache: {
      source: null,
      length: -1,
      firstKey: '',
      lastKey: '',
      byKey: Object.create(null),
      byPath: Object.create(null),
    },
    localLibrarySongs: [],
    playQueue: [],
    localLibraryPlaylistSelection: 'library',
    localLibraryPlaybackSelection: 'library',
    playlistPanelLastDomSignature: '',
    localStorage: {
      getItem: (key) => storage.get(key) || null,
    },
    setPersistentLocalStorageItem: (key, value) => storage.set(key, value),
    document: {
      getElementById: () => null,
    },
    specialLikedSongPath: songPath,
    specialLikedSongKey: songKey,
    specialLikedSongRef: (song) => ({
      key: songKey(song),
      path: songPath(song),
      name: String(song && song.name || ''),
      artist: String(song && song.artist || ''),
    }),
    getSpecialLikedSongs: () => [],
    localSearchPool: () => context.localLibrarySongs,
  };
  vm.runInNewContext(
    `${functions}\nthis.api = { createLocalPlaylist, renameLocalPlaylist, deleteLocalPlaylist, addSongToLocalPlaylist, removeSongFromLocalPlaylist, localPlaylistById, localPlaylistHasSong, getLocalPlaylistSongsById, localPlaylistSongs, setLocalPlaybackPlaylistSelection };`,
    context,
  );
  return { context, storage };
}

test('独立歌单支持完整 CRUD，编辑时不改当前播放队列', () => {
  const { context, storage } = createContext();
  const queueSong = { type: 'local', localKey: 'playing', localPath: 'D:\\Music\\Playing.flac', name: 'Playing' };
  const songA = { type: 'local', localKey: 'a', localPath: 'D:\\Music\\A.flac', name: 'A', artist: '甲' };
  const songB = { type: 'local', localKey: 'b', localPath: 'D:\\Music\\B.flac', name: 'B', artist: '乙' };
  context.playQueue = [queueSong];
  context.localLibrarySongs = [songA, songB];

  const playlist = context.api.createLocalPlaylist(' 夜路 ', songA);
  assert.ok(playlist.id.startsWith('local-playlist:'));
  assert.equal(playlist.name, '夜路');
  assert.equal(context.api.addSongToLocalPlaylist(playlist.id, songB), true);
  assert.equal(context.api.addSongToLocalPlaylist(playlist.id, songB), false);
  assert.equal(context.api.localPlaylistHasSong(playlist.id, songA), true);
  assert.deepEqual(Array.from(context.api.getLocalPlaylistSongsById(playlist.id), (song) => song.name), ['A', 'B']);

  assert.equal(context.api.renameLocalPlaylist(playlist.id, '深夜驾驶'), true);
  assert.equal(context.api.localPlaylistById(playlist.id).name, '深夜驾驶');
  assert.equal(context.api.removeSongFromLocalPlaylist(playlist.id, songA), true);
  assert.deepEqual(Array.from(context.api.getLocalPlaylistSongsById(playlist.id), (song) => song.name), ['B']);
  assert.strictEqual(context.playQueue[0], queueSong);
  assert.equal(context.playQueue.length, 1);

  context.localLibraryPlaybackSelection = playlist.id;
  assert.equal(context.api.deleteLocalPlaylist(playlist.id), true);
  assert.equal(context.localLibraryPlaybackSelection, 'library');
  assert.equal(JSON.parse(storage.get('mineradio-local-playlists-v1')).length, 0);
  assert.strictEqual(context.playQueue[0], queueSong);
});

test('独立歌单按保存顺序和路径回退恢复歌曲，未解析引用不会被清理', () => {
  const initial = [{
    id: 'local-playlist:drive',
    name: '开车',
    createdAt: 1,
    updatedAt: 2,
    songRefs: [
      { key: 'local-key:old-b', path: 'd:/music/b.flac', name: 'B' },
      { key: 'local-key:missing', path: 'd:/music/missing.flac', name: 'Missing' },
      { key: 'local-key:a', path: 'd:/music/a.flac', name: 'A' },
    ],
  }];
  const { context, storage } = createContext(initial);
  const songA = { type: 'local', localKey: 'a', localPath: 'D:\\Music\\A.flac', name: 'A' };
  const songB = { type: 'local', localKey: 'new-b', localPath: 'D:\\Music\\B.flac', name: 'B' };
  context.localLibrarySongs = [songA, songB];

  const songs = context.api.getLocalPlaylistSongsById('local-playlist:drive');

  assert.deepEqual(Array.from(songs, (song) => song.name), ['B', 'A']);
  assert.equal(JSON.parse(storage.get('mineradio-local-playlists-v1'))[0].songRefs.length, 3);
});

test('独立歌单可作为播放来源，但只有播放动作才需要生成队列快照', () => {
  const initial = [{
    id: 'local-playlist:focus',
    name: '专注',
    songRefs: [{ key: 'local-key:a', path: 'd:/music/a.flac' }],
  }];
  const { context, storage } = createContext(initial);
  const songA = { type: 'local', localKey: 'a', localPath: 'D:\\Music\\A.flac', name: 'A' };
  context.localLibrarySongs = [songA];

  assert.strictEqual(context.api.localPlaylistSongs('local-playlist:focus')[0], songA);
  context.api.setLocalPlaybackPlaylistSelection('local-playlist:focus');
  assert.equal(context.localLibraryPlaybackSelection, 'local-playlist:focus');
  assert.equal(storage.get('mineradio-local-playback-source-v1'), 'local-playlist:focus');
  assert.equal(context.playQueue.length, 0);
});

test('收藏弹窗、左侧歌单页和 3D 歌单架都接入独立歌单', () => {
  const source = readAppSource();
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');

  assert.match(source, /function openCreateLocalPlaylistModal\(\)/);
  assert.match(source, /data-local-playlist-id=/);
  assert.match(source, /data-local-playlist-remove-index=/);
  assert.match(source, /items\.push\(makePlaylistShelfItem\(playlist\.id, playlist\.name/);
  assert.match(source, /var tracks = localPlaylistSongs\(playlistSourceKind\);/);
  assert.match(source, /items = items \|\| allItems;/);
  assert.match(source, /appendOption\('library', '全部音乐'/);
  assert.match(source, /appendOption\(SPECIAL_LIKED_PLAYLIST_ID, '特别喜欢'/);
  assert.match(source, /appendOption\(playlist\.id, playlist\.name/);
  assert.match(source, /selectLocalPlaybackPlaylistSource\(option\.getAttribute\('data-playback-playlist-kind'\)\)/);
  assert.match(html, /id="playlist-source-popover"/);
  assert.match(html, /id="playlist-source-list"[^>]*role="listbox"/);
});
