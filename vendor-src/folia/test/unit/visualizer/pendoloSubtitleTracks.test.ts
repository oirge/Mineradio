import { describe, expect, it } from 'vitest';
import {
    buildPendoloSubtitleFontSpec,
    resolvePendoloSubtitleTracks,
    sumPendoloSubtitleTrackHeights,
    type PendoloSubtitleTrackOptions,
} from '@/components/visualizer/pendolo/pendoloSubtitleTracks';
import {
    SECONDARY_TRACK_FONT_WEIGHT_FALLBACK,
    SECONDARY_TRACK_GAP_EM,
    SECONDARY_TRACK_OPACITY,
    SECONDARY_TRACK_SIZE_FACTOR,
} from '@/utils/lyrics/subtitleTrackStyle';

// test/unit/visualizer/pendoloSubtitleTracks.test.ts

const options = (overrides: Partial<PendoloSubtitleTrackOptions> = {}): PendoloSubtitleTrackOptions => ({
    mode: 'both',
    hidden: false,
    focal: true,
    subtitleFontScale: 1,
    ...overrides,
});

const both = { romanization: 'ohayou', translation: '早安' };

describe('resolvePendoloSubtitleTracks', () => {
    it('returns romanization first and translation second when both exist', () => {
        const tracks = resolvePendoloSubtitleTracks(both, options());
        expect(tracks.map(track => [track.role, track.text])).toEqual([
            ['romanization', 'ohayou'],
            ['translation', '早安'],
        ]);
    });

    it('omits the missing row without leaving an empty one', () => {
        expect(resolvePendoloSubtitleTracks({ romanization: 'ohayou' }, options()).map(t => t.role)).toEqual(['romanization']);
        expect(resolvePendoloSubtitleTracks({ translation: '早安' }, options()).map(t => t.role)).toEqual(['translation']);
        expect(resolvePendoloSubtitleTracks({}, options())).toEqual([]);
    });

    it('shows identical content once', () => {
        const tracks = resolvePendoloSubtitleTracks({ romanization: 'hello', translation: 'hello' }, options());
        expect(tracks.map(t => t.role)).toEqual(['romanization']);
    });

    it('filters placeholder rows before counting, so the survivor is the first row', () => {
        const tracks = resolvePendoloSubtitleTracks({ romanization: '//', translation: '早安' }, options());
        expect(tracks).toHaveLength(1);
        expect(tracks[0]).toMatchObject({ role: 'translation', text: '早安', opacityFactor: 1, fontPx: 16 });
        expect(resolvePendoloSubtitleTracks({ romanization: '●●●', translation: '--' }, options())).toEqual([]);
    });

    it('returns nothing when hidden or mode is none', () => {
        expect(resolvePendoloSubtitleTracks(both, options({ hidden: true }))).toEqual([]);
        expect(resolvePendoloSubtitleTracks(both, options({ mode: 'none' }))).toEqual([]);
    });

    it('keeps single-source modes identical to the previous single row', () => {
        for (const [mode, text] of [['translation', '早安'], ['romanization', 'ohayou']] as const) {
            const focal = resolvePendoloSubtitleTracks(both, options({ mode, focal: true }));
            expect(focal).toEqual([{
                role: mode,
                text,
                fontPx: 16,
                lineHeightPx: 24,
                fontWeightFallback: 500,
                gapEm: 0.25,
                opacityFactor: 1,
            }]);
            expect(resolvePendoloSubtitleTracks(both, options({ mode, focal: false }))[0]).toMatchObject({ fontPx: 12, lineHeightPx: 18 });
        }
    });

    it('applies the subtitle font scale before rounding', () => {
        expect(resolvePendoloSubtitleTracks(both, options({ mode: 'translation', subtitleFontScale: 1.5 }))[0].fontPx).toBe(24);
    });

    it('steps the second row down by the shared factors', () => {
        const [first, second] = resolvePendoloSubtitleTracks(both, options({ focal: true }));
        expect(first).toMatchObject({ fontPx: 16, fontWeightFallback: 500, opacityFactor: 1, gapEm: 0.25 });
        expect(second.fontPx).toBe(Math.round(16 * SECONDARY_TRACK_SIZE_FACTOR));
        expect(second.fontWeightFallback).toBe(SECONDARY_TRACK_FONT_WEIGHT_FALLBACK);
        expect(second.opacityFactor).toBe(SECONDARY_TRACK_OPACITY);
        expect(second.gapEm).toBe(SECONDARY_TRACK_GAP_EM);

        const [, idleSecond] = resolvePendoloSubtitleTracks(both, options({ focal: false }));
        expect(idleSecond.fontPx).toBe(Math.round(12 * SECONDARY_TRACK_SIZE_FACTOR));
    });
});

describe('sumPendoloSubtitleTrackHeights', () => {
    it('adds each row text height plus its own top gap', () => {
        const tracks = resolvePendoloSubtitleTracks(both, options());
        // Fake measurer: one wrapped line per row.
        const total = sumPendoloSubtitleTrackHeights(tracks, track => track.lineHeightPx);
        const expected = tracks.reduce((sum, track) => sum + track.lineHeightPx + track.gapEm * track.fontPx, 0);
        expect(total).toBeCloseTo(expected);
        // The second row's gap is part of the total, not just the sum of text heights.
        expect(total).toBeGreaterThan(tracks[0].lineHeightPx + tracks[1].lineHeightPx + tracks[0].gapEm * tracks[0].fontPx);
    });

    it('matches the previous single-row formula for one track', () => {
        const [track] = resolvePendoloSubtitleTracks(both, options({ mode: 'translation' }));
        expect(sumPendoloSubtitleTrackHeights([track], () => 38)).toBeCloseTo(38 + 16 * 0.25);
    });

    it('is zero without rows', () => {
        expect(sumPendoloSubtitleTrackHeights([], () => 100)).toBe(0);
    });
});

describe('buildPendoloSubtitleFontSpec', () => {
    it('uses the row size with the resolved weight and family', () => {
        const [, second] = resolvePendoloSubtitleTracks(both, options());
        expect(buildPendoloSubtitleFontSpec(second, 400, 'Inter, sans-serif')).toBe(`400 ${second.fontPx}px Inter, sans-serif`);
    });
});
