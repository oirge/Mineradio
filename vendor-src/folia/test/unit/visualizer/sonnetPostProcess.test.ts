import { describe, expect, it } from 'vitest';
import { DEFAULT_SONNET_TUNING, type Theme } from '@/types';
import { resolveSonnetPostProcessProfile } from '@/components/visualizer/sonnet/sonnetPostProcess';

// test/unit/visualizer/sonnetPostProcess.test.ts
// Locks intensity-aware glow, disabled film noise, and static-mode filter suppression.
const theme = {
    animationIntensity: 'normal',
} as Theme;

describe('Sonnet post-process profile', () => {
    it('keeps glow restrained and film noise disabled', () => {
        const profile = resolveSonnetPostProcessProfile(theme, DEFAULT_SONNET_TUNING, false);

        expect(profile.glowStrength).toBeGreaterThan(3);
        expect(profile.glowAlpha).toBeLessThanOrEqual(0.62);
        expect(profile.noise).toBe(0);
        expect(profile.contrast).toBe(0);
        expect(profile.lensDistortion).toBe(0);
        expect(profile.lensDispersion).toBe(0);
        expect(profile.printEffects).toEqual({ rgbShift: 0, halftone: 0, vignette: 0 });
    });

    it('disables filter passes in static mode', () => {
        expect(resolveSonnetPostProcessProfile(theme, DEFAULT_SONNET_TUNING, true))
            .toEqual({
                glowStrength: 0,
                glowAlpha: 0,
                noise: 0,
                contrast: 0,
                glitchIntensity: 0,
                lensDistortion: 0,
                lensDispersion: 0,
                printEffects: { rgbShift: 0, halftone: 0, vignette: 0 },
            });
    });

    it('enables fixed print passes only when post processing is on', () => {
        const enabled = resolveSonnetPostProcessProfile(
            theme,
            { ...DEFAULT_SONNET_TUNING, postProcessEnabled: true },
            false,
        );

        expect(enabled.printEffects).toEqual({
            rgbShift: DEFAULT_SONNET_TUNING.postProcessRgbShift,
            halftone: DEFAULT_SONNET_TUNING.postProcessHalftone,
            vignette: DEFAULT_SONNET_TUNING.postProcessVignette,
        });

        const partial = resolveSonnetPostProcessProfile(
            theme,
            { ...DEFAULT_SONNET_TUNING, postProcessEnabled: true, postProcessHalftone: 0 },
            false,
        );
        expect(partial.printEffects.halftone).toBe(0);
        expect(partial.printEffects.vignette).toBe(DEFAULT_SONNET_TUNING.postProcessVignette);
        expect(enabled.noise).toBeGreaterThan(0);
        expect(enabled.contrast).toBe(DEFAULT_SONNET_TUNING.postProcessContrast * 0.5);
        expect(enabled.lensDistortion).toBe(DEFAULT_SONNET_TUNING.postProcessLensDistortion);
        expect(enabled.lensDispersion).toBe(DEFAULT_SONNET_TUNING.postProcessLensDispersion);

        const disabled = resolveSonnetPostProcessProfile(
            { ...theme },
            { ...DEFAULT_SONNET_TUNING, postProcessEnabled: false },
            false,
        );
        expect(disabled.lensDistortion).toBe(0);
        expect(disabled.lensDispersion).toBe(0);
    });

    it('scales with theme animation intensity without exceeding caps', () => {
        const calm = resolveSonnetPostProcessProfile(
            { ...theme, animationIntensity: 'calm' },
            DEFAULT_SONNET_TUNING,
            false,
        );
        const chaotic = resolveSonnetPostProcessProfile(
            { ...theme, animationIntensity: 'chaotic' },
            DEFAULT_SONNET_TUNING,
            false,
        );

        expect(chaotic.glowStrength).toBeGreaterThan(calm.glowStrength);
        expect(chaotic.glowAlpha).toBeLessThanOrEqual(0.62);
        expect(chaotic.noise).toBe(0);
    });
});
