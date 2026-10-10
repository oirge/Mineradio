import { describe, expect, it } from 'vitest';
import { resolveLiveRasterScale } from '@/components/visualizer/fume/fumeLiveRaster';

// test/unit/visualizer/fumeLiveRaster.test.ts
// fume's live text is rasterized at a bounded set of scales (a continuously changing one leaked a
// glyph-cache fd every thousand or so sizes) and shrunk the rest of the way on the stage. Lock both
// halves: the set stays small, and the text is never enlarged and only barely shrunk.

describe('fume live raster scale', () => {
    it('rounds up to a level at most 1.5% above the device scale', () => {
        for (let index = 0; index <= 2000; index += 1) {
            const scale = 0.3 + (index / 2000) * 3.4;
            const level = resolveLiveRasterScale(scale);
            expect(level).toBeGreaterThanOrEqual(scale * (1 - 1e-12));
            expect(level / scale).toBeLessThanOrEqual(2 ** (1 / 48) + 1e-12);
        }
    });

    it('keeps a whole camera sweep to a few hundred sizes', () => {
        const levels = new Set(Array.from({ length: 100_000 }, (_, index) => resolveLiveRasterScale(0.22 + (index / 100_000) * (2.24 * 2 - 0.22))));
        expect(levels.size).toBeLessThanOrEqual(Math.ceil(Math.log2((2.24 * 2) / 0.22) * 48) + 1);
    });

    it('lands exactly on a level when the scale is one', () => {
        expect(resolveLiveRasterScale(2)).toBe(2);
        expect(resolveLiveRasterScale(1)).toBe(1);
    });
});
