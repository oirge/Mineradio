import { describe, expect, it } from 'vitest';
import {
    DEFAULT_LYRIC_RENDER_OVERRIDE,
    DEFAULT_LYRIC_RENDER_QUALITY,
    LYRIC_RENDER_SCALES,
    normalizeLyricRenderOverride,
    normalizeLyricRenderQuality,
    resolveLyricAntialias,
    resolveLyricPixelRatio,
    resolveLyricRenderQuality,
} from '../../../src/utils/lyricRenderQuality';

// test/unit/visualizer/lyricRenderQuality.test.ts
describe('lyric render quality', () => {
    it('accepts every supported resolution and validates fields independently', () => {
        for (const scale of LYRIC_RENDER_SCALES) {
            expect(normalizeLyricRenderQuality({ scale, antialias: 'off' })).toEqual({ scale, antialias: 'off' });
        }
        expect(normalizeLyricRenderQuality({ scale: 3, antialias: 'on' })).toEqual({ scale: 1, antialias: 'on' });
        expect(normalizeLyricRenderQuality({ scale: 1.5, antialias: 'invalid' })).toEqual({ scale: 1.5, antialias: 'auto' });
        for (const raw of [null, undefined, 'invalid', [], {}]) {
            expect(normalizeLyricRenderQuality(raw)).toEqual(DEFAULT_LYRIC_RENDER_QUALITY);
        }
    });

    it('defaults old style settings to following the global values', () => {
        expect(normalizeLyricRenderOverride(undefined)).toEqual(DEFAULT_LYRIC_RENDER_OVERRIDE);
        expect(normalizeLyricRenderOverride({ scale: '2', antialias: 'auto' })).toEqual(DEFAULT_LYRIC_RENDER_OVERRIDE);
        expect(normalizeLyricRenderOverride({ scale: 0.75, antialias: 'off' })).toEqual({ scale: 0.75, antialias: 'off' });
    });

    it('resolves each override independently without changing its inputs', () => {
        const global = Object.freeze({ scale: 2, antialias: 'auto' } as const);
        expect(resolveLyricRenderQuality(global, null)).toEqual(global);
        expect(resolveLyricRenderQuality(global, { scale: 0.5, antialias: 'global' })).toEqual({ scale: 0.5, antialias: 'auto' });
        expect(resolveLyricRenderQuality(global, { scale: 'global', antialias: 'on' })).toEqual({ scale: 2, antialias: 'on' });
        expect(resolveLyricRenderQuality(global, { scale: 1.5, antialias: 'off' })).toEqual({ scale: 1.5, antialias: 'off' });
        expect(global).toEqual({ scale: 2, antialias: 'auto' });
    });

    it('caps supersampling while preserving existing high-density rendering', () => {
        expect(resolveLyricPixelRatio(2, 2)).toBe(3);
        expect(resolveLyricPixelRatio(2, 0.5)).toBe(1);
        expect(resolveLyricPixelRatio(4, 1.5)).toBe(4);
        expect(resolveLyricPixelRatio(4, 0.5)).toBe(2);
        expect(resolveLyricPixelRatio(2, 2, 2.5)).toBe(2.5);
        for (const base of [NaN, Infinity, 0, -1]) expect(resolveLyricPixelRatio(base, 1.5)).toBe(1.5);
    });

    it('keeps each effect default when antialias is automatic', () => {
        expect(resolveLyricAntialias('auto', true)).toBe(true);
        expect(resolveLyricAntialias('auto', false)).toBe(false);
        expect(resolveLyricAntialias('on', false)).toBe(true);
        expect(resolveLyricAntialias('off', true)).toBe(false);
    });
});
