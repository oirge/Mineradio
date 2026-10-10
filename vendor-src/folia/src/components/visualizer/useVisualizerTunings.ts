import { useShallow } from 'zustand/react/shallow';
import { useVisualizerSettingsStore } from '../../stores/useVisualizerSettingsStore';

// src/components/visualizer/useVisualizerTunings.ts
//
// The per-visualizer tuning bundle. Two surfaces publish it - the on-screen renderer and the OBS
// browser source - and App.tsx assembled it for both, which is the only reason it lived there.
// Adding a visualizer's tuning is now this file plus its store field, not App.tsx as well.

export const useVisualizerTunings = () => useVisualizerSettingsStore(useShallow(state => ({
    classic: state.classicTuning,
    cadenza: state.cadenzaTuning,
    partita: state.partitaTuning,
    fume: state.fumeTuning,
    claddagh: state.claddaghTuning,
    cappella: state.cappellaTuning,
    tilt: state.tiltTuning,
    diorama: state.dioramaTuning,
    monet: state.monetTuning,
    pendolo: state.pendoloTuning,
    sonnet: state.sonnetTuning,
    tempera: state.temperaTuning,
    lumiere: state.lumiereTuning,
})));
