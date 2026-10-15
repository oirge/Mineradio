import assert from 'node:assert/strict';
import test from 'node:test';
import { beginWallCatalogRefresh, completeWallCatalogRefresh, emptyWallCatalog, patchWallCatalogTracks, previewWallCatalogRefresh } from '../vendor-src/folia/src/mineradio/local/wallCatalogData.ts';

// tests/folia-wall-catalog.test.mjs
// Catalog refreshes must preserve mounted wall content and unaffected visual object identities.
const scope = JSON.stringify(['library', '']);
const song = (id, overrides = {}) => ({ id, title: `Track ${id}`, artist: 'Artist', album: 'Album', duration: 120,
    cover: `/cover/${id}.jpg`, liked: false, filePath: `D:/Music/${id}.mp3`, format: 'mp3', ...overrides });
const loaded = () => completeWallCatalogRefresh(emptyWallCatalog(scope), scope, [song('a'), song('b')]);

test('first-page previews are usable, accept late metadata, and never truncate an already complete wall', () => {
    const initial = previewWallCatalogRefresh(emptyWallCatalog(scope), scope, [song('a')]);
    assert.equal(initial.loaded, false);
    assert.equal(initial.loading, true);
    assert.equal(initial.songs.length, 1);
    const patched = patchWallCatalogTracks(initial, scope, [song('a', { cover: '/fresh.jpg' })]);
    assert.equal(patched.songs[0].album.coverUrl, '/fresh.jpg');
    const complete = completeWallCatalogRefresh(patched, scope, [song('a'), song('b')], new Map([['a', patched.tracks[0]]]));
    assert.equal(complete.songs[0], patched.songs[0]);
    assert.equal(complete.loaded, true);
    assert.equal(previewWallCatalogRefresh(complete, scope, [song('a')]), complete);
    assert.equal(previewWallCatalogRefresh(initial, 'other', [song('c')]), initial);
});

test('an incomplete first-page preview keeps the loaded prefix and reports a retryable error', () => {
    const preview = previewWallCatalogRefresh(emptyWallCatalog(scope), scope, [song('a'), song('b')]);
    const failed = { ...preview, loading: false, error: 'Incomplete catalog page' };
    assert.deepEqual(failed.songs.map(item => item.id), ['a', 'b']);
    assert.equal(failed.loaded, false);
    assert.equal(failed.error, 'Incomplete catalog page');
    const retrying = beginWallCatalogRefresh(failed, scope);
    assert.equal(retrying.loading, true);
    assert.equal(retrying.error, '');
    assert.equal(retrying.songs, failed.songs);
});

test('revision refresh retains mounted content and never shows foreground loading', () => {
    const previous = loaded();
    const refreshing = beginWallCatalogRefresh(previous, scope);
    assert.equal(refreshing, previous);
    assert.equal(refreshing.loading, false);
    assert.equal(refreshing.tracks, previous.tracks);
    assert.equal(refreshing.songs, previous.songs);
});

test('favorite changes update host metadata but keep the complete visual song array stable', () => {
    const previous = loaded();
    const next = completeWallCatalogRefresh(previous, scope, [song('a', { liked: true }), song('b')]);
    assert.equal(next.tracks[0].liked, true);
    assert.notEqual(next.tracks[0], previous.tracks[0]);
    assert.equal(next.tracks[1], previous.tracks[1]);
    assert.equal(next.songs, previous.songs);
});

test('unchanged replies retain snapshot and changed artwork replaces only its song', () => {
    const previous = loaded();
    assert.equal(completeWallCatalogRefresh(previous, scope, [song('a'), song('b')]), previous);
    const next = completeWallCatalogRefresh(previous, scope, [song('a', { cover: '/new.jpg' }), song('b')]);
    assert.notEqual(next.songs[0], previous.songs[0]);
    assert.equal(next.songs[0].album.coverUrl, '/new.jpg');
    assert.equal(next.songs[1], previous.songs[1]);
    assert.equal(next.tracks[1], previous.tracks[1]);
});

test('artwork completion patches only its wall tile without refetching the collection', () => {
    const previous = loaded();
    const changed = song('b', { cover: '/new-b.jpg' });
    const next = patchWallCatalogTracks(previous, scope, [changed]);
    assert.equal(next.songs[1].album.coverUrl, '/new-b.jpg');
    assert.notEqual(next.songs[1], previous.songs[1]);
    assert.equal(next.songs[0], previous.songs[0]);
    assert.equal(next.tracks[0], previous.tracks[0]);
    assert.equal(patchWallCatalogTracks(next, scope, [changed]), next);
});

test('one asset batch updates every affected wall tile', () => {
    const previous = loaded();
    const next = patchWallCatalogTracks(previous, scope, [
        song('a', { cover: '/new-a.jpg' }), song('b', { cover: '/new-b.jpg' }),
    ]);
    assert.deepEqual(next.songs.map(item => item.album.coverUrl), ['/new-a.jpg', '/new-b.jpg']);
});

test('an in-flight stale page cannot overwrite artwork that completed after the request began', () => {
    const previous = loaded();
    const changed = song('b', { cover: '/new-b.jpg' });
    const patched = patchWallCatalogTracks(beginWallCatalogRefresh(previous, scope), scope, [changed]);
    const completed = completeWallCatalogRefresh(patched, scope, [song('a'), song('b')], new Map([['b', changed]]));
    assert.equal(completed.songs[1].album.coverUrl, '/new-b.jpg');
    assert.equal(completed.songs[1], patched.songs[1]);
    assert.equal(completed.songs[0], previous.songs[0]);
});

test('reordering and deleting retain identities by ID while reflecting the new collection', () => {
    const previous = loaded();
    const reordered = completeWallCatalogRefresh(previous, scope, [song('b'), song('a')]);
    assert.equal(reordered.tracks[0], previous.tracks[1]);
    assert.equal(reordered.songs[0], previous.songs[1]);
    const removed = completeWallCatalogRefresh(reordered, scope, [song('b')]);
    assert.equal(removed.tracks.length, 1);
    assert.equal(removed.songs[0], previous.songs[1]);
});

test('switching collection clears old tiles and rejects a stale prior collection response', () => {
    const nextScope = JSON.stringify(['special-liked', '']);
    const next = beginWallCatalogRefresh(loaded(), nextScope);
    assert.equal(next.loading, true);
    assert.deepEqual(next.tracks, []);
    assert.deepEqual(next.songs, []);
    assert.equal(completeWallCatalogRefresh(next, scope, [song('a')]), next);
    const completed = completeWallCatalogRefresh(next, nextScope, [song('a', { liked: true })]);
    assert.equal(completed.loading, false);
    assert.equal(completed.songs[0].sourceRef.mediaId, 'a');
    assert.equal(completed.songs[0].durationMs, 120000);
});

test('large catalog refresh keeps the full collection and stable identities across late edits and reordering', () => {
    const tracks = Array.from({ length: 50_000 }, (_, index) => song(String(index)));
    const previous = completeWallCatalogRefresh(emptyWallCatalog(scope), scope, tracks);
    assert.equal(previous.tracks.length, 50_000);
    assert.equal(previous.songs[49_999].localRef.songId, '49999');
    assert.equal(completeWallCatalogRefresh(previous, scope, tracks), previous);

    const edited = tracks.slice();
    edited[49_999] = { ...edited[49_999], liked: true };
    const favorite = completeWallCatalogRefresh(previous, scope, edited);
    assert.equal(favorite.tracks[49_999].liked, true);
    assert.equal(favorite.songs, previous.songs);
    assert.equal(favorite.tracks[0], previous.tracks[0]);

    const reordered = completeWallCatalogRefresh(favorite, scope, edited.toReversed());
    assert.equal(reordered.tracks.length, 50_000);
    assert.equal(reordered.tracks[0], favorite.tracks[49_999]);
    assert.equal(reordered.songs[0], favorite.songs[49_999]);
    assert.equal(reordered.songs[49_999], favorite.songs[0]);
});
