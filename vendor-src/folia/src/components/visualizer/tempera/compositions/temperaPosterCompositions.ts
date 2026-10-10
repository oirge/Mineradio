import type { TemperaCompositionDrawer } from '../temperaCompositionContext';
import type { TemperaShotKind } from '../types';
import { temperaHash01 } from '../temperaRandom';
import { buildHatchSpec, buildWavyPath, circlePolygon, diamondPolygon, rectPolygon } from '../temperaHatch';
import {
    drawHatchFill,
    drawPolygonFill,
    drawPolygonOutline,
    drawPolyline,
} from '../temperaShapes';

// src/components/visualizer/tempera/compositions/temperaPosterCompositions.ts
// Big tilted masses. These are the loud compositions: one dominant solid shape the type has to
// fight, which is exactly what makes the inversion filter visible.
const posterPanel: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const poster = ctx.createGroup(-0.06, width / 2, height / 2);
    const solid = diamondPolygon(-width * 0.12, 0, width * 0.42, height * 0.66);
    const hatched = diamondPolygon(width * 0.2, -height * 0.06, width * 0.3, height * 0.48);
    ctx.add(drawPolygonFill(ctx.pixi, solid, palette.ink, 0.92, ctx.gradient), { enterDX: -width * 0.6, span: 0.55 }, poster);
    ctx.add(drawHatchFill(ctx.pixi, hatched, buildHatchSpec(ctx.seed, 41), palette.tone4, 0.7), { delay: 0.08, grow: true, span: 0.55 }, poster);
    ctx.add(drawPolygonOutline(ctx.pixi, hatched, palette.ink, 2, 0.8), { delay: 0.12, span: 0.55 }, poster);
    ctx.add(drawPolyline(
        ctx.pixi,
        buildWavyPath(ctx.seed, 43, -width * 0.6, width * 0.6, height * 0.42, height * 0.02),
        palette.tone4,
        2,
        0.7,
    ), { delay: 0.2, enterDY: height * 0.1 }, poster);
};

// Three solids marching off the frame at descending size; the type rides the largest one.
const diamondStack: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone1, 0.9, ctx.gradient), { span: 0.5 });
    const tones = [palette.ink, palette.tone4, palette.tone3];
    tones.forEach((tone, index) => {
        const scale = 1 - index * 0.28;
        const cx = width * (0.34 + index * 0.24);
        const cy = height * (0.52 - index * 0.14);
        ctx.add(drawPolygonFill(ctx.pixi, diamondPolygon(cx, cy, width * 0.3 * scale, height * 0.46 * scale), tone, 0.93, ctx.gradient),
            { delay: index * 0.07, span: 0.55, enterDX: width * 0.25, enterDY: -height * 0.12 });
    });
};

// One broad slash across the frame with the counter-hatch running the other way.
const slashPoster: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const lean = height * 0.34;
    const band = [
        -bleed, height * 0.24 + lean,
        width + bleed, height * 0.24 - lean,
        width + bleed, height * 0.72 - lean,
        -bleed, height * 0.72 + lean,
    ];
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone1, 0.9, ctx.gradient), { span: 0.5 });
    ctx.add(drawPolygonFill(ctx.pixi, band, palette.tone4, 0.94, ctx.gradient), { delay: 0.05, span: 0.55, enterDX: -width * 0.4 });
    ctx.add(drawHatchFill(ctx.pixi, band, { ...buildHatchSpec(ctx.seed, 67), angle: Math.PI / 3 }, palette.paper, 0.3),
        { delay: 0.1, span: 0.55, grow: true });
    ctx.add(drawPolygonOutline(ctx.pixi, band, palette.ink, 2.2, 0.8), { delay: 0.14, span: 0.5 });
};

// A chevron pointing across the frame, echoing the roof-line motif of the reference art.
const arrowWedge: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const apex = height * (0.24 + temperaHash01(ctx.seed, 3, 71) * 0.14);
    const thickness = height * 0.2;
    const chevron = [
        -bleed, height + bleed,
        width * 0.5, apex,
        width + bleed, height + bleed,
        width + bleed, height + bleed,
        width * 0.5, apex + thickness,
        -bleed, height + bleed,
    ];
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone1, 0.9, ctx.gradient), { span: 0.5 });
    ctx.add(drawPolygonFill(ctx.pixi, [-bleed, height + bleed, width * 0.5, apex, width + bleed, height + bleed], palette.tone4, 0.94, ctx.gradient),
        { delay: 0.05, span: 0.55, enterDY: height * 0.3 });
    ctx.add(drawHatchFill(ctx.pixi, chevron, { ...buildHatchSpec(ctx.seed, 73), angle: -Math.PI / 4 }, palette.paper, 0.35),
        { delay: 0.1, span: 0.55, grow: true });
    ctx.add(drawPolyline(ctx.pixi, [-bleed, height * 0.9, width * 0.5, apex - thickness * 0.4, width + bleed, height * 0.9], palette.ink, 2, 0.7),
        { delay: 0.16, span: 0.5, enterDY: -height * 0.1 });
};

// A single mass pushed in from one edge, leaving the type on the exposed paper beside it.
const edgeBleed: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const fromLeft = temperaHash01(ctx.seed, 4, 79) > 0.5;
    const cover = width * 0.42;
    const mass = fromLeft
        ? rectPolygon(-bleed, -bleed, cover + bleed, height + bleed * 2)
        : rectPolygon(width - cover, -bleed, cover + bleed, height + bleed * 2);
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone1, 0.9, ctx.gradient), { span: 0.5 });
    ctx.add(drawPolygonFill(ctx.pixi, mass, palette.ink, 0.93, ctx.gradient), { delay: 0.05, span: 0.55, enterDX: (fromLeft ? -1 : 1) * width * 0.4 });
    ctx.add(drawHatchFill(ctx.pixi, mass, buildHatchSpec(ctx.seed, 83), palette.paper, 0.22), { delay: 0.12, span: 0.55, grow: true });
};

// One triangle anchored on an edge, filling most of the frame.
const triangleMass: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const fromLeft = temperaHash01(ctx.seed, 91, 89) > 0.5;
    const apexX = fromLeft ? width * 1.02 : -width * 0.02;
    const triangle = [
        fromLeft ? -bleed : width + bleed, -bleed,
        fromLeft ? -bleed : width + bleed, height + bleed,
        apexX, height * (0.3 + temperaHash01(ctx.seed, 93, 97) * 0.3),
    ];
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone1, 0.9, ctx.gradient), { span: 0.5 });
    ctx.add(drawPolygonFill(ctx.pixi, triangle, palette.tone4, 0.94, ctx.gradient),
        { delay: 0.05, span: 0.55, enterDX: (fromLeft ? -1 : 1) * width * 0.35 });
    ctx.add(drawHatchFill(ctx.pixi, triangle, buildHatchSpec(ctx.seed, 101), palette.paper, 0.24),
        { delay: 0.12, span: 0.55, grow: true });
};

// Two tilted ribbons crossing; where they overlap the tone doubles up.
const ribbonCross: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const half = height * 0.14;
    const lean = height * 0.3;
    const ribbon = (sign: number) => [
        -bleed, height / 2 + sign * lean - half,
        width + bleed, height / 2 - sign * lean - half,
        width + bleed, height / 2 - sign * lean + half,
        -bleed, height / 2 + sign * lean + half,
    ];
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone1, 0.9, ctx.gradient), { span: 0.5 });
    ctx.add(drawPolygonFill(ctx.pixi, ribbon(1), palette.tone3, 0.8, ctx.gradient), { delay: 0.05, span: 0.55, enterDX: -width * 0.3 });
    ctx.add(drawPolygonFill(ctx.pixi, ribbon(-1), palette.tone4, 0.8, ctx.gradient), { delay: 0.11, span: 0.55, enterDX: width * 0.3 });
};

// A disc so large that only its shoulder is in frame.
const halfDisc: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const fromRight = temperaHash01(ctx.seed, 103, 107) > 0.5;
    const radius = Math.hypot(width, height) * 0.62;
    const disc = circlePolygon(fromRight ? width + radius * 0.55 : -radius * 0.55, height * 0.5, radius, 64);
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone1, 0.9, ctx.gradient), { span: 0.5 });
    ctx.add(drawPolygonFill(ctx.pixi, disc, palette.tone4, 0.94, ctx.gradient),
        { delay: 0.05, span: 0.55, enterDX: (fromRight ? 1 : -1) * width * 0.3 });
    ctx.add(drawPolygonOutline(ctx.pixi, disc, palette.ink, 2, 0.6), { delay: 0.12, span: 0.5 });
};

// Three rotated slabs stacked off-register, like sheets dropped on a table.
const stackedSlabs: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone1, 0.9, ctx.gradient), { span: 0.5 });
    const tones = [palette.tone2, palette.tone3, palette.tone4];
    tones.forEach((tone, index) => {
        const group = ctx.createGroup(-0.09 + index * 0.08, width / 2, height / 2);
        const slab = rectPolygon(-width * (0.42 - index * 0.05), -height * (0.3 - index * 0.03), width * (0.84 - index * 0.1), height * (0.6 - index * 0.06));
        ctx.add(drawPolygonFill(ctx.pixi, slab, tone, 0.93, ctx.gradient),
            { delay: index * 0.07, span: 0.55, enterDX: width * 0.2, enterDY: height * 0.12 }, group);
    });
};

// Two wedges biting in from opposite edges, leaving an hourglass of paper.
const wedgePair: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const waist = width * (0.2 + temperaHash01(ctx.seed, 109, 113) * 0.1);
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone1, 0.9, ctx.gradient), { span: 0.5 });
    ctx.add(drawPolygonFill(ctx.pixi, [
        -bleed, -bleed, (width - waist) / 2, height / 2, -bleed, height + bleed,
    ], palette.tone4, 0.94, ctx.gradient), { delay: 0.05, span: 0.55, enterDX: -width * 0.25 });
    ctx.add(drawPolygonFill(ctx.pixi, [
        width + bleed, -bleed, (width + waist) / 2, height / 2, width + bleed, height + bleed,
    ], palette.tone4, 0.94, ctx.gradient), { delay: 0.11, span: 0.55, enterDX: width * 0.25 });
};

export const TEMPERA_POSTER_COMPOSITIONS: Partial<Record<TemperaShotKind, TemperaCompositionDrawer>> = {
    'poster-panel': posterPanel,
    'diamond-stack': diamondStack,
    'slash-poster': slashPoster,
    'arrow-wedge': arrowWedge,
    'edge-bleed': edgeBleed,
    'triangle-mass': triangleMass,
    'ribbon-cross': ribbonCross,
    'half-disc': halfDisc,
    'stacked-slabs': stackedSlabs,
    'wedge-pair': wedgePair,
};
