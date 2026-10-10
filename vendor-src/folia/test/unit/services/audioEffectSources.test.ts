import { describe, expect, it } from 'vitest';
import { createBitCrushCurve, createSaturationCurve } from '@/services/audioEffects/effectSources';

// test/unit/services/audioEffectSources.test.ts
// Guards the saturation transfer curve against becoming a distortion pedal again: it must stay
// loudness matched and keep its small-signal gain close to unity so dynamics survive.

const REFERENCE_AMPLITUDE = 0.5;

const shape = (curve: Float32Array, input: number) => {
    const position = ((Math.min(1, Math.max(-1, input)) + 1) / 2) * (curve.length - 1);
    const low = Math.floor(position);
    const high = Math.min(curve.length - 1, low + 1);
    return curve[low] + (curve[high] - curve[low]) * (position - low);
};

const referenceSineRms = (curve: Float32Array) => {
    const samples = 2048;
    let energy = 0;
    for (let index = 0; index < samples; index += 1) {
        const value = shape(curve, REFERENCE_AMPLITUDE * Math.sin((2 * Math.PI * index) / samples));
        energy += value * value;
    }
    return Math.sqrt(energy / samples);
};

// Slope of the transfer curve around zero, i.e. how much a very quiet signal is amplified.
const smallSignalGain = (curve: Float32Array) => {
    const step = 2 / (curve.length - 1);
    const above = curve.length / 2;
    return (curve[above] - curve[above - 1]) / step;
};

describe('saturation curve', () => {
    it('stays inactive at zero drive', () => {
        expect(createSaturationCurve(0)).toBeNull();
        expect(createBitCrushCurve(0)).toBeNull();
    });

    it('matches the reference loudness at every drive amount', () => {
        const referenceRms = REFERENCE_AMPLITUDE / Math.SQRT2;

        [0.1, 0.3, 0.5, 1].forEach(amount => {
            const curve = createSaturationCurve(amount)!;
            expect(referenceSineRms(curve)).toBeCloseTo(referenceRms, 2);
        });
    });

    it('keeps quiet passages close to unity instead of compressing them upwards', () => {
        // Loudness matching inevitably lifts low-level signal, and too much of it flattens dynamics.
        // Preset-range drive must stay within about +3 dB, and even a fully cranked one within +7 dB.
        expect(smallSignalGain(createSaturationCurve(0.3)!)).toBeGreaterThan(1);
        expect(smallSignalGain(createSaturationCurve(0.3)!)).toBeLessThan(1.4);
        expect(smallSignalGain(createSaturationCurve(1)!)).toBeLessThan(2.2);
    });

    it('never shapes past full scale and stays monotonic', () => {
        const curve = createSaturationCurve(1)!;

        curve.forEach((value, index) => {
            expect(Math.abs(value)).toBeLessThanOrEqual(1);
            if (index > 0) {
                expect(value).toBeGreaterThanOrEqual(curve[index - 1]);
            }
        });
    });
});

describe('bit crush curve', () => {
    it('quantizes onto fewer steps as the amount rises', () => {
        const countLevels = (amount: number) => new Set(
            Array.from(createBitCrushCurve(amount)!).map(value => value.toFixed(4)),
        ).size;

        expect(countLevels(1)).toBeLessThan(countLevels(0.5));
        expect(countLevels(0.5)).toBeLessThan(countLevels(0.1));
    });
});
