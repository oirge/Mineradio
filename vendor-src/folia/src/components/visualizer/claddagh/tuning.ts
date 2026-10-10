import { defineVisualizerTuning } from '../tuningRegistry';

// Injects Claddagh's strongly typed tuning at the renderer boundary.
export default defineVisualizerTuning({ mode: 'claddagh', settingsKey: 'claddaghTuning', settingsSetterKey: 'handleSetCladdaghTuning', apply: (props, tuning) => ({ ...props, claddaghTuning: tuning }) });
