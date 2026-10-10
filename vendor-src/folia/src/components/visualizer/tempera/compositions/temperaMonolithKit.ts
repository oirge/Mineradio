import type { TemperaCompositionContext } from '../temperaCompositionContext';
import { buildHatchSpec, buildScribblePath, rectPolygon } from '../temperaHatch';
import { drawHatchFill, drawLines, drawPolygonFill, drawPolygonOutline, drawPolyline } from '../temperaShapes';

// src/components/visualizer/tempera/compositions/temperaMonolithKit.ts
// The brutalist vocabulary, shared by the `monolith` and `terrain` families: one enormous
// matte mass, a couple of hairlines drawn straight across the whole picture, a face of ruled
// stripes, and a few small survey marks. The mass carries the shot on its own, so everything
// else here is deliberately thin - a monolith surrounded by decoration stops being monumental.
//
// Every mass runs past the frame on at least one side. A solid with all four edges in shot
// reads as an object sitting on a page; the same solid cropped by the frame reads as something
// too big for it, which is the entire effect.

interface MassOptions {
    alpha?: number;
    delay?: number;
    span?: number;
    enterDX?: number;
    enterDY?: number;
    /** Ink silhouette. Off for masses that meet another mass rather than the ground. */
    edge?: boolean;
    edgeWidth?: number;
}

export const addMass = (
    ctx: TemperaCompositionContext,
    polygon: number[],
    color: string,
    options: MassOptions = {},
) => {
    ctx.add(drawPolygonFill(ctx.pixi, polygon, color, options.alpha ?? 0.95, ctx.gradient), {
        delay: options.delay ?? 0.04,
        span: options.span ?? 0.6,
        enterDX: options.enterDX ?? 0,
        enterDY: options.enterDY ?? 0,
    });
    if (options.edge === false) return;
    ctx.add(drawPolygonOutline(ctx.pixi, polygon, ctx.palette.ink, options.edgeWidth ?? 2.4, 0.8), {
        delay: (options.delay ?? 0.04) + 0.06,
        span: 0.5,
        enterDX: (options.enterDX ?? 0) * 0.6,
        enterDY: (options.enterDY ?? 0) * 0.6,
    });
};

/** The full-bleed ground the mass stands on. */
export const addGround = (ctx: TemperaCompositionContext, color: string, alpha = 0.94) => {
    ctx.add(
        drawPolygonFill(ctx.pixi, rectPolygon(-ctx.bleed, -ctx.bleed, ctx.width + ctx.bleed * 2, ctx.height + ctx.bleed * 2), color, alpha, ctx.gradient),
        { span: 0.5 },
    );
};

/**
 * Ruled stripes over one face of a mass. The polygon has to be convex - `buildHatchLines`
 * clips against edge half-planes - so callers pass a convex slice of the mass rather than the
 * mass itself, which is usually stepped or notched.
 */
export const addFaceRuling = (
    ctx: TemperaCompositionContext,
    face: number[],
    salt: number,
    color = ctx.palette.tone4,
    alpha = 0.5,
) => {
    ctx.add(drawHatchFill(ctx.pixi, face, buildHatchSpec(ctx.seed, salt, 0.7), color, alpha), {
        delay: 0.16,
        span: 0.65,
        grow: true,
    });
};

/**
 * Two or three hairlines ruled across the entire picture at shallow angles. They are the only
 * thing in these compositions that ignores the mass, and that is what gives the mass its
 * scale: a line that crosses everything without touching anything.
 */
export const addSurveyLines = (ctx: TemperaCompositionContext, count = 3, salt = 211) => {
    const { width, height, bleed } = ctx;
    const lines = Array.from({ length: Math.max(1, count) }, (_, index) => {
        const anchor = height * (0.16 + ((index * 0.31 + (ctx.seed % 7) * 0.04) % 0.7));
        const lean = height * (index % 2 === 0 ? 0.22 : -0.16);
        return {
            x1: -bleed,
            y1: anchor - lean,
            x2: width + bleed,
            y2: anchor + lean,
        };
    });
    ctx.add(drawLines(ctx.pixi, lines, ctx.palette.paper, 1, 0.45), {
        delay: 0.2 + (salt % 3) * 0.02,
        span: 0.7,
        enterDX: width * 0.2,
    });
};

/** Survey marks in two opposite corners: registration for something far too big to register. */
export const addCornerTicks = (ctx: TemperaCompositionContext) => {
    const { width, height, palette } = ctx;
    const inset = Math.min(width, height) * 0.06;
    const arm = Math.min(width, height) * 0.05;
    ([[1, 1], [-1, -1]] as const).forEach(([sx, sy], index) => {
        const x = sx > 0 ? inset : width - inset;
        const y = sy > 0 ? inset : height - inset;
        ctx.add(drawLines(ctx.pixi, [
            { x1: x, y1: y, x2: x + sx * arm, y2: y },
            { x1: x, y1: y, x2: x, y2: y + sy * arm },
        ], palette.paper, 1.6, 0.6), { delay: 0.26 + index * 0.04, span: 0.5 });
    });
};

/** A loose wire contour parked in a corner - a survey trace of a shape that is not there. */
export const addWireTrace = (ctx: TemperaCompositionContext, cx: number, cy: number, radius: number) => {
    // Local coordinates inside a positioned group: `drift` scales and rotates a node about its
    // own origin, so a trace drawn at absolute coordinates would orbit the frame origin.
    const group = ctx.createGroup(0, cx, cy);
    ctx.add(drawPolyline(ctx.pixi, buildScribblePath(ctx.decor.scribbleSeed, 199, 0, 0, radius, 1), ctx.palette.paper, 1.2, 0.4), {
        delay: 0.3,
        span: 0.6,
        drift: true,
    }, group);
};
