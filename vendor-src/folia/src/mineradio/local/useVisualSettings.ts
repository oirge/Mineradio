import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import * as presets from '../../types';
import type { VisualizerTuningBundle, VisualizerTuningMode } from '../../components/visualizer/tuningRegistry';
import type { VisualizerBackgroundConfig } from '../../components/visualizer/backgrounds/definition';
import { isBuiltinVisualizerMode, isBuiltinVisualizerBackgroundMode } from '../../types/visualizerModes';

// src/mineradio/local/useVisualSettings.ts
// Dedicated visual preferences for the embedded local player, without application/provider stores.
export const DEFAULT_LOCAL_TUNINGS: VisualizerTuningBundle = {
    classic: presets.DEFAULT_CLASSIC_TUNING, cadenza: presets.DEFAULT_CADENZA_TUNING,
    partita: presets.DEFAULT_PARTITA_TUNING, fume: presets.DEFAULT_FUME_TUNING,
    claddagh: presets.DEFAULT_CLADDAGH_TUNING, cappella: presets.DEFAULT_CAPPELLA_TUNING,
    tilt: presets.DEFAULT_TILT_TUNING, diorama: presets.DEFAULT_DIORAMA_TUNING,
    monet: presets.DEFAULT_MONET_TUNING, pendolo: presets.DEFAULT_PENDOLO_TUNING,
    sonnet: presets.DEFAULT_SONNET_TUNING, tempera: presets.DEFAULT_TEMPERA_TUNING,
    lumiere: presets.DEFAULT_LUMIERE_TUNING,
};
interface VisualPreferences {
    view: 'lyrics' | 'records' | 'posters';
    mode: presets.VisualizerMode;
    background: VisualizerBackgroundConfig;
    daylight: boolean;
    lyricsFontScale: number;
    translation: boolean;
    tunings: VisualizerTuningBundle;
}
interface VisualSettings extends VisualPreferences {
    update: (patch: Partial<VisualPreferences>) => void;
    tune: (mode: VisualizerTuningMode, patch: Record<string, unknown>) => void;
    reset: () => void;
}
const defaults: VisualPreferences = {
    view: 'lyrics',
    mode: 'classic', background: { mode: 'latent' }, daylight: false,
    lyricsFontScale: 1, translation: true, tunings: DEFAULT_LOCAL_TUNINGS,
};
function restoredTunings(value: unknown): VisualizerTuningBundle {
    const saved = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return Object.fromEntries(Object.entries(DEFAULT_LOCAL_TUNINGS).map(([mode, base]) => {
        const patch = saved[mode];
        return [mode, { ...base, ...(patch && typeof patch === 'object' && !Array.isArray(patch) ? patch : {}) }];
    })) as VisualizerTuningBundle;
}
export const useVisualSettings = create<VisualSettings>()(persist((set) => ({
    ...defaults,
    update: (patch) => set(patch),
    tune: (mode, patch) => set((state) => ({ tunings: {
        ...state.tunings, [mode]: { ...DEFAULT_LOCAL_TUNINGS[mode], ...state.tunings[mode], ...patch },
    } })),
    reset: () => set(defaults),
}), {
    name: 'mineradio-folia-local-visuals-v1',
    // Validate persisted routing fields so outdated/unavailable modes cannot load remote backgrounds.
    merge: (saved, current) => {
        const value = saved && typeof saved === 'object' ? saved as Partial<VisualPreferences> : {};
        const background = value.background && typeof value.background === 'object' ? value.background : defaults.background;
        return { ...current,
            view: value.view === 'records' || value.view === 'posters' ? value.view : 'lyrics',
            mode: isBuiltinVisualizerMode(value.mode) ? value.mode : defaults.mode,
            background: { ...background, mode: isBuiltinVisualizerBackgroundMode(background.mode) && background.mode !== 'url' ? background.mode : 'latent', url: undefined },
            daylight: value.daylight === true,
            lyricsFontScale: Number.isFinite(value.lyricsFontScale) ? Math.min(1.6, Math.max(0.6, value.lyricsFontScale!)) : 1,
            translation: value.translation !== false,
            tunings: restoredTunings(value.tunings),
        };
    },
}));
