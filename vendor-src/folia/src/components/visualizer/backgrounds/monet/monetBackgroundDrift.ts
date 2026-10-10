// src/components/visualizer/backgrounds/monet/monetBackgroundDrift.ts
// AE-wiggle-style drift for the Monet background: fractal value noise sampled into a long,
// seamlessly looping keyframe track that the compositor plays without any per-frame JS.

// One full lap of the noise lattice. Long enough that the loop never reads as a loop.
const DRIFT_LOOP_SECONDS = 240;
// Lattice cells per lap. Spacing works out to ~4.6s, i.e. a wiggle every ~9s.
const DRIFT_LATTICE_POINTS = 76;
// Samples emitted per lap. Three per cell keeps the piecewise-linear playback free of visible kinks.
const DRIFT_SAMPLE_COUNT = 156;

// Travel and breathing at strength 1.
const DRIFT_MAX_TRAVEL_PERCENT = 3.4;
const DRIFT_BREATH_AMPLITUDE = 0.035;
// Headroom on top of the geometric minimum, so rounding can never uncover an edge.
const DRIFT_OVERSCAN_MARGIN = 0.01;

// Distinct lattices per channel; the offsets keep x, y and scale from moving in lockstep.
const DRIFT_SEED_X = 12.9898;
const DRIFT_SEED_Y = 78.233;
const DRIFT_SEED_SCALE = 39.425;

export interface MonetDriftTrack {
    keyframes: Keyframe[];
    durationMs: number;
    /** Largest |translate| any keyframe reaches, as a percentage of the element's own box. */
    maxTravelPercent: number;
    /** Smallest scale any keyframe reaches; must stay above 1 + 2 * maxTravel to hide the edges. */
    minScale: number;
}

const wrap = (value: number, modulus: number) => ((value % modulus) + modulus) % modulus;

const hash = (lattice: number, seed: number) => {
    const value = Math.sin(lattice * 127.1 + seed * 311.7) * 43758.5453;
    return value - Math.floor(value);
};

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** Value noise that repeats exactly every `points` lattice cells, so the track loops seamlessly. */
const periodicNoise = (t: number, points: number, seed: number) => {
    const cell = Math.floor(t);
    const from = hash(wrap(cell, points), seed);
    const to = hash(wrap(cell + 1, points), seed);
    return from + (to - from) * smoothstep(t - cell);
};

/** Two octaves of periodic noise, centred on 0. The second octave supplies the finer AE-ish jitter. */
const periodicFbm = (t: number, seed: number) => {
    const base = periodicNoise(t, DRIFT_LATTICE_POINTS, seed);
    const detail = periodicNoise(t * 2, DRIFT_LATTICE_POINTS * 2, seed + 17.31);
    return (base * 0.68 + detail * 0.32) * 2 - 1;
};

/** Scales a channel so its extreme sample sits exactly at ±1, making the travel budget exact. */
const normalize = (samples: number[]) => {
    const peak = samples.reduce((acc, value) => Math.max(acc, Math.abs(value)), 0);
    return peak > 0 ? samples.map(value => value / peak) : samples;
};

/**
 * Builds the drift animation for one strength (0..1). The element is pre-scaled past twice the
 * largest translate, which is what keeps the pan from ever dragging an image edge into frame.
 */
export const buildMonetDriftTrack = (strength: number): MonetDriftTrack => {
    const clamped = Math.min(1, Math.max(0, strength));
    const travelPercent = DRIFT_MAX_TRAVEL_PERCENT * clamped;
    const minScale = 1 + (travelPercent / 100) * 2 + DRIFT_OVERSCAN_MARGIN;
    const breath = DRIFT_BREATH_AMPLITUDE * clamped;

    const rawX: number[] = [];
    const rawY: number[] = [];
    const rawScale: number[] = [];
    for (let index = 0; index <= DRIFT_SAMPLE_COUNT; index += 1) {
        const t = (DRIFT_LATTICE_POINTS * index) / DRIFT_SAMPLE_COUNT;
        rawX.push(periodicFbm(t, DRIFT_SEED_X));
        rawY.push(periodicFbm(t, DRIFT_SEED_Y));
        rawScale.push(periodicFbm(t, DRIFT_SEED_SCALE));
    }

    const x = normalize(rawX);
    const y = normalize(rawY);
    const scale = normalize(rawScale);

    const keyframes = x.map((offsetX, index) => ({
        transform: `translate3d(${(offsetX * travelPercent).toFixed(4)}%, ${(y[index] * travelPercent).toFixed(4)}%, 0) `
            + `scale(${(minScale + breath * ((scale[index] + 1) / 2)).toFixed(5)})`,
    }));

    return {
        keyframes,
        durationMs: DRIFT_LOOP_SECONDS * 1000,
        maxTravelPercent: travelPercent,
        minScale,
    };
};
