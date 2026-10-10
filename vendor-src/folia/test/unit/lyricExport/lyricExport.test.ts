import { beforeEach, describe, expect, it, vi } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import type { LyricData } from '@/types';

// test/unit/lyricExport/lyricExport.test.ts
// Covers the batch lyric export: cache grouping, name resolution order, and archive layout.

const cacheEntriesMock = vi.hoisted(() => vi.fn());
const saveToCacheMock = vi.hoisted(() => vi.fn());
const songDetailMock = vi.hoisted(() => vi.fn());

// The collector reads through the repository so read errors surface; the name index goes through
// the forgiving db.ts wrapper. Both are served from the same fake cache.
vi.mock('@/services/db', () => ({
    getCacheEntriesByKey: cacheEntriesMock,
    saveToCache: saveToCacheMock,
}));

vi.mock('@/services/repositories/cacheRepository', () => ({
    readCacheEntriesByKey: cacheEntriesMock,
}));

vi.mock('@/services/onlineMusic/omni', () => ({
    omni: { getSongDetail: songDetailMock },
}));

const { collectOnlineLyrics, parseOnlineLyricCacheKey } = await import('@/services/lyricExport/collectOnlineLyrics');
const { resolveExportMetadata } = await import('@/services/lyricExport/resolveExportMetadata');
const { buildLyricExportArchive, createUniqueNameAllocator } = await import('@/services/lyricExport/buildLyricExportArchive');
const { buildLyricArchiveFolder, buildLyricFileBaseName } = await import('@/services/lyricExport/lyricExportFiles');

const lyrics = (text: string, extra: Partial<LyricData> = {}): LyricData => ({
    isWordByWord: true,
    lines: [{ startTime: 1, endTime: 2, fullText: text, words: [{ text, startTime: 1, endTime: 2 }] }],
    ...extra,
});

type Entry = { key: string; data: unknown; timestamp: number };
const entry = (key: string, data: unknown): Entry => ({ key, data, timestamp: 0 });

/** Serves the fake cache through the same key predicate the real scan uses. */
const serveCache = (entries: Entry[]) => {
    cacheEntriesMock.mockImplementation(async (predicate: (key: string) => boolean) => (
        entries.filter(item => predicate(item.key))
    ));
};

beforeEach(() => {
    cacheEntriesMock.mockReset();
    saveToCacheMock.mockReset();
    songDetailMock.mockReset();
});

describe('parseOnlineLyricCacheKey', () => {
    it('maps provider-prefixed and legacy NetEase keys onto one song key', () => {
        expect(parseOnlineLyricCacheKey('online:qq:abc')).toEqual({ songKey: 'online:qq:abc', providerId: 'qq', mediaId: 'abc' });
        expect(parseOnlineLyricCacheKey('123')?.songKey).toBe('online:netease:123');
        expect(parseOnlineLyricCacheKey('cloud_123')?.songKey).toBe('online:netease:123');
        expect(parseOnlineLyricCacheKey('something_else')).toBeNull();
    });
});

describe('collectOnlineLyrics', () => {
    it('exports what playback would show and reports what it skips', async () => {
        serveCache([
            entry('lyric_online:netease:1', lyrics('provider')),
            entry('lyric_online:netease:1_state', { lyricsSource: 'imported', importedLyrics: lyrics('imported'), hasOnlineOverride: false }),
            entry('lyric_online:netease:1_meta', { title: 'Song One', artist: 'Artist' }),
            entry('lyric_online:netease:2', lyrics('instrumental?')),
            entry('lyric_online:netease:2_state', { lyricsSource: 'online', hasOnlineOverride: true, onlineOverrideLyrics: null }),
            entry('lyric_online:qq:3', lyrics('plain')),
            entry('lyric_online:qq:9_meta', { title: 'Orphan' }),
        ]);

        const result = await collectOnlineLyrics();

        expect(result.entries.map(item => [item.songKey, item.source, item.lyrics.lines[0].fullText])).toEqual([
            ['online:netease:1', 'imported', 'imported'],
            ['online:qq:3', 'online', 'plain'],
        ]);
        expect(result.entries[0].song).toMatchObject({ title: 'Song One', artist: 'Artist' });
        expect(result.entries[0].offsetKey).toBe('1');
        expect(result.skipped).toEqual([{ songKey: 'online:netease:2', label: undefined, reason: 'pureMusic' }]);
    });

    it('prefers the provider-prefixed entry over a legacy NetEase one', async () => {
        serveCache([
            entry('lyric_online:netease:5', lyrics('current')),
            entry('lyric_5', lyrics('legacy')),
        ]);
        const result = await collectOnlineLyrics();
        expect(result.entries).toHaveLength(1);
        expect(result.entries[0].lyrics.lines[0].fullText).toBe('current');
    });

    it('ignores legacy state keys, which playback never reads', async () => {
        serveCache([
            entry('lyric_online:netease:6', lyrics('shown by playback')),
            entry('lyric_online:netease:6_state', { lyricsSource: 'online', hasOnlineOverride: false }),
            entry('lyric_6_state', { lyricsSource: 'online', hasOnlineOverride: true, onlineOverrideLyrics: null }),
            entry('lyric_cloud_6_state', { lyricsSource: 'imported', importedLyrics: lyrics('stale import') }),
        ]);
        const result = await collectOnlineLyrics();
        expect(result.skipped).toEqual([]);
        expect(result.entries[0].lyrics.lines[0].fullText).toBe('shown by playback');
        expect(result.entries[0].source).toBe('online');
    });

    it('keys the offset by the song id the sidecar recorded, not the cache key', async () => {
        serveCache([
            entry('lyric_online:qq:songMid', lyrics('qq')),
            entry('lyric_online:qq:songMid_meta', { title: 'T', artist: 'A', songId: 12345 }),
        ]);
        const [collected] = (await collectOnlineLyrics()).entries;
        expect(collected.offsetKey).toBe(12345);
        expect(collected.song).not.toHaveProperty('songId');
    });

    it('trusts a recorded instrumental verdict the way playback does', async () => {
        serveCache([
            entry('lyric_online:netease:7', lyrics('纯音乐，请欣赏')),
            entry('lyric_online:netease:7_state', { lyricsSource: 'online', hasOnlineOverride: true, onlineOverrideLyrics: lyrics('纯音乐，请欣赏'), matchedIsPureMusic: false }),
        ]);
        const result = await collectOnlineLyrics();
        expect(result.entries).toHaveLength(1);
        expect(result.skipped).toEqual([]);
    });

    it('does not take names from the lyrics\' own [ti:] tag', async () => {
        serveCache([entry('lyric_online:netease:8', lyrics('x', { title: 'Tag Title' }))]);
        const [collected] = (await collectOnlineLyrics()).entries;
        expect(collected.song.title).toBeUndefined();
    });

    it('does not export lyrics that are nothing but interludes', async () => {
        serveCache([entry('lyric_online:netease:9', { lines: [{ startTime: 0.5, endTime: 3, fullText: '......', words: [] }] })]);
        const result = await collectOnlineLyrics();
        expect(result.entries).toEqual([]);
        expect(result.skipped).toEqual([expect.objectContaining({ songKey: 'online:netease:9', reason: 'noLyrics' })]);
    });

    it('lets a failed cache read surface instead of reporting nothing to export', async () => {
        cacheEntriesMock.mockRejectedValue(new Error('IndexedDB unavailable'));
        await expect(collectOnlineLyrics()).rejects.toThrow('IndexedDB unavailable');
    });
});

describe('resolveExportMetadata', () => {
    const base = (songKey: string, mediaId: string) => ({
        songKey,
        lyrics: lyrics('x'),
        source: 'online' as const,
        song: { key: songKey },
        providerRef: { providerId: 'netease', mediaId },
    });

    it('uses cached song lists before asking the provider', async () => {
        serveCache([
            entry('last_queue', [{ id: 7, name: 'Cached Name', artists: [{ id: 1, name: 'Cached Artist' }], album: { id: 0, name: '' }, durationMs: 0 }]),
        ]);

        const [resolved] = await resolveExportMetadata([base('online:netease:7', '7')], { resolveOnline: true });

        expect(resolved.song).toMatchObject({ title: 'Cached Name', artist: 'Cached Artist' });
        expect(resolved.offsetKey).toBe(7);
        expect(songDetailMock).not.toHaveBeenCalled();
    });

    it('keeps looking while the artist is missing, and uses the lyric tags only as a last resort', async () => {
        serveCache([]);
        songDetailMock.mockResolvedValue({ id: 'num', name: 'Real Title', artists: [{ id: 1, name: 'Real Artist' }], album: { id: 0, name: '' }, durationMs: 0 });
        const titleOnly = { ...base('online:netease:3', '3'), song: { key: 'online:netease:3', title: 'Real Title' } };
        const [resolved] = await resolveExportMetadata([titleOnly], { resolveOnline: true });
        expect(resolved.song).toMatchObject({ title: 'Real Title', artist: 'Real Artist' });
        expect(resolved.offsetKey).toBe('num');

        const tagged = { ...base('online:netease:4', '4'), lyrics: lyrics('x', { title: 'Tag Title', artist: 'Tag Artist' }) };
        const [offline] = await resolveExportMetadata([tagged], { resolveOnline: false });
        expect(offline.song).toMatchObject({ title: 'Tag Title', artist: 'Tag Artist' });
    });

    it('falls back to Omni, remembers the answer, and survives failures', async () => {
        serveCache([]);
        songDetailMock.mockImplementation(async (_provider: string, id: string) => {
            if (id === '8') return { id: 8, name: 'Remote Name', artists: [{ id: 1, name: 'Remote Artist' }], album: { id: 0, name: 'LP' }, durationMs: 1000 };
            throw new Error('network');
        });
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const [found, failed] = await resolveExportMetadata(
            [base('online:netease:8', '8'), base('online:netease:9', '9')],
            { resolveOnline: true },
        );

        expect(found.song).toMatchObject({ title: 'Remote Name', artist: 'Remote Artist', album: 'LP' });
        expect(saveToCacheMock).toHaveBeenCalledWith('lyric_online:netease:8_meta', expect.objectContaining({ title: 'Remote Name', songId: 8 }));
        expect(failed.song.title).toBeUndefined();
        expect(buildLyricFileBaseName(failed)).toBe('online_netease_9');
        warn.mockRestore();
    });

    it('stays offline when online resolution is off', async () => {
        serveCache([]);
        await resolveExportMetadata([base('online:netease:8', '8')], { resolveOnline: false });
        expect(songDetailMock).not.toHaveBeenCalled();
    });
});

describe('local song naming', () => {
    it('names a local song after its audio file and mirrors its folder', () => {
        const entry = { songKey: 'local:x', song: { title: 'Pretty Title', artist: 'A' }, localPath: 'Music/Disc 1/01 Track' };
        expect(buildLyricFileBaseName(entry)).toBe('01 Track');
        expect(buildLyricArchiveFolder(entry)).toBe('local/Music/Disc 1');
        expect(buildLyricArchiveFolder({})).toBe('online');
    });

    it('lets untouched names win and records the ones that had to move', async () => {
        const local = (key: string, localPath: string) => ({ songKey: key, lyrics: lyrics(key), source: 'online' as const, song: {}, localPath });
        const archive = await buildLyricExportArchive([
            local('colon', 'Music/a:b'),
            local('plain', 'Music/a_b'),
            local('mp3', 'Music/Song'),
            local('flac', 'Music/Song'),
        ], [], ['lrc'], { includeTranslation: true, includeRomanization: true });

        const byKey = Object.fromEntries(archive.manifest.exported.map(item => [item.songKey, item]));
        // The real `a_b` keeps its own name even though `a:b` came first.
        expect(byKey.plain.files).toEqual(['lrc/local/Music/a_b.lrc']);
        expect(byKey.plain.renamedFrom).toBeUndefined();
        expect(byKey.colon).toMatchObject({ files: ['lrc/local/Music/a_b (2).lrc'], renamedFrom: 'Music/a:b' });
        // Two audio files differing only in extension cannot both own `Song.lrc`.
        expect(byKey.mp3.files).toEqual(['lrc/local/Music/Song.lrc']);
        expect(byKey.flac).toMatchObject({ files: ['lrc/local/Music/Song (2).lrc'], renamedFrom: 'Music/Song' });
    });

    it('lays local songs out as sidecars inside the archive', async () => {
        const local = { songKey: 'local:1', lyrics: lyrics('hi'), source: 'online' as const, song: { title: 'T' }, localPath: 'Music/Disc 1/01 Track' };
        const archive = await buildLyricExportArchive([local], [], ['lrc'], { includeTranslation: true, includeRomanization: true });
        const files = unzipSync(new Uint8Array(await archive.blob.arrayBuffer()));
        expect(Object.keys(files)).toContain('lrc/local/Music/Disc 1/01 Track.lrc');
    });
});

describe('buildLyricExportArchive', () => {
    it('deduplicates names case-insensitively', () => {
        const allocate = createUniqueNameAllocator();
        expect(allocate('Song', 'lrc')).toBe('Song.lrc');
        expect(allocate('song', 'lrc')).toBe('song (2).lrc');
        expect(allocate('Song', 'fia')).toBe('Song.fia');
    });

    it('writes one folder per format plus a manifest', async () => {
        const song = { songKey: 'online:netease:1', lyrics: lyrics('hello'), source: 'online' as const, song: { title: 'T', artist: 'A' } };
        const archive = await buildLyricExportArchive(
            [song, { ...song, songKey: 'online:netease:2' }],
            [{ songKey: 'online:netease:3', reason: 'pureMusic' }],
            ['fia', 'lrc'],
            { includeTranslation: true, includeRomanization: true },
            new Date(2026, 0, 2, 3, 4, 5),
        );

        expect(archive.fileName).toBe('folia-lyrics-2026-01-02-03-04-05.zip');
        const files = unzipSync(new Uint8Array(await archive.blob.arrayBuffer()));
        expect(Object.keys(files).sort()).toEqual([
            'fia/online/T - A (2).fia',
            'fia/online/T - A.fia',
            'lrc/online/T - A (2).lrc',
            'lrc/online/T - A.lrc',
            'manifest.json',
        ]);
        expect(JSON.parse(strFromU8(files['fia/online/T - A.fia'])).format).toBe('folia-lyricdata');
        expect(strFromU8(files['lrc/online/T - A.lrc'])).toContain('[00:01.00]<00:01.000>hello<00:02.000>');
        const manifest = JSON.parse(strFromU8(files['manifest.json']));
        expect(manifest.exported).toHaveLength(2);
        expect(manifest.skipped).toEqual([{ songKey: 'online:netease:3', reason: 'pureMusic' }]);
    });
});
