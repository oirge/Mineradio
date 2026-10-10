import type { DualTheme, Theme } from '../../../types';
import { sanitizeDualTheme } from '../../../services/themeSanitizer';

// src/components/modal/theme-park/themeParkDraft.ts
// Pure model for the Theme Park editor: the editable field map, the metadata normalizer that keeps
// a half-typed draft renderable, and the validators the save button gates on.

export type ThemeEditTarget = 'ai' | 'custom';
export type EditableMode = 'light' | 'dark';
export type EditableColorKey = 'backgroundColor' | 'primaryColor' | 'accentColor' | 'secondaryColor';
export type ThemeParkTab = 'colors' | 'details' | 'content' | 'ai';

export type WordColorEntry = { word: string; color: string; };

export const THEME_NAME_MAX_LENGTH = 32;
export const THEME_DESCRIPTION_MAX_LENGTH = 120;
// Mirrors the sanitizer's own cap so the editor cannot build a theme it would then truncate.
export const LYRICS_ICON_LIMIT = 12;
export const WORD_COLOR_LIMIT = 40;

export const COLOR_FIELDS: Array<{ key: EditableColorKey; labelKey: string; descKey: string; }> = [
    { key: 'backgroundColor', labelKey: 'theme.bgColor', descKey: 'theme.bgColorDesc' },
    { key: 'primaryColor', labelKey: 'theme.primaryColor', descKey: 'theme.primaryColorDesc' },
    { key: 'accentColor', labelKey: 'theme.accentColor', descKey: 'theme.accentColorDesc' },
    { key: 'secondaryColor', labelKey: 'theme.secondaryColor', descKey: 'theme.secondaryColorDesc' },
];

const normalizeThemeMetadata = (theme: Theme, fallbackName: string, provider: string): Theme => ({
    ...theme,
    name: theme.name?.trim() || fallbackName,
    provider: theme.provider || provider,
    wordColors: theme.wordColors || [],
    lyricsIcons: theme.lyricsIcons || [],
    description: theme.description || '',
});

const normalizeDualThemeMetadata = (dualTheme: DualTheme, provider: string): DualTheme => ({
    light: normalizeThemeMetadata(dualTheme.light, 'Theme Park Light', provider),
    dark: normalizeThemeMetadata(dualTheme.dark, 'Theme Park Dark', provider),
});

export const getTargetProvider = (target: ThemeEditTarget) => (target === 'custom' ? 'Custom' : 'AI');

// Keeps an in-progress draft (empty name, missing wordColors, invalid hex) renderable without
// discarding what the user typed; the same normalizer runs again on save.
export const normalizeThemeParkDualTheme = (
    dualTheme: DualTheme,
    target: ThemeEditTarget,
    fallbackTheme?: DualTheme,
): DualTheme => {
    const provider = getTargetProvider(target);
    const normalized = normalizeDualThemeMetadata(dualTheme, provider);

    return sanitizeDualTheme(
        normalized,
        fallbackTheme ? normalizeDualThemeMetadata(fallbackTheme, provider) : normalized,
    );
};

export const isThemeNameValid = (name: string) => {
    const trimmed = name.trim();
    return trimmed.length > 0 && trimmed.length <= THEME_NAME_MAX_LENGTH;
};

export const isDualThemeNameValid = (dualTheme: DualTheme) => (
    isThemeNameValid(dualTheme.light.name ?? '') && isThemeNameValid(dualTheme.dark.name ?? '')
);

export const patchDualThemeMode = (
    dualTheme: DualTheme,
    mode: EditableMode,
    patch: Partial<Theme>,
): DualTheme => ({
    ...dualTheme,
    [mode]: { ...dualTheme[mode], ...patch },
});

// wordColors and lyricsIcons describe the song, not the light/dark surface, so the AI contract
// keeps them identical on both sides and so does the editor.
export const patchDualThemeShared = (dualTheme: DualTheme, patch: Partial<Theme>): DualTheme => ({
    light: { ...dualTheme.light, ...patch },
    dark: { ...dualTheme.dark, ...patch },
});
