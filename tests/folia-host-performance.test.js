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
const coverKeyStart = appSource.indexOf('function songCustomCoverKey(song)');
const coverKeyEnd = appSource.indexOf('function resolvedCustomCoverForSong(', coverKeyStart);
assert.ok(coverKeyStart >= 0 && coverKeyEnd > coverKeyStart);
const coverKeySource = appSource.slice(coverKeyStart, coverKeyEnd);
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
const metadataRefreshStart = appSource.indexOf('function schedulePlaybackMetadataRefresh(song)');
const metadataRefreshEnd = appSource.indexOf('function maybeApplyLocalCoverForSong(', metadataRefreshStart);
assert.ok(metadataRefreshStart >= 0 && metadataRefreshEnd > metadataRefreshStart);
const metadataRefreshSource = appSource.slice(metadataRefreshStart, metadataRefreshEnd);
const metadataCoreStart = appSource.indexOf('function applyLocalMetadataTags(song, tags)');
assert.ok(metadataCoreStart >= 0 && metadataRefreshEnd > metadataCoreStart);
const metadataCoreSource = appSource.slice(metadataCoreStart, metadataRefreshEnd);
const assetSyncStart = appSource.indexOf('function syncLocalSongAssetFields(');
const assetSyncEnd = appSource.indexOf('async function readLocalBeatCacheForSong(', assetSyncStart);
assert.ok(assetSyncStart >= 0 && assetSyncEnd > assetSyncStart);
const assetSyncSource = appSource.slice(assetSyncStart, assetSyncEnd);
const assetUiRefreshStart = appSource.indexOf('function scheduleLocalAssetUiRefresh(song, reason)');
const assetUiRefreshEnd = appSource.indexOf('async function ensureLocalBeatMapForSong(', assetUiRefreshStart);
assert.ok(assetUiRefreshStart >= 0 && assetUiRefreshEnd > assetUiRefreshStart);
const assetUiRefreshSource = appSource.slice(assetUiRefreshStart, assetUiRefreshEnd);

function node(id) {
    return { id, children: [], classList: { toggle() {}, remove() {} }, setAttribute() {}, addEventListener() {}, focus() {},
        appendChild(child) { this.children.push(child); } };
}

function harness(count = 2500, favoriteCount = 0, realMetadata = false) {
    const counters = { typeReads: 0, keyReads: 0, favoriteResolutions: 0, coverReads: 0, durationReads: 0,
        likedReads: 0, metadataStarts: 0, nativeQueueRenders: 0, nativeLibraryRenders: 0,
        currentTrackInfoUpdates: 0, mediaSyncs: 0, frequencyReads: 0, waveformReads: 0 };
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
        songCoverSrc: song => {
            counters.coverReads++;
            return context.customCoverMap?.[context.songCustomCoverKey(song)] || song.localCoverThumbDataUrl
                || song.localCoverDataUrl || song.customCover || song.localCoverObjectUrl || song.cover || '';
        },
        playbackDurationFromSong: song => { counters.durationReads++; return song.duration; },
        getPlaybackCurrentSeconds: () => context.audio.currentTime, getPlaybackDurationSeconds: () => context.audio.duration,
        suspendMainRenderLoop() {}, resumeMainRenderLoop() {}, markQueueContentChanged() {}, writeLocalPlaylists() {},
        invalidateLocalPlaylistSongLookup() {},
        ensureLocalMetadataForSong() { counters.metadataStarts++; return Promise.resolve(false); },
        extractLocalMetadataTags() { counters.metadataStarts++; return Promise.resolve(context.nextMetadataTags); },
        isLocalSourcePlaceholderMetadata: () => false, updateLocalAudioQualityInfo() {},
        noteLocalLibraryMaintenanceAssetChange() {}, shouldRetainLocalLyricText: () => false,
        releaseLocalLyricText: () => false, trimLocalLyricTextCopies() {}, invalidateSongCoverCache() {},
        scheduleLocalAssetCacheWrite() {}, isCurrentLocalQueueSong: () => false,
        updateControlTrackInfo() { counters.currentTrackInfoUpdates++; },
        safeRenderQueuePanel() { counters.nativeQueueRenders++; },
        refreshVisibleLocalLibraryResults() { counters.nativeLibraryRenders++; },
        renderHomeDiscover() {},
        scheduleShelfRebuild() {}, updateSystemMediaSessionPlaybackState() { counters.mediaSyncs++; },
        playlist: [], miniQueueOpen: false, LOCAL_ONLY_MODE: true, emptyHomeActive: false,
        LOCAL_METADATA_TAG_SCHEMA: 9,
        localAssetUiRefreshTimer: null, localAssetUiRefreshReason: '',
        scheduleLocalAssetUiRefresh() {},
        refreshLocalMetadataUi() {},
        setCustomCoverForCurrent(source) {
            const song = context.playQueue[context.currentIdx];
            song.customCover = source;
            context.customCoverMap = { [`local:${song.localKey}`]: source };
        },
        clearCustomCoverForCurrent() {
            const song = context.playQueue[context.currentIdx];
            delete song.customCover;
            context.customCoverMap = {};
        },
        applyLocalAssetCacheToSong(song, record) {
            Object.assign(song, record.fields);
            return true;
        },
        async hydrateLocalAssetCacheForSongRange(songs) {
            if (!context.nextAssetHydration) return 0;
            const updates = Array.isArray(context.nextAssetHydration) ? context.nextAssetHydration : [context.nextAssetHydration];
            context.nextAssetHydration = null;
            let count = 0;
            for (const { index, fields } of updates) {
                if (context.applyLocalAssetCacheToSong(songs[index], { fields })) count++;
            }
            return count;
        },
        localPlaylistById: id => id === customPlaylist.id ? customPlaylist : null,
        localPlaylistSongs: id => { assert.ok(id === 'special-liked' || id === customPlaylist.id); counters.favoriteResolutions++; return id === 'special-liked' ? context.getSpecialLikedSongs() : context.getLocalPlaylistSongsById(id); },
        analyser: { frequencyBinCount: 1024, fftSize: 2048,
            getByteFrequencyData(array) { counters.frequencyReads++; array.fill(23); },
            getByteTimeDomainData(array) { counters.waveformReads++; array.fill(128); } },
        audioCtx: { sampleRate: 48000 },
    });
    context.window = context;
    vm.runInContext(favoriteSource, context);
    vm.runInContext(coverKeySource, context);
    vm.runInContext(favoriteCollectionSource, context);
    vm.runInContext(playlistLookupSource, context);
    vm.runInContext(customCollectionSource, context);
    if (realMetadata) {
        vm.runInContext(assetSyncSource, context);
        vm.runInContext(assetUiRefreshSource, context);
        vm.runInContext(metadataCoreSource, context);
    } else vm.runInContext(metadataRefreshSource, context);
    context.writeSpecialLikedSongRefs(tracks.slice(0, favoriteCount).map(song => context.specialLikedSongRef(song)));
    const isSpecialLikedSong = context.isSpecialLikedSong;
    context.isSpecialLikedSong = song => { counters.likedReads++; return isSpecialLikedSong(song); };
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

test('a new Folia query sees metadata updated in place after a previous query', async () => {
    const h = harness(20);
    const initial = await h.request('listTracks', { query: 'track 1', limit: 30 });
    assert.equal(initial.total, 11);
    h.tracks[2].name = 'Track 123 moved';
    h.tracks[3].artist = 'New Artist';
    assert.equal(h.context.localLibrarySongs, h.tracks, 'the library keeps its array identity and length');

    const narrowed = await h.request('listTracks', { query: 'track 123', limit: 30 });
    assert.deepEqual(narrowed.items.map(song => song.id), ['local-key:2']);
    const changed = await h.request('listTracks', { query: 'new artist', limit: 30 });
    assert.deepEqual(changed.items.map(song => song.id), ['local-key:3']);
});

test('a cached Folia query refreshes after an in-place metadata completion', async () => {
    const h = harness(20);
    const before = await h.request('listTracks', { query: 'track 1', limit: 30 });
    assert.equal(before.total, 11);
    const libraryRevision = h.context.MineradioFoliaHost.getState().libraryRevision;
    h.tracks[1].name = 'Other Song';
    h.context.refreshLocalMetadataUi(h.tracks[1], 'local-metadata-ready');

    const other = await h.request('listTracks', { query: 'other song', limit: 30 });
    assert.deepEqual(other.items.map(song => song.id), ['local-key:1']);
    const revisited = await h.request('listTracks', { query: 'track 1', limit: 30 });
    assert.equal(revisited.total, 10, 'the prior query must not retain obsolete membership');
    assert.equal(h.context.MineradioFoliaHost.getState().libraryRevision, libraryRevision,
        'metadata cache invalidation must not trigger a full wall-catalog reload');
    h.runTimer(180);
    const changed = h.messages.filter(message => message.event === 'tracksChanged');
    assert.equal(changed.length, 1);
    assert.deepEqual(changed[0].data.updates.map(update => [update.track.id, update.searchableChanged]),
        [['local-key:1', true]]);
    assert.equal(changed[0].data.updates[0].track.title, 'Other Song');
});

test('partial metadata on a library song refreshes Folia search without marking the scan complete', async () => {
    const h = harness(4, 0, true);
    assert.equal((await h.request('listTracks', { query: 'track 1' })).total, 1);
    h.context.nextMetadataTags = { title: 'Partially Renamed', _mineradioScanComplete: false };

    assert.equal(await h.context.ensureLocalMetadataForSong(h.tracks[1], { background: true }), true);
    assert.notEqual(h.tracks[1].localMetadataLoaded, true, 'a truncated scan must remain retryable');
    assert.equal((await h.request('listTracks', { query: 'track 1' })).total, 0);
    assert.equal((await h.request('listTracks', { query: 'partially renamed' })).total, 1);
    h.runTimer(180);
    assert.deepEqual(h.messages.filter(message => message.event === 'tracksChanged')
        .flatMap(message => message.data.updates.map(update => [update.track.title, update.searchableChanged])),
    [['Partially Renamed', true]]);
});

test('partial metadata for noncurrent songs batches native UI work while updating Folia search', async () => {
    const h = harness(4, 0, true);
    assert.equal((await h.request('listTracks', { query: 'renamed' })).total, 0);
    for (const index of [1, 2]) {
        h.context.nextMetadataTags = { title: `Renamed ${index}`, _mineradioScanComplete: false };
        assert.equal(await h.context.ensureLocalMetadataForSong(h.tracks[index], { background: true }), true);
    }

    assert.equal((await h.request('listTracks', { query: 'renamed' })).total, 2);
    assert.equal(h.counters.nativeQueueRenders, 0, 'background metadata must not refresh the queue per song');
    assert.equal(h.counters.nativeLibraryRenders, 0, 'background metadata must not refresh native search per song');
    assert.equal([...h.timers.values()].filter(timer => timer.delay === 220).length, 1);

    h.runTimer(180);
    assert.deepEqual(h.messages.filter(message => message.event === 'tracksChanged')
        .flatMap(message => message.data.updates.map(update => [update.track.title, update.searchableChanged])),
    [['Renamed 1', true], ['Renamed 2', true]]);
    h.runTimer(220);
    assert.equal(h.counters.nativeQueueRenders, 1);
    assert.equal(h.counters.nativeLibraryRenders, 1);
});

test('partial metadata for the current song updates media information immediately', async () => {
    const h = harness(4, 0, true);
    h.context.playQueue = [{ ...h.tracks[0] }];
    h.context.isCurrentLocalQueueSong = song => song?.localKey === h.tracks[0].localKey;
    await h.request('getState');
    h.context.nextMetadataTags = { title: 'Now Renamed', _mineradioScanComplete: false };

    assert.equal(await h.context.ensureLocalMetadataForSong(h.tracks[0], { background: true }), true);
    assert.equal(h.counters.currentTrackInfoUpdates, 1);
    assert.equal(h.counters.mediaSyncs, 1);
    assert.equal(h.context.playQueue[0].name, 'Now Renamed');
    assert.equal(h.context.MineradioFoliaHost.getState().currentTrack.title, 'Now Renamed');
    assert.equal([...h.timers.values()].some(timer => timer.delay === 220), false);
});

test('partial metadata on a noncurrent queue clone reaches its canonical library song', async () => {
    const h = harness(4, 0, true);
    const queued = { ...h.tracks[1], localFile: { name: '1.ape' } };
    h.context.playQueue = [h.tracks[0], queued];
    h.tracks[1].album = 'Catalog Album';
    assert.equal((await h.request('listTracks', { query: 'track 1' })).total, 1);
    assert.equal((await h.request('getQueue', { query: 'track 1' })).total, 1);
    h.context.nextMetadataTags = { title: 'Partial Queue Rename', artist: 'New Artist', _mineradioScanComplete: false };

    assert.equal(await h.context.ensureLocalMetadataForSong(queued, { background: true }), true);
    assert.notEqual(queued.localMetadataLoaded, true);
    assert.notEqual(h.tracks[1].localMetadataLoaded, true, 'propagation must not suppress a later full scan');
    assert.equal(h.tracks[1].name, 'Partial Queue Rename');
    assert.equal(h.tracks[1].artist, 'New Artist');
    assert.equal(h.tracks[1].album, 'Catalog Album', 'unscanned clone fields must not overwrite library metadata');
    assert.equal((await h.request('listTracks', { query: 'track 1' })).total, 0);
    assert.equal((await h.request('getQueue', { query: 'track 1' })).total, 0);
    h.runTimer(180);
    assert.deepEqual(h.messages.filter(message => message.event === 'tracksChanged')
        .flatMap(message => message.data.updates.map(update => [update.track.title, update.searchableChanged])),
    [['Partial Queue Rename', true]]);

    h.context.nextMetadataTags = { album: 'Full Album', _mineradioScanComplete: true };
    assert.equal(await h.context.ensureLocalMetadataForSong(queued, { applyCurrent: true }), true);
    assert.equal(queued.localMetadataLoaded, true);
    assert.equal(h.tracks[1].localMetadataLoaded, true);
    assert.equal(h.tracks[1].album, 'Full Album');
});

test('duration-only and unchanged metadata do not invalidate cached Folia searches', async () => {
    const h = harness(4, 0, true);
    h.tracks[1].duration = 0;
    h.tracks[3].duration = 0;
    assert.equal((await h.request('listTracks', { query: 'track 1' })).total, 1);
    h.context.nextMetadataTags = { duration: 215, _mineradioScanComplete: true };
    assert.equal(await h.context.ensureLocalMetadataForSong(h.tracks[1], { background: true }), true);
    h.context.nextMetadataTags = { duration: 230, _mineradioScanComplete: false };
    assert.equal(await h.context.ensureLocalMetadataForSong(h.tracks[3], { background: true }), true);
    assert.notEqual(h.tracks[3].localMetadataLoaded, true);
    h.context.nextMetadataTags = { _mineradioScanComplete: true };
    assert.equal(await h.context.ensureLocalMetadataForSong(h.tracks[2], { applyCurrent: true }), false);

    h.runTimer(180);
    assert.deepEqual(h.messages.filter(message => message.event === 'tracksChanged')
        .flatMap(message => message.data.updates.map(update => [update.track.id, update.searchableChanged])),
    [['local-key:1', false], ['local-key:3', false], ['local-key:2', false]]);
    const inspected = h.counters.typeReads;
    assert.equal((await h.request('listTracks', { query: 'track 1' })).total, 1);
    assert.equal(h.counters.typeReads, inspected, 'nonsearchable metadata must preserve the cached query');
});

test('Folia asset hydration batches visible changes and ignores lyric-only updates', async () => {
    const h = harness(20);
    assert.equal((await h.request('listTracks', { query: 'track 1', limit: 30 })).total, 11);
    const libraryRevision = h.context.MineradioFoliaHost.getState().libraryRevision;
    const inspected = h.counters.typeReads;
    assert.equal(await h.context.hydrateLocalAssetCacheForSongRange(h.tracks, 0, 20, { includeLyrics: false }), 0);
    await h.request('listTracks', { query: 'track 1', limit: 30 });
    assert.equal(h.counters.typeReads, inspected, 'an empty hydration chunk must preserve the query cache');

    h.context.nextAssetHydration = [
        { index: 1, fields: { name: 'Hydrated Song', artist: 'New Artist' } },
        { index: 2, fields: { localCoverThumbDataUrl: 'blob:new-cover' } },
        { index: 3, fields: { localLyricText: '[00:01]Lyrics only' } },
    ];
    assert.equal(await h.context.hydrateLocalAssetCacheForSongRange(h.tracks, 0, 20), 3);
    assert.deepEqual((await h.request('listTracks', { query: 'hydrated song' })).items.map(song => song.id), ['local-key:1']);
    assert.equal((await h.request('listTracks', { query: 'track 1', limit: 30 })).total, 10);
    assert.equal(h.context.MineradioFoliaHost.getState().libraryRevision, libraryRevision,
        'asset hydration must not force a full wall-catalog reload');
    h.runTimer(180);
    const changed = h.messages.filter(message => message.event === 'tracksChanged');
    assert.equal(changed.length, 1, 'one hydration chunk should post a single batched event');
    assert.deepEqual(changed[0].data.updates.map(update => [update.track.id, update.searchableChanged]),
        [['local-key:1', true], ['local-key:2', false]], 'lyrics are not catalog presentation data');
    assert.equal(changed[0].data.updates[1].track.cover, 'blob:new-cover');
});

test('Folia cover completion sends a track patch even while the iframe is hidden', async () => {
    const h = harness(4);
    await h.request('getState');
    const revision = h.context.MineradioFoliaHost.getState().libraryRevision;
    h.context.MineradioFoliaHost.setInterface('mineradio');
    h.tracks[1].localCoverThumbDataUrl = 'blob:cover-one';
    h.context.scheduleLocalAssetUiRefresh(h.tracks[1], 'local-cover-prefetch');
    h.tracks[2].localCoverThumbDataUrl = 'blob:cover-two';
    h.context.scheduleLocalAssetUiRefresh(h.tracks[2], 'local-cover-prefetch');
    h.context.scheduleLocalAssetUiRefresh(h.tracks[3], 'local-lyric-prefetch');
    assert.equal(h.context.MineradioFoliaHost.getState().libraryRevision, revision,
        'artwork and lyrics must not reload either wall');
    h.runTimer(180);
    const changed = h.messages.filter(message => message.event === 'tracksChanged');
    assert.equal(changed.length, 1);
    assert.deepEqual(changed[0].data.updates.map(update => [update.track.id, update.searchableChanged]),
        [['local-key:1', false], ['local-key:2', false]]);
    h.context.MineradioFoliaHost.setInterface('folia');
    assert.equal((await h.request('listTracks', { offset: 1, limit: 1 })).items[0].cover, 'blob:cover-one');
});

test('Folia discards a late track update from a replaced library even when IDs match', async () => {
    const h = harness(4);
    await h.request('getState');
    const previous = h.tracks[1];
    previous.name = 'Queued From Old Library';
    h.context.refreshLocalMetadataUi(previous, 'local-metadata-ready');
    h.context.localLibrarySongs = [{ ...h.tracks[0] }, { ...previous, name: 'Current Library' }];
    h.context.MineradioFoliaHost.getState();
    h.runTimer(180);
    previous.name = 'Old Library';
    h.context.refreshLocalMetadataUi(previous, 'local-metadata-ready');
    assert.equal([...h.timers.values()].some(timer => timer.delay === 180), false,
        'detached songs must be rejected before scheduling another update');
    assert.equal(h.messages.filter(message => message.event === 'tracksChanged').length, 0);
    assert.equal((await h.request('listTracks', { offset: 1, limit: 1 })).items[0].title, 'Current Library');
});

test('late metadata from a noncurrent queue clone updates the library and queue searches', async () => {
    const h = harness(4);
    const queued = { ...h.tracks[1] };
    h.context.playQueue = [h.tracks[0], queued];
    assert.equal((await h.request('listTracks', { query: 'track 1' })).total, 1);
    assert.equal((await h.request('getQueue', { query: 'track 1' })).total, 1);

    queued.name = 'Retagged Song';
    h.tracks[1].name = 'Retagged Song';
    h.context.refreshLocalMetadataUi(queued, 'local-metadata-ready');

    assert.equal((await h.request('listTracks', { query: 'track 1' })).total, 0);
    assert.equal((await h.request('getQueue', { query: 'track 1' })).total, 0);
    assert.equal((await h.request('listTracks', { query: 'retagged song' })).total, 1);
    h.runTimer(180);
    assert.deepEqual(h.messages.filter(message => message.event === 'tracksChanged')
        .flatMap(message => message.data.updates.map(update => update.track.title)), ['Retagged Song']);
});

test('Folia projects custom artwork and a late thumbnail without reloading the wall', async () => {
    const h = harness(4);
    await h.request('getState');
    const before = h.context.MineradioFoliaHost.getState().libraryRevision;
    h.context.setCustomCoverForCurrent('blob:custom-cover');
    h.runTimer(180);
    assert.equal(h.messages.filter(message => message.event === 'tracksChanged').at(-1).data.updates[0].track.cover,
        'blob:custom-cover');
    h.context.clearCustomCoverForCurrent();
    h.runTimer(180);
    assert.equal(h.messages.filter(message => message.event === 'tracksChanged').at(-1).data.updates[0].track.cover, '');

    const lateThumbnail = h.tracks[1];
    lateThumbnail.localCoverThumbDataUrl = 'blob:late-thumbnail';
    h.context.MineradioFoliaHost.noteTrackChanged(lateThumbnail, false);
    h.runTimer(180);
    assert.equal(h.messages.filter(message => message.event === 'tracksChanged').at(-1).data.updates[0].track.cover,
        'blob:late-thumbnail');
    assert.equal(h.context.MineradioFoliaHost.getState().libraryRevision, before);

    const coverStart = appSource.indexOf('if (song.localCoverDataUrl) {', appSource.indexOf('function ensureLocalCoverForSong('));
    const coverEnd = appSource.indexOf('maybeApplyLocalCoverForSong(song, opts);', coverStart);
    assert.ok(coverStart >= 0 && coverEnd > coverStart);
    assert.match(appSource.slice(coverStart, coverEnd), /MineradioFoliaHost\.noteTrackChanged\(song,\s*false\)/,
        'late thumbnail completion must notify Folia after the cover is assigned');
});

test('custom artwork on a queue clone overrides the catalog thumbnail and restores it on clear', async () => {
    const h = harness(4);
    h.tracks[0].localCoverThumbDataUrl = 'blob:original-thumb';
    h.context.playQueue = [{ ...h.tracks[0] }];
    assert.equal((await h.request('listTracks', { limit: 1 })).items[0].cover, 'blob:original-thumb');

    h.context.setCustomCoverForCurrent('blob:new-custom');
    h.runTimer(180);
    assert.equal(h.messages.filter(message => message.event === 'tracksChanged').at(-1).data.updates[0].track.cover,
        'blob:new-custom');
    assert.equal((await h.request('listTracks', { limit: 1 })).items[0].cover, 'blob:new-custom');

    h.context.clearCustomCoverForCurrent();
    h.runTimer(180);
    assert.equal(h.messages.filter(message => message.event === 'tracksChanged').at(-1).data.updates[0].track.cover,
        'blob:original-thumb');
    assert.equal((await h.request('listTracks', { limit: 1 })).items[0].cover, 'blob:original-thumb');
});

test('an already-loaded playback metadata no-op does not reload the Folia catalog', () => {
    const h = harness(4);
    const current = h.tracks[0];
    current.localMetadataLoaded = true;
    const before = h.context.MineradioFoliaHost.getState().libraryRevision;

    h.context.schedulePlaybackMetadataRefresh(current);
    assert.equal(h.counters.metadataStarts, 0, 'native metadata scheduling exits for a loaded song');
    assert.equal(h.context.MineradioFoliaHost.getState().libraryRevision, before,
        'the Folia wall must not refetch the whole library for a no-op');

    current.localMetadataLoaded = false;
    h.context.schedulePlaybackMetadataRefresh(current);
    assert.equal(h.counters.metadataStarts, 1);
    assert.equal(h.context.MineradioFoliaHost.getState().libraryRevision, before,
        'starting an async metadata request must not refetch the wall before any fields change');
});

test('a new empty Folia query sees a same-length queue membership change', async () => {
    const h = harness(3);
    h.context.playQueue = [h.tracks[0], { type: 'remote' }, h.tracks[2]];
    assert.equal((await h.request('getQueue', { query: 'track 0' })).total, 1);
    h.context.playQueue[1] = h.tracks[1];
    const page = await h.request('getQueue', { limit: 10 });
    assert.equal(page.total, 3);
    assert.deepEqual(page.items.map(song => song.id), ['local-key:0', 'local-key:1', 'local-key:2']);
});

test('alternating Folia query pages reuse bounded membership without caching projections', async () => {
    const h = harness(2500);
    const first = await h.request('listTracks', { query: 'track 1', limit: 20 });
    const second = await h.request('listTracks', { query: 'track 2', limit: 20 });
    assert.ok(first.total > 20 && second.total > 20);
    const inspected = h.counters.typeReads;
    h.tracks[10].cover = 'blob:updated';
    const firstPage = await h.request('listTracks', { query: 'track 1', offset: 0, limit: 20 });
    const secondPage = await h.request('listTracks', { query: 'track 2', offset: 20, limit: 20 });
    assert.equal(h.counters.typeReads, inspected, 'revisiting either query must not scan the entire collection');
    assert.equal(firstPage.items.find(song => song.id === 'local-key:10').cover, 'blob:updated');
    assert.equal(secondPage.items[0].id, 'local-key:209');

    for (let index = 3; index <= 10; index++) await h.request('listTracks', { query: `track ${index}`, limit: 1 });
    const beforeEvicted = h.counters.typeReads;
    await h.request('listTracks', { query: 'track 1', limit: 1 });
    assert.equal(h.counters.typeReads, beforeEvicted + h.tracks.length, 'old queries must be evicted from the bounded cache');
});

test('Folia state ticks reuse current track metadata while playback progresses', async () => {
    const h = harness(4);
    await h.request('getState');
    h.reset();
    for (let tick = 0; tick < 5; tick++) {
        h.context.audio.currentTime++;
        h.runTimer(200);
    }
    const states = h.messages.filter(message => message.type === 'event' && message.event === 'state').map(message => message.data);
    assert.deepEqual(states.map(state => state.position), [38, 39, 40, 41, 42]);
    assert.equal(states.every(state => state.currentTrack.title === 'Track 0'), true);
    assert.equal(h.counters.coverReads, 0, 'unchanged state ticks should not resolve the same cover repeatedly');
    assert.equal(h.counters.durationReads, 0, 'unchanged state ticks should not project duration repeatedly');
    assert.equal(h.counters.likedReads, 0, 'unchanged state ticks should not recheck the same favorite');
    const first = h.context.MineradioFoliaHost.getState();
    first.currentTrack.title = 'modified by caller';
    assert.equal(h.context.MineradioFoliaHost.getState().currentTrack.title, 'Track 0',
        'each state response must preserve an independent currentTrack projection');
});

test('Folia state cache reflects in-place metadata, cover, favorites and track changes', async () => {
    const h = harness(4);
    const first = await h.request('getState');
    assert.equal(first.currentTrack.liked, false);
    const current = h.context.playQueue[0];
    Object.assign(current, { name: 'Retagged', artist: 'New Artist', album: 'New Album',
        duration: 217, localPath: 'D:/Music/retagged.ogg', localFormat: 'ogg', cover: 'blob:retagged' });
    const metadata = h.context.MineradioFoliaHost.getState().currentTrack;
    assert.equal(metadata.title, 'Retagged');
    assert.equal(metadata.artist, 'New Artist');
    assert.equal(metadata.album, 'New Album');
    assert.equal(metadata.duration, 217);
    assert.equal(metadata.filePath, 'D:/Music/retagged.ogg');
    assert.equal(metadata.format, 'ogg');
    assert.equal(metadata.cover, 'blob:retagged');

    current.localCoverThumbDataUrl = 'blob:loaded-thumb';
    assert.equal(h.context.MineradioFoliaHost.getState().currentTrack.cover, 'blob:loaded-thumb');
    current.localCoverThumbDataUrl = '';
    current.localCoverDataUrl = 'blob:loaded-full';
    assert.equal(h.context.MineradioFoliaHost.getState().currentTrack.cover, 'blob:loaded-full');
    current.localCoverDataUrl = '';
    current.customCover = 'blob:custom';
    assert.equal(h.context.MineradioFoliaHost.getState().currentTrack.cover, 'blob:custom');
    delete current.customCover;
    current.localCoverObjectUrl = 'blob:object-cover';
    assert.equal(h.context.MineradioFoliaHost.getState().currentTrack.cover, 'blob:object-cover');
    current.localCoverObjectUrl = '';
    assert.equal(h.context.MineradioFoliaHost.getState().currentTrack.cover, 'blob:retagged');
    const coverReads = h.counters.coverReads;
    current._mineradioCoverCacheVersion = 1;
    h.context.MineradioFoliaHost.getState();
    assert.equal(h.counters.coverReads, coverReads + 1, 'native cover-cache invalidation must refresh the projection');

    h.context.writeSpecialLikedSongRefs([h.context.specialLikedSongRef(current)]);
    assert.equal(h.context.MineradioFoliaHost.getState().currentTrack.liked, true);
    h.context.writeSpecialLikedSongRefs([]);
    assert.equal(h.context.MineradioFoliaHost.getState().currentTrack.liked, false);
    h.context.customCoverMap = { 'local:0': 'blob:hydrated-cover' };
    assert.equal(h.context.MineradioFoliaHost.getState().currentTrack.cover, 'blob:hydrated-cover');
    h.context.customCoverMap['local:0'] = 'blob:changed-in-place';
    assert.equal(h.context.MineradioFoliaHost.getState().currentTrack.cover, 'blob:changed-in-place');
    h.context.customCoverMap = { 'local:0': 'blob:replaced-cover' };
    assert.equal(h.context.MineradioFoliaHost.getState().currentTrack.cover, 'blob:replaced-cover');
    h.context.playQueue[0] = h.tracks[1];
    assert.equal(h.context.MineradioFoliaHost.getState().currentTrack.id, 'local-key:1');
    h.context.playQueue = [];
    h.context.currentLocalSong = null;
    assert.equal(h.context.MineradioFoliaHost.getState().currentTrack, null);
});

test('Folia audio bridge sends only the frequency data used by the embedded player', async () => {
    const h = harness(4);
    await h.request('getState');
    h.runTimer(33);

    const audioEvent = h.messages.find(message => message.type === 'event' && message.event === 'audio');
    assert.ok(audioEvent);
    assert.equal(Object.hasOwn(audioEvent.data, 'timeDomain'), false);
    assert.ok(audioEvent.data.frequency instanceof Uint8Array, 'audio frames should keep the typed-array transport');
    assert.equal(audioEvent.data.frequency.length, 1024);
    assert.equal(h.counters.frequencyReads, 1);
    assert.equal(h.counters.waveformReads, 0);
});

test('Folia track updates coalesce initially, then drain in bounded short-interval batches', async () => {
    const h = harness(400);
    await h.request('getState');
    h.reset();
    for (let index = 0; index < h.tracks.length; index++) {
        h.tracks[index].localCoverThumbDataUrl = `blob:cover-${index}`;
        h.context.MineradioFoliaHost.noteTrackChanged(h.tracks[index], false);
    }
    h.context.MineradioFoliaHost.noteTrackChanged(h.tracks[0], false);
    const batches = () => h.messages.filter(message => message.event === 'tracksChanged')
        .map(message => message.data.updates);
    assert.equal([...h.timers.values()].filter(timer => timer.delay === 180).length, 1,
        'the initial debounce must coalesce the entire burst');

    h.runTimer(180);
    assert.deepEqual(batches().map(batch => batch.length), [180]);
    assert.equal([...h.timers.values()].filter(timer => timer.delay === 32).length, 1,
        'remaining updates should drain soon, without a second full debounce');
    h.runTimer(32);
    assert.deepEqual(batches().map(batch => batch.length), [180, 180]);
    h.runTimer(32);
    assert.deepEqual(batches().map(batch => batch.length), [180, 180, 40]);
    assert.equal([...h.timers.values()].some(timer => timer.delay === 180 || timer.delay === 32), false);
    assert.deepEqual(batches().flatMap(batch => batch.map(update => update.track.id)),
        h.tracks.map(song => `local-key:${song.localKey}`), 'all updates must arrive once, in catalog order');
    assert.equal(batches()[2][39].track.cover, 'blob:cover-399');
});

test('Folia host performance benchmark', { skip: process.env.FOLIA_PERF_BENCH !== '1' }, async t => {
    const count = 50000, favoriteCount = 10000;
    for (const playlistId of ['library', 'special-liked']) {
        const h = harness(count, favoriteCount), total = playlistId === 'library' ? count : favoriteCount;
        const start = performance.now();
        for (let offset = 0; offset < total; offset += 1000) await h.request('listTracks', { playlistId, offset, limit: 1000 });
        t.diagnostic(JSON.stringify({ scenario: playlistId, count, pages: total / 1000, elapsedMs: Math.round(performance.now() - start), ...h.counters }));
    }
    {
        const h = harness(count), start = performance.now();
        for (let page = 0; page < 12; page++) {
            for (const query of ['track 12', 'track 13']) {
                const result = await h.request('listTracks', { query, offset: page * 100, limit: 100 });
                assert.ok(result.total > 1100);
            }
        }
        t.diagnostic(JSON.stringify({ scenario: 'alternating-query-pages', count, pages: 24,
            elapsedMs: Math.round(performance.now() - start), ...h.counters }));
    }
    const h = harness(count, favoriteCount);
    await h.request('getState'); h.reset();
    const start = performance.now();
    for (let index = 0; index < 300; index++) { h.runTimer(33); if (index % 6 === 0) h.runTimer(200); }
    t.diagnostic(JSON.stringify({ scenario: '10s-state-audio', elapsedMs: Math.round(performance.now() - start),
        stateMessages: h.messages.filter(message => message.event === 'state').length,
        audioMessages: h.messages.filter(message => message.event === 'audio').length, ...h.counters }));
});
