import type { Line } from '../../types';
import { splitLyricGraphemes } from './graphemeTiming';

// src/utils/lyrics/wordSegmentation.ts
// The single word-granularity segmenter for lyrics. Before this file, sonnetSemantic.ts and
// temperaProgram.ts carried byte-for-byte identical `getSegmenterParts` helpers and
// cjkSemanticLayout.ts carried a third variant, so a user-supplied override would have had to be
// wired into three places that could drift apart.
//
// Callers that have a Line should use `segmentLyricWords`, which honours `line.wordSegments` (the
// user's saved segmentation, baked on upstream by createLyricsSetter). `segmentTextWords` is the
// no-override path for text that has no Line behind it.

export interface LyricWordSegment {
    segment: string;
    /** Offset of this segment inside the source text, in code units. */
    index: number;
    isWordLike: boolean;
}

const PUNCTUATION_ONLY = /^[\s\p{P}\p{S}]+$/u;

const isWordLikeText = (text: string) => !PUNCTUATION_ONLY.test(text);

/**
 * Rebuilds full segment records from a bare boundary list. Used both for the user's saved
 * segmentation and for anything that stores boundaries as plain strings.
 */
export const segmentsFromBoundaries = (boundaries: string[]): LyricWordSegment[] => {
    let cursor = 0;
    return boundaries.map(segment => {
        const part = { segment, index: cursor, isWordLike: isWordLikeText(segment) };
        cursor += segment.length;
        return part;
    });
};

/**
 * Intl.Segmenter word split, falling back to graphemes when the runtime has no Segmenter. The
 * fallback preserves every code unit, so offsets stay valid and line timing is never lost.
 */
export const segmentTextWords = (text: string): LyricWordSegment[] => {
    if (!text) {
        return [];
    }

    const Segmenter = typeof Intl !== 'undefined' ? Intl.Segmenter : undefined;
    if (Segmenter) {
        try {
            return Array.from(new Segmenter(undefined, { granularity: 'word' }).segment(text), part => ({
                segment: part.segment,
                index: part.index,
                isWordLike: part.isWordLike ?? isWordLikeText(part.segment),
            }));
        } catch {
            // The grapheme fallback below preserves every code unit and the line timing.
        }
    }

    return segmentsFromBoundaries(splitLyricGraphemes(text));
};

/**
 * True when the boundaries reconstruct the text exactly. A saved segmentation that fails this is
 * stale (the lyric source changed under it) and must be ignored rather than applied at an offset.
 */
export const isValidWordSegmentation = (text: string, boundaries: string[] | undefined): boolean => (
    Array.isArray(boundaries)
    && boundaries.length > 0
    && boundaries.every(segment => typeof segment === 'string')
    && boundaries.join('') === text
);

const EDGE_WHITESPACE = /^(\s*)(.*?)(\s*)$/su;

/**
 * Lifts the whitespace at a saved boundary's edges out into segments of its own, so a saved split
 * reaches the consumers in the same shape Intl.Segmenter would have produced.
 *
 * Intl.Segmenter always emits a whitespace run as a segment in its own right, and every consumer is
 * written against that. tempera tells a real word gap from a bare CJK word boundary by the hole a
 * dropped whitespace segment leaves in the offsets, and cjkSemanticLayout skips whitespace segments
 * when aligning to parser words, which never contain any. The saved format is the other way round:
 * the prompt tells the model that a space belongs to the segment before it, and
 * realignSegmentsToText attaches the line's real whitespace to whichever slice sits next to it. So
 * an unsplit boundary arrives downstream as a word with a space glued on — which read as "no space
 * here" in tempera, and failed to align at all in cjkSemanticLayout.
 *
 * Whitespace INSIDE a segment is deliberately left alone. It is the one thing this format can say
 * that Intl.Segmenter cannot — a multi-word phrase the user kept together on purpose — and the
 * consumers already handle it (or already fall back) exactly as they do today. Punctuation is left
 * attached for the same reason: the sticky passes in tempera and sonnet would re-attach it anyway.
 */
const splitEdgeWhitespace = (boundaries: string[]): string[] => boundaries.flatMap(boundary => {
    const [, lead, core, trail] = EDGE_WHITESPACE.exec(boundary) ?? [];
    // No core means the boundary is whitespace only, which is already the shape we want.
    return core ? [lead, core, trail].filter(Boolean) : [boundary].filter(Boolean);
});

/** Word segments for a line: the user's saved split when it is valid, else Intl.Segmenter. */
export const segmentLyricWords = (line: Pick<Line, 'fullText' | 'wordSegments'>): LyricWordSegment[] => {
    if (isValidWordSegmentation(line.fullText, line.wordSegments)) {
        return segmentsFromBoundaries(splitEdgeWhitespace(line.wordSegments!));
    }

    return segmentTextWords(line.fullText);
};

/**
 * Fingerprint of a line's saved split, for layout cache keys and memo dependencies.
 *
 * Boundary LENGTHS rather than the segment text: the boundaries always join back to the line's own
 * `fullText`, which every caller of this already keys on, so the lengths alone pin the split down
 * exactly — and no second copy of the lyric is built on paths that run per frame. Empty string when
 * the line is on the default split, so adding it to a key changes nothing for lyrics without one.
 */
export const getWordSegmentationKey = (line: Pick<Line, 'wordSegments'>): string => (
    line.wordSegments ? line.wordSegments.map(segment => segment.length).join(',') : ''
);

/** Whether this line will render with a user-supplied split rather than the default one. */
export const hasWordSegmentationOverride = (line: Pick<Line, 'fullText' | 'wordSegments'>): boolean => (
    isValidWordSegmentation(line.fullText, line.wordSegments)
);
