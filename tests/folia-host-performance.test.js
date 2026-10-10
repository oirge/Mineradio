'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { performance } = require('node:perf_hooks');

const appSource = fs.readFileSync(path.join(__dirname, '../public/app.js'), 'utf8');
const hostSource = fs.readFileSync(path.join(__dirname, '../public/folia-host.js'), 'utf8');
const favoriteStart = appSource.indexOf('function specialLikedSongPath(song)');
const favoriteEnd = appSource.indexOf('function isSongLiked(song)', favoriteStart);
assert.ok(favoriteStart >= 0 && favoriteEnd > favoriteStart);
const favoriteSource = appSource.slice(favoriteStart, favoriteEnd);
const favoriteCollectionStart = appSource.indexOf('function getSpecialLikedSongs()', favoriteStart);
const favoriteCollectionEnd = appSource.indexOf('function toggleSpecialLikedSong(song)', favoriteCollectionStart);
assert.ok(favoriteCollectionStart >= 0 && favoriteCollectionEnd > favoriteCollectionStart);
const favoriteCollectionSource = appSource.slice(favoriteCollectionStart, favoriteCollectionEnd);
const playlistLookupStart = appSource.indexOf('function getLocalPlaylistSongLookup()');
const playlistLookupEnd = appSource.indexOf('function refreshLocalPlaylistSurfaces(', playlistLookupStart);
assert.ok(playlistLookupStart >= 0 && playlistLookupEnd > playlistLookupStart);
const playlistLookupSource = appSource.slice(playlistLookupStart, playlistLookupEnd);
const customCollectionStart = appSource.indexOf('function getLocalPlaylistSongsById(id)');
const customCollectionEnd = appSource.indexOf('function readSavedLocalPlaybackPlaylistSelection(', customCollectionStart);
assert.ok(customCollectionStart >= 0 && customCollectionEnd > customCollectionStart);
const customCollectionSource = appSource.slice(customCollectionStart, customCollectionEnd);

function node(id) {
    return { id, children: [], classList: { toggle() {}, remove() {} }, setAttribute() {}, addEventListener() {}, focus() {},
        appendChild(child) { this.children.push(child); } };
}

function harness(count = 2500, favoriteCount = 0) {
    const counters = { typeReads: 0, keyReads: 0, favoriteResolutions: 0, frequencyReads: 0, waveformReads: 0 };
    const tracks = Array.from({ length: count }, (_, index) => new Proxy({ type: 'local', localKey: String(index),
        localPath: `D:/Music/${index}.flac`, name: `Track ${index}`, artist: 'Artist', album: 'Album', duration: 200 }, {
        get(target, key) { if (key === 'type') counters.typeReads++; if (key === 'localKey') counters.keyReads++; return target[key]; },
    }));
    const listeners = new Map(), timers = new Map(), storage = new Map(), messages = [];
    const mount = node('folia-interface'), status = node('folia-load-status'), shell = node('desktop-window-shell');
    const elements = new Map([mount, status, shell].map(element => [element.id, element]));
    let timerId = 0, requestId = 0;
    const document = { hidden: false, body: node('body'), querySelectorAll: () => [], addEventListener() {},
        getElementById: id => elements.get(id), createElement: () => {
            const element = node('frame');
            element.contentWindow = { postMessage(message, origin) { messages.push({ ...structuredClone(message), origin }); } };
            return element;
        } };
    const customPlaylist = { id: 'local-playlist:test', name: 'Custom', songRefs: tracks.slice(0, 200).map(song => ({ key: `local-key:${song.localKey}` })) };
    const context = vm.createContext({ console, document, URL, Blob, location: { origin: 'http://127.0.0.1:3000' },
        addEventListener: (name, callback) => listeners.set(name, callback),
        setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
        clearTimeout: id => timers.delete(id),
        localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
        setPersistentLocalStorageItem: (key, value) => storage.set(key, value),
        localLibrarySongs: tracks, localLibraryReady: true, playQueue: [tracks[0]], currentIdx: 0,
        localPlaylistSongLookupCache: { source: null, length: -1, firstKey: '', lastKey: '', byKey: Object.create(null), byPath: Object.create(null) },
        audio: { src: 'blob:current', paused: false, ended: false, currentTime: 37, duration: 200, volume: 0.7, playbackRate: 1 },
        targetVolume: 0.7, lyricsLines: [], specialLikedSongRefs: null, SPECIAL_LIKED_PLAYLIST_STORE_KEY: 'favorites',
        songCoverSrc: song => song.cover || '', playbackDurationFromSong: song => song.duration,
        getPlaybackCurrentSeconds: () => context.audio.currentTime, getPlaybackDurationSeconds: () => context.audio.duration,
        suspendMainRenderLoop() {}, resumeMainRenderLoop() {}, markQueueContentChanged() {}, writeLocalPlaylists() {},
        invalidateLocalPlaylistSongLookup() {}, schedulePlaybackMetadataRefresh() {}, scheduleLocalAssetUiRefresh() {},
        localPlaylistById: id => id === customPlaylist.id ? customPlaylist : null,
        localPlaylistSongs: id => { assert.ok(id === 'special-liked' || id === customPlaylist.id); counters.favoriteResolutions++; return id === 'special-liked' ? context.getSpecialLikedSongs() : context.getLocalPlaylistSongsById(id); },
        analyser: { frequencyBinCount: 1024, fftSize: 2048,
            getByteFrequencyData(array) { counters.frequencyReads++; array.fill(23); },
            getByteTimeDomainData(array) { counters.waveformReads++; array.fill(128); } },
        audioCtx: { sampleRate: 48000 },
    });
    context.window = context;
    vm.runInContext(favoriteSource, context);
    vm.runInContext(favoriteCollectionSource, context);
    vm.runInContext(playlistLookupSource, context);
    vm.runInContext(customCollectionSource, context);
    context.writeSpecialLikedSongRefs(tracks.slice(0, favoriteCount).map(song => context.specialLikedSongRef(song)));
    vm.runInContext(hostSource, context);
    context.MineradioFoliaHost.setInterface('folia');
    function reset() { for (const key of Object.keys(counters)) counters[key] = 0; messages.length = 0; }
    async function request(method, params = {}) {
        const id = String(++requestId);
        await listeners.get('message')({ source: mount.children[0].contentWindow, origin: context.location.origin,
            data: { channel: 'mineradio-folia', version: 1, type: 'request', id, method, params } });
        const response = messages.find(message => message.type === 'response' && message.id === id);
        assert.equal(response?.ok, true, response?.error?.message);
        return response.result;
    }
    function runTimer(delay) {
        const entry = [...timers].find(([, timer]) => timer.delay === delay);
        assert.ok(entry, `Missing ${delay}ms timer`);
        timers.delete(entry[0]); entry[1].callback();
    }
    reset();
    return { context, tracks, counters, document, messages, timers, request, runTimer, reset };
}

test('Folia catalog pages inspect unchanged local membership once and still return fresh projections', async () => {
    const h = harness();
    const ids = [];
    for (let offset = 0; offset < h.tracks.length; offset += 500) {
        const page = await h.request('listTracks', { offset, limit: 500 });
        assert.equal(page.total, h.tracks.length);
        ids.push(...page.items.map(song => song.id));
    }
    assert.equal(new Set(ids).size, h.tracks.length);
    assert.deepEqual(ids, h.tracks.map(song => `local-key:${song.localKey}`));
    assert.equal(h.counters.typeReads, h.tracks.length, 'reading five catalog pages must not rescan every song five times');
    h.tracks[0].cover = 'blob:new-cover';
    const page = await h.request('listTracks', { limit: 1 });
    assert.equal(page.items[0].cover, 'blob:new-cover', 'only page membership may be cached, never a projected song snapshot');
});

test('Folia favorite pages resolve native membership once until favorites change', async () => {
    const h = harness(2500, 1500), ids = [];
    for (let offset = 0; offset < 1500; offset += 500) {
        const page = await h.request('listTracks', { playlistId: 'special-liked', offset, limit: 500 });
        assert.equal(page.total, 1500);
        assert.ok(page.items.every(song => song.liked));
        ids.push(...page.items.map(song => song.id));
    }
    assert.equal(new Set(ids).size, 1500);
    assert.equal(h.counters.favoriteResolutions, 1, 'one collection read must not rebuild the entire library lookup for every page');
    assert.equal(h.counters.typeReads, 2500 + 1500);
    h.context.writeSpecialLikedSongRefs([h.context.specialLikedSongRef(h.tracks[0])]);
    const changed = await h.request('listTracks', { playlistId: 'special-liked' });
    assert.deepEqual(changed.items.map(song => song.id), ['local-key:0']);
    assert.equal(h.counters.favoriteResolutions, 2);
    const libraryPage = await h.request('listTracks', { limit: 1 });
    assert.equal(libraryPage.items[0].liked, true, 'library projections must refresh the favorite flag after favorites change');
});

test('Folia queue pages reuse stable membership while refreshing each requested projection', async () => {
    const h = harness(2500), ids = [];
    h.context.playQueue = h.tracks;
    h.reset();
    for (let offset = 0; offset < 1500; offset += 500) {
        const page = await h.request('getQueue', { offset, limit: 500 });
        assert.equal(page.total, 2500);
        ids.push(...page.items.map(song => song.id));
    }
    assert.equal(new Set(ids).size, 1500);
    assert.equal(h.counters.typeReads, 2500);
    h.tracks[0].cover = 'blob:new-queue-cover';
    assert.equal((await h.request('getQueue', { limit: 1 })).items[0].cover, 'blob:new-queue-cover');
});

test('custom Folia playlist pages reuse indexed ordered membership', async () => {
    const h = harness(2500), ids = [];
    for (let offset = 0; offset < 200; offset += 50) {
        const page = await h.request('listTracks', { playlistId: 'local-playlist:test', offset, limit: 50 });
        assert.equal(page.total, 200);
        ids.push(...page.items.map(song => song.id));
    }
    assert.equal(new Set(ids).size, 200);
    assert.equal(h.counters.favoriteResolutions, 1);
    assert.equal(h.counters.typeReads, 2500 + 200);
});

test('Folia query pages keep only actual matches, including when the first track misses', async () => {
    const h = harness(12), first = await h.request('listTracks', { query: 'track 8', limit: 3 });
    assert.equal(first.total, 1);
    assert.deepEqual(first.items.map(song => song.id), ['local-key:8']);

    const second = await h.request('listTracks', { query: 'artist', offset: 4, limit: 3 });
    assert.equal(second.total, 12);
    assert.deepEqual(second.items.map(song => song.id), ['local-key:4', 'local-key:5', 'local-key:6']);
});

test('Folia audio bridge sends only the frequency data used by the embedded player', async () => {
    const h = harness(4);
    await h.request('getState');
    h.runTimer(33);

    const audioEvent = h.messages.find(message => message.type === 'event' && message.event === 'audio');
    assert.ok(audioEvent);
    assert.equal(Object.hasOwn(audioEvent.data, 'timeDomain'), false);
    assert.equal(h.counters.frequencyReads, 1);
    assert.equal(h.counters.waveformReads, 0);
});

test('Folia host performance benchmark', { skip: process.env.FOLIA_PERF_BENCH !== '1' }, async t => {
    const count = 50000, favoriteCount = 10000;
    for (const playlistId of ['library', 'special-liked']) {
        const h = harness(count, favoriteCount), total = playlistId === 'library' ? count : favoriteCount;
        const start = performance.now();
        for (let offset = 0; offset < total; offset += 1000) await h.request('listTracks', { playlistId, offset, limit: 1000 });
        t.diagnostic(JSON.stringify({ scenario: playlistId, count, pages: total / 1000, elapsedMs: Math.round(performance.now() - start), ...h.counters }));
    }
    const h = harness(count, favoriteCount);
    await h.request('getState'); h.reset();
    const start = performance.now();
    for (let index = 0; index < 300; index++) { h.runTimer(33); if (index % 6 === 0) h.runTimer(200); }
    t.diagnostic(JSON.stringify({ scenario: '10s-state-audio', elapsedMs: Math.round(performance.now() - start),
        stateMessages: h.messages.filter(message => message.event === 'state').length,
        audioMessages: h.messages.filter(message => message.event === 'audio').length, ...h.counters }));
});
