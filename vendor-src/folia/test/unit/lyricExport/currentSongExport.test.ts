import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LyricData, SongResult } from '@/types';

// test/unit/lyricExport/currentSongExport.test.ts
// Single-song export reads the song's raw lyric source, not the lyrics the display setter produced.

const loadStateMock = vi.hoisted(() => vi.fn());
const songCacheMock = vi.hoisted(() => vi.fn());
const segmentationMock = vi.hoisted(() => vi.fn());

vi.mock('@/utils/onlineLyricsState', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/utils/onlineLyricsState')>()),
    loadOnlineLyricsState: loadStateMock,
}));
vi.mock('@/services/onlineMusic/resourceCache', () => ({ getSongCacheWithLegacyMigration: songCacheMock }));
vi.mock('@/services/lyricSegmentation', () => ({ loadSegmentationBySongKey: segmentationMock }));
vi.mock('@/services/db', () => ({ getLocalSongs: vi.fn(async () => []), saveToCache: vi.fn() }));

const { buildCurrentSongExportEntry } = await import('@/services/lyricExport/currentSongExport');

const lines = (...texts: string[]): LyricData => ({
    isWordByWord: false,
    lines: texts.map((fullText, index) => ({ startTime: index * 2, endTime: index * 2 + 1, fullText, words: [] })),
});

const song = { id: 42, name: 'Song', artists: [{ id: 1, name: 'Artist' }], album: { id: 0, name: '' }, durationMs: 0 } as SongResult;

beforeEach(() => {
    loadStateMock.mockReset();
    songCacheMock.mockReset();
    segmentationMock.mockReset().mockResolvedValue(null);
});

describe('buildCurrentSongExportEntry', () => {
    it('exports the cached lyrics, not the filtered and staff-trimmed ones on screen', async () => {
        loadStateMock.mockResolvedValue(null);
        songCacheMock.mockResolvedValue(lines('作词：someone', 'first line'));

        const entry = await buildCurrentSongExportEntry({
            song,
            onScreenLyrics: lines('first line'),
            activeLocalLyricsSource: null,
            localLyricsPriority: 'local',
        });

        expect(entry?.lyrics.lines.map(line => line.fullText)).toEqual(['作词：someone', 'first line']);
        expect(entry?.song).toMatchObject({ title: 'Song', artist: 'Artist', key: 'online:netease:42' });
    });

    it('prefers an imported file, like playback does', async () => {
        loadStateMock.mockResolvedValue({ lyricsSource: 'imported', importedLyrics: lines('imported'), hasOnlineOverride: false });
        songCacheMock.mockResolvedValue(lines('provider'));

        const entry = await buildCurrentSongExportEntry({ song, onScreenLyrics: null, activeLocalLyricsSource: null, localLyricsPriority: 'local' });

        expect(entry?.source).toBe('imported');
        expect(entry?.lyrics.lines[0].fullText).toBe('imported');
    });

    it('skips an instrumental placeholder, as the batch export does', async () => {
        loadStateMock.mockResolvedValue(null);
        songCacheMock.mockResolvedValue(lines('纯音乐，请欣赏'));

        const entry = await buildCurrentSongExportEntry({ song, onScreenLyrics: lines('纯音乐，请欣赏'), activeLocalLyricsSource: null, localLyricsPriority: 'local' });

        expect(entry).toBeNull();
    });

    it('falls back to the lyrics on screen when nothing is cached yet', async () => {
        loadStateMock.mockResolvedValue(null);
        songCacheMock.mockResolvedValue(null);

        const entry = await buildCurrentSongExportEntry({ song, onScreenLyrics: lines('on screen'), activeLocalLyricsSource: null, localLyricsPriority: 'local' });

        expect(entry?.lyrics.lines[0].fullText).toBe('on screen');
    });
});
