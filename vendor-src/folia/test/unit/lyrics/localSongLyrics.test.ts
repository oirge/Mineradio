import { describe, expect, it } from 'vitest';
import type { LocalSong } from '@/types';
import { resolveLocalSongLyrics, selectLocalSongLyricsSource } from '@/utils/lyrics/localSongLyrics';

// test/unit/lyrics/localSongLyrics.test.ts
// Verifies automatic priority and explicit per-song selections resolve to the actual loaded source.

const buildSong = (patch: Partial<LocalSong> = {}): LocalSong => ({
    id: 'local-song',
    fileName: 'song.flac',
    filePath: 'Library/song.flac',
    title: 'Song',
    titleOrigin: 'import',
    importedMetadata: { title: 'Song', titleSource: 'embedded', artistNames: [], albumName: '' },
    duration: 180000,
    fileSize: 1,
    mimeType: 'audio/flac',
    addedAt: 1,
    hasLocalLyrics: true,
    localLyricsContent: '[00:00.00]Local',
    hasEmbeddedLyrics: true,
    embeddedLyricsContent: '[00:00.00]Embedded',
    matchedLyrics: { lines: [], isWordByWord: false },
    ...patch,
});

describe('local song lyric resolution', () => {
    it('selects the matched online result for an automatic online-first song', async () => {
        const song = buildSong();

        expect(selectLocalSongLyricsSource(song, 'online')).toBe('online');
        await expect(resolveLocalSongLyrics(song, 'online')).resolves.toEqual({
            lyrics: song.matchedLyrics,
            source: 'online',
        });
    });

    it('falls back to local lyrics when an online result is not available', () => {
        expect(selectLocalSongLyricsSource(buildSong({ matchedLyrics: undefined }), 'online')).toBe('local');
    });

    it('keeps an explicit local selection ahead of the automatic online priority', () => {
        expect(selectLocalSongLyricsSource(buildSong({ lyricsSource: 'local' }), 'online')).toBe('local');
    });
});
