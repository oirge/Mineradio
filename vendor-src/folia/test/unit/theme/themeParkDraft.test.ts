import { describe, expect, it } from 'vitest';
import {
    isDualThemeNameValid,
    isThemeNameValid,
    getTargetProvider,
    normalizeThemeParkDualTheme,
    patchDualThemeMode,
    patchDualThemeShared,
    THEME_NAME_MAX_LENGTH,
} from '@/components/modal/theme-park/themeParkDraft';
import type { DualTheme } from '@/types';

// test/unit/theme/themeParkDraft.test.ts

const buildDualTheme = (overrides: Partial<DualTheme> = {}): DualTheme => ({
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
    ...overrides,
});

describe('themeParkDraft', () => {
    it('stamps the provider of the edit target', () => {
        expect(getTargetProvider('custom')).toBe('Custom');
        expect(getTargetProvider('ai')).toBe('AI');

        const custom = normalizeThemeParkDualTheme(buildDualTheme(), 'custom');
        expect(custom.light.provider).toBe('Custom');
        expect(custom.dark.provider).toBe('Custom');

        const ai = normalizeThemeParkDualTheme(buildDualTheme(), 'ai');
        expect(ai.light.provider).toBe('AI');
    });

    it('keeps an existing provider rather than overwriting it', () => {
        const seeded = buildDualTheme();
        seeded.light.provider = 'Google Gemini';
        seeded.dark.provider = 'Google Gemini';

        expect(normalizeThemeParkDualTheme(seeded, 'custom').light.provider).toBe('Google Gemini');
    });

    it('fills the metadata a half-typed draft is missing', () => {
        const draft = buildDualTheme();
        draft.light.name = '   ';

        const normalized = normalizeThemeParkDualTheme(draft, 'custom');
        expect(normalized.light.name).toBe('Theme Park Light');
        expect(normalized.light.wordColors).toEqual([]);
        expect(normalized.light.lyricsIcons).toEqual([]);
        expect(normalized.light.description).toBe('');
    });

    it('falls back to the session baseline for an invalid hex value', () => {
        const baseline = buildDualTheme();
        const draft = buildDualTheme();
        draft.dark.accentColor = '#f9';

        const normalized = normalizeThemeParkDualTheme(draft, 'ai', baseline);
        expect(normalized.dark.accentColor).toBe(baseline.dark.accentColor);
    });

    it('validates theme names on both sides', () => {
        expect(isThemeNameValid('Sunset')).toBe(true);
        expect(isThemeNameValid('   ')).toBe(false);
        expect(isThemeNameValid('x'.repeat(THEME_NAME_MAX_LENGTH + 1))).toBe(false);

        expect(isDualThemeNameValid(buildDualTheme())).toBe(true);
        expect(isDualThemeNameValid(buildDualTheme({ dark: { ...buildDualTheme().dark, name: '' } }))).toBe(false);
    });

    it('patches one mode without touching the other', () => {
        const patched = patchDualThemeMode(buildDualTheme(), 'dark', { accentColor: '#123456' });

        expect(patched.dark.accentColor).toBe('#123456');
        expect(patched.light.accentColor).toBe('#ea580c');
    });

    it('patches song-level fields on both modes at once', () => {
        const patched = patchDualThemeShared(buildDualTheme(), {
            wordColors: [{ word: 'summer', color: '#ea580c' }],
            lyricsIcons: ['Sun'],
        });

        expect(patched.light.wordColors).toEqual(patched.dark.wordColors);
        expect(patched.light.lyricsIcons).toEqual(['Sun']);
        expect(patched.dark.lyricsIcons).toEqual(['Sun']);
    });
});
