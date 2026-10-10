import { defineVisualizerTuning } from '../tuningRegistry';

// src/components/visualizer/pendolo/tuning.ts
// Injects Pendolo's strongly typed tuning at the renderer boundary.
export default defineVisualizerTuning({
    mode: 'pendolo',
    settingsKey: 'pendoloTuning',
    settingsSetterKey: 'handleSetPendoloTuning',
    apply: (props, tuning) => ({ ...props, pendoloTuning: tuning }),
});
