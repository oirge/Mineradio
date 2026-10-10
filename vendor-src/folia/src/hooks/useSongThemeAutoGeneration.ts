import { useEffect, useRef } from 'react';
import type { GenerateAIThemeOptions, GenerateAIThemeResult } from './useThemeController';
import type { LyricData, SongResult } from '../types';
import type { ThemeGenerationSource } from '../services/themePreferences';
import { getCachedThemeStateForSong } from '../services/themeCache';
import {
    getSongThemeAutoGenerationKey,
    hasSongThemePromptSource,
    isSongThemeGenerationStillCurrent,
    shouldRequestSongThemeAutoGeneration,
} from '../utils/songThemeAutoGeneration';
import { usePlaybackStore } from '../stores/usePlaybackStore';

// src/hooks/useSongThemeAutoGeneration.ts
// Coordinates delayed AI theme generation for the real current playback song.

type GenerateAITheme = (
    lyrics: LyricData | null,
    currentSong: SongResult | null,
    options?: GenerateAIThemeOptions,
) => Promise<GenerateAIThemeResult>;

type UseSongThemeAutoGenerationParams = {

    enabled: boolean;
    isLyricsLoading: boolean;
    // 'cover' generates from the artwork alone, so it does not wait for a lyric prompt source.
    themeGenerationSource: ThemeGenerationSource;
    generateAITheme: GenerateAITheme;
};

const AUTO_GENERATE_DELAY_MS = 650;

export function useSongThemeAutoGeneration({
    enabled,
    isLyricsLoading,
    themeGenerationSource,
    generateAITheme,
}: UseSongThemeAutoGenerationParams) {
    const currentSong = usePlaybackStore(state => state.currentSong);
    const lyrics = usePlaybackStore(state => state.lyrics);

    const requiresPromptSource = themeGenerationSource !== 'cover';
    const latestSongKeyRef = useRef<string | null>(null);
    const latestEnabledRef = useRef(enabled);
    const latestGenerationInputRef = useRef({ currentSong, lyrics });
    const attemptedSongKeysRef = useRef(new Set<string>());
    const generateAIThemeRef = useRef(generateAITheme);
    const songKey = getSongThemeAutoGenerationKey(currentSong);
    const hasPromptSource = currentSong
        ? hasSongThemePromptSource(currentSong, lyrics)
        : false;

    useEffect(() => {
        generateAIThemeRef.current = generateAITheme;
    }, [generateAITheme]);

    useEffect(() => {
        latestGenerationInputRef.current = { currentSong, lyrics };
    }, [currentSong, lyrics]);

    useEffect(() => {
        latestEnabledRef.current = enabled;
    }, [enabled]);

    useEffect(() => {
        latestSongKeyRef.current = songKey;
    }, [songKey]);

    useEffect(() => {
        const scheduledInput = latestGenerationInputRef.current;
        const scheduledSong = scheduledInput.currentSong;
        if (!scheduledSong || !songKey) {
            return;
        }

        if (!shouldRequestSongThemeAutoGeneration({
            enabled,
            currentSong: scheduledSong,
            lyrics: scheduledInput.lyrics,
            isLyricsLoading,
            hasAttempted: attemptedSongKeysRef.current.has(songKey),
            hasCachedTheme: false,
            requiresPromptSource,
        })) {
            return;
        }

        const targetSongKey = songKey;
        let cancelled = false;
        const timeoutId = window.setTimeout(() => {
            void (async () => {
                if (cancelled || !isSongThemeGenerationStillCurrent({
                    latestSongKey: latestSongKeyRef.current,
                    targetSongKey,
                    enabled: latestEnabledRef.current,
                })) {
                    return;
                }

                const latestInput = latestGenerationInputRef.current;
                const latestSong = latestInput.currentSong;
                if (!latestSong) {
                    return;
                }

                const cachedTheme = await getCachedThemeStateForSong(latestSong);
                if (cancelled || !isSongThemeGenerationStillCurrent({
                    latestSongKey: latestSongKeyRef.current,
                    targetSongKey,
                    enabled: latestEnabledRef.current,
                })) {
                    return;
                }
                if (!shouldRequestSongThemeAutoGeneration({
                    enabled: latestEnabledRef.current,
                    currentSong: latestSong,
                    lyrics: latestInput.lyrics,
                    isLyricsLoading: false,
                    hasAttempted: attemptedSongKeysRef.current.has(targetSongKey),
                    hasCachedTheme: cachedTheme.kind !== 'none',
                    requiresPromptSource,
                })) {
                    attemptedSongKeysRef.current.add(targetSongKey);
                    return;
                }

                attemptedSongKeysRef.current.add(targetSongKey);
                await generateAIThemeRef.current(latestInput.lyrics, latestSong, {
                    source: 'auto',
                    shouldApply: () => isSongThemeGenerationStillCurrent({
                        latestSongKey: latestSongKeyRef.current,
                        targetSongKey,
                        enabled: latestEnabledRef.current,
                    }),
                });
            })();
        }, AUTO_GENERATE_DELAY_MS);

        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
        };
    }, [enabled, hasPromptSource, isLyricsLoading, requiresPromptSource, songKey]);
}
