import { describe, expect, it, vi } from 'vitest';
import type { Line } from '@/types';
import {
    buildMonetLayoutCacheKey,
    measureMonetLineLayout,
    resolveMonetSubtitleTracks,
    type MonetLineLayoutInputs,
} from '@/components/visualizer/monet/monetLyricsModel';
import {
    SECONDARY_TRACK_FONT_WEIGHT_FALLBACK,
    SECONDARY_TRACK_GAP_EM,
    SECONDARY_TRACK_SIZE_FACTOR,
} from '@/utils/lyrics/subtitleTrackStyle';

// test/unit/visualizer/monetSubtitleTracks.test.ts
// Locks Monet's dual subtitle rows (romanization + translation): track resolution, per-track measurement
// and the layout cache key. Single-track numbers are pinned to what the pre-dual-row code produced.

// Same per-character pretext heuristics as monetSettings.test.ts: 10px per char, so a 512px column
// (520 - 8) wraps at 51 chars. Node has no canvas, so line heights fall back to the font-size multiples.
vi.mock('@chenglou/pretext', () => ({
    prepareWithSegments: (text: string) => ({ text }),
    layoutWithLines: (prepared: { text?: string; }, maxWidth: number) => {
        const text = prepared.text || ' ';
        const charsPerLine = Math.max(1, Math.floor(maxWidth / 10));
        const lineCount = Math.max(1, Math.ceil(text.length / charsPerLine));
        return {
            lines: Array.from({ length: lineCount }, () => ({
                width: Math.min(text.length, charsPerLine) * 10,
            })),
        };
    },
    clearCache: () => undefined,
}));

vi.mock('@chenglou/pretext/rich-inline', () => ({
    prepareRichInline: (items: { text: string; }[]) => ({ text: items.map(item => item.text).join('') }),
    measureRichInlineStats: (prepared: { text?: string; }, maxWidth: number) => {
        const text = prepared.text || ' ';
        const charsPerLine = Math.max(1, Math.floor(maxWidth / 10));
        return {
            lineCount: Math.max(1, Math.ceil(text.length / charsPerLine)),
            maxLineWidth: Math.min(text.length, charsPerLine) * 10,
        };
    },
}));

const TRANSLATION_FONT_PX = 18;
const SECONDARY_FONT_PX = TRANSLATION_FONT_PX * SECONDARY_TRACK_SIZE_FACTOR;

const makeLine = (extra: Partial<Line> = {}): Line => ({
    startTime: 0,
    endTime: 3,
    fullText: 'A bright river',
    words: [],
    ...extra,
});

const measure = (
    line: Line,
    options: Partial<Parameters<typeof measureMonetLineLayout>[0]> = {},
) => measureMonetLineLayout({
    line,
    status: 'active',
    fontPx: 32,
    translationFontPx: TRANSLATION_FONT_PX,
    fontStack: 'Arial',
    maxWidthPx: 520,
    translationFontWeight: 500,
    ...options,
});

const cacheInputs = (overrides: Partial<MonetLineLayoutInputs> = {}): MonetLineLayoutInputs => ({
    fontPx: 32,
    translationFontPx: TRANSLATION_FONT_PX,
    fontStack: 'Arial',
    translationFontStack: 'Arial',
    fontWeight: 600,
    translationFontWeight: 500,
    secondaryTranslationFontWeight: 400,
    maxWidthPx: 512,
    subtitleContentMode: 'both',
    ...overrides,
});

describe('resolveMonetSubtitleTracks', () => {
    const both = makeLine({ romanization: 'ohayou', translation: '早安' });

    it('stacks romanization above translation when both exist', () => {
        expect(resolveMonetSubtitleTracks(both, 'both')).toEqual([
            { role: 'romanization', text: 'ohayou' },
            { role: 'translation', text: '早安' },
        ]);
    });

    it('keeps only the romanization row when there is no translation', () => {
        expect(resolveMonetSubtitleTracks(makeLine({ romanization: 'ohayou' }), 'both'))
            .toEqual([{ role: 'romanization', text: 'ohayou' }]);
    });

    it('keeps only the translation row when there is no romanization', () => {
        expect(resolveMonetSubtitleTracks(makeLine({ translation: '早安' }), 'both'))
            .toEqual([{ role: 'translation', text: '早安' }]);
    });

    it('yields no rows when the line has neither', () => {
        expect(resolveMonetSubtitleTracks(makeLine(), 'both')).toEqual([]);
    });

    it('shows identical texts once', () => {
        expect(resolveMonetSubtitleTracks(makeLine({ romanization: 'hello', translation: 'hello' }), 'both'))
            .toEqual([{ role: 'romanization', text: 'hello' }]);
    });

    it('drops placeholder rows that hold no letter or digit', () => {
        expect(resolveMonetSubtitleTracks(makeLine({ romanization: '//', translation: '早安' }), 'both'))
            .toEqual([{ role: 'translation', text: '早安' }]);
        expect(resolveMonetSubtitleTracks(makeLine({ romanization: '●●●', translation: '---' }), 'both')).toEqual([]);
        expect(resolveMonetSubtitleTracks(makeLine({ translation: '//' }), 'translation')).toEqual([]);
    });

    it('follows the single-source modes', () => {
        expect(resolveMonetSubtitleTracks(both, 'translation')).toEqual([{ role: 'translation', text: '早安' }]);
        expect(resolveMonetSubtitleTracks(both, 'romanization')).toEqual([{ role: 'romanization', text: 'ohayou' }]);
        expect(resolveMonetSubtitleTracks(both, 'none')).toEqual([]);
    });
});

describe('measureMonetLineLayout single subtitle row', () => {
    // Golden values captured from the implementation before dual rows existed (translation 18px, weight 500).
    const GOLDEN_SHORT = {
        translationLineCount: 1,
        translationHeightPx: 36.14,
        translationContentHeightPx: 23.04,
        translationPaddingTopPx: 8.1,
        translationPaddingBottomPx: 5,
        translationLineHeightPx: 23.04,
        visualHeightPx: 95.9,
        isTranslationClipped: false,
    };

    it('reproduces the pre-dual-row numbers for a one-row translation', () => {
        const layout = measure(makeLine({ translation: '一条明亮的河流' }));
        expect(layout).toMatchObject({ ...GOLDEN_SHORT, textHeightPx: 59.76, lineHeightPx: 37.76 });
        expect(layout.subtitleTracks).toHaveLength(1);
        expect(layout.subtitleTracks[0]).toMatchObject({
            role: 'translation',
            fontPx: TRANSLATION_FONT_PX,
            fontWeight: 500,
            lineCount: 1,
            paddingTopPx: 8.1,
            paddingBottomPx: 5,
            heightPx: 36.14,
        });
    });

    it('reproduces the pre-dual-row numbers for a two-row translation', () => {
        expect(measure(makeLine({ translation: 'x'.repeat(70) }))).toMatchObject({
            translationLineCount: 2,
            translationHeightPx: 59.18,
            translationContentHeightPx: 46.08,
            visualHeightPx: 118.94,
            isTranslationClipped: false,
        });
    });

    it('reproduces the pre-dual-row numbers for a clipped translation', () => {
        expect(measure(makeLine({ translation: 'x'.repeat(200) }))).toMatchObject({
            translationLineCount: 2,
            translationHeightPx: 59.18,
            visualHeightPx: 118.94,
            isTranslationClipped: true,
        });
    });

    it('reproduces the pre-dual-row numbers when there is nothing to show', () => {
        const expected = {
            translationLineCount: 0,
            translationHeightPx: 0,
            translationContentHeightPx: 0,
            translationPaddingTopPx: 8.1,
            translationPaddingBottomPx: 5,
            translationLineHeightPx: 23.04,
            visualHeightPx: 59.76,
            isTranslationClipped: false,
        };
        const noTranslation = measure(makeLine());
        expect(noTranslation).toMatchObject(expected);
        expect(noTranslation.subtitleTracks).toEqual([]);
        // Only the active line carries subtitle rows.
        const inactive = measure(makeLine({ translation: 'hello' }), { status: 'waiting' });
        expect(inactive).toMatchObject(expected);
        expect(inactive.subtitleTracks).toEqual([]);
    });

    it('measures a romanization-only mode exactly like a translation of the same text', () => {
        const asTranslation = measure(makeLine({ translation: 'ohayou gozaimasu' }), { subtitleContentMode: 'translation' });
        const asRomanization = measure(makeLine({ romanization: 'ohayou gozaimasu' }), { subtitleContentMode: 'romanization' });
        expect({ ...asRomanization, subtitleTracks: [] }).toEqual({ ...asTranslation, subtitleTracks: [] });
        expect(asRomanization.subtitleTracks[0]).toMatchObject({ role: 'romanization', fontPx: TRANSLATION_FONT_PX });
    });

    it('still honours the legacy showSubtitleTranslation switch when no mode is given', () => {
        const line = makeLine({ translation: '一条明亮的河流' });
        expect(measure(line, { showSubtitleTranslation: false }).translationHeightPx).toBe(0);
        expect(measure(line, { showSubtitleTranslation: true }).translationHeightPx).toBeGreaterThan(0);
        // An explicit mode wins over the legacy flag.
        expect(measure(line, { showSubtitleTranslation: false, subtitleContentMode: 'translation' }).translationHeightPx).toBeGreaterThan(0);
    });
});

describe('measureMonetLineLayout dual subtitle rows', () => {
    const both = makeLine({ romanization: 'ohayou', translation: '早安' });

    it('measures two rows with the second one stepped down', () => {
        const layout = measure(both, { subtitleContentMode: 'both' });
        const [first, second] = layout.subtitleTracks;

        expect(layout.subtitleTracks.map(track => track.role)).toEqual(['romanization', 'translation']);
        // First row is exactly the single-row look.
        expect(first).toMatchObject({ fontPx: TRANSLATION_FONT_PX, fontWeight: 500, paddingTopPx: 8.1, paddingBottomPx: 5, heightPx: 36.14 });
        // Second row: smaller font, fallback weight, and GAP_EM of its own size above it instead of the first row's top padding.
        expect(second.fontPx).toBeCloseTo(SECONDARY_FONT_PX, 10);
        expect(second.fontWeight).toBe(SECONDARY_TRACK_FONT_WEIGHT_FALLBACK);
        expect(second.paddingTopPx).toBeCloseTo(SECONDARY_FONT_PX * SECONDARY_TRACK_GAP_EM, 10);
        expect(second.lineHeightPx).toBeCloseTo(SECONDARY_FONT_PX * 1.28, 10);
        expect(second.heightPx).toBeCloseTo(second.contentHeightPx + second.paddingTopPx + second.paddingBottomPx, 10);
        expect(second.fontPx).toBeLessThan(first.fontPx);
    });

    it('reports translationHeightPx as the sum of the row boxes', () => {
        const layout = measure(both, { subtitleContentMode: 'both' });
        const sum = layout.subtitleTracks.reduce((total, track) => total + track.heightPx, 0);

        expect(layout.translationHeightPx).toBeCloseTo(sum, 10);
        expect(layout.visualHeightPx).toBeCloseTo(layout.textHeightPx + sum, 10);
        expect(layout.translationHeightPx).toBeGreaterThan(measure(both, { subtitleContentMode: 'translation' }).translationHeightPx);
        expect(layout.translationLineCount).toBe(2);
        expect(layout.translationPaddingTopPx).toBe(layout.subtitleTracks[0].paddingTopPx);
        expect(layout.translationPaddingBottomPx).toBe(layout.subtitleTracks[1].paddingBottomPx);
    });

    it('caps and clips each row at two lines on its own', () => {
        // 200 chars each is far over the cap for both rows; the second row wraps at its own (smaller) font width.
        const layout = measure(
            makeLine({ romanization: 'r'.repeat(200), translation: 't'.repeat(200) }),
            { subtitleContentMode: 'both' },
        );

        expect(layout.subtitleTracks.map(track => track.lineCount)).toEqual([2, 2]);
        expect(layout.subtitleTracks.map(track => track.isClipped)).toEqual([true, true]);
        expect(layout.isTranslationClipped).toBe(true);
    });

    it('clips only the row that overflows', () => {
        const layout = measure(
            makeLine({ romanization: 'short', translation: 't'.repeat(200) }),
            { subtitleContentMode: 'both' },
        );

        expect(layout.subtitleTracks.map(track => track.isClipped)).toEqual([false, true]);
        expect(layout.subtitleTracks.map(track => track.lineCount)).toEqual([1, 2]);
    });

    it('collapses to a single row when only one source exists, matching the single-row look', () => {
        const romanizationOnly = measure(makeLine({ romanization: 'ohayou' }), { subtitleContentMode: 'both' });
        expect(romanizationOnly.subtitleTracks).toHaveLength(1);
        expect(romanizationOnly.subtitleTracks[0]).toMatchObject({ role: 'romanization', fontPx: TRANSLATION_FONT_PX, paddingTopPx: 8.1 });
        expect(romanizationOnly.translationHeightPx).toBe(36.14);

        const translationOnly = measure(makeLine({ translation: '早安' }), { subtitleContentMode: 'both' });
        expect(translationOnly.subtitleTracks.map(track => track.role)).toEqual(['translation']);
        expect(translationOnly.translationHeightPx).toBe(36.14);
    });

    it('reserves nothing when neither row exists, or the texts are placeholders', () => {
        expect(measure(makeLine(), { subtitleContentMode: 'both' }).translationHeightPx).toBe(0);
        expect(measure(makeLine({ romanization: '//', translation: '--' }), { subtitleContentMode: 'both' }).translationHeightPx).toBe(0);
    });

    it('measures identical texts once', () => {
        const layout = measure(makeLine({ romanization: 'hello', translation: 'hello' }), { subtitleContentMode: 'both' });
        expect(layout.subtitleTracks).toHaveLength(1);
        expect(layout.translationHeightPx).toBe(36.14);
    });

    it('uses the resolved second-row weight passed by the rail', () => {
        const layout = measure(both, { subtitleContentMode: 'both', secondaryTranslationFontWeight: 300 });
        expect(layout.subtitleTracks[0].fontWeight).toBe(500);
        expect(layout.subtitleTracks[1].fontWeight).toBe(300);
    });
});

describe('buildMonetLayoutCacheKey', () => {
    const entry = (line: Line, status: 'active' | 'waiting' = 'active') => ({ index: 1, line, status });
    const both = makeLine({ romanization: 'ohayou', translation: '早安' });

    it('is stable for identical inputs', () => {
        expect(buildMonetLayoutCacheKey(entry(both), cacheInputs())).toBe(buildMonetLayoutCacheKey(entry(both), cacheInputs()));
    });

    it('changes with the subtitle mode so a mode switch never hits a stale layout', () => {
        const keys = (['translation', 'romanization', 'both', 'none'] as const)
            .map(subtitleContentMode => buildMonetLayoutCacheKey(entry(both), cacheInputs({ subtitleContentMode })));
        expect(new Set(keys).size).toBe(4);
    });

    it('changes with the row texts, including a romanization-only edit', () => {
        const base = buildMonetLayoutCacheKey(entry(both), cacheInputs());
        expect(buildMonetLayoutCacheKey(entry(makeLine({ romanization: 'konnichiwa', translation: '早安' })), cacheInputs())).not.toBe(base);
        expect(buildMonetLayoutCacheKey(entry(makeLine({ romanization: 'ohayou', translation: '你好' })), cacheInputs())).not.toBe(base);
        expect(buildMonetLayoutCacheKey(entry(makeLine({ translation: '早安' })), cacheInputs())).not.toBe(base);
    });

    it('does not mix up which role carries a text', () => {
        const asRomanization = buildMonetLayoutCacheKey(entry(makeLine({ romanization: 'same' })), cacheInputs());
        const asTranslation = buildMonetLayoutCacheKey(entry(makeLine({ translation: 'same' })), cacheInputs());
        expect(asRomanization).not.toBe(asTranslation);
    });

    it('changes with the final weights and font size', () => {
        const base = buildMonetLayoutCacheKey(entry(both), cacheInputs());
        expect(buildMonetLayoutCacheKey(entry(both), cacheInputs({ secondaryTranslationFontWeight: 300 }))).not.toBe(base);
        expect(buildMonetLayoutCacheKey(entry(both), cacheInputs({ translationFontWeight: 700 }))).not.toBe(base);
        expect(buildMonetLayoutCacheKey(entry(both), cacheInputs({ translationFontPx: 20 }))).not.toBe(base);
    });

    it('ignores subtitle text for lines that never measure subtitle rows', () => {
        const a = buildMonetLayoutCacheKey(entry(makeLine({ translation: 'one' }), 'waiting'), cacheInputs());
        const b = buildMonetLayoutCacheKey(entry(makeLine({ translation: 'two' }), 'waiting'), cacheInputs());
        expect(a).toBe(b);
    });
});
