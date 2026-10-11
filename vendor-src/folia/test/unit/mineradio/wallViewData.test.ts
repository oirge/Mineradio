import { expect, it } from 'vitest';
import type { LocalWallSong } from '@/mineradio/local/wallCatalogData';
import { buildPosterWallTiles, buildRecordWallItems } from '@/mineradio/local/wallViewData';

// test/unit/mineradio/wallViewData.test.ts
const song = (id: string, artist = 'Artist'): LocalWallSong => ({
    id, name: `Track ${id}`, artists: [{ id: '', name: artist }],
    album: { id: '', name: 'Album', coverUrl: `/cover/${id}.jpg` },
    durationMs: 120000, sourceRef: { kind: 'local', mediaId: id },
    isLocal: true, localRef: { songId: id },
});

it('reuses all unaffected record and poster items after one cover finishes in a 50k-song library', () => {
    const songs = Array.from({ length: 50_000 }, (_, index) => song(String(index)));
    const records = buildRecordWallItems(songs, 'Unknown artist');
    const posters = buildPosterWallTiles(songs, 'local:49999');
    const sameRecords = buildRecordWallItems(songs.slice(), 'Unknown artist', records);
    const samePosters = buildPosterWallTiles(songs.slice(), 'local:49999', posters);
    expect(sameRecords.items).toBe(records.items);
    expect(samePosters.tiles).toBe(posters.tiles);
    let artistReads = 0, songKeyReads = 0;
    for (const entry of songs) {
        Object.defineProperty(entry.artists[0], 'name', {
            get: () => { artistReads++; return 'Artist'; },
        });
        Object.defineProperty(entry.sourceRef, 'mediaId', {
            get: () => { songKeyReads++; return entry.id; },
        });
    }
    const changed = songs.slice();
    changed[25_000] = { ...songs[25_000], album: { ...songs[25_000].album, coverUrl: '/new-cover.jpg' } };
    const nextRecords = buildRecordWallItems(changed, 'Unknown artist', sameRecords);
    const nextPosters = buildPosterWallTiles(changed, 'local:49999', samePosters);

    expect(artistReads).toBeLessThanOrEqual(2);
    expect(songKeyReads).toBeLessThanOrEqual(1);
    expect(nextRecords.items[25_000]).not.toBe(records.items[25_000]);
    expect(nextPosters.tiles[25_000]).not.toBe(posters.tiles[25_000]);
    expect(nextRecords.items[25_000].coverUrl).toBe('/new-cover.jpg');
    expect(nextPosters.tiles[25_000].coverUrl).toBe('/new-cover.jpg');
    expect(nextRecords.items.every((item, index) => index === 25_000 || item === records.items[index])).toBe(true);
    expect(nextPosters.tiles.every((tile, index) => index === 25_000 || tile === posters.tiles[index])).toBe(true);
    expect(nextPosters.tiles[49_999].section).toBe('now');
});

it('advancing to the next song changes only the two affected posters in a 50k-song library', () => {
    const songs = Array.from({ length: 50_000 }, (_, index) => song(String(index)));
    const previous = buildPosterWallTiles(songs, 'local:25000');
    const next = buildPosterWallTiles(songs, 'local:25001', previous);

    expect(next.currentIndex).toBe(25_001);
    expect(next.tiles[25_000].section).toBe('played');
    expect(next.tiles[25_001].section).toBe('now');
    expect(next.tiles[24_999]).toBe(previous.tiles[24_999]);
    expect(next.tiles[25_002]).toBe(previous.tiles[25_002]);
    expect(next.tiles.filter((tile, index) => tile !== previous.tiles[index])).toHaveLength(2);
});

it('updates artwork and playback sections together without replacing unrelated posters', () => {
    const songs = [song('a'), song('b'), song('c'), song('d')];
    const previous = buildPosterWallTiles(songs, 'local:b');
    const changed = songs.slice();
    changed[3] = { ...songs[3], album: { ...songs[3].album, coverUrl: '/new-cover.jpg' } };
    const next = buildPosterWallTiles(changed, 'local:c', previous);

    expect(next.tiles.map(tile => tile.section)).toEqual(['played', 'played', 'now', 'upcoming']);
    expect(next.tiles[3].coverUrl).toBe('/new-cover.jpg');
    expect(next.tiles[0]).toBe(previous.tiles[0]);
    expect(next.tiles[1]).not.toBe(previous.tiles[1]);
    expect(next.tiles[2]).not.toBe(previous.tiles[2]);
    expect(next.tiles[3]).not.toBe(previous.tiles[3]);
});

it('restores poster sections when the playing song leaves and re-enters the collection', () => {
    const songs = [song('a'), song('b'), song('c'), song('d')];
    const current = buildPosterWallTiles(songs, 'local:c');
    const missing = buildPosterWallTiles(songs, 'local:outside', current);
    expect(missing.currentIndex).toBe(-1);
    expect(missing.tiles.map(tile => tile.section)).toEqual(['upcoming', 'upcoming', 'upcoming', 'upcoming']);
    expect(missing.tiles[3]).toBe(current.tiles[3]);
    const stillMissing = buildPosterWallTiles(songs, 'online:outside', missing);
    expect(stillMissing.tiles).toBe(missing.tiles);

    const returned = buildPosterWallTiles(songs, 'local:b', stillMissing);
    expect(returned.tiles.map(tile => tile.section)).toEqual(['played', 'now', 'upcoming', 'upcoming']);
    expect(returned.tiles[3]).toBe(missing.tiles[3]);
});

it('rebuilds entries for reorder, playback changes and translated artist fallback', () => {
    const songs = [song('a', ''), song('b'), song('c')];
    const records = buildRecordWallItems(songs, 'Unknown artist');
    const posters = buildPosterWallTiles(songs, 'local:b');
    const reordered = [songs[2], songs[0], songs[1]];
    const movedRecords = buildRecordWallItems(reordered, 'Unknown artist', records);
    const movedPosters = buildPosterWallTiles(reordered, 'local:b', posters);
    expect(movedRecords.items.map(item => item.id)).toEqual(['c', 'a', 'b']);
    expect(movedRecords.items[1].rawTrackIndex).toBe(1);
    expect(movedPosters.tiles.map(tile => tile.section)).toEqual(['played', 'played', 'now']);
    expect(movedPosters.tiles[0].queueIndex).toBe(0);

    const nextSong = buildPosterWallTiles(reordered, 'local:c', movedPosters);
    expect(nextSong.tiles.map(tile => tile.section)).toEqual(['now', 'upcoming', 'upcoming']);
    const translated = buildRecordWallItems(reordered, 'Artiste inconnu', movedRecords);
    expect(translated.items[1].description).toBe('Artiste inconnu');
});
