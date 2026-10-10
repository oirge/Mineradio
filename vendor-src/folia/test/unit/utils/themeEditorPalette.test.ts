import { describe, expect, it } from 'vitest';
import { buildRecommendedColors, normalizePaletteColor, RECOMMENDED_COLOR_LIMIT } from '@/utils/themeEditorPalette';
import type { DualTheme } from '@/types';

// test/unit/utils/themeEditorPalette.test.ts

const dualTheme: DualTheme = {
    light: {
        name: 'Light',
        backgroundColor: '#fff8e7',
        primaryColor: '#1c1917',
        accentColor: '#ea580c',
        secondaryColor: '#44403c',
        fontStyle: 'sans',
        animationIntensity: 'normal',
    },
    dark: {
        name: 'Dark',
        backgroundColor: '#09090b',
        primaryColor: '#f4f4f5',
        accentColor: '#f97316',
        secondaryColor: '#71717a',
        fontStyle: 'sans',
        animationIntensity: 'normal',
    },
};

describe('themeEditorPalette', () => {
    it('normalizes short hex and rejects anything else', () => {
        expect(normalizePaletteColor('#F00')).toBe('#ff0000');
        expect(normalizePaletteColor('  #A1B2C3 ')).toBe('#a1b2c3');
        expect(normalizePaletteColor('rgb(1,2,3)')).toBeNull();
        expect(normalizePaletteColor('')).toBeNull();
    });

    it('puts cover colors first and drops duplicates', () => {
        const recommended = buildRecommendedColors(dualTheme, ['#F97316', '#123456', 'not-a-color']);

        expect(recommended.slice(0, 2)).toEqual(['#f97316', '#123456']);
        expect(recommended).not.toContain('not-a-color');
        expect(new Set(recommended).size).toBe(recommended.length);
        // '#f97316' is also the dark accent, so it must not appear twice.
        expect(recommended.filter(color => color === '#f97316')).toHaveLength(1);
    });

    it('caps the strip so it stays one row', () => {
        const manyColors = Array.from({ length: 30 }, (_, index) => `#${index.toString(16).padStart(6, '0')}`);
        expect(buildRecommendedColors(dualTheme, manyColors)).toHaveLength(RECOMMENDED_COLOR_LIMIT);
    });
});
