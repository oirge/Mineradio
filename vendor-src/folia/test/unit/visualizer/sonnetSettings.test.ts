import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SONNET_TUNING } from '@/types';
import { useVisualizerSettingsStore } from '@/stores/useVisualizerSettingsStore';

// test/unit/visualizer/sonnetSettings.test.ts
// Verifies Sonnet visibility tuning at the store boundary.
const createLocalStorageMock = (): Storage => {
    const values = new Map<string, string>();

    return {
        get length() {
            return values.size;
        },
        getItem: key => values.get(key) ?? null,
        key: index => Array.from(values.keys())[index] ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key),
        clear: () => values.clear(),
    };
};

describe('Sonnet settings', () => {
    let storage: Storage;

    beforeEach(() => {
        storage = createLocalStorageMock();
        vi.stubGlobal('localStorage', storage);
        vi.stubGlobal('window', { localStorage: storage });
        useVisualizerSettingsStore.setState({
            visualizerMode: 'classic',
            sonnetTuning: { ...DEFAULT_SONNET_TUNING },
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('updates and persists visibility tuning', () => {
        expect(DEFAULT_SONNET_TUNING.textureResolution).toBe(1.5);
        useVisualizerSettingsStore.getState().handleSetSonnetTuning({
            showOnlyText: true,
            showGuide: false,
            showBackgroundMg: false,
            enableTransitions: true,
            outerFrameMode: 'frame',
            textureResolution: 1.75,
            postProcessLensDistortion: 1.8,
            postProcessLensDispersion: 0.7,
        });

        expect(useVisualizerSettingsStore.getState().sonnetTuning).toMatchObject({
            showOnlyText: true,
            showGuide: false,
            showBackgroundMg: false,
            showFixedGeo: true,
            enableTransitions: true,
            outerFrameMode: 'frame',
            textureResolution: 1.75,
            postProcessLensDistortion: 1.8,
            postProcessLensDispersion: 0.7,
        });
        expect(JSON.parse(storage.getItem('sonnet_tuning') ?? '{}')).toMatchObject({
            showOnlyText: true,
            showGuide: false,
            showBackgroundMg: false,
            enableTransitions: true,
            outerFrameMode: 'frame',
            textureResolution: 1.75,
            postProcessLensDistortion: 1.8,
            postProcessLensDispersion: 0.7,
        });
    });

    it('enters Sonnet directly without an interstitial confirmation', () => {
        useVisualizerSettingsStore.getState().handleSetVisualizerMode('sonnet');

        expect(useVisualizerSettingsStore.getState().visualizerMode).toBe('sonnet');
        expect(storage.getItem('visualizer_mode')).toBe('sonnet');
    });

    it('allows the stronger lens distortion range without accepting out-of-range values', () => {
        useVisualizerSettingsStore.getState().handleSetSonnetTuning({ postProcessLensDistortion: 3 });

        expect(useVisualizerSettingsStore.getState().sonnetTuning.postProcessLensDistortion).toBe(2);
    });
});
