import assert from 'node:assert/strict';
import test from 'node:test';
import { beginWallCatalogRefresh, completeWallCatalogRefresh, emptyWallCatalog } from '../vendor-src/folia/src/mineradio/local/wallCatalogData.ts';

// tests/folia-wall-catalog.test.mjs
// Catalog refreshes must preserve mounted wall content and unaffected visual object identities.
const scope = JSON.stringify(['library', '']);
const song = (id, overrides = {}) => ({ id, title: `Track ${id}`, artist: 'Artist', album: 'Album', duration: 120,
    cover: `/cover/${id}.jpg`, liked: false, filePath: `D:/Music/${id}.mp3`, format: 'mp3', ...overrides });
const loaded = () => completeWallCatalogRefresh(emptyWallCatalog(scope), scope, [song('a'), song('b')]);

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
