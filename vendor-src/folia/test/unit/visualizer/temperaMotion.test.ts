import { describe, expect, it } from 'vitest';
import { TEMPERA_ENTER_STYLES } from '@/components/visualizer/tempera/temperaEnterStyles';
import {
    easeTemperaEnter,
    easeTemperaInOut,
    easeTemperaSoftBack,
    resolveCubicBezier,
    resolveShotPacedDuration,
    resolveTemperaGlyphMotion,
    type TemperaGlyphMotionInput,
} from '@/components/visualizer/tempera/temperaMotion';

// test/unit/visualizer/temperaMotion.test.ts
// Locks the easing contract and the absolute-time glyph solver: a seek must produce exactly
// the frame continuous playback would, and a muted motion setting must pin glyphs in place.
const glyph = (overrides: Partial<TemperaGlyphMotionInput> = {}): TemperaGlyphMotionInput => ({
    startTime: 10,
    settleTime: 10.8,
    endTime: 10.4,
    enterX: 40,
    enterY: -25,
    enterRotation: 0.3,
    enterScale: 0.7,
    rotation: 0.05,
    enterStyle: 'slide',
    releaseTime: 12.8,
    trackingX: 300,
    trackingY: -120,
    ...overrides,
});

describe('Tempera easing', () => {
    it('pins the cubic bezier endpoints and stays monotonic', () => {
        expect(resolveCubicBezier(0.22, 1, 0.36, 1, 0)).toBe(0);
        expect(resolveCubicBezier(0.22, 1, 0.36, 1, 1)).toBe(1);
        let previous = -1;
        for (let step = 0; step <= 20; step += 1) {
            const value = easeTemperaEnter(step / 20);
            expect(value).toBeGreaterThanOrEqual(previous);
            previous = value;
        }
        expect(easeTemperaInOut(0)).toBe(0);
        expect(easeTemperaInOut(1)).toBe(1);
    });

    it('front-loads the enter curve so glyphs decelerate into place', () => {
        // Half the visual travel is done well before half the time has passed. Softening this
        // was tried and read as sluggish, so the punchy opening is deliberate.
        expect(easeTemperaEnter(0.25)).toBeGreaterThan(0.5);
        expect(easeTemperaEnter(0.9)).toBeLessThan(1);
    });

    it('overshoots slightly on the soft-back curve then lands on 1', () => {
        expect(easeTemperaSoftBack(0)).toBeCloseTo(0, 6);
        expect(easeTemperaSoftBack(1)).toBeCloseTo(1, 6);
        const peak = Math.max(...Array.from({ length: 40 }, (_, i) => easeTemperaSoftBack(i / 39)));
        expect(peak).toBeGreaterThan(1);
        expect(peak).toBeLessThan(1.15);
    });
});

describe('Tempera glyph motion', () => {
    it('hides a glyph before its start time', () => {
        const frame = resolveTemperaGlyphMotion(glyph(), 9.5, 1);
        expect(frame.visible).toBe(false);
        expect(frame.alpha).toBe(0);
    });

    it('lands on the layout position and full scale once settled', () => {
        const frame = resolveTemperaGlyphMotion(glyph(), 10.8, 1);
        expect(frame.alpha).toBeCloseTo(1, 6);
        expect(Math.hypot(frame.x, frame.y)).toBeLessThan(0.5);
        expect(frame.scaleX).toBeCloseTo(1, 2);
        expect(frame.scaleY).toBeCloseTo(1, 2);
        expect(frame.rotation).toBeCloseTo(0.05, 3);
    });

    it('emphasises the glyph being sung with a small scale swell, never a backing block', () => {
        const singing = resolveTemperaGlyphMotion(glyph({ enterScale: 1 }), 10.2, 1);
        const after = resolveTemperaGlyphMotion(glyph({ enterScale: 1 }), 12, 1);
        expect(singing.scaleX).toBeGreaterThan(after.scaleX);
        // The swell must stay subtle enough to read as weight, not as a pop.
        expect(singing.scaleX).toBeLessThan(1.06);
        // Afterwards it is back to normal size, minus the slight recede of the release drift.
        expect(after.scaleX).toBeGreaterThan(0.96);
        expect(after.scaleX).toBeLessThanOrEqual(1);
    });

    it('tracks the sung window rather than counting down from the start', () => {
        // Rises over a short attack, holds while the glyph is sung, decays after it ends.
        const during = resolveTemperaGlyphMotion(glyph({ enterScale: 1 }), 10.3, 1).scaleX;
        const justAfter = resolveTemperaGlyphMotion(glyph({ enterScale: 1 }), 10.55, 1).scaleX;
        const later = resolveTemperaGlyphMotion(glyph({ enterScale: 1 }), 10.7, 1).scaleX;
        expect(during).toBeGreaterThan(justAfter);
        expect(justAfter).toBeGreaterThan(later);
        expect(later).toBeCloseTo(1, 3);
    });

    it('gives a glyph that is never sung no swell at all', () => {
        // Punctuation carries no timing of its own, so it merges in as a zero-length glyph.
        // Counting the emphasis down from `startTime` over a synthetic floor made every one
        // of those pop on its own.
        const mark = glyph({ enterScale: 1, startTime: 10, endTime: 10, settleTime: 10.8 });
        [10, 10.05, 10.2, 10.5].forEach(time => {
            expect(resolveTemperaGlyphMotion(mark, time, 1).scaleX, `${time}`)
                .toBeLessThanOrEqual(1 + 1e-9);
        });
    });

    it('starts from the full entrance offset and resolves alpha before position', () => {
        const start = resolveTemperaGlyphMotion(glyph(), 10, 1);
        expect(start.x).toBeCloseTo(40, 6);
        expect(start.y).toBeCloseTo(-25, 6);
        expect(start.scaleX).toBeCloseTo(0.7, 6);

        // Alpha is resolved well before the glyph stops travelling: it must be readable
        // while it is still on the move, not fade in only once it has parked.
        const mid = resolveTemperaGlyphMotion(glyph(), 10.36, 1);
        expect(mid.alpha).toBeCloseTo(1, 3);
        expect(Math.abs(mid.x)).toBeGreaterThan(0.5);
    });

    it('pins the glyph to its layout position when motion is zero', () => {
        [10, 10.2, 11, 40].forEach(time => {
            const frame = resolveTemperaGlyphMotion(glyph(), time, 0);
            expect(frame.x).toBeCloseTo(0, 10);
            expect(frame.y).toBeCloseTo(0, 10);
            expect(frame.rotation).toBeCloseTo(0.05, 6);
            expect(frame.scaleX).toBeCloseTo(1, 6);
            expect(frame.scaleY).toBeCloseTo(1, 6);
        });
    });

    it('opens the tracking of a sung glyph instead of freezing it in place', () => {
        // The whole point: a line that finished early must not sit dead for the rest of a
        // long shot.
        const atRelease = resolveTemperaGlyphMotion(glyph(), 10.8, 1);
        const midRelease = resolveTemperaGlyphMotion(glyph(), 11.8, 1);
        const opened = resolveTemperaGlyphMotion(glyph(), 12.8, 1);
        expect(Math.hypot(atRelease.x, atRelease.y)).toBeLessThan(0.5);
        expect(Math.hypot(midRelease.x, midRelease.y)).toBeGreaterThan(2);
        expect(Math.hypot(opened.x, opened.y)).toBeGreaterThan(Math.hypot(midRelease.x, midRelease.y));
    });

    it('moves strictly along its own lever, never on a wandering path', () => {
        // Deterministic typesetting: the offset stays exactly parallel to the lever, so the
        // block only widens - a glyph can never drift somewhere the layout did not put it.
        [11.5, 12, 12.8, 20, 300].forEach(time => {
            const frame = resolveTemperaGlyphMotion(glyph(), time, 1);
            expect(frame.x / 300).toBeCloseTo(frame.y / -120, 9);
            expect(frame.rotation).toBeCloseTo(0.05, 9);
            expect(frame.scaleX).toBeCloseTo(1, 6);
        });
    });

    it('caps the expansion at a few percent and holds it', () => {
        [12.8, 20, 60, 300].forEach(time => {
            const frame = resolveTemperaGlyphMotion(glyph(), time, 1);
            // 5.5% of a 300px lever, and it stops there rather than accumulating.
            expect(frame.x).toBeCloseTo(300 * 0.055, 6);
            expect(frame.alpha).toBeCloseTo(1, 6);
        });
    });

    it('keeps a stretched entrance readable instead of fading in over the whole line', () => {
        // A long line hands the glyph a settle window many seconds wide so the block never
        // stops moving. Position may creep for all of it; opacity and the echo may not, or the
        // type would be half-transparent and smeared while it is being sung.
        const frame = resolveTemperaGlyphMotion(glyph({ settleTime: 22, releaseTime: 30 }), 11.4, 1);
        expect(frame.alpha).toBeCloseTo(1, 3);
        expect(frame.echoAlpha).toBeLessThan(0.02);
        // Still visibly on its way in, which is the whole point of the stretch.
        expect(Math.abs(frame.x)).toBeGreaterThan(1);
    });

    it('is a pure function of absolute time, so seeking matches playback', () => {
        [9.9, 10.1, 10.5, 12, 30].forEach(time => {
            expect(resolveTemperaGlyphMotion(glyph(), time, 1))
                .toEqual(resolveTemperaGlyphMotion(glyph(), time, 1));
        });
    });
});

describe('Tempera entrance styles', () => {
    it('lands every style on the resting pose by the settle time', () => {
        TEMPERA_ENTER_STYLES.forEach(enterStyle => {
            const frame = resolveTemperaGlyphMotion(glyph({ enterStyle }), 10.8, 1);
            expect(Math.hypot(frame.x, frame.y), enterStyle).toBeLessThan(0.6);
            expect(frame.scaleX, enterStyle).toBeCloseTo(1, 2);
            expect(frame.scaleY, enterStyle).toBeCloseTo(1, 2);
            expect(frame.rotation, enterStyle).toBeCloseTo(0.05, 2);
            expect(frame.echoAlpha, enterStyle).toBeLessThan(0.02);
        });
    });

    it('gives the styles genuinely different openings', () => {
        const openings = TEMPERA_ENTER_STYLES.map(enterStyle => {
            const frame = resolveTemperaGlyphMotion(glyph({ enterStyle }), 10.05, 1);
            return `${frame.x.toFixed(2)}:${frame.y.toFixed(2)}:${frame.scaleX.toFixed(2)}:${frame.scaleY.toFixed(2)}:${frame.rotation.toFixed(2)}`;
        });
        expect(new Set(openings).size).toBe(TEMPERA_ENTER_STYLES.length);
    });

    it('keeps every style on the same modest travel distance', () => {
        // No long-haul fly-ins: switching style changes the direction a glyph comes from,
        // never how far it has to come.
        const reach = TEMPERA_ENTER_STYLES.map(enterStyle => {
            const frame = resolveTemperaGlyphMotion(glyph({ enterStyle }), 10, 1);
            return Math.hypot(frame.x, frame.y);
        });
        const base = Math.hypot(40, 25);
        reach.forEach((distance, index) => {
            expect(distance, TEMPERA_ENTER_STYLES[index]).toBeLessThanOrEqual(base + 1e-6);
        });
    });

    it('scales uniformly on both axes', () => {
        // Single-axis stretches read as a gimmick against the deterministic typesetting.
        TEMPERA_ENTER_STYLES.forEach(enterStyle => {
            [10, 10.2, 10.5, 10.8].forEach(time => {
                const frame = resolveTemperaGlyphMotion(glyph({ enterStyle }), time, 1);
                expect(frame.scaleX, `${enterStyle}@${time}`).toBeCloseTo(frame.scaleY, 9);
            });
        });
    });

    it('trails echoes only for styles that actually travel', () => {
        const travelling = resolveTemperaGlyphMotion(glyph({ enterStyle: 'slide' }), 10.05, 1);
        expect(travelling.echoAlpha).toBeGreaterThan(0.1);
        expect(Math.hypot(travelling.echoX, travelling.echoY)).toBeGreaterThan(1);
        // A stamp lands in place, so a trail behind it would have nothing to trail from.
        expect(resolveTemperaGlyphMotion(glyph({ enterStyle: 'stamp' }), 10.05, 1).echoAlpha).toBe(0);
    });

    it('suppresses echoes entirely when motion is muted', () => {
        TEMPERA_ENTER_STYLES.forEach(enterStyle => {
            expect(resolveTemperaGlyphMotion(glyph({ enterStyle }), 10.05, 0).echoAlpha, enterStyle).toBe(0);
        });
    });
});

describe('Shot-paced durations', () => {
    it('scales with the shot but clamps at both ends', () => {
        expect(resolveShotPacedDuration(4, 0.25, 0.3, 2)).toBeCloseTo(1, 6);
        expect(resolveShotPacedDuration(0.4, 0.25, 0.3, 2)).toBeCloseTo(0.3, 6);
        expect(resolveShotPacedDuration(30, 0.25, 0.3, 2)).toBeCloseTo(2, 6);
    });
});
