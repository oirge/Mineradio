import type { TemperaCompositionContext, TemperaCompositionDrawer } from '../temperaCompositionContext';
import type { TemperaShotKind } from '../types';
import { temperaHash01 } from '../temperaRandom';
import { buildHatchSpec, rectPolygon } from '../temperaHatch';
import { drawHatchFill, drawPolygonFill } from '../temperaShapes';

// src/components/visualizer/tempera/compositions/temperaSplitCompositions.ts
// Compositions that cut the frame into flat tone panels. These are the ones the inversion
// filter reacts to most strongly: a glyph straddling a panel edge flips colour mid-stroke.
type Panel = { polygon: number[]; tone: string; enterDX: number; enterDY: number };

// Lays panels in with a stagger and drops a hatch pass over one of them, so the split never
// reads as flat vector art.
const addPanels = (ctx: TemperaCompositionContext, panels: Panel[], hatchIndex: number) => {
    const hatch = buildHatchSpec(ctx.seed, 5);
    panels.forEach((panel, index) => {
        ctx.add(drawPolygonFill(ctx.pixi, panel.polygon, panel.tone, 0.96, ctx.gradient), {
            delay: index * 0.05,
            span: 0.5,
            enterDX: panel.enterDX,
            enterDY: panel.enterDY,
        });
        if (index !== hatchIndex) return;
        ctx.add(drawHatchFill(ctx.pixi, panel.polygon, hatch, ctx.palette.tone4, 0.5), {
            delay: index * 0.05 + 0.06,
            span: 0.5,
            grow: true,
        });
    });
};

const addSeam = (ctx: TemperaCompositionContext, polygon: number[], delay: number) => {
    ctx.add(drawPolygonFill(ctx.pixi, polygon, ctx.palette.ink, 0.85, ctx.gradient), { delay, span: 0.5 });
};

const duoSplit: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const horizontal = temperaHash01(ctx.seed, 1, 3) > 0.5;
    addPanels(ctx, horizontal
        ? [
            { polygon: rectPolygon(-bleed, -bleed, width + bleed * 2, height * 0.52 + bleed), tone: palette.tone1, enterDX: 0, enterDY: -height * 0.55 },
            { polygon: rectPolygon(-bleed, height * 0.52, width + bleed * 2, height * 0.48 + bleed), tone: palette.tone3, enterDX: 0, enterDY: height * 0.55 },
        ]
        : [
            { polygon: rectPolygon(-bleed, -bleed, width * 0.5 + bleed, height + bleed * 2), tone: palette.tone1, enterDX: -width * 0.5, enterDY: 0 },
            { polygon: rectPolygon(width * 0.5, -bleed, width * 0.5 + bleed, height + bleed * 2), tone: palette.tone3, enterDX: width * 0.5, enterDY: 0 },
        ], 0);
    addSeam(ctx, horizontal
        ? rectPolygon(-bleed, height * 0.52 - 1.5, width + bleed * 2, 3)
        : rectPolygon(width * 0.5 - 1.5, -bleed, 3, height + bleed * 2), 0.16);
};

// Four tone panels meeting under the type. Each quadrant arrives from its own corner.
const quadSplit: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const splitX = width * (0.42 + temperaHash01(ctx.seed, 2, 7) * 0.16);
    const splitY = height * (0.42 + temperaHash01(ctx.seed, 3, 11) * 0.16);
    addPanels(ctx, [
        { polygon: rectPolygon(-bleed, -bleed, splitX + bleed, splitY + bleed), tone: palette.tone1, enterDX: -width * 0.3, enterDY: -height * 0.3 },
        { polygon: rectPolygon(splitX, -bleed, width - splitX + bleed, splitY + bleed), tone: palette.tone4, enterDX: width * 0.3, enterDY: -height * 0.3 },
        { polygon: rectPolygon(-bleed, splitY, splitX + bleed, height - splitY + bleed), tone: palette.tone3, enterDX: -width * 0.3, enterDY: height * 0.3 },
        { polygon: rectPolygon(splitX, splitY, width - splitX + bleed, height - splitY + bleed), tone: palette.tone2, enterDX: width * 0.3, enterDY: height * 0.3 },
    ], 3);
    addSeam(ctx, rectPolygon(splitX - 1.5, -bleed, 3, height + bleed * 2), 0.2);
    addSeam(ctx, rectPolygon(-bleed, splitY - 1.5, width + bleed * 2, 3), 0.24);
};

const triColumn: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const edge = width * (0.26 + temperaHash01(ctx.seed, 4, 13) * 0.06);
    addPanels(ctx, [
        { polygon: rectPolygon(-bleed, -bleed, edge + bleed, height + bleed * 2), tone: palette.tone1, enterDX: -width * 0.25, enterDY: 0 },
        { polygon: rectPolygon(edge, -bleed, width - edge * 2, height + bleed * 2), tone: palette.tone4, enterDX: 0, enterDY: -height * 0.3 },
        { polygon: rectPolygon(width - edge, -bleed, edge + bleed, height + bleed * 2), tone: palette.tone1, enterDX: width * 0.25, enterDY: 0 },
    ], 0);
};

const thirdsStack: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const band = height * 0.34;
    addPanels(ctx, [
        { polygon: rectPolygon(-bleed, -bleed, width + bleed * 2, band + bleed), tone: palette.tone2, enterDX: -width * 0.2, enterDY: 0 },
        { polygon: rectPolygon(-bleed, band, width + bleed * 2, band), tone: palette.tone4, enterDX: width * 0.2, enterDY: 0 },
        { polygon: rectPolygon(-bleed, band * 2, width + bleed * 2, height - band * 2 + bleed), tone: palette.tone1, enterDX: -width * 0.2, enterDY: 0 },
    ], 0);
};

// Diagonally opposite quadrants share a tone, so the type alternates as it crosses the centre.
const checkerQuad: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const splitX = width * 0.5;
    const splitY = height * 0.5;
    addPanels(ctx, [
        { polygon: rectPolygon(-bleed, -bleed, splitX + bleed, splitY + bleed), tone: palette.tone4, enterDX: 0, enterDY: -height * 0.35 },
        { polygon: rectPolygon(splitX, -bleed, width - splitX + bleed, splitY + bleed), tone: palette.tone1, enterDX: 0, enterDY: -height * 0.35 },
        { polygon: rectPolygon(-bleed, splitY, splitX + bleed, height - splitY + bleed), tone: palette.tone1, enterDX: 0, enterDY: height * 0.35 },
        { polygon: rectPolygon(splitX, splitY, width - splitX + bleed, height - splitY + bleed), tone: palette.tone4, enterDX: 0, enterDY: height * 0.35 },
    ], 1);
};

const cornerWedge: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const fromLeft = temperaHash01(ctx.seed, 5, 17) > 0.5;
    const apexX = fromLeft ? width * 0.78 : width * 0.22;
    addPanels(ctx, [
        { polygon: rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), tone: palette.tone1, enterDX: 0, enterDY: 0 },
        {
            polygon: fromLeft
                ? [-bleed, -bleed, apexX, -bleed, -bleed, height + bleed]
                : [width + bleed, -bleed, apexX, -bleed, width + bleed, height + bleed],
            tone: palette.tone4,
            enterDX: fromLeft ? -width * 0.4 : width * 0.4,
            enterDY: 0,
        },
    ], 1);
};

const diagonalHalves: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const lean = height * (0.2 + temperaHash01(ctx.seed, 6, 19) * 0.3);
    addPanels(ctx, [
        { polygon: [-bleed, -bleed, width + bleed, -bleed, width + bleed, lean, -bleed, height - lean], tone: palette.tone2, enterDX: 0, enterDY: -height * 0.4 },
        { polygon: [-bleed, height - lean, width + bleed, lean, width + bleed, height + bleed, -bleed, height + bleed], tone: palette.tone4, enterDX: 0, enterDY: height * 0.4 },
    ], 1);
};

// Two heavy axes cutting the frame into quarters; the type sits on the crossing.
const crossAxis: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const barX = width * 0.11;
    const barY = height * 0.13;
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone1, 0.9, ctx.gradient), { span: 0.5 });
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon((width - barX) / 2, -bleed, barX, height + bleed * 2), palette.tone4, 0.95),
        { delay: 0.06, span: 0.5, enterDY: -height * 0.5 });
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, (height - barY) / 2, width + bleed * 2, barY), palette.tone3, 0.95),
        { delay: 0.12, span: 0.5, enterDX: width * 0.5 });
};

// Two halves shoved past each other; the step where they miss is the composition.
const offsetHalves: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const step = height * (0.06 + temperaHash01(ctx.seed, 7, 23) * 0.06);
    const seam = width * 0.48;
    addPanels(ctx, [
        { polygon: rectPolygon(-bleed, -bleed, seam + bleed, height * 0.5 + step + bleed), tone: palette.tone1, enterDX: -width * 0.3, enterDY: 0 },
        { polygon: rectPolygon(seam, -bleed, width - seam + bleed, height * 0.5 - step + bleed), tone: palette.tone3, enterDX: width * 0.3, enterDY: 0 },
        { polygon: rectPolygon(-bleed, height * 0.5 + step, seam + bleed, height * 0.5 - step + bleed), tone: palette.tone4, enterDX: -width * 0.2, enterDY: 0 },
        { polygon: rectPolygon(seam, height * 0.5 - step, width - seam + bleed, height * 0.5 + step + bleed), tone: palette.tone2, enterDX: width * 0.2, enterDY: 0 },
    ], 2);
};

// Four blocks marching down the diagonal, each one a step darker.
const stairBlocks: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const tones = [palette.tone1, palette.tone2, palette.tone3, palette.tone4];
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone1, 0.9, ctx.gradient), { span: 0.5 });
    tones.forEach((tone, index) => {
        const left = width * (0.06 + index * 0.2);
        const top = height * (0.1 + index * 0.16);
        ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(left, top, width * 0.3, height * 0.34), tone, 0.94, ctx.gradient),
            { delay: index * 0.06, span: 0.5, enterDX: -width * 0.2, enterDY: height * 0.12 });
    });
};

// Two heavy masses leave a bright vertical slot; the lyric stands in the slot.
const pillarGap: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const gap = width * (0.26 + temperaHash01(ctx.seed, 8, 29) * 0.08);
    const side = (width - gap) / 2;
    addPanels(ctx, [
        { polygon: rectPolygon(-bleed, -bleed, side + bleed, height + bleed * 2), tone: palette.tone4, enterDX: -width * 0.3, enterDY: 0 },
        { polygon: rectPolygon(width - side, -bleed, side + bleed, height + bleed * 2), tone: palette.tone4, enterDX: width * 0.3, enterDY: 0 },
    ], 1);
};

// Quadrants of deliberately unequal weight, split off-centre in both axes.
const cornerQuad: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const splitX = width * (0.6 + temperaHash01(ctx.seed, 9, 31) * 0.12);
    const splitY = height * (0.62 + temperaHash01(ctx.seed, 10, 37) * 0.1);
    addPanels(ctx, [
        { polygon: rectPolygon(-bleed, -bleed, splitX + bleed, splitY + bleed), tone: palette.tone2, enterDX: 0, enterDY: -height * 0.25 },
        { polygon: rectPolygon(splitX, -bleed, width - splitX + bleed, splitY + bleed), tone: palette.tone4, enterDX: width * 0.25, enterDY: 0 },
        { polygon: rectPolygon(-bleed, splitY, splitX + bleed, height - splitY + bleed), tone: palette.tone1, enterDX: -width * 0.25, enterDY: 0 },
        { polygon: rectPolygon(splitX, splitY, width - splitX + bleed, height - splitY + bleed), tone: palette.tone3, enterDX: 0, enterDY: height * 0.25 },
    ], 0);
};

// A stack of thin alternating slivers filling one side of the frame.
const sliverStack: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const fromLeft = temperaHash01(ctx.seed, 11, 41) > 0.5;
    const slabWidth = width * 0.46;
    const left = fromLeft ? -bleed : width - slabWidth;
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone1, 0.9, ctx.gradient), { span: 0.5 });
    const count = 9;
    const sliver = (height + bleed * 2) / count;
    for (let index = 0; index < count; index += 1) {
        if (index % 2 === 1) continue;
        ctx.add(drawPolygonFill(
            ctx.pixi,
            rectPolygon(left, -bleed + sliver * index, slabWidth + bleed, sliver),
            palette.tone4,
            0.92,
            ctx.gradient,
        ), { delay: index * 0.02, span: 0.5, enterDX: (fromLeft ? -1 : 1) * width * 0.2 });
    }
};

export const TEMPERA_SPLIT_COMPOSITIONS: Partial<Record<TemperaShotKind, TemperaCompositionDrawer>> = {
    'duo-split': duoSplit,
    'quad-split': quadSplit,
    'tri-column': triColumn,
    'thirds-stack': thirdsStack,
    'checker-quad': checkerQuad,
    'corner-wedge': cornerWedge,
    'diagonal-halves': diagonalHalves,
    'cross-axis': crossAxis,
    'offset-halves': offsetHalves,
    'stair-blocks': stairBlocks,
    'pillar-gap': pillarGap,
    'corner-quad': cornerQuad,
    'sliver-stack': sliverStack,
};
