import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_PENDOLO_TUNING } from '@/types';
import { useVisualizerSettingsStore } from '@/stores/useVisualizerSettingsStore';

// test/unit/visualizer/pendoloSettings.test.ts
// Verifies the Pendolo glow preference survives the settings store and local persistence boundary.
const createLocalStorageMock = (): Storage => {
    const values = new Map<string, string>();

    return {
        get length() {
            return values.size;
        },
        getItem: (key) => values.get(key) ?? null,
        key: (index) => Array.from(values.keys())[index] ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
        clear: () => values.clear(),
    };
};

describe('Pendolo settings', () => {
    let storage: Storage;

    beforeEach(() => {
        storage = createLocalStorageMock();
        vi.stubGlobal('localStorage', storage);
        vi.stubGlobal('window', { localStorage: storage });
        useVisualizerSettingsStore.setState({ pendoloTuning: { ...DEFAULT_PENDOLO_TUNING } });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('updates and persists the line glow preference', () => {
        useVisualizerSettingsStore.getState().handleSetPendoloTuning({ enableLineGlow: true });

        expect(useVisualizerSettingsStore.getState().pendoloTuning.enableLineGlow).toBe(true);
        expect(JSON.parse(storage.getItem('pendolo_tuning') ?? '{}').enableLineGlow).toBe(true);

        useVisualizerSettingsStore.getState().handleSetPendoloTuning({ enableLineGlow: false });

        expect(useVisualizerSettingsStore.getState().pendoloTuning.enableLineGlow).toBe(false);
        expect(JSON.parse(storage.getItem('pendolo_tuning') ?? '{}').enableLineGlow).toBe(false);
    });
});
