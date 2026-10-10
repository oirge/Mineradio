import type { DualTheme } from '../types';

// src/utils/themeEditorPalette.ts
// Shared swatch helpers for the theme editors: normalizes loose hex input and builds the
// "recommended colors" strip from the cover palette plus the theme's own eight colors.

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const RECOMMENDED_COLOR_LIMIT = 12;

export const normalizePaletteColor = (color: string) => {
    const trimmed = typeof color === 'string' ? color.trim() : '';
    if (!HEX_COLOR_PATTERN.test(trimmed)) {
        return null;
    }

    const hex = trimmed.slice(1).toLowerCase();
    return hex.length === 3
        ? `#${hex.split('').map(char => `${char}${char}`).join('')}`
        : `#${hex}`;
};

export const collectThemeColors = (theme: DualTheme) => ([
    theme.light.backgroundColor,
    theme.light.primaryColor,
    theme.light.accentColor,
    theme.light.secondaryColor,
    theme.dark.backgroundColor,
    theme.dark.primaryColor,
    theme.dark.accentColor,
    theme.dark.secondaryColor,
]);

// Cover colors first so the artwork's own palette stays reachable in one click.
export const buildRecommendedColors = (theme: DualTheme, coverColors: string[]) => {
    const seen = new Set<string>();

    return [...coverColors, ...collectThemeColors(theme)].flatMap(color => {
        const normalized = normalizePaletteColor(color);
        if (!normalized || seen.has(normalized)) {
            return [];
        }
        seen.add(normalized);
        return [normalized];
    }).slice(0, RECOMMENDED_COLOR_LIMIT);
};
