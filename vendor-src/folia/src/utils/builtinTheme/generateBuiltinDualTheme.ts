import type { DualTheme, Theme } from '../../types';
import {
    adjustLightnessForContrast,
    clamp01,
    getContrastRatio,
    getHueDistance,
    hslToHex,
    normalizeHue,
} from '../themeColorMath';
import { analyzeCoverPalette, type CoverPalette } from './coverPaletteAnalysis';
import { pickBuiltinThemeDescriptions } from './themeDescriptionTable';
import { pickBuiltinThemeNames } from './themeNameTable';
import {
    ACCENT_MIN_CONTRAST,
    ACCENT_RANGES,
    BACKGROUND_TONES,
    MIN_BACKGROUND_SATURATION,
    PRIMARY_MIN_CONTRAST,
    PRIMARY_RANGES,
    SECONDARY_MIN_CONTRAST,
    SECONDARY_RANGES,
    type Range,
    type ThemeMode,
} from './themeColorRanges';

// src/utils/builtinTheme/generateBuiltinDualTheme.ts
// Generates the light/dark theme pair used when no AI API key is configured. Colors are computed
// from the cover's own hues plus a harmony scheme instead of snapping onto a fixed preset, and
// every text color is pushed along its lightness axis until it clears the contrast floor, so it
// keeps its hue rather than collapsing into a hard-coded near-white / near-black.

const between = (random: () => number, [min, max]: Range) => min + random() * (max - min);

// Interpolates along the shorter arc so a base/accent pair never swings through the opposite hue.
const lerpHue = (from: number, to: number, amount: number) => {
    const delta = ((to - from + 540) % 360) - 180;
    return normalizeHue(from + delta * amount);
};

const buildBackgroundColor = (mode: ThemeMode, palette: CoverPalette, random: () => number) => {
    const tone = BACKGROUND_TONES[palette.tone];
    const lightnessRange = mode === 'dark' ? tone.darkLightness : tone.lightLightness;
    const saturationRange = mode === 'dark' ? tone.darkSaturation : tone.lightSaturation;
    // A washed-out cover should not force a washed-out ground, but it should still read calmer.
    const coverWeight = 0.55 + 0.45 * clamp01(palette.baseSaturation / 0.7);

    return hslToHex({
        h: palette.baseHue,
        s: Math.max(MIN_BACKGROUND_SATURATION, between(random, saturationRange) * coverWeight),
        l: between(random, lightnessRange),
    });
};

const buildAccentColor = (
    mode: ThemeMode,
    palette: CoverPalette,
    backgroundColor: string,
    primaryColor: string,
    random: () => number,
) => {
    const ranges = ACCENT_RANGES[mode];
    const saturation = between(random, ranges.saturation);
    const lightness = between(random, ranges.lightness);
    const accent = adjustLightnessForContrast(
        hslToHex({ h: palette.accentHue, s: saturation, l: lightness }),
        backgroundColor,
        ACCENT_MIN_CONTRAST,
    );

    // A monochrome/analogous accent can land on top of the primary text color; rotate it away.
    const collidesWithPrimary = getHueDistance(palette.accentHue, palette.baseHue) < 15
        && getContrastRatio(accent, primaryColor) < 1.3;

    if (!collidesWithPrimary) {
        return accent;
    }

    return adjustLightnessForContrast(
        hslToHex({ h: normalizeHue(palette.accentHue + 40), s: saturation, l: lightness }),
        backgroundColor,
        ACCENT_MIN_CONTRAST,
    );
};

const buildModeTheme = (
    mode: ThemeMode,
    palette: CoverPalette,
    random: () => number,
    name: string,
    description: string,
): Theme => {
    const backgroundColor = buildBackgroundColor(mode, palette, random);

    const primaryRanges = PRIMARY_RANGES[mode];
    const primaryColor = adjustLightnessForContrast(
        hslToHex({
            h: palette.baseHue,
            s: between(random, primaryRanges.saturation),
            l: between(random, primaryRanges.lightness),
        }),
        backgroundColor,
        PRIMARY_MIN_CONTRAST,
    );

    const accentColor = buildAccentColor(mode, palette, backgroundColor, primaryColor, random);

    const secondaryRanges = SECONDARY_RANGES[mode];
    const secondaryColor = adjustLightnessForContrast(
        hslToHex({
            h: lerpHue(palette.baseHue, palette.accentHue, 0.2 + random() * 0.4),
            s: between(random, secondaryRanges.saturation),
            l: between(random, secondaryRanges.lightness),
        }),
        backgroundColor,
        SECONDARY_MIN_CONTRAST,
    );

    return {
        name,
        description,
        backgroundColor,
        primaryColor,
        accentColor,
        secondaryColor,
        fontStyle: 'sans',
        animationIntensity: 'normal',
        wordColors: [],
        lyricsIcons: [],
        provider: 'Built-in',
    };
};

export const generateBuiltinDualTheme = ({
    coverColors = [],
    random = Math.random,
}: {
    coverColors?: string[];
    random?: () => number;
} = {}): DualTheme => {
    const palette = analyzeCoverPalette(coverColors, random);
    const names = pickBuiltinThemeNames(palette, random);
    const descriptions = pickBuiltinThemeDescriptions(palette, random);

    return {
        light: buildModeTheme('light', palette, random, names.light, descriptions.light),
        dark: buildModeTheme('dark', palette, random, names.dark, descriptions.dark),
    };
};
