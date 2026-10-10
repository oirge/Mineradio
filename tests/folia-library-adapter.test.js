'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const source = fs.readFileSync(path.join(__dirname, '../vendor-src/folia/src/mineradio/library.ts'), 'utf8');
const executable = stripTypeScriptTypes(source.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, ''));
const track = (id, extra = {}) => ({ id, title: `Track ${id}`, artist: 'Artist', album: 'Album', duration: 12.5, cover: '', liked: false, filePath: `D:\\Music\\Album\\${id}.flac`, format: 'flac', ...extra });

function harness(initialTracks = [track('a'), track('b')], initialPlaylists = [{ id: 'special-liked', name: '特别喜欢', ids: ['b'], readOnly: true }]) {
    const tracks = initialTracks;
    const hostLists = initialPlaylists;
    const listeners = new Map();
    const calls = [];
    const makeTable = () => ({ rows: [], writes: 0, async clear() { this.rows = []; }, async bulkPut(rows) { this.rows = structuredClone(rows); this.writes++; }, async toArray() { return structuredClone(this.rows); } });
    const db = { local_music: makeTable(), local_library_entities: makeTable(), local_library_assignments: makeTable(), async transaction(_mode, _tables, callback) { return callback(); } };
    let serial = 0;
    let onRead = null;
    const window = new EventTarget();
    const context = vm.createContext({
        console, Event, window, appDatabase: db, isMineradioEmbedded: () => true,
        normalizeLocalLibraryName: value => value.normalize('NFKC').trim().toLowerCase(),
        splitLocalLibraryArtistNames: value => [...new Set(value.split(/[;；/／]/u).map(item => item.trim()).filter(Boolean))],
        subscribeHost: (name, callback) => { listeners.set(name, callback); return () => listeners.delete(name); },
        requestHost: async (method, params = {}) => {
            calls.push({ method, params: structuredClone(params) });
            if (method === 'listTracks') {
                if (onRead) { const callback = onRead; onRead = null; callback(); }
                const list = params.playlistId === 'library' ? tracks : (hostLists.find(list => list.id === params.playlistId)?.ids || []).map(id => tracks.find(track => track.id === id)).filter(Boolean);
                return { items: structuredClone(list.slice(params.offset, params.offset + params.limit)), total: list.length, offset: params.offset, limit: params.limit };
            }
            if (method === 'listPlaylists') return [{ id: 'library', name: '所有音乐', count: tracks.length, readOnly: true }, ...hostLists.map(list => ({ id: list.id, name: list.name, count: list.ids.length, readOnly: list.readOnly }))];
            if (method === 'createPlaylist') { const list = { id: `local-playlist:${++serial}`, name: params.name, ids: [] }; hostLists.push(list); return { ...list, count: 0 }; }
            if (method === 'setPlaylistTracks') { hostLists.find(list => list.id === params.playlistId).ids = [...params.trackIds]; return { ok: true }; }
            if (method === 'renamePlaylist') { hostLists.find(list => list.id === params.id).name = params.name; return { ok: true }; }
            if (method === 'deletePlaylist') { hostLists.splice(hostLists.findIndex(list => list.id === params.id), 1); return { ok: true }; }
            if (method === 'importFolder' || method === 'importFiles') { tracks.push(track('new')); return { ok: true }; }
            throw new Error(`Unexpected method ${method}`);
        },
    });
    vm.runInContext(`${executable}\nglobalThis.adapter = { hostTrackToLocalSong, buildHostCatalog, ensureMineradioLibrary, getMineradioPlaylists, createMineradioPlaylist, updateMineradioPlaylist, deleteMineradioPlaylist, importMineradioFiles };`, context);
    return { adapter: context.adapter, db, calls, tracks, hostLists, listeners, onRead: callback => { onRead = callback; } };
}

test('Folia projection preserves host identity, timing, cover URL and metadata without audio copies', () => {
    const { adapter } = harness();
    const song = adapter.hostTrackToLocalSong(track('stable:1', { artist: 'A / B', cover: 'blob:http://localhost/cover' }));
    assert.equal(song.id, 'stable:1');
    assert.equal(song.duration, 12500);
    assert.equal(song.filePath, 'D:/Music/Album/stable:1.flac');
    assert.equal(song.onlineMetadata.coverUrl, 'blob:http://localhost/cover');
    assert.equal(song.useOnlineCover, true);
    assert.equal(song.noAutoMatch, true);
    assert.deepEqual(Array.from(song.importedMetadata.artistNames), ['A', 'B']);
    assert.equal(song.fileHandle, undefined);
    assert.equal(song.matchedLyrics, undefined);
});

test('Folia hydrates paginated tracks once for concurrent readers and retains host favorite order', async () => {
    const tracks = Array.from({ length: 1005 }, (_, i) => track(String(i)));
    const h = harness(tracks, [{ id: 'special-liked', name: 'Favorites', ids: ['900', '1'], readOnly: true }]);
    await Promise.all([h.adapter.ensureMineradioLibrary(), h.adapter.ensureMineradioLibrary(), h.adapter.getMineradioPlaylists()]);
    assert.equal(h.db.local_music.rows.length, 1005);
    assert.equal(h.db.local_library_assignments.rows.length, 1005);
    assert.deepEqual(h.calls.filter(call => call.method === 'listTracks' && call.params.playlistId === 'library').map(call => call.params.offset), [0, 1000]);
    assert.deepEqual(Array.from((await h.adapter.getMineradioPlaylists())[0].songIds), ['900', '1']);
});

test('Folia retries a catalog snapshot invalidated by a host library event', async () => {
    const h = harness();
    h.onRead(() => { h.tracks.splice(0, h.tracks.length, track('latest')); h.listeners.get('libraryChanged')({ revision: 2 }); });
    await h.adapter.ensureMineradioLibrary();
    assert.deepEqual(h.db.local_music.rows.map(song => song.id), ['latest']);
    assert.equal(h.calls.filter(call => call.method === 'listTracks' && call.params.playlistId === 'library').length, 2);
    assert.equal(h.db.local_music.writes, 1);
});

test('Folia playlist creation, rename, reorder, favorites and deletion mutate the same host playlists', async () => {
    const h = harness();
    const created = await h.adapter.createMineradioPlaylist(' New list ', ['a', 'b', 'a']);
    assert.deepEqual(Array.from(created.songIds), ['a', 'b']);
    await h.adapter.updateMineradioPlaylist(created.id, playlist => ({ ...playlist, name: 'Renamed', songIds: ['b', 'a'] }));
    assert.equal(h.hostLists.find(list => list.id === created.id).name, 'Renamed');
    assert.deepEqual(h.hostLists.find(list => list.id === created.id).ids, ['b', 'a']);
    await h.adapter.updateMineradioPlaylist('special-liked', playlist => ({ ...playlist, songIds: ['a'] }));
    assert.deepEqual(h.hostLists.find(list => list.id === 'special-liked').ids, ['a']);
    await h.adapter.deleteMineradioPlaylist(created.id);
    assert.equal(h.hostLists.some(list => list.id === created.id), false);
    assert.equal(h.db.local_music.writes, 1, 'playlist-only changes must not rewrite the catalog');
});

test('Folia file import uses the host picker and reloads the host catalog', async () => {
    const h = harness();
    const songs = await h.adapter.importMineradioFiles('files');
    assert.equal(h.calls[0].method, 'importFiles');
    assert.equal(songs.some(song => song.id === 'new'), true);
});

function playbackHarness() {
    const storeSource = fs.readFileSync(path.join(__dirname, '../vendor-src/folia/src/stores/usePlaybackStore.ts'), 'utf8');
    const commands = [];
    const errors = [];
    const context = vm.createContext({
        PlayerState: { IDLE: 'IDLE' }, isMineradioEmbedded: () => true,
        hostSongId: song => song.localRef?.songId || null,
        reportHostPlaybackError: error => errors.push(error.message),
        reportHostManagedAudio: () => errors.push('host-managed'),
        hostPlaybackCommand: (method, params) => new Promise(resolve => commands.push({ method, params, resolve })),
        create: initializer => {
            let state;
            const setState = partial => { state = { ...state, ...partial }; };
            const getState = () => state;
            state = initializer(setState, getState);
            return { getState, setState };
        },
    });
    const code = stripTypeScriptTypes(storeSource.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, ''));
    vm.runInContext(`${code}\nglobalThis.store = usePlaybackStore;`, context);
    return { store: context.store, commands, errors };
}

test('Rapid Folia queue edits build on preceding edits before host acknowledgements', async () => {
    const h = playbackHarness();
    const song = id => ({ localRef: { songId: id } });
    h.store.setState({ playQueue: [song('a'), song('b'), song('c')] });
    h.store.getState().setPlayQueue(queue => queue.filter(item => item.localRef.songId !== 'a'));
    h.store.getState().setPlayQueue(queue => queue.filter(item => item.localRef.songId !== 'b'));
    assert.deepEqual(Array.from(h.commands[0].params.trackIds), ['b', 'c']);
    assert.deepEqual(Array.from(h.commands[1].params.trackIds), ['c']);
    h.commands.forEach(command => command.resolve({ currentTrack: null }));
    await Promise.resolve();
    assert.deepEqual(Array.from(h.store.getState().playQueue, item => item.localRef.songId), ['c']);
});

test('A rejected Folia queue edit restores the preceding state and online songs never enter it', async () => {
    const h = playbackHarness();
    const original = [{ localRef: { songId: 'a' } }];
    h.store.setState({ playQueue: original });
    h.store.getState().setPlayQueue([]);
    h.commands[0].resolve(null);
    await Promise.resolve();
    assert.equal(h.store.getState().playQueue, original);
    h.store.getState().setPlayQueue([{ id: 44 }]);
    assert.equal(h.commands.length, 1);
    assert.equal(h.errors.length, 1);
    h.store.getState().setReplayGainMode('album');
    assert.equal(h.store.getState().replayGainMode, 'off');
    assert.equal(h.errors.at(-1), 'host-managed');
});

test('Overlapping rejected queue edits restore the last accepted host queue', async () => {
    const h = playbackHarness();
    const original = [{ localRef: { songId: 'a' } }, { localRef: { songId: 'b' } }];
    h.store.setState({ playQueue: original });
    h.store.getState().setPlayQueue([original[1]]);
    h.store.getState().setPlayQueue([]);
    h.commands[1].resolve(null);
    h.commands[0].resolve(null);
    await Promise.resolve();
    assert.equal(h.store.getState().playQueue, original);

    const accepted = [original[0]];
    h.store.getState().setPlayQueue(accepted);
    h.store.getState().setPlayQueue([]);
    h.commands[3].resolve(null);
    h.commands[2].resolve({ currentTrack: null });
    await Promise.resolve();
    assert.equal(h.store.getState().playQueue, accepted);
});
