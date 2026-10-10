import { easeTemperaSoftBack } from './temperaMotionEasing';

// src/components/visualizer/tempera/temperaEnterStyles.ts
// The ways a glyph can arrive. One style is picked per word at layout time, so a word lands as
// a unit while neighbouring words arrive differently — that variety is what keeps a collage
// from reading as one uniform slide-in.
//
// These are direction variants, deliberately. Long-haul fly-ins and single-axis stretches were
// tried and read as gimmicks against the deterministic typesetting: every style here travels
// the modest distance the layout already sized for the shot, and scales uniformly.
export const TEMPERA_ENTER_STYLES = [
    'slide',
    'from-left',
    'from-right',
    'from-above',
    'from-below',
    'swing',
    'stamp',
] as const;
export type TemperaEnterStyle = typeof TEMPERA_ENTER_STYLES[number];

export interface TemperaEnterInput {
    enterX: number;
    enterY: number;
    enterRotation: number;
    enterScale: number;
}

export interface TemperaEnterFrame {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    /** 0 when the style has no travel worth echoing (a stamp has nowhere to trail from). */
    echo: number;
}

// Every direction variant reuses the magnitude the layout already picked for this glyph, so
// switching style changes where a glyph comes from, never how far it has to come.
const directional = (
    input: TemperaEnterInput,
    travel: number,
    uniform: number,
    dirX: number,
    dirY: number,
    rotationScale: number,
): TemperaEnterFrame => {
    const magnitude = Math.hypot(input.enterX, input.enterY);
    // Normalised, so the slight cross-axis lean tilts the approach without lengthening it.
    const length = Math.hypot(dirX, dirY) || 1;
    return {
        x: (dirX / length) * magnitude * travel,
        y: (dirY / length) * magnitude * travel,
        rotation: input.enterRotation * rotationScale * travel,
        scaleX: uniform,
        scaleY: uniform,
        echo: travel,
    };
};

/**
 * Resolves one style's offset/rotation/scale at a point in its entrance.
 * `travel` runs 1 -> 0 across the window and `linear` is the raw 0 -> 1 progress; styles that
 * need their own curve re-ease `linear` rather than reusing the shared travel.
 */
export const resolveTemperaEnterFrame = (
    style: TemperaEnterStyle,
    input: TemperaEnterInput,
    travel: number,
    linear: number,
): TemperaEnterFrame => {
    const settle = easeTemperaSoftBack(linear);
    const uniform = input.enterScale + (1 - input.enterScale) * settle;

    switch (style) {
        case 'from-left':
            return directional(input, travel, uniform, -1, 0.12, 0.4);
        case 'from-right':
            return directional(input, travel, uniform, 1, -0.12, 0.4);
        case 'from-above':
            return directional(input, travel, uniform, 0.12, -1, 0.4);
        case 'from-below':
            return directional(input, travel, uniform, -0.12, 1, 0.4);
        case 'swing':
            // The shot's own approach vector, but the glyph rotates in around its centre.
            return {
                x: input.enterX * 0.6 * travel,
                y: input.enterY * 0.6 * travel,
                rotation: (input.enterRotation + Math.sign(input.enterRotation || 1) * 0.95) * travel,
                scaleX: uniform,
                scaleY: uniform,
                echo: travel * 0.8,
            };
        case 'stamp':
            // The one in-place style: slams down onto the page from oversize. No travel, so
            // no echo trail either.
            return {
                x: 0,
                y: 0,
                rotation: input.enterRotation * 0.6 * travel,
                scaleX: 1 + travel * 0.7,
                scaleY: 1 + travel * 0.7,
                echo: 0,
            };
        case 'slide':
        default:
            // The shot's own fanned vector, straight in.
            return {
                x: input.enterX * travel,
                y: input.enterY * travel,
                rotation: input.enterRotation * travel,
                scaleX: uniform,
                scaleY: uniform,
                echo: travel,
            };
    }
};
