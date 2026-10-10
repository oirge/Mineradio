import { rampParam } from './effectParams';
import { createVinylNoiseBuffer } from './effectSources';
import { createReleaseTimer, type AudioEffectBranch } from './effectBranchRelease';
import type { AudioEffectNodes } from './effectNodes';

// src/services/audioEffects/noiseBranch.ts
// Looping vinyl noise floor mixed straight into the chain output.

// Crackles and hiss are band-passed so the noise sits with the music instead of on top of it.
export const createNoiseBranch = (context: AudioContext, nodes: AudioEffectNodes): AudioEffectBranch => {
    let source: AudioBufferSourceNode | null = null;
    let filter: BiquadFilterNode | null = null;
    const release = createReleaseTimer();

    const teardown = () => {
        if (source) {
            try {
                source.stop();
            } catch {
                // Already stopped together with the audio context.
            }
            source.disconnect();
            source = null;
        }
        filter?.disconnect();
        filter = null;
    };

    return {
        set: (amount) => {
            if (amount > 0) {
                release.cancel();
                if (!source) {
                    filter = context.createBiquadFilter();
                    filter.type = 'bandpass';
                    filter.frequency.value = 2600;
                    filter.Q.value = 0.5;
                    source = context.createBufferSource();
                    source.buffer = createVinylNoiseBuffer(context);
                    source.loop = true;
                    source.connect(filter);
                    filter.connect(nodes.noiseGain);
                    source.start();
                }
                rampParam(context, nodes.noiseGain.gain, amount ** 1.4 * 0.55, 0.12);
                return;
            }

            rampParam(context, nodes.noiseGain.gain, 0, 0.12);
            if (source) {
                release.schedule(teardown);
            }
        },
        dispose: () => {
            release.cancel();
            teardown();
        },
    };
};
