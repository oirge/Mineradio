// Copyright (c) 2026 chthollyphile
import { defineVisualizerTuning, type StoredTuningFields } from '../tuningDefinition';
import { normalizeHanabiTuning } from './hanabiTuning';
import { DEFAULT_HANABI_TUNING, type HanabiTuning } from './types';

// src/components/visualizer/hanabi/tuning.ts
// 花火's tuning: its defaults, the settings store fields it lives in, and where it is stored. The
// renderer reads it from the tuning bundle with read() (entry.tsx), so there is no named prop.

declare module '../tuningDefinition' {
    interface VisualizerTuningSettings extends StoredTuningFields<'hanabiTuning', 'handleSetHanabiTuning', 'handleResetHanabiTuning', HanabiTuning> {}
}

export default defineVisualizerTuning<HanabiTuning>({
    mode: 'hanabi',
    defaults: DEFAULT_HANABI_TUNING,
    settingsKey: 'hanabiTuning',
    settingsSetterKey: 'handleSetHanabiTuning',
    settingsResetterKey: 'handleResetHanabiTuning',
    storage: {
        key: 'hanabi_tuning',
        read: normalizeHanabiTuning,
        // Merge then normalize: the same clamp runs for slider drags, imports, sync and Folium.
        merge: (held, patch) => normalizeHanabiTuning({ ...held, ...patch }),
        resetNotice: 'notifications.hanabiReset',
    },
});
