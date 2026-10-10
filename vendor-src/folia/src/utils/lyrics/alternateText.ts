import type { Line, LyricAlternateText, SubtitleContentMode } from '../../types';

// src/utils/lyrics/alternateText.ts
// Resolves normalized translation and romanization tracks without format-specific logic in renderers.

type AlternateTextSource = Pick<Line, 'translation' | 'romanization' | 'alternateTexts'>;

/** One subtitle track: the single-source modes carry exactly one, 'both' carries up to two. */
export type SubtitleTrackRole = 'romanization' | 'translation';
export interface SubtitleTrack {
    role: SubtitleTrackRole;
    text: string;
}

/**
 * Collapses the dual-row mode to the one track a single-track consumer can show.
 * Monet, Pendolo, Lattice and Still lay translation out inside their own lyric animation
 * (a second lyric track rather than the shared bottom subtitle), so they cannot stack two
 * rows yet; under 'both' they keep their existing translation-only behaviour.
 */
export const resolveSingleTrackSubtitleMode = (
    mode: SubtitleContentMode,
): Exclude<SubtitleContentMode, 'both'> => (mode === 'both' ? 'translation' : mode);

const findAlternateText = (
    alternateTexts: LyricAlternateText[] | undefined,
    role: SubtitleTrackRole,
): string | null => (
    alternateTexts?.find(entry => entry.role === role && entry.text.trim())?.text.trim() ?? null
);

const resolveTrackText = (source: AlternateTextSource, role: SubtitleTrackRole): string | null => {
    const directText = role === 'translation' ? source.translation : source.romanization;
    return directText?.trim() || findAlternateText(source.alternateTexts, role);
};

/** Single-track text for a mode; 'both' is treated as translation (see resolveSingleTrackSubtitleMode). */
export const resolveLyricAlternateText = (
    source: AlternateTextSource | null | undefined,
    mode: SubtitleContentMode,
): string | null => {
    const singleTrackMode = resolveSingleTrackSubtitleMode(mode);
    if (!source || singleTrackMode === 'none') {
        return null;
    }
    return resolveTrackText(source, singleTrackMode);
};

/**
 * Ordered subtitle rows for the shared bottom overlay: romanization first, translation second.
 * Single-source modes return at most one row; 'both' returns whichever of the two exist, so a
 * line with only one of them yields one row and never an empty placeholder. `isReadable` lets
 * the caller drop placeholder strings (e.g. "//") per row before the rows are counted.
 */
export const resolveLyricSubtitleTracks = (
    source: AlternateTextSource | null | undefined,
    mode: SubtitleContentMode,
    isReadable: (text: string) => boolean = () => true,
): SubtitleTrack[] => {
    if (!source || mode === 'none') {
        return [];
    }
    const roles: SubtitleTrackRole[] = mode === 'both' ? ['romanization', 'translation'] : [mode];
    const tracks: SubtitleTrack[] = [];
    for (const role of roles) {
        const text = resolveTrackText(source, role);
        if (!text || !isReadable(text)) {
            continue;
        }
        // Some sources fill both fields with the same string (e.g. already-Latin lyrics); show it once.
        if (tracks.some(track => track.text === text)) {
            continue;
        }
        tracks.push({ role, text });
    }
    return tracks;
};

export const resolveSubtitleContentMode = (
    mode: SubtitleContentMode | undefined,
    legacyShowTranslation = true,
): SubtitleContentMode => mode ?? (legacyShowTranslation ? 'translation' : 'none');

/** Command-palette cycle: translation -> romanization -> both -> translation ('none' re-enters at translation). */
export const cycleSubtitleContentMode = (mode: SubtitleContentMode): SubtitleContentMode => {
    if (mode === 'translation') return 'romanization';
    if (mode === 'romanization') return 'both';
    return 'translation';
};
