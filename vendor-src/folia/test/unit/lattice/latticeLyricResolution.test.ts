import { describe, expect, it } from 'vitest';
import { latticeLyricResolution } from '../../../src/components/app/lattice/lyrics/createLatticeLyricRuntime';

describe('latticeLyricResolution', () => {
    it('renders 1x displays at 1 and dense displays at 2', () => {
        expect(latticeLyricResolution(1)).toBe(1);
        expect(latticeLyricResolution(2)).toBe(2);
        expect(latticeLyricResolution(3)).toBe(2);
    });
    it('rounds fractional ratios up so the camera-scaled card keeps its supersampling', () => {
        expect(latticeLyricResolution(1.25)).toBe(2);
        expect(latticeLyricResolution(1.5)).toBe(2);
        expect(latticeLyricResolution(1.75)).toBe(2);
    });
    it('falls back to 1 for unusable ratios', () => {
        expect(latticeLyricResolution(0)).toBe(1);
        expect(latticeLyricResolution(Number.NaN)).toBe(1);
        expect(latticeLyricResolution(-2)).toBe(1);
    });
});
