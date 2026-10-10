import type { MutableRefObject } from 'react';
import { AUDIO_EQUALIZER_BANDS, type AudioEqualizerSettings } from '../utils/audioEqualizer';

// src/services/audioEqualizerGraph.ts
// Owns the Web Audio filter chain without introducing React updates into the audio path.

type ConnectAudioEqualizerGraphParams = {
    context: AudioContext;
    input: AudioNode;
    output: AudioNode;
    nodesRef: MutableRefObject<BiquadFilterNode[]>;
    settings: AudioEqualizerSettings;
};

const resolveFilterFrequency = (context: AudioContext, frequency: number) => (
    Math.min(frequency, context.sampleRate * 0.475)
);

// Creates one stable ten-filter chain for the lifetime of the MediaElementAudioSourceNode.
export const connectAudioEqualizerGraph = ({
    context,
    input,
    output,
    nodesRef,
    settings,
}: ConnectAudioEqualizerGraphParams) => {
    const nodes = AUDIO_EQUALIZER_BANDS.map((band, index) => {
        const filter = context.createBiquadFilter();
        filter.type = index === 0
            ? 'lowshelf'
            : index === AUDIO_EQUALIZER_BANDS.length - 1
                ? 'highshelf'
                : 'peaking';
        filter.frequency.value = resolveFilterFrequency(context, band.frequency);
        filter.Q.value = 1.4;
        filter.gain.value = settings.enabled ? settings.gains[index] : 0;
        return filter;
    });

    nodes.reduce<AudioNode>((previousNode, filter) => {
        previousNode.connect(filter);
        return filter;
    }, input).connect(output);
    nodesRef.current = nodes;
};

// Smoothly applies discrete slider commits while keeping React out of the audio processing loop.
export const applyAudioEqualizerSettings = (
    context: AudioContext,
    nodes: BiquadFilterNode[],
    settings: AudioEqualizerSettings,
) => {
    nodes.forEach((filter, index) => {
        const nextGain = settings.enabled ? (settings.gains[index] ?? 0) : 0;
        filter.gain.cancelScheduledValues(context.currentTime);
        filter.gain.setTargetAtTime(nextGain, context.currentTime, 0.015);
    });
};
