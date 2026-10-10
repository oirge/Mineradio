import { describe, expect, it } from 'vitest';
import { buildAmllDbSearchQueries, toAmllDbSongResult, toAmllDbSongResults } from '@/utils/lyrics/amllDbCandidates';
import type { AmllApiSongItem } from '@/utils/lyrics/providers/amllApi';

// test/unit/lyrics/amllDbCandidates.test.ts

const songItem = (overrides: Partial<AmllApiSongItem> = {}): AmllApiSongItem => ({
    id: 4438332652147575,
    filename: '1707033916660-39523898-506d891b.ttml',
    createdAt: 1707033916660,
    musicNames: ['祝福'],
    artistNames: ['YOASOBI'],
    albumNames: ['祝福', 'THE BOOK 3'],
    ncmMusicIds: ['1983292457', '2083872223'],
    qqMusicIds: ['001KEjQl07j8DG', '000zi9gH0OEMMu'],
    appleMusicIds: [],
    spotifyIds: [],
    isrcs: [],
    authorIds: ['39523898'],
    authorUsernames: ['Steve-xmh'],
    ...overrides,
});

describe('buildAmllDbSearchQueries', () => {
    it('turns the structured default query into musicName + first artist, then musicName only', () => {
        expect(buildAmllDbSearchQueries('Idol - YOASOBI, Ikura - Idol')).toEqual([
            { musicName: 'Idol', artistName: 'YOASOBI' },
            { musicName: 'Idol' },
        ]);
        expect(buildAmllDbSearchQueries('夜に駆ける - YOASOBI feat. someone')).toEqual([
            { musicName: '夜に駆ける', artistName: 'YOASOBI' },
            { musicName: '夜に駆ける' },
        ]);
    });

    it('retries without a bracketed title suffix before dropping the artist', () => {
        expect(buildAmllDbSearchQueries('Idol (TV Size) - YOASOBI - Idol')).toEqual([
            { musicName: 'Idol (TV Size)', artistName: 'YOASOBI' },
            { musicName: 'Idol', artistName: 'YOASOBI' },
            { musicName: 'Idol' },
        ]);
        expect(buildAmllDbSearchQueries('春を発つ【Live】(2024) - 花譜')[1]).toEqual({ musicName: '春を発つ', artistName: '花譜' });
    });

    it('does not split artist names on a slash', () => {
        expect(buildAmllDbSearchQueries('Highway to Hell - AC/DC')[0]).toEqual({ musicName: 'Highway to Hell', artistName: 'AC/DC' });
    });

    it('searches input without " - " as a title first, then as a keyword query', () => {
        expect(buildAmllDbSearchQueries('雨')).toEqual([{ musicName: '雨' }, { q: '雨' }]);
        expect(buildAmllDbSearchQueries('  Idol YOASOBI ')).toEqual([{ musicName: 'Idol YOASOBI' }, { q: 'Idol YOASOBI' }]);
        expect(buildAmllDbSearchQueries('A-ha')).toEqual([{ musicName: 'A-ha' }, { q: 'A-ha' }]);
        expect(buildAmllDbSearchQueries('   ')).toEqual([]);
    });
});

describe('toAmllDbSongResult', () => {
    it('prefers the NetEase id and keeps it numeric', () => {
        expect(toAmllDbSongResult(songItem())).toEqual({
            id: 1983292457,
            name: '祝福',
            artists: [{ id: 0, name: 'YOASOBI' }],
            album: { id: 0, name: '祝福' },
            durationMs: 0,
            amllDbPlatform: 'ncm',
        });
    });

    it('falls back to QQ and records a mid as qqMid', () => {
        const result = toAmllDbSongResult(songItem({ ncmMusicIds: [] }));
        expect(result).toMatchObject({ id: '001KEjQl07j8DG', qqMid: '001KEjQl07j8DG', amllDbPlatform: 'qq' });
    });

    it('keeps numeric QQ ids as numbers without qqMid', () => {
        const result = toAmllDbSongResult(songItem({ ncmMusicIds: [], qqMusicIds: ['296021954'] }));
        expect(result).toMatchObject({ id: 296021954, amllDbPlatform: 'qq' });
        expect(result).not.toHaveProperty('qqMid');
    });

    it('skips entries without a NetEase or QQ id', () => {
        expect(toAmllDbSongResult(songItem({ ncmMusicIds: [], qqMusicIds: [], spotifyIds: ['x'] }))).toBeNull();
    });
});

describe('toAmllDbSongResults', () => {
    it('dedupes historical versions by platform id, keeping the first one', () => {
        const results = toAmllDbSongResults([
            songItem({ id: 2, musicNames: ['Newest'] }),
            songItem({ id: 1, musicNames: ['Older'] }),
            songItem({ id: 3, ncmMusicIds: [], qqMusicIds: ['003Unrelated0'] }),
        ]);
        expect(results.map(result => [result.name, result.id])).toEqual([
            ['Newest', 1983292457],
            ['祝福', '003Unrelated0'],
        ]);
    });

    it('treats versions as the same song when any platform id overlaps, regardless of order', () => {
        const results = toAmllDbSongResults([
            songItem({ ncmMusicIds: ['1983292457', '2083872223'] }),
            songItem({ ncmMusicIds: ['2083872223', '1983292457'], musicNames: ['Reordered'] }),
            songItem({ ncmMusicIds: [], qqMusicIds: ['000zi9gH0OEMMu'], musicNames: ['Shares a QQ id'] }),
        ]);
        expect(results.map(result => result.name)).toEqual(['祝福']);
    });
});
