import { defineVisualizerTuning } from '../tuningRegistry';

// Injects Tilt's strongly typed tuning at the renderer boundary.
export default defineVisualizerTuning({ mode: 'tilt', settingsKey: 'tiltTuning', settingsSetterKey: 'handleSetTiltTuning', apply: (props, tuning) => ({ ...props, tiltTuning: tuning }) });
