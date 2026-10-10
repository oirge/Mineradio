import { useEffect, useMemo, useRef } from 'react';
import type { MotionValue } from 'framer-motion';
import type { Line, SubtitleContentMode, Theme } from '@/types';
import type { FoliumDisplay, FoliumParamAccess, FoliumParamValues, FoliumStageContext, FoliumSurface, FoliumTheme } from './contract';
import { toFoliumLines, toFoliumSongFromMeta, toFoliumTheme } from './dto';
import { createFoliumAudio, type FoliumAudioSource } from './audio';
import { resolveSingleTrackSubtitleMode } from '@/utils/lyrics/alternateText';

// src/mods/folium/stageContext.ts
// Builds the FoliumStageContext handed to lyric-synced content (visualizers,
// background types, stage layers). One rule decides what goes where:
//   - identity (lyrics, song, staticMode, the static preview line, seed,
//     preview) is a snapshot, and changing it remounts the content;
//   - everything that changes while a song plays (line index, pause, themes,
//     cover, display settings, mod settings, surface) is a getter, and
//     `subscribe` announces the change.
// Putting a per-line value into the snapshot would dispose and remount the
// content on every lyric line, which is what the pre-Folium bridge did.

export interface FoliumStageInputs {
    lines: Line[];
    currentTime: MotionValue<number>;
    currentLineIndex: number;
    paused: boolean;
    theme: Theme;
    isDaylight: boolean;
    songTitle: string | null;
    songArtist: string | null;
    songAlbum: string | null;
    staticMode: boolean;
    /** Builtin modes' geometry seed; null where the host has none. */
    seed: string | number | null | undefined;
    isPreview: boolean;
    coverUrl: string | null;
    /** The subtitle theme; absent means the same as `theme`. */
    subtitleTheme?: Theme;
    /** Host-side display state: carries the host's own SubtitleContentMode, which may be 'both'. */
    display: Partial<Omit<FoliumDisplay, 'subtitleContentMode'>> & { subtitleContentMode?: SubtitleContentMode };
    surface: FoliumSurface;
    settings: FoliumParamAccess | null;
    /** The analyser signals behind `ctx.audio`; absent reads as silence. */
    audio?: FoliumAudioSource;
}

const EMPTY_SETTINGS: FoliumParamValues = Object.freeze({});
const NO_AUDIO: FoliumAudioSource = Object.freeze({});

/*
 * The defaults builtin modes fall back to when a prop is absent (see
 * VisualizerShell, VisualizerSubtitleOverlay, VisualizerHarmonyOverlay), so a
 * mod reads the same effective values they render with.
 */
export const resolveFoliumDisplay = (display: FoliumStageInputs['display']): FoliumDisplay => {
    const showSubtitleTranslation = display.showSubtitleTranslation ?? true;
    return {
        showText: display.showText ?? true,
        lyricsFontScale: display.lyricsFontScale ?? 1,
        subtitleFontScale: display.subtitleFontScale ?? 1,
        subtitleOverlayOpacity: display.subtitleOverlayOpacity ?? 0.6,
        subtitleOverlayBackground: display.subtitleOverlayBackground ?? true,
        subtitleUpcomingLyricsBlur: display.subtitleUpcomingLyricsBlur ?? true,
        showHarmonySubtitle: display.showHarmonySubtitle ?? true,
        harmonySubtitleBackground: display.harmonySubtitleBackground ?? true,
        showSubtitleTranslation,
        hideTranslationSubtitle: display.hideTranslationSubtitle ?? false,
        // The Folium contract only knows single-track modes: mods draw their own text, so the host's
        // dual-row 'both' (shared bottom overlay only) reads as translation, like Monet / Pendolo / Lattice.
        subtitleContentMode: resolveSingleTrackSubtitleMode(
            display.subtitleContentMode ?? (showSubtitleTranslation ? 'translation' : 'none'),
        ),
        isPlayerChromeHidden: display.isPlayerChromeHidden ?? false,
        isPanelOpen: display.isPanelOpen ?? false,
        visualizerOpacity: display.visualizerOpacity ?? 1,
    };
};

const sameDisplay = (left: FoliumDisplay, right: FoliumDisplay) => (
    (Object.keys(left) as (keyof FoliumDisplay)[]).every((key) => left[key] === right[key])
);

/** Caches a theme projection per (theme, daylight) identity so per-frame reads allocate nothing. */
const createThemeReader = () => {
    const cache = { source: null as Theme | null, daylight: false, value: Object.freeze(toFoliumTheme(null, false)) as FoliumTheme };
    return (theme: Theme, isDaylight: boolean): FoliumTheme => {
        if (cache.source !== theme || cache.daylight !== isDaylight) {
            cache.source = theme;
            cache.daylight = isDaylight;
            cache.value = Object.freeze(toFoliumTheme(theme, isDaylight));
        }
        return cache.value;
    };
};

export const useFoliumStageContext = (inputs: FoliumStageInputs): FoliumStageContext => {
    const inputsRef = useRef(inputs);
    inputsRef.current = inputs;
    const listenersRef = useRef(new Set<() => void>());

    const notify = () => {
        listenersRef.current.forEach((listener) => {
            try {
                listener();
            } catch (error) {
                console.warn('[Folium] stage subscriber failed', error);
            }
        });
    };

    const { lines, songTitle, songArtist, songAlbum, staticMode, currentLineIndex, settings, currentTime, isPreview } = inputs;
    const staticLineIndex = staticMode ? currentLineIndex : null;
    const seed = inputs.seed === null || inputs.seed === undefined ? null : String(inputs.seed);

    // One stable object until a value changes, so `getDisplay()` can be compared by identity.
    const nextDisplay = resolveFoliumDisplay(inputs.display);
    const displayRef = useRef<FoliumDisplay>(Object.freeze(nextDisplay));
    if (!sameDisplay(displayRef.current, nextDisplay)) {
        displayRef.current = Object.freeze(nextDisplay);
    }
    const display = displayRef.current;

    const ctx = useMemo<FoliumStageContext>(() => {
        const readTheme = createThemeReader();
        const readSubtitleTheme = createThemeReader();
        return Object.freeze({
            lines: toFoliumLines(lines),
            song: toFoliumSongFromMeta(songTitle, songArtist, songAlbum),
            staticMode,
            staticLineIndex,
            seed,
            isPreview,
            currentTime: Object.freeze({
                get: () => inputsRef.current.currentTime.get(),
                on: (_event: 'change', listener: (seconds: number) => void) => currentTime.on('change', listener),
            }),
            getLineIndex: () => inputsRef.current.currentLineIndex,
            isPaused: () => inputsRef.current.paused,
            getTheme: () => readTheme(inputsRef.current.theme, inputsRef.current.isDaylight),
            getSubtitleTheme: () => {
                const { theme, subtitleTheme, isDaylight } = inputsRef.current;
                return subtitleTheme ? readSubtitleTheme(subtitleTheme, isDaylight) : readTheme(theme, isDaylight);
            },
            getCoverUrl: () => inputsRef.current.coverUrl,
            getDisplay: () => displayRef.current,
            getSettings: () => inputsRef.current.settings?.get() ?? EMPTY_SETTINGS,
            getSurface: () => inputsRef.current.surface,
            subscribe: (listener: () => void) => {
                listenersRef.current.add(listener);
                return () => listenersRef.current.delete(listener);
            },
            audio: createFoliumAudio(() => inputsRef.current.audio ?? NO_AUDIO),
        });
    }, [lines, songTitle, songArtist, songAlbum, staticMode, staticLineIndex, seed, isPreview, currentTime]);

    const { paused, theme, isDaylight, subtitleTheme, coverUrl } = inputs;
    const { transparent, hostBackground } = inputs.surface;
    // Skip the first run: a fresh mount already reads current values.
    const primedRef = useRef(false);
    useEffect(() => {
        if (!primedRef.current) {
            primedRef.current = true;
            return;
        }
        notify();
    }, [currentLineIndex, paused, theme, isDaylight, subtitleTheme, coverUrl, display, transparent, hostBackground]);

    useEffect(() => settings?.subscribe(notify), [settings]);

    return ctx;
};
