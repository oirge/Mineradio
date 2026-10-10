import { afterEach, describe, expect, it } from 'vitest';
import { buildBuiltinDualTheme } from '@/hooks/themeControllerState';

// test/unit/hooks/themeControllerState.test.ts

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

describe('themeControllerState built-in theme behavior', () => {
    afterEach(() => {
        // Keep the node test environment clean across cases.
        delete (globalThis as { window?: unknown; }).window;
    });

    it('builds built-in fallback themes with the persisted animation intensity', () => {
        const localStorage = createLocalStorageMock();
        localStorage.setItem('theme_animation_intensity', 'chaotic');
        (globalThis as { window?: { localStorage: Storage; }; }).window = {
            localStorage,
        };

        const dualTheme = buildBuiltinDualTheme({
            coverColors: ['#22c55e'],
        });

        expect(dualTheme.light.animationIntensity).toBe('chaotic');
        expect(dualTheme.dark.animationIntensity).toBe('chaotic');
        expect(dualTheme.light.provider).toBe('Built-in');
        expect(dualTheme.dark.provider).toBe('Built-in');
    });
});
