'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appSource = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const bridgeSource = fs.readFileSync(path.join(__dirname, '../public/folia-host.js'), 'utf8');
function block(start, end) {
    const from = appSource.indexOf(start);
    const to = appSource.indexOf(end, from);
    assert.ok(from >= 0 && to > from, `Missing host source: ${start}`);
    return appSource.slice(from, to);
}
const playlistSource = block('function normalizeLocalPlaylistKind(kind)', 'function localSongIndexByKey(songs, key)');
const favoriteSource = block('function specialLikedSongPath(song)', 'function isSongLiked(song)');
const volumeSource = block('function setVolume(value, silent)', 'function adjustVolumeByKeyboard(delta)');
const shuffleSource = block('function shufflePlayQueueOnce(opts)', '/**\n * 下一首');

function element(id, tagName = 'DIV') {
    const classes = new Set();
    return {
        id, tagName, inert: false, hidden: false, children: [], attributes: {}, listeners: new Map(), isConnected: true,
        classList: {
            toggle(name, force) { const value = force === undefined ? !classes.has(name) : force; value ? classes.add(name) : classes.delete(name); return value; },
            remove(name) { classes.delete(name); }, contains(name) { return classes.has(name); },
        },
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, callback) { this.listeners.set(name, callback); },
        appendChild(child) { this.children.push(child); child.parent = this; },
        remove() { this.parent.children.splice(this.parent.children.indexOf(this), 1); this.isConnected = false; },
        focus() {}, click() { this.clicks = (this.clicks || 0) + 1; },
    };
}

function harness() {
    const storage = new Map(), listeners = new Map(), timers = new Map(), messages = [], calls = [], dbFavorites = [];
    const mount = element('folia-interface'), status = element('folia-load-status'), original = element('renderer'), titlebar = element('desktop-titlebar');
    const fileInput = element('file-input', 'INPUT'); fileInput.type = 'file';
    const video = element('background', 'VIDEO');
    video.src = 'blob:background'; video.paused = false;
    video.pause = () => { video.paused = true; calls.push('video-pause'); };
    video.play = () => { video.paused = false; calls.push('video-play'); return Promise.resolve(); };
    const shell = element('desktop-window-shell'); shell.children = [titlebar, original, video, fileInput, mount];
    const nodes = new Map([shell, mount, status, fileInput].map(node => [node.id, node]));
    const button = element('switch', 'BUTTON');
    let timerId = 0, requestId = 0;
    const tracks = ['a', 'b', 'c'].map(id => ({ type: 'local', localKey: id, localPath: `D:/Music/${id}.flac`, name: `Track ${id}`, artist: 'Artist', album: 'Album', duration: 200, localFile: { privateAudio: true } }));
    const document = {
        hidden: false, body: element('body'), listeners: new Map(),
        getElementById: id => nodes.get(id) || null,
        querySelectorAll: query => query === '[data-folia-switch]' ? [button] : query === '#desktop-window-shell video' ? [video] : [],
        addEventListener(name, callback) { this.listeners.set(name, callback); },
        createElement(tag) {
            assert.equal(tag, 'iframe', 'the bridge must never create an audio element');
            const frame = element('', 'IFRAME');
            frame.contentWindow = { postMessage(data, origin) { messages.push({ ...structuredClone(data), origin }); } };
            return frame;
        },
    };
    const context = vm.createContext({
        console, document, location: { origin: 'http://127.0.0.1:3000' }, URL, Blob,
        addEventListener: (name, callback) => listeners.set(name, callback),
        setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
        clearTimeout: id => timers.delete(id),
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
        setPersistentLocalStorageItem: (key, value) => storage.set(key, value),
        localLibrarySongs: tracks, localLibraryReady: true, playQueue: tracks.map(song => ({ ...song })), currentIdx: 0,
        audio: { src: 'blob:host-audio', currentTime: 37, duration: 200, playbackRate: 1, volume: 1, paused: false, ended: false, muted: false },
        targetVolume: 0.65, lastNonZeroVolume: 0.65, playMode: 'loop', lyricsLines: [],
        SPECIAL_LIKED_PLAYLIST_ID: 'special-liked', SPECIAL_LIKED_PLAYLIST_STORE_KEY: 'favorites',
        LOCAL_PLAYLISTS_STORE_KEY: 'playlists', LOCAL_PLAYBACK_SOURCE_STORE_KEY: 'playback-source',
        localPlaylists: null, specialLikedSongRefs: null, localLibraryPlaylistSelection: 'library', localLibraryPlaybackSelection: 'library',
        localPlaylistSongLookupCache: { source: null, length: -1, firstKey: '', lastKey: '', byKey: Object.create(null), byPath: Object.create(null) },
        playlistPanelLastDomSignature: '', miniQueueOpen: false, shuffledPlayQueueArrays: new WeakSet(),
        songCoverSrc: song => song.cover || '', playbackDurationFromSong: song => song.duration,
        syncLocalLibraryDbFavorite: (song, liked) => dbFavorites.push({ id: song.localKey, liked }),
        cloneSong: song => ({ ...song }), cloneSongList: songs => songs.map(song => ({ ...song })),
        savePlaybackSession: () => calls.push('save-session'), clearLocalLibraryPassiveQueue: () => calls.push('clear-passive'),
        safeRenderQueuePanel: () => calls.push('render-queue'), safeShelfRebuild: () => calls.push('rebuild-shelf'),
        markQueueContentChanged() {}, updateLikeButtons() {}, showToast() {}, updateVolumeUi() {}, scheduleVolumePreference() {},
        suspendMainRenderLoop: () => calls.push('suspend-render'), resumeMainRenderLoop: () => calls.push('resume-render'),
        scheduleMainRendererViewportRefresh: () => calls.push('refresh-viewport'),
        syncBeatMapPlaybackCursor() {}, schedulePlaybackProgressUi() {},
        applyVolumeToAudio: () => { context.audio.muted = false; },
        getPlaybackCurrentSeconds: () => context.audio.currentTime,
        getPlaybackDurationSeconds: () => context.audio.duration,
        localSearchPool: () => context.localLibrarySongs,
        togglePlay: async () => { context.audio.paused = !context.audio.paused; },
        playQueueAt: async index => {
            calls.push('play-track');
            if (context.playMode === 'shuffle' && !context.shuffledPlayQueueArrays.has(context.playQueue)) {
                context.currentIdx = index; context.shufflePlayQueueOnce({ toast: false }); index = context.currentIdx;
            }
            context.currentIdx = index; context.currentLocalSong = context.playQueue[index]; context.audio.currentTime = 0;
        },
    });
    context.window = context;
    context.currentLocalSong = context.playQueue[0];
    vm.runInContext(`${playlistSource}\n${favoriteSource}\n${volumeSource}\n${shuffleSource}\n${bridgeSource}`, context);
    context.MineradioFoliaHost.setInterface('folia');
    const frame = () => mount.children[0];
    async function request(method, params = {}, envelope = {}) {
        const id = String(++requestId);
        await listeners.get('message')({ source: frame().contentWindow, origin: context.location.origin,
            data: { channel: 'mineradio-folia', version: 1, type: 'request', id, method, params }, ...envelope });
        return messages.find(message => message.type === 'response' && message.id === id);
    }
    function runTimer(delay) {
        const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay);
        assert.ok(entry, `Expected timer with ${delay}ms delay`);
        timers.delete(entry[0]); entry[1].callback();
    }
    return { context, tracks, document, mount, frame, status, original, titlebar, video, fileInput, storage, messages, calls, dbFavorites, timers, listeners, request, runTimer };
}

test('Folia host accepts only versioned messages from its iframe and exact origin', async () => {
    const h = harness();
    assert.equal(await h.request('setVolume', { volume: 0.2 }, { source: {} }), undefined);
    assert.equal(await h.request('setVolume', { volume: 0.2 }, { origin: 'https://other.example' }), undefined);
    assert.equal(await h.request('setVolume', { volume: 0.2 }, { data: { channel: 'mineradio-folia', version: 2, type: 'request', id: 'bad', method: 'setVolume' } }), undefined);
    assert.equal(h.context.targetVolume, 0.65);
    const response = await h.request('setVolume', { volume: 0.2 });
    assert.equal(response.ok, true);
    assert.equal(response.result.volume, 0.2);
    assert.equal(response.origin, h.context.location.origin);
});

test('local wall and visual preferences reach desktop backup only from host local storage', () => {
    const h = harness();
    const backedUp = [];
    h.context.backupPersistentUiState = patch => backedUp.push(structuredClone(patch));
    const onStorage = h.listeners.get('storage');
    for (const key of ['mineradio-folia-local-visuals-v1', 'mineradio-folia-local-lattice-v1']) {
        onStorage({ key, newValue: '{"state":{"enabled":false}}', storageArea: h.context.localStorage });
        onStorage({ key, newValue: 'wrong-area', storageArea: {} });
    }
    onStorage({ key: 'unrelated-preference', newValue: 'value', storageArea: h.context.localStorage });
    assert.deepEqual(backedUp, [
        { 'mineradio-folia-local-visuals-v1': '{"state":{"enabled":false}}' },
        { 'mineradio-folia-local-lattice-v1': '{"state":{"enabled":false}}' },
    ]);
});

test('Folia host projects paginated tracks without live audio or file objects', async () => {
    const h = harness();
    const response = await h.request('listTracks', { offset: 1, limit: 1 });
    assert.equal(response.result.total, 3);
    assert.deepEqual(response.result.items.map(song => song.id), ['local-key:b']);
    assert.equal(response.result.items[0].duration, 200);
    assert.equal('localFile' in response.result.items[0], false);
    assert.equal('src' in response.result.items[0], false);
    const search = await h.request('listTracks', { query: 'TRACK C', limit: 5000 });
    assert.equal(search.result.limit, 1000);
    assert.deepEqual(search.result.items.map(song => song.id), ['local-key:c']);
});

test('switching interfaces retains the iframe, audio graph, queue and playback position', async () => {
    const h = harness();
    await h.request('getState');
    const frame = h.frame(), audio = h.context.audio, queue = h.context.playQueue, song = h.context.currentLocalSong;
    assert.equal(h.original.inert, true);
    assert.equal(h.titlebar.inert, false);
    assert.equal(h.fileInput.inert, false);
    assert.equal(h.video.paused, true);
    h.context.MineradioFoliaHost.setInterface('mineradio');
    assert.equal(h.timers.size, 0, 'inactive Folia must not keep bridge polling timers');
    assert.equal(h.original.inert, false);
    assert.equal(h.video.paused, false);
    h.context.MineradioFoliaHost.setInterface('folia');
    assert.equal(h.frame(), frame);
    assert.equal(h.context.audio, audio);
    assert.equal(h.context.playQueue, queue);
    assert.equal(h.context.currentLocalSong, song);
    assert.equal(audio.currentTime, 37);
    assert.equal(audio.paused, false);
    assert.equal(h.calls.includes('play-track'), false);
});

test('a late successful Folia handshake survives a previous loading timeout', async () => {
    const h = harness();
    h.runTimer(20000);
    assert.equal(h.status.classList.contains('failed'), true);
    const frame = h.frame();
    await h.request('getState');
    assert.equal(h.status.classList.contains('failed'), false);
    h.context.MineradioFoliaHost.setInterface('mineradio');
    h.context.MineradioFoliaHost.setInterface('folia');
    assert.equal(h.frame(), frame, 'a recovered frame must retain its navigation and UI state');
});

test('editing the queue retains the loaded song object and ignores a requested current index', async () => {
    const h = harness();
    const current = h.context.currentLocalSong, media = h.context.audio;
    const response = await h.request('setQueue', { trackIds: ['local-key:c', 'local-key:a', 'local-key:b'], currentIndex: 0 });
    assert.equal(response.ok, true);
    assert.equal(h.context.currentIdx, 1);
    assert.equal(h.context.playQueue[1], current);
    assert.equal(h.context.currentLocalSong, current);
    assert.notEqual(h.context.playQueue[0], h.tracks[2]);
    await h.request('setQueue', { trackIds: ['local-key:b'] });
    assert.deepEqual(Array.from(h.context.playQueue, song => song.localKey), ['a', 'b']);
    assert.equal(h.context.playQueue[0], current);
    assert.equal(h.context.audio, media);
    assert.equal(media.currentTime, 37);
    assert.equal(h.calls.includes('play-track'), false);
});

test('an explicit queue edit keeps its order on the next play while shuffle is enabled', async () => {
    const h = harness();
    h.context.playMode = 'shuffle';
    await h.request('setQueue', { trackIds: ['local-key:c', 'local-key:a', 'local-key:b'] });
    assert.equal(h.context.shuffledPlayQueueArrays.has(h.context.playQueue), true);
    const before = Array.from(h.context.playQueue, song => song.localKey);
    await h.request('playQueue', { index: 2 });
    assert.deepEqual(Array.from(h.context.playQueue, song => song.localKey), before);
    assert.equal(h.context.currentLocalSong.localKey, 'b');
});

test('adding a local track appends atomically without replacing or seeking the playing media', async () => {
    const h = harness();
    h.context.playQueue.splice(1);
    const queue = h.context.playQueue, current = h.context.currentLocalSong, media = h.context.audio;
    const before = (await h.request('getState')).result;
    const response = await h.request('addToQueue', { id: 'local-key:b' });
    assert.equal(response.ok, true);
    assert.equal(h.context.playQueue, queue);
    assert.deepEqual(Array.from(queue, song => song.localKey), ['a', 'b']);
    assert.equal(queue[0], current);
    assert.notEqual(queue[1], h.tracks[1]);
    assert.equal(h.context.currentLocalSong, current);
    assert.equal(h.context.currentIdx, 0);
    assert.equal(h.context.audio, media);
    assert.equal(media.currentTime, 37);
    assert.equal(media.paused, false);
    assert.ok(response.result.queueRevision > before.queueRevision);
    assert.equal(h.calls.includes('play-track'), false);
    assert.ok(h.calls.includes('save-session'));
});

test('repeated or concurrent addToQueue requests keep a unique ordered queue', async () => {
    const h = harness();
    h.context.playQueue.splice(1);
    h.context.playMode = 'shuffle';
    const results = await Promise.all([
        h.request('addToQueue', { id: 'local-key:b' }),
        h.request('addToQueue', { id: 'local-key:b' }),
        h.request('addToQueue', { id: 'local-key:c' }),
    ]);
    assert.ok(results.every(result => result.ok));
    assert.deepEqual(Array.from(h.context.playQueue, song => song.localKey), ['a', 'b', 'c']);
    assert.equal(h.context.shuffledPlayQueueArrays.has(h.context.playQueue), true);
    const revision = (await h.request('getState')).result.queueRevision;
    await h.request('addToQueue', { id: 'local-key:a' });
    assert.equal((await h.request('getState')).result.queueRevision, revision);
    assert.equal(h.context.currentIdx, 0);
    assert.equal(h.context.audio.currentTime, 37);
});

test('addToQueue rejects missing tracks before mutation and does not auto-start an empty queue', async () => {
    const h = harness(), queue = h.context.playQueue;
    const invalid = await h.request('addToQueue', { id: 'missing' });
    assert.equal(invalid.error.code, 'TRACK_NOT_FOUND');
    assert.equal(h.context.playQueue, queue);
    assert.equal(queue.length, 3);
    assert.equal((await h.request('addToQueue', { id: null })).error.code, 'INVALID_TRACK');
    h.context.playQueue = [];
    h.context.currentIdx = -1;
    h.context.currentLocalSong = null;
    h.context.audio.src = '';
    h.context.audio.paused = true;
    const response = await h.request('addToQueue', { id: 'local-key:c' });
    assert.equal(response.ok, true);
    assert.deepEqual(Array.from(h.context.playQueue, song => song.localKey), ['c']);
    assert.equal(h.context.currentIdx, -1);
    assert.equal(h.context.audio.src, '');
    assert.equal(h.context.audio.paused, true);
    assert.equal(h.calls.includes('play-track'), false);
});

test('a queue edit without loaded media applies currentIndex and rejects invalid tracks atomically', async () => {
    const h = harness();
    h.context.audio.src = ''; h.context.currentLocalSong = null;
    await h.request('setQueue', { trackIds: ['local-key:b', 'local-key:c'], currentIndex: 9 });
    assert.equal(h.context.currentIdx, 1);
    const queue = h.context.playQueue;
    const invalid = await h.request('setQueue', { trackIds: ['local-key:a', 'missing'] });
    assert.equal(invalid.error.code, 'TRACK_NOT_FOUND');
    assert.equal(h.context.playQueue, queue);
});

test('getQueue includes the fresh revision when native code replaced the array between ticks', async () => {
    const h = harness();
    const before = await h.request('getQueue');
    h.context.playQueue = [h.tracks[2], h.tracks[1], h.tracks[0]];
    const after = await h.request('getQueue');
    assert.ok(after.result.revision > before.result.revision);
    assert.deepEqual(after.result.items.map(song => song.id), ['local-key:c', 'local-key:b', 'local-key:a']);
});

test('replacing a playback queue saves the old audio position until the new track has loaded', async () => {
    for (const loaded of [true, false]) {
        const h = harness(), saved = [];
        Object.assign(h.context, {
            playbackSessionSaveState: {}, PLAYBACK_SESSION_STORE_KEY: 'playback-session',
            savedLocalLibraryFolderPaths: () => [], savedLocalLibraryFolderPath: () => 'D:/Music',
            localPlaybackSessionSongKey: song => song ? song.localKey : '', recordSongResumeTick() {},
            setPersistentLocalStorageItem: (key, value) => {
                h.storage.set(key, value);
                if (key === 'playback-session') saved.push(JSON.parse(value));
            },
        });
        // Exercise the real persistence projection, including its queue/currentTime pairing.
        vm.runInContext(block('function writePlaybackSession() {', 'function savePlaybackSession(force)'), h.context);
        h.context.savePlaybackSession = () => h.context.writePlaybackSession();
        let finishLoading, shouldLoad = loaded;
        h.context.playQueueAt = async index => {
            await new Promise(resolve => { finishLoading = resolve; });
            if (shouldLoad) {
                h.context.currentIdx = index;
                h.context.currentLocalSong = h.context.playQueue[index];
                h.context.audio.currentTime = 0;
            }
        };
        const pending = h.request('play', { id: 'local-key:b', playlistId: 'library' });
        assert.deepEqual(saved.map(value => [value.songKey, value.currentTime]), [['a', 37]],
            'pending playback must not persist the target track with the old audio time');
        finishLoading();
        assert.equal((await pending).ok, true);
        assert.deepEqual(saved.map(value => [value.songKey, value.currentTime]), loaded ? [['a', 37], ['b', 0]] : [['a', 37]],
            'a failed load must leave the last valid session intact');
        assert.equal(JSON.parse(h.storage.get('playback-session')).songKey, loaded ? 'b' : 'a');
        if (!loaded) {
            shouldLoad = true;
            const retry = h.request('play', { id: 'local-key:c', playlistId: 'library' });
            assert.deepEqual(saved.map(value => [value.songKey, value.currentTime]), [['a', 37]],
                'retrying after a failed load must not persist its stale selected track');
            finishLoading();
            assert.equal((await retry).ok, true);
            assert.deepEqual(saved.map(value => [value.songKey, value.currentTime]), [['a', 37], ['c', 0]]);
        }
    }
});

test('Folia CRUD operates on real Mineradio playlists, persists ordered membership and preserves playback', async () => {
    const h = harness(), queue = h.context.playQueue;
    const created = await h.request('createPlaylist', { name: '  Night drive  ' });
    assert.equal(created.ok, true);
    const id = created.result.id;
    assert.equal(created.result.name, 'Night drive');
    await h.request('addToPlaylist', { playlistId: id, trackIds: ['local-key:a', 'local-key:b', 'local-key:a'] });
    await h.request('removeFromPlaylist', { playlistId: id, trackIds: ['local-key:a'] });
    assert.deepEqual((await h.request('listTracks', { playlistId: id })).result.items.map(song => song.id), ['local-key:b']);
    await h.request('setPlaylistTracks', { playlistId: id, trackIds: ['local-key:c', 'local-key:b', 'local-key:c'] });
    await h.request('renamePlaylist', { id, name: 'Evening' });
    assert.deepEqual(JSON.parse(h.storage.get('playlists'))[0].songRefs.map(ref => ref.key), ['local-key:c', 'local-key:b']);
    assert.equal(JSON.parse(h.storage.get('playlists'))[0].name, 'Evening');
    const beforeInvalid = h.storage.get('playlists');
    assert.equal((await h.request('setPlaylistTracks', { playlistId: id, trackIds: ['missing'] })).error.code, 'TRACK_NOT_FOUND');
    assert.equal(h.storage.get('playlists'), beforeInvalid);
    assert.equal((await h.request('deletePlaylist', { id: 'library' })).error.code, 'PLAYLIST_READ_ONLY');
    await h.request('deletePlaylist', { id });
    assert.deepEqual(JSON.parse(h.storage.get('playlists')), []);
    assert.equal(h.context.playQueue, queue);
    assert.equal(h.context.audio.currentTime, 37);
});

test('replacing favorites deduplicates order and synchronizes removed and added database flags', async () => {
    const h = harness();
    h.context.writeSpecialLikedSongRefs([h.context.specialLikedSongRef(h.tracks[0])]);
    const response = await h.request('setPlaylistTracks', { playlistId: 'special-liked', trackIds: ['local-key:c', 'local-key:b', 'local-key:c'] });
    assert.equal(response.result.count, 2);
    assert.deepEqual(JSON.parse(h.storage.get('favorites')).map(ref => ref.key), ['local-key:c', 'local-key:b']);
    assert.ok(h.dbFavorites.some(item => item.id === 'a' && item.liked === false));
    assert.ok(h.dbFavorites.some(item => item.id === 'b' && item.liked === true));
    assert.equal(h.context.isSpecialLikedSong(h.tracks[0]), false);
    assert.equal(h.context.isSpecialLikedSong(h.tracks[2]), true);
});

test('mute restores the previous audible volume and invalid requests return errors', async () => {
    const h = harness();
    await h.request('setMuted', { muted: true });
    assert.equal(h.context.targetVolume, 0);
    assert.equal((await h.request('setMuted', { muted: false })).result.volume, 0.65);
    assert.equal((await h.request('setMuted', { muted: 'false' })).error.code, 'INVALID_MUTED');
    assert.equal((await h.request('setVolume', { volume: NaN })).error.code, 'INVALID_VOLUME');
    assert.equal((await h.request('playQueue', { index: -1 })).error.code, 'INVALID_INDEX');
    assert.equal((await h.request('seek', { seconds: Infinity })).error.code, 'INVALID_SEEK');
    assert.equal((await h.request('unknown')).error.code, 'METHOD_NOT_FOUND');
});
