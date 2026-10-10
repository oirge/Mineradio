import { defineVisualizerTuning } from '../tuningRegistry';

// Injects Fume's strongly typed tuning at the renderer boundary.
export default defineVisualizerTuning({ mode: 'fume', settingsKey: 'fumeTuning', settingsSetterKey: 'handleSetFumeTuning', apply: (props, tuning) => ({ ...props, fumeTuning: tuning }) });
