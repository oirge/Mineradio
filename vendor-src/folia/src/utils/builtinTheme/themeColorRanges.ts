import type { PaletteTone } from './coverPaletteAnalysis';

// src/utils/builtinTheme/themeColorRanges.ts
// The numeric design space of a built-in theme: how deep/tinted each background tone reads and
// which saturation/lightness band each role starts from before the contrast solver runs.

export type ThemeMode = 'light' | 'dark';

export type Range = [number, number];

export type BackgroundTone = {
    darkLightness: Range;
    darkSaturation: Range;
    lightLightness: Range;
    lightSaturation: Range;
};

export const PRIMARY_MIN_CONTRAST = 9;
export const ACCENT_MIN_CONTRAST = 3.2;
export const SECONDARY_MIN_CONTRAST = 4.5;
export const MIN_BACKGROUND_SATURATION = 0.04;

// Background character: how far the theme leans from near-neutral ink to a fully tinted ground.
export const BACKGROUND_TONES: Record<PaletteTone, BackgroundTone> = {
    ink: {
        darkLightness: [0.055, 0.085],
        darkSaturation: [0.10, 0.22],
        lightLightness: [0.940, 0.965],
        lightSaturation: [0.05, 0.12],
    },
    tinted: {
        darkLightness: [0.075, 0.110],
        darkSaturation: [0.20, 0.36],
        lightLightness: [0.920, 0.950],
        lightSaturation: [0.10, 0.20],
    },
    rich: {
        darkLightness: [0.095, 0.140],
        darkSaturation: [0.32, 0.50],
        lightLightness: [0.900, 0.935],
        lightSaturation: [0.18, 0.30],
    },
};

// Kept off the pure #ffffff / #000000 poles and tinted toward the background hue, the way the AI
// theme contract asks for (soft cream / pale mint on dark, deep navy / plum on light).
export const PRIMARY_RANGES: Record<ThemeMode, { saturation: Range; lightness: Range; }> = {
    light: { saturation: [0.15, 0.40], lightness: [0.10, 0.20] },
    dark: { saturation: [0.10, 0.30], lightness: [0.90, 0.96] },
};

export const ACCENT_RANGES: Record<ThemeMode, { saturation: Range; lightness: Range; }> = {
    light: { saturation: [0.55, 0.88], lightness: [0.38, 0.55] },
    dark: { saturation: [0.55, 0.92], lightness: [0.55, 0.72] },
};

export const SECONDARY_RANGES: Record<ThemeMode, { saturation: Range; lightness: Range; }> = {
    light: { saturation: [0.15, 0.45], lightness: [0.32, 0.46] },
    dark: { saturation: [0.15, 0.45], lightness: [0.62, 0.76] },
};

