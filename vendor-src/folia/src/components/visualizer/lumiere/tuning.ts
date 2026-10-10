// Copyright (c) 2026 chthollyphile
import { defineVisualizerTuning } from '../tuningRegistry';

// src/components/visualizer/lumiere/tuning.ts
// Injects 绘光's strongly typed tuning at the renderer boundary.
export default defineVisualizerTuning({
    mode: 'lumiere',
    settingsKey: 'lumiereTuning',
    settingsSetterKey: 'handleSetLumiereTuning',
    apply: (props, tuning) => ({ ...props, lumiereTuning: tuning }),
});
