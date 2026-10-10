import { TEMPERA_SHOT_KINDS, type TemperaShotKind } from './types';

// src/components/visualizer/tempera/temperaShotProfiles.ts
// Pure per-composition data: where the type sits, which way its glyphs fly in, how the camera
// travels, and how loud the composition reads. Deliberately free of Pixi so the typesetter and
// the program compiler can both depend on it without pulling in the drawing code.

/** Layout box for the lyric, in fractions of the viewport. */
export interface TemperaShotRegion {
    cx: number;
    cy: number;
    w: number;
    h: number;
    align: 'center' | 'left' | 'right';
    rotation: number;
    /** Multiplier on the shot's base font size. */
    fontScale: number;
}

export interface TemperaShotProfile {
    region: TemperaShotRegion;
    /** Base glyph entrance vector, in multiples of the resolved font size. */
    enter: { x: number; y: number };
    /** Camera travel along the shot's flow angle, plus its zoom ramp. */
    camera: { travel: number; zoomStart: number; zoomEnd: number };
    /**
     * How much noise the composition makes. Breathing paragraphs avoid `loud` compositions and
     * a chorus never drops to a `quiet` one.
     */
    mood: 'quiet' | 'neutral' | 'loud';
    /**
     * Whether the shared crossing lines and motif overlay are drawn on top. Cards whose whole
     * point is a bare field opt out - a stray scribble would undo them.
     */
    sharedDecor?: boolean;
}

const region = (
    cx: number,
    cy: number,
    w: number,
    h: number,
    options: Partial<Pick<TemperaShotRegion, 'align' | 'rotation' | 'fontScale'>> = {},
): TemperaShotRegion => ({
    cx,
    cy,
    w,
    h,
    align: options.align ?? 'center',
    rotation: options.rotation ?? 0,
    fontScale: options.fontScale ?? 1,
});

export const TEMPERA_SHOT_PROFILES: Record<TemperaShotKind, TemperaShotProfile> = {
    'duo-split': {
        region: region(0.5, 0.52, 0.86, 0.46),
        enter: { x: 0, y: 1.3 },
        camera: { travel: 0.11, zoomStart: 1.06, zoomEnd: 1.13 },
        mood: 'neutral',
    },
    'quad-split': {
        // Sits dead on the crossing of the four panels, so every glyph straddles two tones.
        region: region(0.5, 0.5, 0.82, 0.4),
        enter: { x: 0.9, y: 0.9 },
        camera: { travel: 0.09, zoomStart: 1.08, zoomEnd: 1.16 },
        mood: 'loud',
    },
    'tri-column': {
        region: region(0.5, 0.5, 0.7, 0.5, { fontScale: 0.95 }),
        enter: { x: -1.2, y: 0 },
        camera: { travel: 0.12, zoomStart: 1.04, zoomEnd: 1.12 },
        mood: 'neutral',
    },
    'thirds-stack': {
        region: region(0.5, 0.5, 0.8, 0.28),
        enter: { x: 0, y: 1.1 },
        camera: { travel: 0.13, zoomStart: 1.03, zoomEnd: 1.11 },
        mood: 'neutral',
    },
    'checker-quad': {
        region: region(0.5, 0.5, 0.76, 0.36),
        enter: { x: 0.8, y: -0.8 },
        camera: { travel: 0.1, zoomStart: 1.1, zoomEnd: 1.02 },
        mood: 'loud',
    },
    'corner-wedge': {
        region: region(0.44, 0.56, 0.68, 0.4, { align: 'left', rotation: -0.03 }),
        enter: { x: -1.4, y: 0.5 },
        camera: { travel: 0.1, zoomStart: 1.05, zoomEnd: 1.14 },
        mood: 'loud',
    },
    'diagonal-halves': {
        region: region(0.5, 0.5, 0.78, 0.4, { rotation: -0.075 }),
        enter: { x: 1.1, y: 1.1 },
        camera: { travel: 0.12, zoomStart: 1.06, zoomEnd: 1.14 },
        mood: 'neutral',
    },
    'cross-axis': {
        region: region(0.5, 0.5, 0.66, 0.3),
        enter: { x: 0, y: 1.2 },
        camera: { travel: 0.08, zoomStart: 1.12, zoomEnd: 1.03 },
        mood: 'loud',
    },
    'offset-halves': {
        region: region(0.5, 0.5, 0.8, 0.4),
        enter: { x: 0.9, y: 0.6 },
        camera: { travel: 0.11, zoomStart: 1.05, zoomEnd: 1.13 },
        mood: 'neutral',
    },
    'stair-blocks': {
        region: region(0.5, 0.5, 0.72, 0.38, { rotation: -0.03 }),
        enter: { x: -1, y: 0.8 },
        camera: { travel: 0.12, zoomStart: 1.06, zoomEnd: 1.14 },
        mood: 'loud',
    },
    'pillar-gap': {
        // The lyric lives in the bright slot the two masses leave between them.
        region: region(0.5, 0.5, 0.34, 0.62, { fontScale: 0.8 }),
        enter: { x: 0, y: 1.2 },
        camera: { travel: 0.07, zoomStart: 1.1, zoomEnd: 1.02 },
        mood: 'loud',
    },
    'corner-quad': {
        region: region(0.46, 0.46, 0.68, 0.36),
        enter: { x: -0.9, y: -0.9 },
        camera: { travel: 0.1, zoomStart: 1.07, zoomEnd: 1.15 },
        mood: 'neutral',
    },
    'sliver-stack': {
        region: region(0.5, 0.5, 0.76, 0.3),
        enter: { x: 1.2, y: 0 },
        camera: { travel: 0.13, zoomStart: 1.04, zoomEnd: 1.12 },
        mood: 'neutral',
    },
    'band-strip': {
        region: region(0.5, 0.52, 0.78, 0.26, { fontScale: 0.92 }),
        enter: { x: 0.5, y: 1.05 },
        camera: { travel: 0.12, zoomStart: 1.03, zoomEnd: 1.1 },
        mood: 'neutral',
    },
    'horizon-band': {
        // Type rides just above the waterline; the vertical flow then reads as a descent.
        region: region(0.5, 0.36, 0.8, 0.3),
        enter: { x: 0, y: -1.1 },
        camera: { travel: 0.14, zoomStart: 1.02, zoomEnd: 1.1 },
        mood: 'neutral',
    },
    'deep-dive': {
        region: region(0.5, 0.58, 0.76, 0.34),
        enter: { x: 0, y: 1.6 },
        camera: { travel: 0.16, zoomStart: 1.04, zoomEnd: 1.14 },
        mood: 'neutral',
    },
    'tone-ramp': {
        region: region(0.5, 0.5, 0.82, 0.38),
        enter: { x: 1.2, y: 0.4 },
        camera: { travel: 0.11, zoomStart: 1.05, zoomEnd: 1.12 },
        mood: 'neutral',
    },
    'double-band': {
        region: region(0.5, 0.5, 0.78, 0.22, { fontScale: 0.88 }),
        enter: { x: 0.8, y: 0 },
        camera: { travel: 0.12, zoomStart: 1.03, zoomEnd: 1.11 },
        mood: 'neutral',
    },
    'tilt-band': {
        region: region(0.5, 0.5, 0.8, 0.26, { rotation: -0.1 }),
        enter: { x: -1.1, y: 0.5 },
        camera: { travel: 0.13, zoomStart: 1.05, zoomEnd: 1.13 },
        mood: 'neutral',
    },
    'edge-rails': {
        region: region(0.5, 0.5, 0.74, 0.4),
        enter: { x: 0, y: 1 },
        camera: { travel: 0.09, zoomStart: 1.02, zoomEnd: 1.09 },
        mood: 'quiet',
    },
    'gradient-wall': {
        region: region(0.5, 0.44, 0.82, 0.36),
        enter: { x: 0.5, y: -0.9 },
        camera: { travel: 0.15, zoomStart: 1.04, zoomEnd: 1.13 },
        mood: 'neutral',
    },
    'terrace': {
        region: region(0.46, 0.52, 0.72, 0.34, { align: 'left' }),
        enter: { x: -1.2, y: 0.4 },
        camera: { travel: 0.14, zoomStart: 1.05, zoomEnd: 1.12 },
        mood: 'neutral',
    },
    'frame-window': {
        region: region(0.5, 0.5, 0.64, 0.5, { fontScale: 0.95 }),
        enter: { x: 0, y: 0.95 },
        camera: { travel: 0.05, zoomStart: 1.14, zoomEnd: 1.03 },
        mood: 'neutral',
    },
    'double-frame': {
        region: region(0.5, 0.5, 0.58, 0.4, { fontScale: 0.9 }),
        enter: { x: 0.6, y: 0.6 },
        camera: { travel: 0.06, zoomStart: 1.12, zoomEnd: 1.02 },
        mood: 'neutral',
    },
    'circle-window': {
        region: region(0.5, 0.5, 0.5, 0.34, { fontScale: 0.88 }),
        enter: { x: 0, y: 0.8 },
        camera: { travel: 0.05, zoomStart: 1.16, zoomEnd: 1.04 },
        mood: 'quiet',
    },
    'ladder-frame': {
        region: region(0.52, 0.5, 0.6, 0.4, { align: 'left', fontScale: 0.9 }),
        enter: { x: -0.9, y: 0.6 },
        camera: { travel: 0.07, zoomStart: 1.1, zoomEnd: 1.02 },
        mood: 'quiet',
    },
    'corner-brackets': {
        region: region(0.5, 0.5, 0.56, 0.3, { fontScale: 0.85 }),
        enter: { x: 0, y: 0.6 },
        camera: { travel: 0.04, zoomStart: 1.06, zoomEnd: 1.01 },
        mood: 'quiet',
    },
    'inset-box': {
        region: region(0.5, 0.5, 0.6, 0.42, { fontScale: 0.92 }),
        enter: { x: 0, y: 0.8 },
        camera: { travel: 0.06, zoomStart: 1.1, zoomEnd: 1.02 },
        mood: 'quiet',
    },
    'bracket-pair': {
        region: region(0.5, 0.5, 0.54, 0.34, { fontScale: 0.88 }),
        enter: { x: 1, y: 0 },
        camera: { travel: 0.05, zoomStart: 1.08, zoomEnd: 1.01 },
        mood: 'quiet',
    },
    'arch-window': {
        region: region(0.5, 0.54, 0.5, 0.34, { fontScale: 0.86 }),
        enter: { x: 0, y: 0.9 },
        camera: { travel: 0.06, zoomStart: 1.14, zoomEnd: 1.03 },
        mood: 'quiet',
    },
    'grid-cells': {
        region: region(0.5, 0.5, 0.72, 0.22, { fontScale: 0.8 }),
        enter: { x: 0.7, y: 0.7 },
        camera: { travel: 0.07, zoomStart: 1.06, zoomEnd: 1.13 },
        mood: 'neutral',
    },
    'keyhole': {
        region: region(0.5, 0.6, 0.42, 0.3, { fontScale: 0.78 }),
        enter: { x: 0, y: 1 },
        camera: { travel: 0.05, zoomStart: 1.12, zoomEnd: 1.02 },
        mood: 'quiet',
    },
    'poster-panel': {
        region: region(0.4, 0.5, 0.58, 0.62, { align: 'left', rotation: -0.045 }),
        enter: { x: -1.5, y: 0.35 },
        camera: { travel: 0.08, zoomStart: 1.05, zoomEnd: 1.12 },
        mood: 'loud',
    },
    'diamond-stack': {
        region: region(0.54, 0.5, 0.6, 0.42, { align: 'right', rotation: 0.035 }),
        enter: { x: 1.3, y: -0.5 },
        camera: { travel: 0.09, zoomStart: 1.07, zoomEnd: 1.15 },
        mood: 'loud',
    },
    'slash-poster': {
        region: region(0.46, 0.5, 0.66, 0.44, { align: 'left', rotation: -0.09 }),
        enter: { x: -1.2, y: 1 },
        camera: { travel: 0.11, zoomStart: 1.06, zoomEnd: 1.14 },
        mood: 'loud',
    },
    'arrow-wedge': {
        region: region(0.5, 0.34, 0.72, 0.26),
        enter: { x: 0, y: -1.2 },
        camera: { travel: 0.13, zoomStart: 1.04, zoomEnd: 1.13 },
        mood: 'loud',
    },
    'edge-bleed': {
        region: region(0.56, 0.5, 0.6, 0.44, { align: 'left' }),
        enter: { x: 1.4, y: 0.3 },
        camera: { travel: 0.1, zoomStart: 1.05, zoomEnd: 1.13 },
        mood: 'neutral',
    },
    'triangle-mass': {
        region: region(0.5, 0.42, 0.68, 0.3),
        enter: { x: 0.8, y: -1 },
        camera: { travel: 0.12, zoomStart: 1.05, zoomEnd: 1.14 },
        mood: 'loud',
    },
    'ribbon-cross': {
        region: region(0.5, 0.5, 0.62, 0.3, { rotation: 0.05 }),
        enter: { x: -1, y: -0.8 },
        camera: { travel: 0.11, zoomStart: 1.08, zoomEnd: 1.16 },
        mood: 'loud',
    },
    'half-disc': {
        region: region(0.44, 0.44, 0.6, 0.34, { align: 'left' }),
        enter: { x: -1.3, y: 0.4 },
        camera: { travel: 0.1, zoomStart: 1.06, zoomEnd: 1.14 },
        mood: 'loud',
    },
    'stacked-slabs': {
        region: region(0.52, 0.5, 0.62, 0.4, { rotation: -0.05 }),
        enter: { x: 1.1, y: 0.6 },
        camera: { travel: 0.1, zoomStart: 1.07, zoomEnd: 1.15 },
        mood: 'loud',
    },
    'wedge-pair': {
        region: region(0.5, 0.5, 0.44, 0.44, { fontScale: 0.82 }),
        enter: { x: 0, y: 1.1 },
        camera: { travel: 0.09, zoomStart: 1.1, zoomEnd: 1.02 },
        mood: 'loud',
    },
    'quiet-line': {
        region: region(0.5, 0.5, 0.6, 0.28, { fontScale: 0.58 }),
        enter: { x: 0, y: 0.7 },
        camera: { travel: 0.03, zoomStart: 1, zoomEnd: 1.04 },
        mood: 'quiet',
    },
    'starfield-dots': {
        region: region(0.5, 0.5, 0.62, 0.26, { fontScale: 0.66 }),
        enter: { x: 0.4, y: 0.5 },
        camera: { travel: 0.04, zoomStart: 1.02, zoomEnd: 1.08 },
        mood: 'quiet',
    },
    'ripple-lines': {
        region: region(0.5, 0.46, 0.66, 0.28, { fontScale: 0.72 }),
        enter: { x: 0, y: 0.9 },
        camera: { travel: 0.06, zoomStart: 1.03, zoomEnd: 1.1 },
        mood: 'quiet',
    },
    'hair-grid': {
        region: region(0.5, 0.5, 0.64, 0.26, { fontScale: 0.62 }),
        enter: { x: 0.4, y: 0.6 },
        camera: { travel: 0.04, zoomStart: 1.01, zoomEnd: 1.06 },
        mood: 'quiet',
    },
    'margin-rule': {
        region: region(0.54, 0.5, 0.62, 0.26, { align: 'left', fontScale: 0.66 }),
        enter: { x: -0.8, y: 0.3 },
        camera: { travel: 0.05, zoomStart: 1.02, zoomEnd: 1.07 },
        mood: 'quiet',
    },
    'dot-drift': {
        region: region(0.5, 0.48, 0.6, 0.26, { fontScale: 0.68 }),
        enter: { x: 0.6, y: 0.6 },
        camera: { travel: 0.05, zoomStart: 1.03, zoomEnd: 1.09 },
        mood: 'quiet',
    },
    'arc-sweep': {
        region: region(0.5, 0.5, 0.6, 0.26, { fontScale: 0.7 }),
        enter: { x: 0, y: 0.8 },
        camera: { travel: 0.06, zoomStart: 1.04, zoomEnd: 1.1 },
        mood: 'quiet',
    },
    'blank-page': {
        region: region(0.5, 0.5, 0.56, 0.24, { fontScale: 0.6 }),
        enter: { x: 0, y: 0.5 },
        camera: { travel: 0.03, zoomStart: 1, zoomEnd: 1.03 },
        mood: 'quiet',
    },
    // Cinema mattes. The regions are conservative boxes that stay inside the window on any
    // viewport aspect; the composition aspect-fits the actual window from the real size.
    'cinema-scope': {
        region: region(0.5, 0.5, 0.74, 0.22, { fontScale: 0.86 }),
        enter: { x: 0.9, y: 0 },
        camera: { travel: 0.09, zoomStart: 1.04, zoomEnd: 1.11 },
        mood: 'neutral',
    },
    'cinema-wide': {
        region: region(0.5, 0.5, 0.7, 0.3, { fontScale: 0.9 }),
        enter: { x: 0, y: 0.9 },
        camera: { travel: 0.08, zoomStart: 1.06, zoomEnd: 1.13 },
        mood: 'neutral',
    },
    'cinema-academy': {
        region: region(0.5, 0.5, 0.5, 0.4, { fontScale: 0.88 }),
        enter: { x: 0, y: 0.8 },
        camera: { travel: 0.06, zoomStart: 1.1, zoomEnd: 1.02 },
        mood: 'quiet',
    },
    'cinema-square': {
        region: region(0.5, 0.5, 0.42, 0.4, { fontScale: 0.84 }),
        enter: { x: 0.7, y: 0.7 },
        camera: { travel: 0.05, zoomStart: 1.12, zoomEnd: 1.03 },
        mood: 'quiet',
    },
    'cinema-portrait': {
        region: region(0.5, 0.5, 0.32, 0.46, { fontScale: 0.8 }),
        enter: { x: 0, y: 1 },
        camera: { travel: 0.06, zoomStart: 1.08, zoomEnd: 1.16 },
        mood: 'neutral',
    },
    'cinema-tall': {
        region: region(0.5, 0.5, 0.24, 0.5, { fontScale: 0.72 }),
        enter: { x: 0.8, y: 0.4 },
        camera: { travel: 0.07, zoomStart: 1.05, zoomEnd: 1.14 },
        mood: 'neutral',
    },
    'cinema-twin': {
        // Two windows; the lyric takes the wider one, which the composition keeps on the left.
        region: region(0.33, 0.5, 0.3, 0.32, { fontScale: 0.76 }),
        enter: { x: -0.9, y: 0.3 },
        camera: { travel: 0.08, zoomStart: 1.06, zoomEnd: 1.13 },
        mood: 'neutral',
    },
    // Rounded family. The type sits inside a curved shape rather than across a seam, so the
    // regions track that shape and the camera stays gentler than the poster family's.
    'bubble-drift': {
        region: region(0.5, 0.5, 0.72, 0.36, { fontScale: 0.92 }),
        enter: { x: 0.5, y: 1 },
        camera: { travel: 0.09, zoomStart: 1.05, zoomEnd: 1.12 },
        mood: 'neutral',
    },
    'cloud-window': {
        // Inside the medallion, which the composition centres slightly below the frame centre.
        region: region(0.5, 0.52, 0.46, 0.3, { fontScale: 0.84 }),
        enter: { x: 0, y: 0.8 },
        camera: { travel: 0.05, zoomStart: 1.14, zoomEnd: 1.03 },
        mood: 'quiet',
    },
    'heart-burst': {
        region: region(0.5, 0.52, 0.5, 0.3, { fontScale: 0.95 }),
        enter: { x: 0.8, y: 0.8 },
        camera: { travel: 0.1, zoomStart: 1.08, zoomEnd: 1.16 },
        mood: 'loud',
    },
    'sparkle-field': {
        region: region(0.5, 0.48, 0.64, 0.26, { fontScale: 0.7 }),
        enter: { x: 0.4, y: 0.6 },
        camera: { travel: 0.04, zoomStart: 1.02, zoomEnd: 1.08 },
        mood: 'quiet',
    },
    'petal-arc': {
        // Low in the frame: the petal fan owns the top corner it swings out of.
        region: region(0.5, 0.6, 0.7, 0.3, { fontScale: 0.9 }),
        enter: { x: 0, y: 1.1 },
        camera: { travel: 0.1, zoomStart: 1.04, zoomEnd: 1.12 },
        mood: 'neutral',
    },
    'scallop-band': {
        region: region(0.5, 0.5, 0.76, 0.24, { fontScale: 0.88 }),
        enter: { x: 0.7, y: 0 },
        camera: { travel: 0.12, zoomStart: 1.03, zoomEnd: 1.1 },
        mood: 'neutral',
    },
    'ribbon-loop': {
        region: region(0.5, 0.5, 0.68, 0.22, { rotation: 0.04, fontScale: 0.86 }),
        enter: { x: -1.1, y: 0.6 },
        camera: { travel: 0.11, zoomStart: 1.07, zoomEnd: 1.15 },
        mood: 'loud',
    },
    'round-plate': {
        region: region(0.5, 0.5, 0.56, 0.36, { fontScale: 0.86 }),
        enter: { x: 0, y: 0.7 },
        camera: { travel: 0.05, zoomStart: 1.1, zoomEnd: 1.02 },
        mood: 'quiet',
    },
    'halo-burst': {
        region: region(0.5, 0.5, 0.46, 0.3, { fontScale: 0.95 }),
        enter: { x: 0, y: 0.9 },
        camera: { travel: 0.08, zoomStart: 1.12, zoomEnd: 1.02 },
        mood: 'loud',
    },
    // Punched plates. Every region here is placed against the opening the composition cuts:
    // the inversion filter reads the Pixi render target, and a hole shows the DOM background
    // layer, which WebGL cannot see - so type over an opening would be judged against the bare
    // paper wash and left to fend for itself on whatever the background happens to be.
    'iris-hole': {
        // Bottom-left of the port, which sits high on the right.
        region: region(0.28, 0.68, 0.44, 0.28, { fontScale: 0.78 }),
        enter: { x: -1, y: 0.6 },
        camera: { travel: 0.09, zoomStart: 1.06, zoomEnd: 1.14 },
        mood: 'loud',
    },
    'slot-rail': {
        region: region(0.5, 0.66, 0.72, 0.3, { fontScale: 0.9 }),
        enter: { x: 0.6, y: 0.9 },
        camera: { travel: 0.12, zoomStart: 1.04, zoomEnd: 1.11 },
        mood: 'neutral',
    },
    'punch-row': {
        region: region(0.5, 0.5, 0.76, 0.34, { fontScale: 0.92 }),
        enter: { x: 1.1, y: 0 },
        camera: { travel: 0.13, zoomStart: 1.03, zoomEnd: 1.1 },
        mood: 'neutral',
    },
    'film-gate': {
        region: region(0.5, 0.82, 0.66, 0.2, { fontScale: 0.8 }),
        enter: { x: 0, y: 1.1 },
        camera: { travel: 0.08, zoomStart: 1.08, zoomEnd: 1.02 },
        mood: 'loud',
    },
    'cross-vent': {
        region: region(0.5, 0.82, 0.66, 0.2, { fontScale: 0.8 }),
        enter: { x: 0, y: 1 },
        camera: { travel: 0.07, zoomStart: 1.1, zoomEnd: 1.02 },
        mood: 'loud',
    },
    'louvre-slats': {
        region: region(0.5, 0.8, 0.7, 0.22, { fontScale: 0.82 }),
        enter: { x: 0.8, y: 0.7 },
        camera: { travel: 0.11, zoomStart: 1.05, zoomEnd: 1.13 },
        mood: 'neutral',
    },
    'ring-eye': {
        // On the island left standing inside the ring; nothing else in the frame is solid.
        region: region(0.5, 0.5, 0.26, 0.18, { fontScale: 0.62 }),
        enter: { x: 0, y: 0.7 },
        camera: { travel: 0.05, zoomStart: 1.14, zoomEnd: 1.03 },
        mood: 'quiet',
    },
    'notch-stack': {
        region: region(0.32, 0.5, 0.5, 0.34, { fontScale: 0.84 }),
        enter: { x: -1.1, y: 0.5 },
        camera: { travel: 0.1, zoomStart: 1.05, zoomEnd: 1.13 },
        mood: 'neutral',
    },
    'wedge-gap': {
        region: region(0.5, 0.78, 0.7, 0.24, { fontScale: 0.82 }),
        enter: { x: 0, y: 1.2 },
        camera: { travel: 0.12, zoomStart: 1.06, zoomEnd: 1.14 },
        mood: 'loud',
    },
    'dot-sieve': {
        region: region(0.75, 0.5, 0.38, 0.3, { fontScale: 0.78 }),
        enter: { x: 0.9, y: 0.4 },
        camera: { travel: 0.06, zoomStart: 1.03, zoomEnd: 1.09 },
        mood: 'quiet',
    },
    // Instrument panels. The type shares the frame with the focal mass rather than hiding from
    // it, so these regions sit on the mass itself wherever the composition leaves it solid.
    'sight-mark': {
        region: region(0.5, 0.5, 0.46, 0.2, { fontScale: 0.85 }),
        enter: { x: 0, y: 0.8 },
        camera: { travel: 0.06, zoomStart: 1.12, zoomEnd: 1.02 },
        mood: 'loud',
    },
    'dial-scale': {
        region: region(0.5, 0.5, 0.36, 0.2, { fontScale: 0.8 }),
        enter: { x: 0.7, y: 0.5 },
        camera: { travel: 0.05, zoomStart: 1.1, zoomEnd: 1.02 },
        mood: 'neutral',
    },
    'chevron-run': {
        region: region(0.5, 0.52, 0.72, 0.3, { fontScale: 0.9 }),
        enter: { x: 0, y: -1.1 },
        camera: { travel: 0.14, zoomStart: 1.04, zoomEnd: 1.12 },
        mood: 'neutral',
    },
    'tally-column': {
        region: region(0.38, 0.5, 0.6, 0.32, { align: 'left', fontScale: 0.76 }),
        enter: { x: -0.9, y: 0.3 },
        camera: { travel: 0.05, zoomStart: 1.02, zoomEnd: 1.08 },
        mood: 'quiet',
    },
    'grid-focus': {
        region: region(0.5, 0.5, 0.62, 0.22, { fontScale: 0.85 }),
        enter: { x: 0.8, y: 0.6 },
        camera: { travel: 0.09, zoomStart: 1.05, zoomEnd: 1.13 },
        mood: 'neutral',
    },
    'axis-caps': {
        // Below the port bored through the bar, still on the bar itself.
        region: region(0.5, 0.72, 0.66, 0.24, { fontScale: 0.82 }),
        enter: { x: 0, y: 1.2 },
        camera: { travel: 0.13, zoomStart: 1.06, zoomEnd: 1.15 },
        mood: 'loud',
    },
    'strobe-slats': {
        region: region(0.5, 0.5, 0.3, 0.36, { fontScale: 0.8 }),
        enter: { x: 1, y: 0 },
        camera: { travel: 0.1, zoomStart: 1.08, zoomEnd: 1.16 },
        mood: 'loud',
    },
    'offset-plate': {
        region: region(0.48, 0.62, 0.4, 0.2, { fontScale: 0.85 }),
        enter: { x: -0.9, y: -0.6 },
        camera: { travel: 0.09, zoomStart: 1.07, zoomEnd: 1.15 },
        mood: 'loud',
    },
    'radial-comb': {
        region: region(0.42, 0.4, 0.62, 0.3, { fontScale: 0.88 }),
        enter: { x: -1.2, y: -0.4 },
        camera: { travel: 0.11, zoomStart: 1.05, zoomEnd: 1.13 },
        mood: 'neutral',
    },
    'bracket-target': {
        region: region(0.5, 0.28, 0.66, 0.24, { fontScale: 0.85 }),
        enter: { x: 0, y: -0.9 },
        camera: { travel: 0.06, zoomStart: 1.04, zoomEnd: 1.1 },
        mood: 'quiet',
    },
    // Corridors. The channels lean with the flow, so every region here is kept clear of the
    // sideways walk a long tilted opening makes across the frame (see `temperaCutout.ts`).
    'flow-channel': {
        region: region(0.32, 0.5, 0.5, 0.3, { fontScale: 0.85 }),
        enter: { x: -1, y: 0.5 },
        camera: { travel: 0.13, zoomStart: 1.04, zoomEnd: 1.12 },
        mood: 'neutral',
    },
    'twin-channel': {
        // On the rib between the two corridors.
        region: region(0.5, 0.5, 0.4, 0.3, { fontScale: 0.85 }),
        enter: { x: 0, y: 1.2 },
        camera: { travel: 0.14, zoomStart: 1.03, zoomEnd: 1.11 },
        mood: 'neutral',
    },
    'reed-run': {
        region: region(0.5, 0.5, 0.3, 0.3, { fontScale: 0.72 }),
        enter: { x: 0, y: 0.9 },
        camera: { travel: 0.1, zoomStart: 1.02, zoomEnd: 1.09 },
        mood: 'quiet',
    },
    'taper-channel': {
        region: region(0.28, 0.5, 0.42, 0.3, { fontScale: 0.82 }),
        enter: { x: -1.1, y: 0.6 },
        camera: { travel: 0.12, zoomStart: 1.05, zoomEnd: 1.14 },
        mood: 'neutral',
    },
    'chain-ports': {
        region: region(0.32, 0.5, 0.5, 0.32, { fontScale: 0.8 }),
        enter: { x: -0.8, y: 0.7 },
        camera: { travel: 0.11, zoomStart: 1.03, zoomEnd: 1.1 },
        mood: 'quiet',
    },
    'dash-channel': {
        region: region(0.3, 0.5, 0.46, 0.3, { fontScale: 0.84 }),
        enter: { x: 0, y: 1.3 },
        camera: { travel: 0.15, zoomStart: 1.04, zoomEnd: 1.13 },
        mood: 'neutral',
    },
    'window-run': {
        region: region(0.28, 0.5, 0.42, 0.3, { fontScale: 0.82 }),
        enter: { x: 0, y: 1.2 },
        camera: { travel: 0.14, zoomStart: 1.04, zoomEnd: 1.12 },
        mood: 'neutral',
    },
    'bridge-span': {
        // On the band crossing the corridor - the widest opening in the family runs under it.
        region: region(0.5, 0.5, 0.72, 0.16, { fontScale: 0.85 }),
        enter: { x: 1.2, y: 0 },
        camera: { travel: 0.12, zoomStart: 1.08, zoomEnd: 1.16 },
        mood: 'loud',
    },
    'braid-channel': {
        region: region(0.5, 0.5, 0.34, 0.3, { fontScale: 0.8 }),
        enter: { x: 0, y: 1.1 },
        camera: { travel: 0.13, zoomStart: 1.06, zoomEnd: 1.15 },
        mood: 'loud',
    },
    'port-ladder': {
        region: region(0.3, 0.5, 0.46, 0.3, { fontScale: 0.78 }),
        enter: { x: -0.9, y: 0.4 },
        camera: { travel: 0.09, zoomStart: 1.02, zoomEnd: 1.09 },
        mood: 'quiet',
    },
    // Brutalist monoliths. Where the ground behind the type is solid, the region is placed to
    // straddle the mass's silhouette - a glyph half on the mass and half off it is the whole
    // point of the inversion filter. Where the composition opens the ground to the background
    // instead, the region moves fully onto the mass.
    'apex-mass': {
        // Sits just above the apex, which pushes into the bottom of the box.
        region: region(0.5, 0.3, 0.62, 0.2, { fontScale: 0.9 }),
        enter: { x: 0, y: -1 },
        camera: { travel: 0.12, zoomStart: 1.04, zoomEnd: 1.13 },
        mood: 'loud',
    },
    'ziggurat': {
        region: region(0.5, 0.32, 0.5, 0.18, { fontScale: 0.85 }),
        enter: { x: 0, y: -0.9 },
        camera: { travel: 0.1, zoomStart: 1.06, zoomEnd: 1.15 },
        mood: 'loud',
    },
    'slab-wall': {
        region: region(0.36, 0.5, 0.5, 0.24, { fontScale: 0.88 }),
        enter: { x: 1.2, y: 0 },
        camera: { travel: 0.11, zoomStart: 1.05, zoomEnd: 1.12 },
        mood: 'neutral',
    },
    'cantilever': {
        region: region(0.42, 0.42, 0.6, 0.14, { fontScale: 0.8 }),
        enter: { x: -1.3, y: 0 },
        camera: { travel: 0.13, zoomStart: 1.04, zoomEnd: 1.12 },
        mood: 'loud',
    },
    'pylon-pair': {
        // On the lintel; the bay below it is open to the background.
        region: region(0.5, 0.22, 0.7, 0.12, { fontScale: 0.75 }),
        enter: { x: 0, y: -0.8 },
        camera: { travel: 0.09, zoomStart: 1.08, zoomEnd: 1.02 },
        mood: 'loud',
    },
    'bunker-slit': {
        region: region(0.5, 0.48, 0.72, 0.2, { fontScale: 0.86 }),
        enter: { x: 0.9, y: 0.4 },
        camera: { travel: 0.08, zoomStart: 1.06, zoomEnd: 1.13 },
        mood: 'neutral',
    },
    'plinth-stack': {
        region: region(0.5, 0.32, 0.44, 0.16, { fontScale: 0.82 }),
        enter: { x: 0, y: -0.8 },
        camera: { travel: 0.1, zoomStart: 1.05, zoomEnd: 1.13 },
        mood: 'neutral',
    },
    'buttress-run': {
        region: region(0.5, 0.26, 0.7, 0.2, { fontScale: 0.86 }),
        enter: { x: 0.8, y: -0.8 },
        camera: { travel: 0.12, zoomStart: 1.03, zoomEnd: 1.11 },
        mood: 'loud',
    },
    'void-core': {
        region: region(0.5, 0.2, 0.66, 0.18, { fontScale: 0.84 }),
        enter: { x: 0, y: -1.1 },
        camera: { travel: 0.11, zoomStart: 1.07, zoomEnd: 1.15 },
        mood: 'loud',
    },
    'shear-block': {
        region: region(0.5, 0.5, 0.56, 0.2, { fontScale: 0.88 }),
        enter: { x: 1, y: 0.5 },
        camera: { travel: 0.12, zoomStart: 1.06, zoomEnd: 1.14 },
        mood: 'neutral',
    },
    'ridge-line': {
        region: region(0.5, 0.42, 0.72, 0.2, { fontScale: 0.9 }),
        enter: { x: 0, y: -1 },
        camera: { travel: 0.14, zoomStart: 1.03, zoomEnd: 1.12 },
        mood: 'neutral',
    },
    'chasm': {
        region: region(0.25, 0.5, 0.38, 0.24, { fontScale: 0.82 }),
        enter: { x: -1.2, y: 0.4 },
        camera: { travel: 0.1, zoomStart: 1.06, zoomEnd: 1.14 },
        mood: 'loud',
    },
    'overhang': {
        region: region(0.44, 0.58, 0.6, 0.22, { fontScale: 0.88 }),
        enter: { x: 0, y: 1.1 },
        camera: { travel: 0.11, zoomStart: 1.08, zoomEnd: 1.02 },
        mood: 'loud',
    },
    'step-well': {
        region: region(0.5, 0.26, 0.66, 0.2, { fontScale: 0.85 }),
        enter: { x: 0, y: -0.9 },
        camera: { travel: 0.09, zoomStart: 1.04, zoomEnd: 1.12 },
        mood: 'neutral',
    },
    'pier-row': {
        region: region(0.5, 0.4, 0.76, 0.14, { fontScale: 0.82 }),
        enter: { x: 1.1, y: 0 },
        camera: { travel: 0.13, zoomStart: 1.03, zoomEnd: 1.1 },
        mood: 'neutral',
    },
    'revetment': {
        region: region(0.46, 0.3, 0.6, 0.2, { fontScale: 0.86 }),
        enter: { x: -1, y: -0.6 },
        camera: { travel: 0.12, zoomStart: 1.05, zoomEnd: 1.13 },
        mood: 'neutral',
    },
    'tower-crop': {
        region: region(0.28, 0.5, 0.44, 0.24, { align: 'left', fontScale: 0.74 }),
        enter: { x: -0.8, y: 0.3 },
        camera: { travel: 0.06, zoomStart: 1.02, zoomEnd: 1.09 },
        mood: 'quiet',
    },
    'lintel': {
        region: region(0.5, 0.5, 0.76, 0.16, { fontScale: 0.9 }),
        enter: { x: -1.1, y: 0 },
        camera: { travel: 0.1, zoomStart: 1.02, zoomEnd: 1.08 },
        mood: 'quiet',
    },
    'rubble-fan': {
        region: region(0.56, 0.4, 0.5, 0.22, { fontScale: 0.84 }),
        enter: { x: 1.2, y: -0.5 },
        camera: { travel: 0.13, zoomStart: 1.07, zoomEnd: 1.16 },
        mood: 'loud',
    },
    'gnomon': {
        region: region(0.66, 0.34, 0.46, 0.2, { fontScale: 0.78 }),
        enter: { x: 0.9, y: -0.4 },
        camera: { travel: 0.07, zoomStart: 1.03, zoomEnd: 1.1 },
        mood: 'quiet',
    },
    // Monogatari interstitials: one flat field and the type *is* the picture, so the regions
    // are large and the type runs big.
    'monogatari-card': {
        region: region(0.5, 0.5, 0.78, 0.5, { fontScale: 1.15 }),
        enter: { x: 0, y: 0.7 },
        camera: { travel: 0.03, zoomStart: 1.02, zoomEnd: 1.07 },
        mood: 'quiet',
        sharedDecor: false,
    },
    'monogatari-rule': {
        region: region(0.5, 0.46, 0.76, 0.4, { fontScale: 1.05 }),
        enter: { x: 0.6, y: 0 },
        camera: { travel: 0.04, zoomStart: 1.03, zoomEnd: 1.09 },
        mood: 'quiet',
        sharedDecor: false,
    },
    'monogatari-edge': {
        region: region(0.52, 0.5, 0.72, 0.46, { align: 'left', fontScale: 1.05 }),
        enter: { x: -0.8, y: 0 },
        camera: { travel: 0.05, zoomStart: 1.02, zoomEnd: 1.08 },
        mood: 'neutral',
        sharedDecor: false,
    },
    'monogatari-stack': {
        region: region(0.5, 0.5, 0.44, 0.62, { fontScale: 1 }),
        enter: { x: 0, y: 0.9 },
        camera: { travel: 0.04, zoomStart: 1.05, zoomEnd: 1.12 },
        mood: 'quiet',
        sharedDecor: false,
    },
    'monogatari-flash': {
        region: region(0.5, 0.5, 0.82, 0.44, { fontScale: 1.3 }),
        enter: { x: 0, y: 0.5 },
        camera: { travel: 0.02, zoomStart: 1.08, zoomEnd: 1.01 },
        mood: 'loud',
        sharedDecor: false,
    },
};

export const resolveTemperaShotProfile = (kind: TemperaShotKind): TemperaShotProfile => (
    TEMPERA_SHOT_PROFILES[kind] ?? TEMPERA_SHOT_PROFILES['duo-split']
);

/** Compositions a paragraph of this character is allowed to cut to. */
export const resolveTemperaShotCandidates = (
    moods: ReadonlyArray<TemperaShotProfile['mood']>,
): readonly TemperaShotKind[] => {
    const candidates = TEMPERA_SHOT_KINDS.filter(
        kind => moods.includes(resolveTemperaShotProfile(kind).mood),
    );
    return candidates.length > 0 ? candidates : TEMPERA_SHOT_KINDS;
};
