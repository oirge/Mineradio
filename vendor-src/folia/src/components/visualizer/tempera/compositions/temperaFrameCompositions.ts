import type { TemperaCompositionDrawer } from '../temperaCompositionContext';
import type { TemperaShotKind } from '../types';
import { temperaHash01 } from '../temperaRandom';
import {
    buildCrossRow,
    buildDotRow,
    buildHatchSpec,
    circlePolygon,
    diamondPolygon,
    rectPolygon,
} from '../temperaHatch';
import {
    drawConcentricDiamonds,
    drawCrossMarks,
    drawHatchFill,
    drawLines,
    drawPolygonFill,
    drawPolygonOutline,
    drawSquareMarks,
} from '../temperaShapes';

// src/components/visualizer/tempera/compositions/temperaFrameCompositions.ts
// Outlined windows. These hold the type in a quiet pocket and let the surrounding tone do the
// work, so they are what a paragraph cuts to when it needs to breathe.
const frameWindow: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const cx = width / 2;
    const cy = height / 2;
    const rx = width * 0.42;
    const ry = height * 0.44;
    ctx.add(drawHatchFill(ctx.pixi, diamondPolygon(cx, cy, rx * 0.78, ry * 0.78), buildHatchSpec(ctx.seed, 23, 1.4), palette.tone2, 0.45),
        { grow: true, span: 0.6 });
    ctx.add(drawConcentricDiamonds(ctx.pixi, cx, cy, rx, ry, 3, palette.ink, 0.9),
        { delay: 0.08, enterDY: height * 0.06, span: 0.55 });

    if (!ctx.showDecor) return;
    ctx.add(drawCrossMarks(ctx.pixi, buildCrossRow(ctx.seed, 29, width * 0.08, height * 0.14, 3, width * 0.045, 8), palette.tone4, 1.8, 0.85), { delay: 0.22 });
    ctx.add(drawSquareMarks(ctx.pixi, buildDotRow(ctx.seed, 37, width * 0.92, height * 0.62, 4, height * 0.06, 7), palette.tone4, 0.8), { delay: 0.28 });
};

// Two offset rectangles: the type sits inside one and overlaps the edge of the other.
const doubleFrame: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const offset = width * 0.05;
    const box = rectPolygon(width * 0.16, height * 0.2, width * 0.68, height * 0.6);
    const shifted = rectPolygon(width * 0.16 + offset, height * 0.2 + offset * 0.6, width * 0.68, height * 0.6);
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone1, 0.9, ctx.gradient), { span: 0.5 });
    ctx.add(drawPolygonFill(ctx.pixi, shifted, palette.tone3, 0.8, ctx.gradient), { delay: 0.06, span: 0.55, enterDX: offset * 3 });
    ctx.add(drawHatchFill(ctx.pixi, shifted, buildHatchSpec(ctx.seed, 43), palette.tone4, 0.4), { delay: 0.1, span: 0.55, grow: true });
    ctx.add(drawPolygonOutline(ctx.pixi, box, palette.ink, 3.5, 0.9), { delay: 0.14, span: 0.5, enterDY: -height * 0.08 });
};

const circleWindow: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const radius = Math.min(width, height) * 0.34;
    const circle = circlePolygon(width / 2, height / 2, radius);
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone3, 0.92, ctx.gradient), { span: 0.5 });
    ctx.add(drawHatchFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), buildHatchSpec(ctx.seed, 47), palette.tone4, 0.4),
        { delay: 0.04, span: 0.6, grow: true });
    ctx.add(drawPolygonFill(ctx.pixi, circle, palette.paper, 0.95, ctx.gradient), { delay: 0.08, span: 0.55 });
    ctx.add(drawPolygonOutline(ctx.pixi, circle, palette.ink, 3, 0.9), { delay: 0.14, span: 0.5 });
    if (!ctx.showDecor) return;
    ctx.add(drawPolygonOutline(ctx.pixi, circlePolygon(width / 2, height / 2, radius * 1.12), palette.ink, 1.2, 0.55), { delay: 0.2, drift: true });
};

// A stepped bracket down one side: reads as a margin rule rather than a closed box.
const ladderFrame: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const left = width * 0.14;
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone1, 0.9, ctx.gradient), { span: 0.5 });
    const steps = 5;
    for (let index = 0; index < steps; index += 1) {
        const y = height * (0.18 + index * 0.14);
        const run = width * (0.06 + index * 0.03);
        ctx.add(drawLines(ctx.pixi, [
            { x1: left, y1: y, x2: left + run, y2: y },
            { x1: left, y1: y, x2: left, y2: y + height * 0.14 },
        ], palette.tone4, index % 2 === 0 ? 3 : 1.4, 0.85), { delay: index * 0.05, span: 0.5, enterDX: -width * 0.1 });
    }
    ctx.add(drawLines(ctx.pixi, [{ x1: width * 0.9, y1: -bleed, x2: width * 0.9, y2: height + bleed }], palette.tone4, 1.4, 0.6),
        { delay: 0.28, span: 0.5, enterDY: height * 0.2 });
};

const cornerBrackets: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const inset = Math.min(width, height) * 0.12;
    const arm = Math.min(width, height) * 0.16;
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone2, 0.9, ctx.gradient), { span: 0.5 });
    const corners: Array<[number, number, number, number]> = [
        [inset, inset, 1, 1],
        [width - inset, inset, -1, 1],
        [inset, height - inset, 1, -1],
        [width - inset, height - inset, -1, -1],
    ];
    corners.forEach(([x, y, sx, sy], index) => {
        ctx.add(drawLines(ctx.pixi, [
            { x1: x, y1: y, x2: x + sx * arm, y2: y },
            { x1: x, y1: y, x2: x, y2: y + sy * arm },
        ], palette.ink, 3.5, 0.9), { delay: index * 0.05, span: 0.5, enterDX: sx * width * 0.06, enterDY: sy * height * 0.06 });
    });
    if (!ctx.showDecor) return;
    const dotted = temperaHash01(ctx.seed, 2, 53) > 0.5;
    ctx.add(dotted
        ? drawSquareMarks(ctx.pixi, buildDotRow(ctx.seed, 59, width * 0.5, height * 0.16, 3, width * 0.03, 6, 0), palette.tone4, 0.8)
        : drawCrossMarks(ctx.pixi, buildCrossRow(ctx.seed, 61, width * 0.44, height * 0.84, 3, width * 0.04, 7), palette.tone4, 1.8, 0.8),
    { delay: 0.24, drift: true });
};

// One inset rectangle, faintly filled: the quietest way to hold a phrase.
const insetBox: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const box = rectPolygon(width * 0.14, height * 0.2, width * 0.72, height * 0.6);
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone1, 0.9, ctx.gradient), { span: 0.5 });
    ctx.add(drawPolygonFill(ctx.pixi, box, palette.tone3, 0.55, ctx.gradient), { delay: 0.05, span: 0.55, enterDY: height * 0.06 });
    ctx.add(drawPolygonOutline(ctx.pixi, box, palette.ink, 2.4, 0.85), { delay: 0.1, span: 0.5 });
};

// Two facing brackets instead of a closed box; the phrase sits between the jaws.
const bracketPair: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const inset = width * 0.16;
    const arm = width * 0.09;
    const top = height * 0.26;
    const bottom = height * 0.74;
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone2, 0.9, ctx.gradient), { span: 0.5 });
    ([1, -1] as const).forEach((side, index) => {
        const x = side === 1 ? inset : width - inset;
        ctx.add(drawLines(ctx.pixi, [
            { x1: x, y1: top, x2: x + side * arm, y2: top },
            { x1: x, y1: top, x2: x, y2: bottom },
            { x1: x, y1: bottom, x2: x + side * arm, y2: bottom },
        ], palette.ink, 4, 0.9), { delay: index * 0.07, span: 0.5, enterDX: side * width * 0.08 });
    });
};

// A rounded-top window: half disc riding a rectangle.
const archWindow: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const radius = width * 0.24;
    const cx = width / 2;
    const shoulder = height * 0.42;
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone3, 0.92, ctx.gradient), { span: 0.5 });
    const arch = circlePolygon(cx, shoulder, radius, 48);
    const body = rectPolygon(cx - radius, shoulder, radius * 2, height * 0.4);
    ctx.add(drawPolygonFill(ctx.pixi, arch, palette.paper, 0.95, ctx.gradient), { delay: 0.05, span: 0.55, enterDY: -height * 0.08 });
    ctx.add(drawPolygonFill(ctx.pixi, body, palette.paper, 0.95, ctx.gradient), { delay: 0.05, span: 0.55, enterDY: height * 0.08 });
    ctx.add(drawPolygonOutline(ctx.pixi, arch, palette.ink, 2.4, 0.8), { delay: 0.12, span: 0.5 });
    ctx.add(drawPolygonOutline(ctx.pixi, body, palette.ink, 2.4, 0.8), { delay: 0.12, span: 0.5 });
};

// A hairline 3x3 lattice; the lyric runs across the middle row.
const gridCells: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone1, 0.9, ctx.gradient), { span: 0.5 });
    const left = width * 0.12;
    const top = height * 0.18;
    const cellWidth = (width * 0.76) / 3;
    const cellHeight = (height * 0.64) / 3;
    for (let row = 0; row < 3; row += 1) {
        for (let column = 0; column < 3; column += 1) {
            const cell = rectPolygon(left + cellWidth * column, top + cellHeight * row, cellWidth, cellHeight);
            const index = row * 3 + column;
            if (row === 1 && column === 1) {
                ctx.add(drawPolygonFill(ctx.pixi, cell, palette.tone4, 0.75, ctx.gradient), { delay: index * 0.03, span: 0.5 });
            }
            ctx.add(drawPolygonOutline(ctx.pixi, cell, palette.tone4, 1.2, 0.6), { delay: index * 0.03, span: 0.5 });
        }
    }
};

// Disc over a narrow shaft: the silhouette reads as a keyhole cut in the tone.
const keyhole: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const radius = Math.min(width, height) * 0.19;
    const cx = width / 2;
    const cy = height * 0.36;
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), palette.tone4, 0.94, ctx.gradient), { span: 0.5 });
    const head = circlePolygon(cx, cy, radius, 48);
    const shaft = rectPolygon(cx - radius * 0.55, cy, radius * 1.1, height * 0.46);
    ctx.add(drawPolygonFill(ctx.pixi, head, palette.paper, 0.96, ctx.gradient), { delay: 0.05, span: 0.55 });
    ctx.add(drawPolygonFill(ctx.pixi, shaft, palette.paper, 0.96, ctx.gradient), { delay: 0.08, span: 0.55, enterDY: height * 0.1 });
    ctx.add(drawPolygonOutline(ctx.pixi, head, palette.ink, 2, 0.7), { delay: 0.14, span: 0.5 });
};

export const TEMPERA_FRAME_COMPOSITIONS: Partial<Record<TemperaShotKind, TemperaCompositionDrawer>> = {
    'frame-window': frameWindow,
    'double-frame': doubleFrame,
    'circle-window': circleWindow,
    'ladder-frame': ladderFrame,
    'corner-brackets': cornerBrackets,
    'inset-box': insetBox,
    'bracket-pair': bracketPair,
    'arch-window': archWindow,
    'grid-cells': gridCells,
    'keyhole': keyhole,
};
