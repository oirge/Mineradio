import type { TemperaCompositionContext } from '../temperaCompositionContext';
import { rectPolygon } from '../temperaHatch';
import { rotatePolygon } from '../temperaCurves';
import { drawPolygonFillWithHoles, drawPolygonOutline } from '../temperaShapes';

// src/components/visualizer/tempera/compositions/temperaCutout.ts
// Shared plumbing for the three families that punch holes through the tone field. A hole is
// genuinely transparent - the Pixi canvas runs on `backgroundAlpha: 0` - so it shows the
// shell's live background layer, veiled only by the scene's paper wash (which is built per
// paragraph and cannot be cut per shot).
//
// One rule governs every cutout composition: **the lyric never sits over a hole.** The
// inversion filter reads the Pixi render target, and the DOM background lives outside WebGL,
// so over a hole the filter sees only the pale wash and picks ink - which then has to survive
// on top of whatever the background happens to be. Keep the type on solid tone; the hole is
// the picture, not the page.

/** The full-bleed rectangle every composition starts from. */
export const fieldPolygon = (ctx: TemperaCompositionContext): number[] => rectPolygon(
    -ctx.bleed,
    -ctx.bleed,
    ctx.width + ctx.bleed * 2,
    ctx.height + ctx.bleed * 2,
);

interface CutFieldOptions {
    alpha?: number;
    delay?: number;
    span?: number;
}

/** Full-bleed tone with `holes` punched through it. Hole outlines are separate nodes. */
export const addCutField = (
    ctx: TemperaCompositionContext,
    color: string,
    holes: number[][],
    options: CutFieldOptions = {},
) => {
    ctx.add(
        drawPolygonFillWithHoles(ctx.pixi, fieldPolygon(ctx), holes, color, options.alpha ?? 0.94, ctx.gradient),
        { delay: options.delay ?? 0, span: options.span ?? 0.5 },
    );
};

/**
 * The ink lip around a hole. It is what keeps a cutout reading as a punched plate rather than
 * as a gap in the render, and it gives the inversion filter an edge next to the opening.
 */
export const addHoleLip = (
    ctx: TemperaCompositionContext,
    hole: number[],
    width = 2.4,
    alpha = 0.85,
    delay = 0.1,
) => {
    ctx.add(drawPolygonOutline(ctx.pixi, hole, ctx.palette.ink, width, alpha), { delay, span: 0.5 });
};

/** A rectangle centred on (cx, cy), `length` along `angle` and `width` across it. */
export const axisRect = (
    cx: number,
    cy: number,
    length: number,
    width: number,
    angle: number,
): number[] => rotatePolygon(
    rectPolygon(cx - length / 2, cy - width / 2, length, width),
    cx,
    cy,
    angle,
);

/**
 * The flow angle, pulled halfway back toward its own vertical axis.
 *
 * A channel has to be parallel to the travel or the hand-off stops reading as one continuous
 * corridor - but a channel is also long, so the raw tilt (up to ~14°) walks its ends sideways
 * by around 90px on a 720px frame, which is enough to slide an opening under the type. Half
 * the tilt keeps the direction and halves the walk; the residual mismatch over one hand-off
 * slide is a handful of pixels and invisible.
 */
export const channelAxis = (ctx: TemperaCompositionContext) => {
    const axis = (Math.sin(ctx.flowAngle) >= 0 ? 1 : -1) * Math.PI / 2;
    return axis + (ctx.flowAngle - axis) * 0.5;
};

/**
 * Unit vector across the channel axis, always pointing into the +x half of the frame.
 *
 * Flow is vertical-dominant but points up in some shots and down in others, so the raw
 * perpendicular flips sides between shots. Layout regions are fixed data, so a channel offset
 * built on the raw perpendicular would sometimes land under the type. Normalising the sign
 * keeps "offset by +n" meaning "to the right" in every shot.
 */
export const acrossFlow = (angle: number) => {
    const across = angle + Math.PI / 2;
    const sign = Math.cos(across) >= 0 ? 1 : -1;
    return { x: Math.cos(across) * sign, y: Math.sin(across) * sign };
};

/** Centre of a channel offset sideways from the frame centre by `offset` across the axis. */
export const acrossPoint = (ctx: TemperaCompositionContext, offset: number) => {
    const across = acrossFlow(channelAxis(ctx));
    return { x: ctx.width / 2 + across.x * offset, y: ctx.height / 2 + across.y * offset };
};

/** A point stepped `distance` along the axis from the frame centre, offset `offset` across it. */
export const flowPoint = (ctx: TemperaCompositionContext, distance: number, offset: number) => {
    const base = acrossPoint(ctx, offset);
    const angle = channelAxis(ctx);
    return {
        x: base.x + Math.cos(angle) * distance,
        y: base.y + Math.sin(angle) * distance,
    };
};

/** How far a shape must run to leave the frame on both ends whatever the flow angle. */
export const flowSpan = (ctx: TemperaCompositionContext) => Math.hypot(ctx.width, ctx.height) * 1.6;
