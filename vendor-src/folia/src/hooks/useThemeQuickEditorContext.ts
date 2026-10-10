import { useEffect } from 'react';
import type { DualTheme, SongResult, ThemeMode } from '../types';
import type { ThemeCacheSongKey } from '../services/themeCache';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { useThemeSettingsStore } from '../stores/useThemeSettingsStore';
import { useThemeQuickEditorStore } from '../stores/useThemeQuickEditorStore';

// src/hooks/useThemeQuickEditorContext.ts
//
// Keeps the quick editor pointed at whatever the listener is looking at, and re-applies a cached
// theme when a sync brings one in for the current song.
//
// The prompt source is the lyrics, except for a pure-music track where there are none and the title
// is all there is to go on - and it still falls back to the lyrics if that track turns out to have
// some, because a wrong `isPureMusic` should not leave the generator with nothing.

type ThemeQuickEditorContextParams = {
    aiTheme: DualTheme | null;
    customTheme: DualTheme | null;
    bgMode: ThemeMode;
    coverUrl: string | null;
    restoreCachedThemeForSong: (
        songOrId: ThemeCacheSongKey | SongResult,
        options?: { allowLastUsedFallback?: boolean; preserveCurrentOnMiss?: boolean },
    ) => Promise<unknown>;
};

export const useThemeQuickEditorContext = ({
    aiTheme,
    customTheme,
    bgMode,
    coverUrl,
    restoreCachedThemeForSong,
}: ThemeQuickEditorContextParams) => {
    const currentSong = usePlaybackStore(state => state.currentSong);
    const lyrics = usePlaybackStore(state => state.lyrics);
    const isDaylight = useThemeSettingsStore(state => state.isDaylight);
    const setThemeQuickEditorContext = useThemeQuickEditorStore(state => state.setContext);

    useEffect(() => {
        const handleSyncCompleted = () => {
            if (currentSong) {
                void restoreCachedThemeForSong(currentSong, { allowLastUsedFallback: true });
            }
        };

        window.addEventListener('folia-themes-synced', handleSyncCompleted);
        return () => window.removeEventListener('folia-themes-synced', handleSyncCompleted);
    }, [currentSong, restoreCachedThemeForSong]);

    useEffect(() => {
        const isPureMusic = Boolean(currentSong?.isPureMusic);
        const songTitle = currentSong?.name;
        const allText = lyrics?.lines.map(line => line.fullText).join('\n') || null;
        const promptSourceText = (isPureMusic ? songTitle : allText) || allText;

        setThemeQuickEditorContext({
            aiTheme,
            customTheme,
            bgMode,
            coverUrl,
            song: currentSong,
            songKey: currentSong?.id ?? null,
            isDaylight,
            promptSourceText,
            isPureMusic,
            songTitle,
        });
    }, [aiTheme, bgMode, coverUrl, currentSong, customTheme, isDaylight, lyrics, setThemeQuickEditorContext]);
};
