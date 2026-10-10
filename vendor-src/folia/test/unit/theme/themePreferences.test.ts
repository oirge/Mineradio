import { afterEach, describe, expect, it } from 'vitest';
import {
    isThemeGenerationSource,
    readStoredThemeAutoGenerateEnabled,
    readStoredThemeGenerationSource,
    resolveCustomThemePreferenceChange,
    resolveSongThemeAutoGenerateChange,
    resolveSongThemeAutoSwitchChange,
    saveStoredThemeAutoGenerateEnabled,
    saveStoredThemeGenerationSource,
    type ThemePreferenceSwitchState,
} from '@/services/themePreferences';

// test/unit/theme/themePreferences.test.ts
// Covers persisted theme preference toggles and their mutual-exclusion rules.

const createLocalStorageMock = (): Storage => {
    const store = new Map<string, string>();

    return {
        get length() {
            return store.size;
        },
        getItem: (key: string) => store.get(key) ?? null,
        key: (index: number) => Array.from(store.keys())[index] ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
        clear: () => {
            store.clear();
        },
    };
};

const baseState: ThemePreferenceSwitchState = {
    isCustomThemePreferred: false,
    songThemeAutoSwitchEnabled: true,
    songThemeAutoGenerateEnabled: true,
};

// Config import applies both song-theme flags back to back. The resolvers only compose correctly
// when the second one starts from the first one's result; feeding both the same starting state
// makes the later write discard the earlier one, which is how an imported auto-switch value gets
// silently dropped. useThemeController therefore keeps the switch state in a ref rather than
// reading render-scoped state between the two calls.
describe('song theme preference resolvers, applied back to back', () => {
    const off: ThemePreferenceSwitchState = {
        isCustomThemePreferred: false,
        songThemeAutoSwitchEnabled: false,
        songThemeAutoGenerateEnabled: false,
    };

    it('keeps both imported values when the state is threaded through', () => {
        const afterSwitch = resolveSongThemeAutoSwitchChange(off, true);
        const afterGenerate = resolveSongThemeAutoGenerateChange(afterSwitch, false);
        expect(afterGenerate.songThemeAutoSwitchEnabled).toBe(true);
        expect(afterGenerate.songThemeAutoGenerateEnabled).toBe(false);
    });

    it('loses the first value when both resolve from the same snapshot', () => {
        const afterSwitch = resolveSongThemeAutoSwitchChange(off, true);
        const fromStaleSnapshot = resolveSongThemeAutoGenerateChange(off, false);
        expect(afterSwitch.songThemeAutoSwitchEnabled).toBe(true);
        expect(fromStaleSnapshot.songThemeAutoSwitchEnabled).toBe(false);
    });
});

describe('themePreferences', () => {
    afterEach(() => {
        delete (globalThis as { window?: unknown; }).window;
    });

    it('defaults automatic song theme generation to disabled', () => {
        (globalThis as { window?: { localStorage: Storage; }; }).window = {
            localStorage: createLocalStorageMock(),
        };

        expect(readStoredThemeAutoGenerateEnabled()).toBe(false);
    });

    it('persists automatic song theme generation', () => {
        const localStorage = createLocalStorageMock();
        (globalThis as { window?: { localStorage: Storage; }; }).window = { localStorage };

        saveStoredThemeAutoGenerateEnabled(true);
        expect(readStoredThemeAutoGenerateEnabled()).toBe(true);

        saveStoredThemeAutoGenerateEnabled(false);
        expect(readStoredThemeAutoGenerateEnabled()).toBe(false);
    });

    it('turns off song automation when custom theme preference is enabled', () => {
        expect(resolveCustomThemePreferenceChange(baseState, true)).toEqual({
            isCustomThemePreferred: true,
            songThemeAutoSwitchEnabled: false,
            songThemeAutoGenerateEnabled: false,
        });
    });

    it('turns off custom theme preference when song auto switch is enabled', () => {
        expect(resolveSongThemeAutoSwitchChange({
            isCustomThemePreferred: true,
            songThemeAutoSwitchEnabled: false,
            songThemeAutoGenerateEnabled: false,
        }, true)).toEqual({
            isCustomThemePreferred: false,
            songThemeAutoSwitchEnabled: true,
            songThemeAutoGenerateEnabled: false,
        });
    });

    it('turns off child auto generation when song auto switch is disabled', () => {
        expect(resolveSongThemeAutoSwitchChange(baseState, false)).toEqual({
            isCustomThemePreferred: false,
            songThemeAutoSwitchEnabled: false,
            songThemeAutoGenerateEnabled: false,
        });
    });

    it('enabling auto generation also enables song auto switch and disables custom preference', () => {
        expect(resolveSongThemeAutoGenerateChange({
            isCustomThemePreferred: true,
            songThemeAutoSwitchEnabled: false,
            songThemeAutoGenerateEnabled: false,
        }, true)).toEqual({
            isCustomThemePreferred: false,
            songThemeAutoSwitchEnabled: true,
            songThemeAutoGenerateEnabled: true,
        });
    });

    it('defaults the theme generation source to AI and round-trips a stored choice', () => {
        const localStorage = createLocalStorageMock();
        (globalThis as { window?: { localStorage: Storage; }; }).window = { localStorage };

        expect(readStoredThemeGenerationSource()).toBe('ai');

        saveStoredThemeGenerationSource('cover');
        expect(localStorage.getItem('theme_generation_source')).toBe('cover');
        expect(readStoredThemeGenerationSource()).toBe('cover');

        // A stale or hand-edited value falls back rather than propagating an unknown source.
        localStorage.setItem('theme_generation_source', 'palette');
        expect(readStoredThemeGenerationSource()).toBe('ai');
    });

    it('guards the theme generation source values', () => {
        expect(isThemeGenerationSource('ai')).toBe(true);
        expect(isThemeGenerationSource('cover')).toBe(true);
        expect(isThemeGenerationSource('palette')).toBe(false);
        expect(isThemeGenerationSource(undefined)).toBe(false);
    });
});
