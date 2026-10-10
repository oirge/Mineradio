import { describe, expect, it } from 'vitest';
import { motionValue } from 'framer-motion';
import type { HostState } from '../../../src/mineradio/client';
import { applyLocalAudio, interpolatedLocalTime, localActiveLineIndex, localLyricLines, localStateSignature } from '../../../src/mineradio/local/localPlayerData';

// test/unit/mineradio/localPlayerData.test.ts
const state = { position: 10, duration: 100, playing: true, playbackRate: 1 } as HostState;

describe('isolated Mineradio local display projection', () => {
    it('preserves repeated words, punctuation, translation, and absolute source timing', () => {
        const lines = localLyricLines({ trackId: 'local:1', lines: [{
            time: 2, endTime: 5, text: '再，再  来', translation: 'Again, again',
            words: [{ time: 2.1, duration: 0.3, text: '再，' }, { time: 3, duration: 0.2, text: '再  ' }, { time: 4, duration: 1, text: '来' }],
        }] }, 10);
        expect(lines[0].fullText).toBe('再，再  来');
        expect(lines[0].translation).toBe('Again, again');
        expect(lines[0].words).toEqual([
            { text: '再，', startTime: 2.1, endTime: 2.4 },
            { text: '再  ', startTime: 3, endTime: 3.2 },
            { text: '来', startTime: 4, endTime: 5 },
        ]);
    });

    it('keeps line-only timing as one unit and does not invent word timings', () => {
        const lines = localLyricLines({ trackId: 'local:2', lines: [{ time: 1, text: 'one line' }, { time: 4, text: 'next' }] }, 8);
        expect(lines[0].words).toEqual([{ text: 'one line', startTime: 1, endTime: 4 }]);
        expect(lines[1].endTime).toBe(8);
        expect(localActiveLineIndex(lines, 0)).toBe(-1);
        expect(localActiveLineIndex(lines, 4)).toBe(1);
        expect(localActiveLineIndex(lines, 8.01)).toBe(-1);
    });

    it('honors lyric gaps and latest overlapping voice', () => {
        const lines = localLyricLines({ trackId: 'local:3', lines: [{ time: 1, endTime: 2, text: 'a' }, { time: 3, endTime: 5, text: 'b' }, { time: 4, endTime: 6, text: 'c' }] }, 10);
        expect(localActiveLineIndex(lines, 2.5)).toBe(-1);
        expect(localActiveLineIndex(lines, 4.5)).toBe(2);
    });

    it('bounds interpolation, playback rate, pause, and end of track', () => {
        expect(interpolatedLocalTime(state, 0.2)).toBe(10.2);
        expect(interpolatedLocalTime(state, 100)).toBe(10.5);
        expect(interpolatedLocalTime({ ...state, playbackRate: 2 }, 0.2)).toBe(10.4);
        expect(interpolatedLocalTime({ ...state, playing: false }, 100)).toBe(10);
        expect(interpolatedLocalTime({ ...state, duration: 10.1 }, 1)).toBe(10.1);
        expect(interpolatedLocalTime(state, -1)).toBe(10);
    });

    it('ignores clock-only snapshots while retaining discrete playback and lyric changes', () => {
        expect(localStateSignature({ ...state, position: 90 })).toBe(localStateSignature(state));
        expect(localStateSignature({ ...state, playing: false })).not.toBe(localStateSignature(state));
        expect(localStateSignature({ ...state, lyricsRevision: 2 })).not.toBe(localStateSignature(state));
    });

    it('uses source FFT resolution and the original Folia energy response curves', () => {
        const bands = { bass: motionValue(0), lowMid: motionValue(0), mid: motionValue(0), vocal: motionValue(0), treble: motionValue(0), spectrum: motionValue(new Uint8Array(0)) };
        const power = motionValue(0);
        applyLocalAudio({ frequency: Array(1024).fill(128), sampleRate: 48000, fftSize: 2048 }, bands, power);
        expect(bands.bass.get()).toBeCloseTo(Math.pow(128 / 255, 1.8) * 255);
        expect(power.get()).toBeCloseTo(Math.pow(128 / 255, 3) * 255);
        expect(bands.spectrum.get()).toHaveLength(1024);
        applyLocalAudio({ frequency: [], sampleRate: 0, fftSize: 0 }, bands, power);
        expect(power.get()).toBe(0);
    });
});
