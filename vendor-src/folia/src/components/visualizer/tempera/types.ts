import type { Line } from '../../../types';
import type { GraphemeTiming } from '../../../utils/lyrics/graphemeTiming';

// src/components/visualizer/tempera/types.ts
// Public, renderer-independent contracts for the deterministic Tempera block PV program.
export type TemperaParagraphKind = 'breath' | 'verse' | 'lift' | 'chorus' | 'break' | 'outro';
export type TemperaParagraphBoundary = 'song-start' | 'time-gap' | 'metadata' | 'duration-cap' | 'line-cap';
/**
 * Every composition Tempera can cut to. Shots are half-phrase sized by default, so the list
 * has to be long enough that a paragraph rarely repeats one; `temperaShotProfiles.ts` carries
 * the layout region / camera / mood for each, and `temperaCompositions.ts` the drawing.
 */
export const TEMPERA_SHOT_KINDS = [
    // Splits and grids
    'duo-split',
    'quad-split',
    'tri-column',
    'thirds-stack',
    'checker-quad',
    'corner-wedge',
    'diagonal-halves',
    'cross-axis',
    'offset-halves',
    'stair-blocks',
    'pillar-gap',
    'corner-quad',
    'sliver-stack',
    // Bands
    'band-strip',
    'horizon-band',
    'deep-dive',
    'tone-ramp',
    'double-band',
    'tilt-band',
    'edge-rails',
    'gradient-wall',
    'terrace',
    // Frames and windows
    'frame-window',
    'double-frame',
    'circle-window',
    'ladder-frame',
    'corner-brackets',
    'inset-box',
    'bracket-pair',
    'arch-window',
    'grid-cells',
    'keyhole',
    // Posters and shapes
    'poster-panel',
    'diamond-stack',
    'slash-poster',
    'arrow-wedge',
    'edge-bleed',
    'triangle-mass',
    'ribbon-cross',
    'half-disc',
    'stacked-slabs',
    'wedge-pair',
    // Sparse fields
    'quiet-line',
    'starfield-dots',
    'ripple-lines',
    'hair-grid',
    'margin-rule',
    'dot-drift',
    'arc-sweep',
    'blank-page',
    // Cinema mattes: a solid frame with a window of a given aspect punched out of it.
    'cinema-scope',
    'cinema-wide',
    'cinema-academy',
    'cinema-square',
    'cinema-portrait',
    'cinema-tall',
    'cinema-twin',
    // Rounded shapes laid on a flat field, after visual novel promo PVs. Every other family
    // cuts the frame with straight edges; these keep the field whole and put curves on it.
    'bubble-drift',
    'cloud-window',
    'heart-burst',
    'sparkle-field',
    'petal-arc',
    'scallop-band',
    'ribbon-loop',
    'round-plate',
    'halo-burst',
    // Punched plates. The opening is cut clean through the tone, so the shell's live
    // background shows in it - see `compositions/temperaCutout.ts`.
    'iris-hole',
    'slot-rail',
    'punch-row',
    'film-gate',
    'cross-vent',
    'louvre-slats',
    'ring-eye',
    'notch-stack',
    'wedge-gap',
    'dot-sieve',
    // Instrument panels: measured geometric decoration around one heavy focal mass.
    'sight-mark',
    'dial-scale',
    'chevron-run',
    'tally-column',
    'grid-focus',
    'axis-caps',
    'strobe-slats',
    'offset-plate',
    'radial-comb',
    'bracket-target',
    // Corridors: openings cut along the flow vector, so the hand-off between two shots keeps
    // the same opening moving instead of cutting to a new one.
    'flow-channel',
    'twin-channel',
    'reed-run',
    'taper-channel',
    'chain-ports',
    'dash-channel',
    'window-run',
    'bridge-span',
    'braid-channel',
    'port-ladder',
    // Brutalist monoliths: one enormous matte solid, cropped by the frame, type on its edge.
    'apex-mass',
    'ziggurat',
    'slab-wall',
    'cantilever',
    'pylon-pair',
    'bunker-slit',
    'plinth-stack',
    'buttress-run',
    'void-core',
    'shear-block',
    // The same language read as ground and structure rather than as objects.
    'ridge-line',
    'chasm',
    'overhang',
    'step-well',
    'pier-row',
    'revetment',
    'tower-crop',
    'lintel',
    'rubble-fan',
    'gnomon',
    // Monogatari-style interstitials: one flat field, type as the whole picture.
    'monogatari-card',
    'monogatari-rule',
    'monogatari-edge',
    'monogatari-stack',
    'monogatari-flash',
] as const;
export type TemperaShotKind = typeof TEMPERA_SHOT_KINDS[number];
/**
 * Every transition is led by the large graphics or the camera; nothing dissolves or cuts
 * hard, because a dissolve reads as an edit and Tempera's compositions should hand off.
 */
export const TEMPERA_TRANSITION_KINDS = [
    'block-wipe',
    'camera-pan',
    'shape-carry',
] as const;
export type TemperaTransitionKind = typeof TEMPERA_TRANSITION_KINDS[number];

export interface TemperaSegment {
    text: string;
    startOffset: number;
    endOffset: number;
    startTime: number;
    endTime: number;
    graphemes: GraphemeTiming[];
    isWordLike: boolean;
}

export interface TemperaCompiledLine {
    sourceIndex: number;
    line: Line;
    renderEndTime: number;
    segments: TemperaSegment[];
}

export interface TemperaCameraKey {
    x: number;
    y: number;
    zoom: number;
    rotation: number;
}

export const TEMPERA_DECOR_MOTIFS = [
    'diamonds',
    'hatch-twin',
    'band-cross',
    'poster-diamond',
    'doodle',
] as const;
export type TemperaDecorMotif = typeof TEMPERA_DECOR_MOTIFS[number];

/** One stray glyph parked in the margins of a sparse composition. */
export interface TemperaDecorFragment {
    char: string;
    /** Fractional viewport position; the scene builder scales it to pixels. */
    x: number;
    y: number;
    rotation: number;
    scale: number;
}

/** Oversized decorative word set behind the composition, poster-watermark style. */
export interface TemperaDecorWatermark {
    text: string;
    /** Fractional viewport position of the word's centre. */
    x: number;
    y: number;
    rotation: number;
    /** Multiplier on the shot's base font size. */
    scale: number;
}

/**
 * Screentone decor for one shot, fully resolved at compile time so the renderer stays
 * free of randomness and every seek paints the identical frame.
 */
export interface TemperaDecorSpec {
    motif: TemperaDecorMotif;
    hatchAngle: number;
    crossCount: number;
    scribbleSeed: number;
    fragments: TemperaDecorFragment[];
    watermark: TemperaDecorWatermark | null;
}

/**
 * A shot shows a half-phrase sliced on word boundaries by default, or one complete source line
 * when `wholeLineLyrics` is on. In both modes the slice is a half-open segment range.
 */
export interface TemperaShotSlice {
    /** `sourceIndex` of the compiled line this slice belongs to. */
    lineIndex: number;
    /** Half-open range into that line's `segments`. */
    segmentStart: number;
    segmentEnd: number;
}

export interface TemperaShot {
    id: string;
    kind: TemperaShotKind;
    startTime: number;
    endTime: number;
    /**
     * When this shot's last grapheme stops singing. `endTime` is tiled up to the next shot's
     * start (and the closing shot holds to the paragraph's tail), so it can sit seconds past
     * the lyric; anything paced against the words - the block and image entrance stagger -
     * has to use this instead, or the graphics are still arriving long after the type landed.
     */
    lyricEndTime: number;
    slices: TemperaShotSlice[];
    /**
     * A bridge shot carries an instrumental gap between paragraphs: it has no lyric slices,
     * only a composition. Without one the gap has nothing on screen and a translating
     * transition slides the outgoing paragraph away into the bare shell.
     */
    isBridge: boolean;
    /** Camera keyframe at shot start (fractional viewport offsets). */
    camera: TemperaCameraKey;
    /** Camera keyframe at shot end; the runtime interpolates between the two. */
    cameraEnd: TemperaCameraKey;
    /**
     * Direction (radians) this shot's graphics travel in. Consecutive shots only turn it by
     * a small amount, so blocks keep sweeping the same way across a cut and the boundary
     * reads as one continuous move rather than as an edit.
     */
    flowAngle: number;
    /** Deterministic screentone decor description for the MG layer. */
    decor: TemperaDecorSpec;
}

export interface TemperaTransition {
    kind: TemperaTransitionKind;
    startTime: number;
    endTime: number;
}

export interface TemperaParagraph {
    id: string;
    kind: TemperaParagraphKind;
    boundary: TemperaParagraphBoundary;
    startTime: number;
    endTime: number;
    lines: TemperaCompiledLine[];
    shots: TemperaShot[];
    transitionOut: TemperaTransition | null;
}

export interface TemperaProgram {
    version: 1;
    seed: string;
    paragraphGapThreshold: number;
    paragraphs: TemperaParagraph[];
}
