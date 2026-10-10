import { describe, expect, it } from 'vitest';
import {
    getSongThemeAutoGenerationKey,
    hasSongThemePromptSource,
    isSongThemeGenerationStillCurrent,
    shouldRequestSongThemeAutoGeneration,
} from '@/utils/songThemeAutoGeneration';
import type { LyricData, SongResult } from '@/types';

// test/unit/theme/songThemeAutoGeneration.test.ts
// Verifies the pure guards used before slow AI song-theme generation requests.

const song = {
    id: 101,
    name: 'Test Song',
} as SongResult;

const lyrics = {
    lines: [{ fullText: 'hello theme' }],
} as LyricData;

describe('songThemeAutoGeneration', () => {
    it('keeps the same generation key across repeated song object instances', () => {
        expect(getSongThemeAutoGenerationKey(song)).toBe('online:netease:101');
        expect(getSongThemeAutoGenerationKey({ ...song } as SongResult)).toBe('online:netease:101');
        expect(getSongThemeAutoGenerationKey(null)).toBeNull();
    });

    it('keeps prompt-source readiness stable across repeated lyric object instances', () => {
        expect(hasSongThemePromptSource(song, lyrics)).toBe(true);
        expect(hasSongThemePromptSource({ ...song } as SongResult, {
            lines: [...lyrics.lines],
        } as LyricData)).toBe(true);
        expect(hasSongThemePromptSource({ ...song, isPureMusic: true } as SongResult, null)).toBe(true);
    });

    it('skips when the parent auto-switch setting is disabled', () => {
        expect(shouldRequestSongThemeAutoGeneration({
            enabled: false,
            currentSong: song,
            lyrics,
            isLyricsLoading: false,
            hasAttempted: false,
            hasCachedTheme: false,
        })).toBe(false);
    });

    it('skips songs that already have a cached theme', () => {
        expect(shouldRequestSongThemeAutoGeneration({
            enabled: true,
            currentSong: song,
            lyrics,
            isLyricsLoading: false,
            hasAttempted: false,
            hasCachedTheme: true,
        })).toBe(false);
    });

    it('skips repeated attempts for the same song', () => {
        expect(shouldRequestSongThemeAutoGeneration({
            enabled: true,
            currentSong: song,
            lyrics,
            isLyricsLoading: false,
            hasAttempted: true,
            hasCachedTheme: false,
        })).toBe(false);
    });

    it('skips songs with no lyrics unless they are pure music', () => {
        expect(shouldRequestSongThemeAutoGeneration({
            enabled: true,
            currentSong: song,
            lyrics: { lines: [] } as LyricData,
            isLyricsLoading: false,
            hasAttempted: false,
            hasCachedTheme: false,
        })).toBe(false);

        expect(shouldRequestSongThemeAutoGeneration({
            enabled: true,
            currentSong: { ...song, isPureMusic: true } as SongResult,
            lyrics: { lines: [] } as LyricData,
            isLyricsLoading: false,
            hasAttempted: false,
            hasCachedTheme: false,
        })).toBe(true);
    });

    it('detects stale generation results', () => {
        expect(isSongThemeGenerationStillCurrent({
            latestSongKey: '202',
            targetSongKey: '101',
            enabled: true,
        })).toBe(false);
        expect(isSongThemeGenerationStillCurrent({
            latestSongKey: '101',
            targetSongKey: '101',
            enabled: false,
        })).toBe(false);
    });

    it('still waits for a prompt source by default', () => {
        expect(shouldRequestSongThemeAutoGeneration({
            enabled: true,
            currentSong: song,
            lyrics: null,
            isLyricsLoading: false,
            hasAttempted: false,
            hasCachedTheme: false,
        })).toBe(false);
    });

    it('generates without lyrics when the source does not need a prompt', () => {
        // Cover-derived themes read the artwork, so an instrumental with no lyrics still qualifies.
        expect(shouldRequestSongThemeAutoGeneration({
            enabled: true,
            currentSong: song,
            lyrics: null,
            isLyricsLoading: false,
            hasAttempted: false,
            hasCachedTheme: false,
            requiresPromptSource: false,
        })).toBe(true);
    });

    it('still respects the other guards when no prompt source is required', () => {
        const base = {
            currentSong: song,
            lyrics: null,
            isLyricsLoading: false,
            hasAttempted: false,
            hasCachedTheme: false,
            requiresPromptSource: false,
        };

        expect(shouldRequestSongThemeAutoGeneration({ ...base, enabled: false })).toBe(false);
        expect(shouldRequestSongThemeAutoGeneration({ ...base, enabled: true, hasCachedTheme: true })).toBe(false);
        expect(shouldRequestSongThemeAutoGeneration({ ...base, enabled: true, hasAttempted: true })).toBe(false);
        expect(shouldRequestSongThemeAutoGeneration({ ...base, enabled: true, isLyricsLoading: true })).toBe(false);
    });
});
