import { describe, expect, it } from 'vitest';
import {
    SONNET_CAMERA_BREATH_MAX_OFFSET,
    SONNET_CAMERA_BREATH_MAX_ROTATION,
    SONNET_CAMERA_BREATH_MAX_SCALE,
    resolveCubicBezier,
    resolveSegmentProgress,
    resolveSonnetBreathWeight,
    resolveSonnetCameraBreath,
    resolveSonnetFocusWeights,
    resolveSonnetSmoothedCameraFocus,
    resolveSonnetSegmentDepth,
    resolveSonnetSegmentNormalOffset,
    resolveShotMotionFrame,
    resolveShotPathProgress,
} from '@/components/visualizer/sonnet/sonnetMotion';
import type { SonnetShotKind } from '@/components/visualizer/sonnet/types';

const ALL_SHOT_KINDS: SonnetShotKind[] = [
    'editorial-column',
    'type-impact',
    'fragment-collage',
    'tracking-ribbon',
    'mask-reveal',
    'poster-blocks',
    'quiet-tableau',
];

// test/unit/visualizer/sonnetMotion.test.ts
// Keeps Sonnet shot movement deliberate, template-specific, and seek deterministic.
describe('Sonnet shot motion', () => {
    it('uses bounded CSS timing with a front-loaded segment entrance', () => {
        expect(resolveCubicBezier(0.65, 0, 0.35, 1, 0)).toBe(0);
        expect(resolveCubicBezier(0.65, 0, 0.35, 1, 1)).toBe(1);
        expect(resolveCubicBezier(0.22, 1, 0.36, 1, 0.2)).toBeGreaterThan(0.2);
        expect(resolveSegmentProgress(0, 1, 0)).toBe(0);
        expect(resolveSegmentProgress(0, 1, 0.2)).toBeGreaterThan(0.2);
        expect(resolveSegmentProgress(0, 1, 0.8)).toBeGreaterThan(0.8);
        expect(resolveSegmentProgress(0, 1, 1)).toBe(1);
    });

    it('moves tracking shots across a meaningful portion of the frame', () => {
        const start = resolveShotMotionFrame('tracking-ribbon', 0);
        const end = resolveShotMotionFrame('tracking-ribbon', 1);

        expect(end.x - start.x).toBeGreaterThan(0.25);
        expect(Math.abs(end.y - start.y)).toBeGreaterThan(0.08);
        expect(end.scale).toBeGreaterThan(start.scale);
    });

    it('keeps quiet shots restrained while still moving visibly', () => {
        const start = resolveShotMotionFrame('quiet-tableau', 0);
        const end = resolveShotMotionFrame('quiet-tableau', 1);

        expect(end.x - start.x).toBeGreaterThan(0.03);
        expect(end.x - start.x).toBeLessThan(0.05);
        expect(end.scale - start.scale).toBeLessThan(0.04);
    });

    it('returns the same frame for the same absolute progress', () => {
        expect(resolveShotMotionFrame('fragment-collage', 0.43))
            .toEqual(resolveShotMotionFrame('fragment-collage', 0.43));
    });

    it('keeps every shot path drifting without a dead plateau', () => {
        ALL_SHOT_KINDS.forEach(kind => {
            expect(resolveShotPathProgress(kind, 0)).toBe(0);
            let previous = 0;
            for (let step = 1; step <= 40; step += 1) {
                const next = resolveShotPathProgress(kind, step / 40);
                expect(next).toBeGreaterThan(previous);
                previous = next;
            }
            expect(previous).toBe(1);
        });
    });

    it('front-loads the entrance and slows down for the shot handoff', () => {
        const entranceDelta = resolveShotPathProgress('editorial-column', 0.09)
            - resolveShotPathProgress('editorial-column', 0);
        const midDelta = resolveShotPathProgress('editorial-column', 0.5)
            - resolveShotPathProgress('editorial-column', 0.41);
        const tailDelta = resolveShotPathProgress('editorial-column', 1)
            - resolveShotPathProgress('editorial-column', 0.99);

        expect(entranceDelta).toBeGreaterThan(midDelta);
        expect(midDelta).toBeGreaterThan(tailDelta);
        expect(tailDelta).toBeGreaterThan(0);
    });

    it('keeps camera breath deterministic and within visibility-safe caps', () => {
        for (const phase of [0, 1.3, 4.2]) {
            for (let step = 0; step <= 100; step += 1) {
                const time = step * 0.37;
                const breath = resolveSonnetCameraBreath(time, phase);
                expect(breath).toEqual(resolveSonnetCameraBreath(time, phase));
                expect(Math.abs(breath.x)).toBeLessThanOrEqual(SONNET_CAMERA_BREATH_MAX_OFFSET + 1e-9);
                expect(Math.abs(breath.y)).toBeLessThanOrEqual(SONNET_CAMERA_BREATH_MAX_OFFSET + 1e-9);
                expect(Math.abs(breath.scale)).toBeLessThanOrEqual(SONNET_CAMERA_BREATH_MAX_SCALE + 1e-9);
                expect(Math.abs(breath.rotation)).toBeLessThanOrEqual(SONNET_CAMERA_BREATH_MAX_ROTATION + 1e-9);
            }
        }
    });

    it('ramps the breath weight in only after the lyric reveal completes', () => {
        expect(resolveSonnetBreathWeight(5, 8)).toBe(0);
        expect(resolveSonnetBreathWeight(8, 8)).toBe(0);
        const midRamp = resolveSonnetBreathWeight(8.6, 8);
        expect(midRamp).toBeGreaterThan(0);
        expect(midRamp).toBeLessThan(1);
        expect(resolveSonnetBreathWeight(9.2, 8)).toBe(1);
        expect(resolveSonnetBreathWeight(30, 8)).toBe(1);
    });

    it('keeps camera focus normalized through lyric gaps and after the final glyph', () => {
        const ranges = [
            { startTime: 1, endTime: 2 },
            { startTime: 4, endTime: 5 },
        ];
        const middleGap = resolveSonnetFocusWeights(ranges, 3);
        const finalTail = resolveSonnetFocusWeights(ranges, 12);

        expect(middleGap[0]).toBeCloseTo(0.5, 5);
        expect(middleGap[1]).toBeCloseTo(0.5, 5);
        expect(finalTail.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 10);
        expect(finalTail[1]).toBeGreaterThan(0.999);
    });

    it('smooths camera focus over a deterministic bounded time window', () => {
        const sampledTimes: number[] = [];
        const resolveFocus = (time: number) => {
            sampledTimes.push(time);
            return { x: time * time, y: time };
        };
        const first = resolveSonnetSmoothedCameraFocus(1, 0, 2, resolveFocus, 0.2);
        const second = resolveSonnetSmoothedCameraFocus(1, 0, 2, resolveFocus, 0.2);

        expect(first).toEqual(second);
        expect(first.x).toBeGreaterThan(1);
        expect(first.y).toBeCloseTo(1, 10);
        expect(sampledTimes.slice(0, 5)).toEqual([0.8, 0.9, 1, 1.1, 1.2]);
        expect(resolveSonnetSmoothedCameraFocus(0, 0, 2, resolveFocus, 0.2).x).toBeGreaterThanOrEqual(0);
    });

    it('does not blend distant camera compositions through their midpoint', () => {
        const resolveFocus = (time: number) => (
            time < 1 ? { x: -300, y: 0 } : { x: 300, y: 0 }
        );

        expect(resolveSonnetSmoothedCameraFocus(0.99, 0, 2, resolveFocus)).toEqual({ x: -300, y: 0 });
        expect(resolveSonnetSmoothedCameraFocus(1, 0, 2, resolveFocus)).toEqual({ x: 300, y: 0 });
    });

    it('keeps primary lyric segments on one depth plane while decorations retain depth', () => {
        const unexpectedRandom = () => {
            throw new Error('primary lyric depth must not sample randomness');
        };

        expect(resolveSonnetSegmentDepth('hero', unexpectedRandom)).toBe(0);
        expect(resolveSonnetSegmentDepth('support', unexpectedRandom)).toBe(0);
        expect(resolveSonnetSegmentDepth('decoration', () => 0.75)).toBe(1.1);
    });

    it('jitters support lyrics only along the segment-layout normal', () => {
        expect(resolveSonnetSegmentNormalOffset('support', 'horizontal', 0, 100, 1)).toEqual({
            x: expect.closeTo(0),
            y: 30,
        });
        expect(resolveSonnetSegmentNormalOffset('support', 'vertical', 0, 100, 1)).toEqual({
            x: 30,
            y: 0,
        });
        expect(resolveSonnetSegmentNormalOffset('hero', 'horizontal', 0, 100, 1)).toEqual({ x: 0, y: 0 });
        expect(resolveSonnetSegmentNormalOffset('decoration', 'vertical', 0, 100, 1)).toEqual({ x: 0, y: 0 });
    });
});
