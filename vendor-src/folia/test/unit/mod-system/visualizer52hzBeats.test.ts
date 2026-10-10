import { describe, expect, it } from 'vitest';
import { createBeatDetector } from '../../../mods/visualizer52hz/beatDetector.mjs';

// test/unit/mod-system/visualizer52hzBeats.test.ts
// 52Hz grows its rings on beats. The detector must find one beat per kick in a
// steady rhythm, not fire on a flat or merely noisy signal (beyond the filler
// beat that keeps silences from leaving a gap), and never fire faster than its
// minimum spacing.

const FPS = 60;

type Reading = { bass: number; lowMid: number };

/** Runs the detector over `seconds` of a signal; returns beat times. */
const detect = (signal: (time: number) => Reading, seconds: number, sensitivity = 1) => {
    const detector = createBeatDetector();
    const bands = { bass: 0, lowMid: 0, mid: 0, vocal: 0, treble: 0 };
    const audio = {
        getPower: () => bands.bass,
        getBands: () => bands,
        getSpectrum: () => null,
    };
    const beats: number[] = [];
    for (let frame = 0; frame < seconds * FPS; frame += 1) {
        const time = frame / FPS;
        Object.assign(bands, signal(time));
        if (detector.step(audio, time, 1 / FPS, sensitivity)) beats.push(time);
    }
    return beats;
};

// A kick every `period` s: a sharp attack decaying over ~80 ms, on a steady bed.
const kicks = (period: number) => (time: number): Reading => {
    const since = time % period;
    const kick = Math.exp(-since / 0.08);
    return { bass: 0.25 + 0.6 * kick, lowMid: 0.2 + 0.3 * kick };
};

describe('visualizer52hz beat detector', () => {
    it('finds one beat per kick at 120 BPM', () => {
        // Skip the first two seconds while the adaptive threshold settles.
        const beats = detect(kicks(0.5), 12).filter(time => time >= 2);
        expect(beats.length).toBeGreaterThanOrEqual(19);
        expect(beats.length).toBeLessThanOrEqual(21);
        beats.forEach((time) => {
            const offset = time % 0.5;
            expect(Math.min(offset, 0.5 - offset)).toBeLessThan(0.05);
        });
    });

    it('fires only the filler beat on a flat signal', () => {
        const beats = detect(() => ({ bass: 0.4, lowMid: 0.3 }), 10);
        const gaps = beats.slice(1).map((time, index) => time - beats[index]);
        gaps.forEach(gap => expect(gap).toBeGreaterThanOrEqual(1.9));
    });

    it('uses the low FFT bins when the host provides a spectrum', () => {
        const detector = createBeatDetector();
        const spectrum = new Uint8Array(1024);
        const audio = {
            getPower: () => 0,
            getBands: () => ({ bass: 0, lowMid: 0, mid: 0, vocal: 0, treble: 0 }),
            getSpectrum: () => spectrum,
        };
        const beats: number[] = [];
        for (let frame = 0; frame < 12 * FPS; frame += 1) {
            const time = frame / FPS;
            const kick = Math.exp(-(time % 0.5) / 0.08);
            // Kick in the low bins; steady hi-hat noise above them must not matter.
            for (let bin = 1; bin <= 12; bin += 1) spectrum[bin] = Math.round(60 + 180 * kick);
            for (let bin = 40; bin < 200; bin += 1) spectrum[bin] = (frame * 37 + bin * 11) % 255;
            if (detector.step(audio, time, 1 / FPS, 1)) beats.push(time);
        }
        const settled = beats.filter(time => time >= 2);
        expect(settled.length).toBeGreaterThanOrEqual(19);
        expect(settled.length).toBeLessThanOrEqual(21);
    });

    it('never fires closer together than its minimum spacing', () => {
        const beats = detect(kicks(0.12), 8, 2.5);
        const gaps = beats.slice(1).map((time, index) => time - beats[index]);
        gaps.forEach(gap => expect(gap).toBeGreaterThanOrEqual(0.28 - 1e-9));
    });
});
