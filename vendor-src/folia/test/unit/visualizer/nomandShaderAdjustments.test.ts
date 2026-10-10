import { describe, expect, it } from 'vitest';
import {
    getLensDistortionOverscan,
    getPaperTextureOverscan,
    NOMAND_LENS_SHAPE,
    NOMAND_PAPER_TEXTURE_SHAPE,
    resolveDaylightInversion,
    resolveHalftoneInversion,
} from '@/components/visualizer/backgrounds/nomand/nomandShaderAdjustments';

// test/unit/visualizer/nomandShaderAdjustments.test.ts
// Guards the two Nomand shader corrections: halftone dots invert with the theme exactly like the
// dithering effect, and the distorting shaders zoom far enough that their warped sampling stays
// inside the source image instead of uncovering the backdrop.

const REFERENCE_ASPECT = 16 / 9;
const OUT_RADIUS = 0.5 * Math.hypot(REFERENCE_ASPECT, 1);

/** Mirrors the shader's lensWarp: how far a point at `cornerRn` gets pushed outward. */
const lensPush = (cornerRn: number, bulge: number) => {
    const amount = Math.abs(bulge) * (bulge > 0 ? 1.4 : 1.2);
    const map = bulge > 0
        ? Math.tan(Math.min(cornerRn * amount, 1.53)) / Math.tan(amount)
        : Math.atan(cornerRn * Math.tan(amount)) / amount;
    return map / cornerRn;
};

describe('daylight inversion', () => {
    it('flips luminance only on light themes and only outside original-colors mode', () => {
        expect(resolveDaylightInversion(false, false, true)).toBe(true);
        expect(resolveDaylightInversion(true, false, true)).toBe(false);
        expect(resolveDaylightInversion(false, false, false)).toBe(false);
        expect(resolveDaylightInversion(true, false, undefined)).toBe(true);
    });

    it('leaves original-colors mode untouched, since the palette is the image itself', () => {
        expect(resolveDaylightInversion(false, true, true)).toBe(false);
        expect(resolveDaylightInversion(true, true, true)).toBe(true);
    });
});

describe('halftone inversion', () => {
    it('flips the base, because the dot radius shrinks with luminance', () => {
        // Toggle off has to reach the shader as inverted, otherwise dark themes render a negative.
        expect(resolveHalftoneInversion(false, false, false)).toBe(true);
        expect(resolveHalftoneInversion(true, false, false)).toBe(false);
        expect(resolveHalftoneInversion(false, true, false)).toBe(true);
    });

    it('still takes the daylight flip on top of that base', () => {
        expect(resolveHalftoneInversion(false, false, true)).toBe(false);
        expect(resolveHalftoneInversion(true, false, true)).toBe(true);
        // Original colors opt out of the daylight flip, same as the dithering effect.
        expect(resolveHalftoneInversion(false, true, true)).toBe(true);
    });
});

describe('paper texture overscan', () => {
    it('covers the UV displacement the shader adds to the image', () => {
        const { folds, crumples, drops } = NOMAND_PAPER_TEXTURE_SHAPE;
        for (const roughness of [0, 0.42, 1]) {
            for (const fiber of [0, 0.3, 1]) {
                const scale = getPaperTextureOverscan(roughness, fiber);
                // shader: imageUV += .02 * normalImage, so the visible half-extent 0.5 / scale
                // plus that displacement has to stay inside the image.
                const displacement = 0.02 * (2 * folds + 1.5 * crumples + 0.2 * drops + 0.75 * roughness + 0.1 * fiber);
                expect(0.5 / scale + displacement).toBeLessThanOrEqual(0.5);
            }
        }
    });

    it('grows with roughness and stays a mild zoom', () => {
        expect(getPaperTextureOverscan(1, 1)).toBeGreaterThan(getPaperTextureOverscan(0, 0));
        expect(getPaperTextureOverscan(1, 1)).toBeLessThan(1.2);
    });
});

describe('lens distortion overscan', () => {
    it('keeps the warped corner inside the image for every bulge on the slider', () => {
        for (let bulge = -1; bulge <= 1.0001; bulge += 0.05) {
            const rounded = Number(bulge.toFixed(2));
            const scale = getLensDistortionOverscan(rounded, 0.45);
            if (scale >= 1.8) continue; // clamped: extreme fisheye fades its own corners anyway.
            const cornerRn = (2 * OUT_RADIUS) / scale;
            const warped = (OUT_RADIUS / scale) * (rounded > 0 ? lensPush(cornerRn, rounded) : 1);
            // The box boundary along the corner ray sits at OUT_RADIUS, minus the dispersion that
            // survives focusEdges.
            const edgeReach = 0.7 * Math.pow(0.45, 1.3 + 2.7 * 0.45) * (1 - NOMAND_LENS_SHAPE.focusEdges);
            expect(warped + edgeReach).toBeLessThanOrEqual(OUT_RADIUS + 1e-9);
        }
    });

    it('does not zoom when nothing pushes the sampling outward', () => {
        expect(getLensDistortionOverscan(0, 0)).toBe(1);
        expect(getLensDistortionOverscan(-1, 0)).toBe(1);
    });

    it('rises with bulge and never exceeds the clamp', () => {
        expect(getLensDistortionOverscan(0.6, 0.45)).toBeGreaterThan(getLensDistortionOverscan(0.2, 0.45));
        expect(getLensDistortionOverscan(1, 1)).toBeLessThanOrEqual(1.8);
    });
});
