import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalSong, LyricData } from '@/types';

// test/unit/lyricExport/collectLocalLyrics.test.ts
// The local-library export only carries lyrics Folia matched online, named after the audio file.

const localSongsMock = vi.hoisted(() => vi.fn());
vi.mock('@/services/db', () => ({ getLocalSongs: localSongsMock }));

const { collectLocalLyrics } = await import('@/services/lyricExport/collectLocalLyrics');

const lyrics = (text: string): LyricData => ({
    isWordByWord: false,
    lines: [{ startTime: 1, endTime: 2, fullText: text, words: [] }],
});

const song = (id: string, patch: Partial<LocalSong>): LocalSong => ({
    id,
    fileName: `${id}.flac`,
    filePath: `Music/Album/${id}.flac`,
    title: id,
    titleOrigin: 'import',
    importedMetadata: { title: id, titleSource: 'filename', artistNames: ['Artist'] },
    duration: 1000,
    fileSize: 1,
    mimeType: 'audio/flac',
    addedAt: 0,
    ...patch,
} as LocalSong);

beforeEach(() => localSongsMock.mockReset());

describe('collectLocalLyrics', () => {
    it('exports only online-matched lyrics, with the audio path for naming', async () => {
        localSongsMock.mockResolvedValue([
            song('matched', { matchedLyrics: lyrics('from online'), lyricsSource: 'online' }),
            song('sidecar', { hasLocalLyrics: true, localLyricsContent: '[00:01.00]on disk' }),
            song('embedded', { hasEmbeddedLyrics: true, embeddedLyricsContent: '[00:01.00]in tags' }),
            song('none', {}),
        ]);

        const result = await collectLocalLyrics('local');

        expect(result.entries.map(entry => [entry.localPath, entry.lyrics.lines[0].fullText, entry.source])).toEqual([
            ['Music/Album/matched', 'from online', 'online'],
        ]);
        expect(result.skipped).toEqual([]);
    });

    it('follows the priority setting when no source was pinned', async () => {
        const both = song('both', { matchedLyrics: lyrics('from online'), hasLocalLyrics: true, localLyricsContent: '[00:01.00]on disk' });
        localSongsMock.mockResolvedValue([both]);

        expect((await collectLocalLyrics('local')).entries).toHaveLength(0);
        expect((await collectLocalLyrics('online')).entries).toHaveLength(1);
    });

    it('reports online matches that turned out to be instrumental', async () => {
        localSongsMock.mockResolvedValue([song('inst', { lyricsSource: 'online', matchedIsPureMusic: true })]);
        const result = await collectLocalLyrics('local');
        expect(result.entries).toHaveLength(0);
        expect(result.skipped).toEqual([expect.objectContaining({ reason: 'pureMusic' })]);
    });
});
