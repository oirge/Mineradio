import { describe, expect, it } from 'vitest';
import {
    adjustLightnessForContrast,
    getContrastRatio,
    getHueDistance,
    hexToHsl,
    hslToHex,
    mixHexColors,
} from '@/utils/themeColorMath';

// test/unit/utils/themeColorMath.test.ts

describe('themeColorMath', () => {
    it('round-trips hex through HSL', () => {
        for (const color of ['#f97316', '#22c55e', '#4f7cff', '#09090b', '#f4f4f5']) {
            const hsl = hexToHsl(color);
            expect(hsl).not.toBeNull();
            expect(hslToHex(hsl!)).toBe(color);
        }
    });

    it('parses rgb() input and normalizes short hex', () => {
        expect(hexToHsl('rgb(255, 0, 0)')!.h).toBeCloseTo(0, 5);
        expect(hslToHex(hexToHsl('#f00')!)).toBe('#ff0000');
        expect(hexToHsl('not-a-color')).toBeNull();
    });

    it('mixes colors in hex space', () => {
        expect(mixHexColors('#000000', '#ffffff', 0.5)).toBe('#808080');
        expect(mixHexColors('#000000', '#ffffff', 0)).toBe('#000000');
        expect(mixHexColors('#000000', '#ffffff', 1)).toBe('#ffffff');
    });

    it('measures hue distance on the shorter arc', () => {
        expect(getHueDistance(350, 10)).toBe(20);
        expect(getHueDistance(10, 350)).toBe(20);
        expect(getHueDistance(0, 180)).toBe(180);
    });

    it('lifts a low-contrast color over the floor on a dark background', () => {
        const background = '#101418';
        const adjusted = adjustLightnessForContrast('#1b2733', background, 4.5);

        expect(getContrastRatio(adjusted, background)).toBeGreaterThanOrEqual(4.5);
        // The hue survives the lightness walk.
        expect(getHueDistance(hexToHsl(adjusted)!.h, hexToHsl('#1b2733')!.h)).toBeLessThan(6);
    });

    it('darkens a low-contrast color on a light background', () => {
        const background = '#f5f1ea';
        const adjusted = adjustLightnessForContrast('#e8d9bf', background, 4.5);

        expect(getContrastRatio(adjusted, background)).toBeGreaterThanOrEqual(4.5);
        expect(hexToHsl(adjusted)!.l).toBeLessThan(hexToHsl('#e8d9bf')!.l);
    });

    it('returns the best candidate when the floor is unreachable', () => {
        const adjusted = adjustLightnessForContrast('#ffffff', '#ffffff', 21);

        expect(getContrastRatio(adjusted, '#ffffff')).toBeGreaterThan(1);
    });
});
