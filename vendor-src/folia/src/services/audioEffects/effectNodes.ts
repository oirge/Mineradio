// src/services/audioEffects/effectNodes.ts
// Creates and wires the always-on part of the effect chain; every stage stays neutral until settings ask for it.

export type AudioEffectNodes = {
    highpass: BiquadFilterNode;
    lowpass: BiquadFilterNode;
    drive: WaveShaperNode;
    crush: WaveShaperNode;
    wowDelay: DelayNode;
    stereoInput: GainNode;
    splitter: ChannelSplitterNode;
    merger: ChannelMergerNode;
    leftDirect: GainNode;
    rightDirect: GainNode;
    leftCross: GainNode;
    rightCross: GainNode;
    compressor: DynamicsCompressorNode;
    makeup: GainNode;
    dry: GainNode;
    wetSend: GainNode;
    wet: GainNode;
    noiseGain: GainNode;
};

export const WOW_BASE_DELAY_SECONDS = 0.012;

// Allocates every persistent node with neutral defaults.
export const createAudioEffectNodes = (context: AudioContext): AudioEffectNodes => {
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.Q.value = 0.7;
    highpass.frequency.value = 20;

    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.Q.value = 0.7;
    lowpass.frequency.value = Math.min(20000, context.sampleRate * 0.475);

    const drive = context.createWaveShaper();
    // Harmonics from soft clipping reach past Nyquist, and aliased ones are what make waveshaping
    // sound harsh rather than warm, so this stage runs at the highest oversampling available.
    drive.oversample = '4x';

    const crush = context.createWaveShaper();

    const wowDelay = context.createDelay(0.2);
    wowDelay.delayTime.value = 0;

    // Forces a stereo frame so mono sources still feed both mid/side legs.
    const stereoInput = context.createGain();
    stereoInput.channelCount = 2;
    stereoInput.channelCountMode = 'explicit';
    stereoInput.channelInterpretation = 'speakers';

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = 0;
    compressor.knee.value = 30;
    compressor.ratio.value = 1;
    compressor.attack.value = 0.008;
    compressor.release.value = 0.18;

    const createGain = (value: number) => {
        const node = context.createGain();
        node.gain.value = value;
        return node;
    };

    return {
        highpass,
        lowpass,
        drive,
        crush,
        wowDelay,
        stereoInput,
        splitter: context.createChannelSplitter(2),
        merger: context.createChannelMerger(2),
        leftDirect: createGain(1),
        rightDirect: createGain(1),
        leftCross: createGain(0),
        rightCross: createGain(0),
        compressor,
        makeup: createGain(1),
        dry: createGain(1),
        wetSend: createGain(1),
        wet: createGain(0),
        noiseGain: createGain(0),
    };
};

// Connects the serial path plus the parallel reverb and noise returns.
export const connectAudioEffectNodes = (nodes: AudioEffectNodes, input: AudioNode, output: AudioNode) => {
    input.connect(nodes.highpass);
    nodes.highpass.connect(nodes.lowpass);
    nodes.lowpass.connect(nodes.drive);
    nodes.drive.connect(nodes.crush);
    nodes.crush.connect(nodes.wowDelay);
    nodes.wowDelay.connect(nodes.stereoInput);
    nodes.stereoInput.connect(nodes.splitter);

    nodes.splitter.connect(nodes.leftDirect, 0, 0);
    nodes.splitter.connect(nodes.rightCross, 1, 0);
    nodes.splitter.connect(nodes.leftCross, 0, 0);
    nodes.splitter.connect(nodes.rightDirect, 1, 0);
    nodes.leftDirect.connect(nodes.merger, 0, 0);
    nodes.rightCross.connect(nodes.merger, 0, 0);
    nodes.leftCross.connect(nodes.merger, 0, 1);
    nodes.rightDirect.connect(nodes.merger, 0, 1);

    nodes.merger.connect(nodes.compressor);
    nodes.compressor.connect(nodes.makeup);
    nodes.makeup.connect(nodes.dry);
    nodes.makeup.connect(nodes.wetSend);
    nodes.dry.connect(output);
    nodes.wet.connect(output);
    nodes.noiseGain.connect(output);
};

export const disconnectAudioEffectNodes = (nodes: AudioEffectNodes, input: AudioNode) => {
    try {
        input.disconnect(nodes.highpass);
    } catch {
        // The source may already be torn down with the audio context.
    }
    Object.values(nodes).forEach(node => node.disconnect());
};
