import * as THREE from 'three';
import { DIORAMA_RIPPLE_COUNT } from './dioramaParticleModel';
import {
    DIORAMA_PARTICLE_FRAGMENT_SHADER,
    DIORAMA_PARTICLE_VERTEX_SHADER,
} from './dioramaParticleShaders';

// src/components/visualizer/diorama/dioramaParticleMaterials.ts
// Builds the two point materials that share one shader: an opaque CONTRAST layer (normal blending) that
// guarantees the theme-adapted colour is visible on any background, and an additive GLOW halo layer.
export interface DioramaParticleColors {
    primary: THREE.Color;
    accent: THREE.Color;
    secondary: THREE.Color;
}

// WCAG's relative luminance IS this weighted sum of LINEAR channels. The spec spells out a
// linearisation step only because it starts from sRGB-encoded input; a THREE.Color is already linear
// (ColorManagement is on, so setHex/setStyle convert on the way in). So do NOT "restore" the missing
// sRGB round-trip here - encoding and then linearising the same value back is the identity, and it
// only costs a clone plus six Math.pow per call, inside a 10-iteration binary search.
const relativeLuminance = (color: THREE.Color): number =>
    0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;

export const getDioramaParticleContrastRatio = (
    foreground: THREE.Color,
    background: THREE.Color,
): number => {
    const foregroundLuminance = relativeLuminance(foreground);
    const backgroundLuminance = relativeLuminance(background);
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);
    return (lighter + 0.05) / (darker + 0.05);
};

// What the point shader ACTUALLY puts on screen for a calm point of this colour. Three transforms sit
// between the uniform and the pixel, and measuring the ratio without them is measuring a colour nobody
// ever sees - on a near-colour theme the "4.6" it certified landed as 1.28 on screen (1.0 being literally
// indistinguishable from the background):
//   - vColor carries a 0.92 floor at rest and the fragment adds a 0.95 rest emission.
//   - the contrast layer composites at vAlpha = layerBase = 0.72 for a near point at rest.
//   - the framebuffer is sRGB-encoded, so that blend runs on ENCODED values, not linear ones.
// All three are read from dioramaParticleShaders.ts. The case pinned here is the hardest one for
// legibility - a NEAR point in SILENCE - because reach only ever adds brightness and alpha on top, and
// the far layer is meant to sit back. Luminance is linear in RGB and the shader's gradient blend of
// primary/accent/secondary is a convex mix in linear space, so a mix of three colours that each clear the
// target clears it too; certifying the three individually certifies every point.
const CALM_EMISSION = 0.92 * 0.95;
const CONTRAST_LAYER_ALPHA = 0.72;

const asDisplayed = (color: THREE.Color, background: THREE.Color): THREE.Color => {
    const src = color.clone().multiplyScalar(CALM_EMISSION).convertLinearToSRGB();
    const dst = background.clone().convertLinearToSRGB();
    const blend = (s: number, d: number) => s * CONTRAST_LAYER_ALPHA + d * (1 - CONTRAST_LAYER_ALPHA);
    return new THREE.Color(blend(src.r, dst.r), blend(src.g, dst.g), blend(src.b, dst.b))
        .convertSRGBToLinear();
};

/**
 * The contrast ratio of the PIXEL a point of this colour becomes, against the background behind it. This
 * is the number that describes legibility; getDioramaParticleContrastRatio describes the uniform.
 */
export const getDioramaParticleDisplayedContrastRatio = (
    color: THREE.Color,
    background: THREE.Color,
): number => getDioramaParticleContrastRatio(asDisplayed(color, background), background);

/**
 * The "smart" contrast step: if a theme colour is already legible on the scene it is left alone; if it
 * is too close to the background it is nudged toward whichever of white/black the scene contrasts with
 * more (so dark scenes get brighter points, light scenes get darker ones) by the smallest amount that
 * clears the target ratio. Hue is preserved as far as possible, and the search still stops at the
 * SMALLEST correction that works, so the theme's palette is bent no further than legibility requires.
 */
const adaptColorToBackground = (
    color: THREE.Color,
    background: THREE.Color,
    minimumContrast: number,
): THREE.Color => {
    if (getDioramaParticleDisplayedContrastRatio(color, background) >= minimumContrast) {
        return color.clone();
    }
    const lightTarget = new THREE.Color(0xffffff);
    const darkTarget = new THREE.Color(0x050505);
    // Which way is further from the background is judged on the DISPLAYED pixel too: the composite pulls
    // every candidate 28% back toward the background, which is not symmetric between the two directions.
    const target = getDioramaParticleDisplayedContrastRatio(lightTarget, background)
        >= getDioramaParticleDisplayedContrastRatio(darkTarget, background)
        ? lightTarget
        : darkTarget;
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 10; iteration += 1) {
        const amount = (low + high) * 0.5;
        const candidate = color.clone().lerp(target, amount);
        if (getDioramaParticleDisplayedContrastRatio(candidate, background) >= minimumContrast) {
            high = amount;
        } else {
            low = amount;
        }
    }
    return color.clone().lerp(target, high);
};

// Higher targets than plain AA text: point clouds are small, so they need more separation from the scene
// than a glyph does. These are demanded of the DISPLAYED pixel (see getDioramaParticleDisplayedContrast-
// Ratio), so the layer's own transparency is already accounted for rather than guessed at.
export const resolveDioramaParticleContrastColors = (
    colors: DioramaParticleColors,
    background: THREE.Color,
): DioramaParticleColors => ({
    primary: adaptColorToBackground(colors.primary, background, 4.6),
    accent: adaptColorToBackground(colors.accent, background, 4.1),
    secondary: adaptColorToBackground(colors.secondary, background, 4.6),
});

const buildUniforms = (colors: DioramaParticleColors, glowPass: number, glowIntensity: number) => ({
    uTime: { value: 0 },
    uCorridor: { value: 0 },      // 0 = clouds, 1 = corridor. Both are ripple-driven; only the space differs.
    uAmplitude: { value: 0.34 },  // displacement per unit of swell, as a FRACTION of the geometry's radius
    uMaxSwell: { value: 0.29 },   // displacement that counts as full reach; normalises d (set per frame)
    uWaveNumberMax: { value: 8 }, // lattice-derived detail ceiling (set per frame from the buffer)
    uDetail: { value: 0 },        // 0..1 sustained treble -> fine texture on existing crests
    // Live ripple sources, for BOTH modes. The field writes these; nothing else drives the displacement.
    uRippleSource: { value: new Float32Array(DIORAMA_RIPPLE_COUNT * 4) },
    uRippleShape: { value: new Float32Array(DIORAMA_RIPPLE_COUNT * 4) },
    uOffsetGain: { value: 0 },    // whole-body sway on mid energy
    uFlow: { value: 1 },          // self-travel of the corridor's idle breath
    uFormation: { value: 1 },     // 1 = formed, 0 = dispersed (song-change dissolve)
    uScatter: { value: 4 },       // how far points fly out while dispersing
    uSizeBase: { value: 0.052 },  // world point size of a calm point
    uSizeGain: { value: 0.3 },    // size a fully-reaching point gains - the reference's real "amplitude"
    uPulse: { value: 1 },         // gentle whole-body beat scale
    uSpectralCentroid: { value: 0.5 },
    uViewportHeight: { value: 1 },
    uGlow: { value: glowIntensity },
    uGlowPass: { value: glowPass },
    uPrimaryColor: { value: colors.primary.clone() },
    uAccentColor: { value: colors.accent.clone() },
    uSecondaryColor: { value: colors.secondary.clone() },
});

/** The opaque contrast layer: near-solid discs, normal blending, legible on any background. */
export const createDioramaParticleMaterial = (
    colors: DioramaParticleColors,
): THREE.ShaderMaterial => new THREE.ShaderMaterial({
    vertexShader: DIORAMA_PARTICLE_VERTEX_SHADER,
    fragmentShader: DIORAMA_PARTICLE_FRAGMENT_SHADER,
    uniforms: buildUniforms(colors, 0, 0),
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    toneMapped: false,
});

/** The glow halo layer: wide soft sprites, additive blending, strength driven by the glow slider. */
export const createDioramaParticleGlowMaterial = (
    colors: DioramaParticleColors,
    glowIntensity: number,
): THREE.ShaderMaterial => new THREE.ShaderMaterial({
    vertexShader: DIORAMA_PARTICLE_VERTEX_SHADER,
    fragmentShader: DIORAMA_PARTICLE_FRAGMENT_SHADER,
    uniforms: buildUniforms(colors, 1, glowIntensity),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
});

export const lerpDioramaParticleMaterialColors = (
    material: THREE.ShaderMaterial,
    colors: DioramaParticleColors,
    amount: number,
): void => {
    (material.uniforms.uPrimaryColor.value as THREE.Color).lerp(colors.primary, amount);
    (material.uniforms.uAccentColor.value as THREE.Color).lerp(colors.accent, amount);
    (material.uniforms.uSecondaryColor.value as THREE.Color).lerp(colors.secondary, amount);
};
