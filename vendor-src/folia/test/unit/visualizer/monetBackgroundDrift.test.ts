import { describe, expect, it } from 'vitest';
import { buildMonetDriftTrack } from '@/components/visualizer/backgrounds/monet/monetBackgroundDrift';

// test/unit/visualizer/monetBackgroundDrift.test.ts
// Guards the two properties the drift track has to hold: it loops without a seam, and it never
// pans far enough to uncover an edge of the background image.

const parseTransform = (transform: string) => {
    const translate = transform.match(/translate3d\((-?[\d.]+)%,\s*(-?[\d.]+)%/);
    const scale = transform.match(/scale\(([\d.]+)\)/);
    if (!translate || !scale) throw new Error(`unparsable transform: ${transform}`);
    return { x: Number(translate[1]), y: Number(translate[2]), scale: Number(scale[1]) };
};

describe('Monet background drift track', () => {
    it('never pans far enough to expose an image edge', () => {
        for (const strength of [0.05, 0.25, 0.5, 0.75, 1]) {
            const track = buildMonetDriftTrack(strength);
            for (const keyframe of track.keyframes) {
                const { x, y, scale } = parseTransform(String(keyframe.transform));
                // translate is a share of the element's own box, so covering it needs 1 + 2*|t|.
                expect(scale).toBeGreaterThanOrEqual(1 + 2 * (Math.abs(x) / 100));
                expect(scale).toBeGreaterThanOrEqual(1 + 2 * (Math.abs(y) / 100));
            }
        }
    });

    it('loops seamlessly and uses the whole travel budget', () => {
        const track = buildMonetDriftTrack(1);
        const first = parseTransform(String(track.keyframes[0].transform));
        const last = parseTransform(String(track.keyframes[track.keyframes.length - 1].transform));

        expect(last.x).toBeCloseTo(first.x, 3);
        expect(last.y).toBeCloseTo(first.y, 3);
        expect(last.scale).toBeCloseTo(first.scale, 4);

        // Normalization should put the extreme sample exactly at the travel budget on each axis,
        // otherwise the derived overscan would be larger than it needs to be.
        const peakX = Math.max(...track.keyframes.map(k => Math.abs(parseTransform(String(k.transform)).x)));
        const peakY = Math.max(...track.keyframes.map(k => Math.abs(parseTransform(String(k.transform)).y)));
        expect(peakX).toBeCloseTo(track.maxTravelPercent, 3);
        expect(peakY).toBeCloseTo(track.maxTravelPercent, 3);
    });

    it('moves irregularly rather than on a fixed cycle', () => {
        const track = buildMonetDriftTrack(1);
        const xs = track.keyframes.map(k => parseTransform(String(k.transform)).x);

        // A sine-like loop turns a handful of times; noise turns far more often.
        let reversals = 0;
        for (let index = 2; index < xs.length; index += 1) {
            const before = xs[index - 1] - xs[index - 2];
            const after = xs[index] - xs[index - 1];
            if (before !== 0 && after !== 0 && Math.sign(before) !== Math.sign(after)) reversals += 1;
        }
        expect(reversals).toBeGreaterThan(8);

        // x and y must not be the same curve offset in time.
        const ys = track.keyframes.map(k => parseTransform(String(k.transform)).y);
        expect(xs).not.toEqual(ys);
    });

    it('is deterministic and scales linearly with strength', () => {
        expect(buildMonetDriftTrack(0.5).keyframes).toEqual(buildMonetDriftTrack(0.5).keyframes);

        const half = buildMonetDriftTrack(0.5);
        const full = buildMonetDriftTrack(1);
        expect(half.maxTravelPercent).toBeCloseTo(full.maxTravelPercent / 2, 6);
    });

    it('clamps out-of-range strength', () => {
        expect(buildMonetDriftTrack(4).keyframes).toEqual(buildMonetDriftTrack(1).keyframes);
        expect(buildMonetDriftTrack(-1).maxTravelPercent).toBe(0);
    });
});
