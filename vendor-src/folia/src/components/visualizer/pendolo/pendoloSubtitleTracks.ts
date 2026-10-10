import type { Line, SubtitleContentMode } from '../../../types';
import { resolveLyricSubtitleTracks, type SubtitleTrackRole } from '../../../utils/lyrics/alternateText';
import {
    SECONDARY_TRACK_FONT_WEIGHT_FALLBACK,
    SECONDARY_TRACK_GAP_EM,
    SECONDARY_TRACK_OPACITY,
    SECONDARY_TRACK_SIZE_FACTOR,
} from '../../../utils/lyrics/subtitleTrackStyle';

// src/components/visualizer/pendolo/pendoloSubtitleTracks.ts
// Single source of truth for the subtitle rows under a Pendolo lyric: which rows exist, their size, weight
// fallback and spacing. Both the pre-measured block height (lineBlockHeights) and the rendered rows read
// from here, so the reserved space and the drawn rows cannot disagree and overlap the next line.

/** Subtitle row font size at the focal / non-focal state, before the user's subtitle scale. */
const FOCAL_SUBTITLE_PX = 16;
const IDLE_SUBTITLE_PX = 12;
/** Gap between the lyric and the first subtitle row, in em of that row's own font size. */
const LEAD_TRACK_GAP_EM = 0.25;
/** Fallback weight for the first row when the theme sets none (the second row uses SECONDARY_TRACK_FONT_WEIGHT_FALLBACK). */
const LEAD_TRACK_FONT_WEIGHT_FALLBACK = 500;
// The rows set no line-height of their own and inherit the page's 1.5, so measure with the same ratio, unrounded,
// to reserve exactly what the DOM draws (1.2 under-reserved a few px per wrapped row and let rows touch the next lyric).
const SUBTITLE_LINE_HEIGHT_RATIO = 1.5;

// Placeholder lines ("//", "●●●", dashes) carry no letter or digit and are never shown as subtitle text.
const READABLE_TEXT_PATTERN = /[\p{L}\p{N}]/u;
export const isPendoloReadableSubtitle = (text: string): boolean => READABLE_TEXT_PATTERN.test(text);

export interface PendoloSubtitleTrackSpec {
    role: SubtitleTrackRole;
    text: string;
    fontPx: number;
    lineHeightPx: number;
    /** Weight used when the theme has no custom weight; pass to resolveThemeFontWeight. */
    fontWeightFallback: number;
    /** Space above this row in em of its own font size (the first row sits against the lyric). */
    gapEm: number;
    /** Opacity multiplier laid over the row's own colour; 1 for the first row. */
    opacityFactor: number;
}

export interface PendoloSubtitleTrackOptions {
    mode: SubtitleContentMode;
    hidden: boolean;
    /** Focal rows are drawn larger than the ones waiting on the wheel. */
    focal: boolean;
    subtitleFontScale: number;
}

/**
 * Resolves the subtitle rows for one wheel line. The first row keeps the original single-row look;
 * the second row (only in 'both' with two distinct readable texts) is smaller, quieter and spaced below it.
 */
export const resolvePendoloSubtitleTracks = (
    line: Pick<Line, 'translation' | 'romanization' | 'alternateTexts'>,
    { mode, hidden, focal, subtitleFontScale }: PendoloSubtitleTrackOptions,
): PendoloSubtitleTrackSpec[] => {
    if (hidden) {
        return [];
    }
    const basePx = (focal ? FOCAL_SUBTITLE_PX : IDLE_SUBTITLE_PX) * subtitleFontScale;
    return resolveLyricSubtitleTracks(line, mode, isPendoloReadableSubtitle).map((track, index) => {
        const isSecondary = index > 0;
        const fontPx = Math.round(isSecondary ? basePx * SECONDARY_TRACK_SIZE_FACTOR : basePx);
        return {
            role: track.role,
            text: track.text,
            fontPx,
            lineHeightPx: fontPx * SUBTITLE_LINE_HEIGHT_RATIO,
            fontWeightFallback: isSecondary ? SECONDARY_TRACK_FONT_WEIGHT_FALLBACK : LEAD_TRACK_FONT_WEIGHT_FALLBACK,
            gapEm: isSecondary ? SECONDARY_TRACK_GAP_EM : LEAD_TRACK_GAP_EM,
            opacityFactor: isSecondary ? SECONDARY_TRACK_OPACITY : 1,
        };
    });
};

/** pretext font spec for a row; `fontWeight` must be the resolved (theme or fallback) weight the DOM row uses. */
export const buildPendoloSubtitleFontSpec = (
    track: Pick<PendoloSubtitleTrackSpec, 'fontPx'>,
    fontWeight: number,
    fontFamily: string,
): string => `${fontWeight} ${track.fontPx}px ${fontFamily}`;

/** Total height of the stacked rows: each row's wrapped text height plus its own top gap. `measureText` returns the text-only height. */
export const sumPendoloSubtitleTrackHeights = (
    tracks: readonly PendoloSubtitleTrackSpec[],
    measureText: (track: PendoloSubtitleTrackSpec) => number,
): number => {
    let total = 0;
    for (const track of tracks) {
        total += measureText(track) + track.gapEm * track.fontPx;
    }
    return total;
};
