// src/services/audioEffects/effectSources.ts
// Generates the waveshaper curves and audio buffers used by the effect chain.

const SATURATION_SAMPLES = 1024;
const CRUSH_SAMPLES = 8192;

const SATURATION_REFERENCE_AMPLITUDE = 0.5;

// Measures how much a transfer shape lifts a reference sine so the curve can cancel that lift again.
// Without it, soft-clipping a typical -6 dBFS signal would come back several dB louder than it went in.
const measureSaturationCompensation = (shape: number, scale: number) => {
    const cycleSamples = 1024;
    let energy = 0;
    for (let index = 0; index < cycleSamples; index += 1) {
        const input = SATURATION_REFERENCE_AMPLITUDE * Math.sin((2 * Math.PI * index) / cycleSamples);
        const shaped = Math.tanh(shape * input) / scale;
        energy += shaped * shaped;
    }
    const shapedRms = Math.sqrt(energy / cycleSamples);
    const referenceRms = SATURATION_REFERENCE_AMPLITUDE / Math.SQRT2;
    return shapedRms > 0 ? referenceRms / shapedRms : 1;
};

// Builds a loudness-matched tanh transfer curve: more drive means more harmonics, not more level.
export const createSaturationCurve = (amount: number) => {
    if (amount <= 0) {
        return null;
    }

    // Kept gentle on purpose: this is a warmth stage, not a distortion pedal. At the top of the
    // range a peak-level signal lands around 20% THD, and typical preset amounts stay near 5%.
    const shape = 1 + amount * 4;
    const scale = Math.tanh(shape);
    const compensation = measureSaturationCompensation(shape, scale);
    const curve = new Float32Array(SATURATION_SAMPLES);
    for (let index = 0; index < SATURATION_SAMPLES; index += 1) {
        const input = (index / (SATURATION_SAMPLES - 1)) * 2 - 1;
        curve[index] = (Math.tanh(shape * input) / scale) * compensation;
    }
    return curve;
};

// Builds a staircase transfer curve so the waveshaper quantizes amplitude like a low bit-depth converter.
export const createBitCrushCurve = (amount: number) => {
    if (amount <= 0) {
        return null;
    }

    // Square-rooted so the audible 8-10 bit range sits in the middle of the slider instead of its very end.
    const bits = 16 - Math.sqrt(amount) * 12;
    const steps = Math.max(2, 2 ** (bits - 1));
    const curve = new Float32Array(CRUSH_SAMPLES);
    for (let index = 0; index < CRUSH_SAMPLES; index += 1) {
        const input = (index / (CRUSH_SAMPLES - 1)) * 2 - 1;
        curve[index] = Math.max(-1, Math.min(1, Math.round(input * steps) / steps));
    }
    return curve;
};

// Builds a stereo noise floor mixing constant hiss with sparse decaying crackles.
export const createVinylNoiseBuffer = (context: BaseAudioContext): AudioBuffer => {
    const length = Math.max(1, Math.floor(context.sampleRate * 3));
    const buffer = context.createBuffer(2, length, context.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const data = buffer.getChannelData(channel);
        let crackle = 0;
        for (let index = 0; index < length; index += 1) {
            if (Math.random() < 0.0007) {
                crackle = Math.random() * 2 - 1;
            }
            crackle *= 0.88;
            data[index] = (Math.random() * 2 - 1) * 0.12 + crackle * 0.9;
        }
    }

    return buffer;
};

// Builds an exponentially decaying noise impulse response for the convolution reverb.
export const createReverbImpulse = (context: BaseAudioContext, seconds = 2.2, decay = 2.8): AudioBuffer => {
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(2, length, context.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const data = buffer.getChannelData(channel);
        for (let index = 0; index < length; index += 1) {
            const progress = index / length;
            data[index] = (Math.random() * 2 - 1) * (1 - progress) ** decay;
        }
    }

    return buffer;
};
