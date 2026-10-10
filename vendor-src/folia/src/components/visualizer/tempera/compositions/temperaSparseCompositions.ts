import type { TemperaCompositionDrawer } from '../temperaCompositionContext';
import type { TemperaShotKind } from '../types';
import { temperaHash01 } from '../temperaRandom';
import { buildDotGrid, buildScribblePath, buildWavyPath, circlePolygon, rectPolygon } from '../temperaHatch';
import {
    drawLines,
    drawPolygonFill,
    drawPolygonOutline,
    drawPolyline,
    drawSquareMarks,
} from '../temperaShapes';

// src/components/visualizer/tempera/compositions/temperaSparseCompositions.ts
// Near-empty compositions for breathing paragraphs: hairlines, dot fields and hand-drawn
// strokes, with almost no tone mass so the type reads as a whisper.
const quietLine: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const gridWidth = width * 0.7;
    const gridX = (width - gridWidth) / 2;
    [0.38, 0.5, 0.62].forEach((ratio, index) => {
        ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(gridX, height * ratio, gridWidth, 1), palette.line, 1, ctx.gradient),
            { delay: index * 0.08, span: 0.6, enterDX: (index % 2 === 0 ? -1 : 1) * width * 0.2 });
    });
    if (!ctx.showDecor) return;
    ctx.add(drawPolyline(
        ctx.pixi,
        buildScribblePath(ctx.decor.scribbleSeed, 47, width * 0.2, height * 0.26, Math.min(width, height) * 0.09, 2),
        palette.tone4,
        1.6,
        0.7,
    ), { delay: 0.24, span: 0.6 });
    // Grass tufts: short strokes fanned from one baseline point.
    const tuftX = width * 0.82;
    const tuftY = height * 0.74;
    ctx.add(drawLines(ctx.pixi, Array.from({ length: 6 }, (_, index) => {
        const lean = (temperaHash01(ctx.decor.scribbleSeed, index, 59) - 0.5) * 34;
        return { x1: tuftX + index * 7, y1: tuftY, x2: tuftX + index * 7 + lean, y2: tuftY - 24 - index * 3 };
    }), palette.tone4, 1.4, 0.7), { delay: 0.3, span: 0.55 });
};

// A dot lattice that thins out toward one edge; the type floats in the sparse half.
const starfieldDots: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const spacing = Math.max(24, Math.sqrt((width * height) / 900));
    const marks = buildDotGrid(width + bleed, height + bleed, spacing, 2.6);
    const dense = marks.filter(mark => mark.y > height * 0.45);
    const sparse = marks.filter(mark => mark.y <= height * 0.45 && (mark.x + mark.y) % 3 < 1);
    ctx.add(drawSquareMarks(ctx.pixi, dense, palette.tone4, 0.45), { span: 0.6, enterDY: height * 0.2 });
    ctx.add(drawSquareMarks(ctx.pixi, sparse, palette.tone4, 0.25), { delay: 0.08, span: 0.6, enterDY: -height * 0.15 });
    if (!ctx.showDecor) return;
    ctx.add(drawLines(ctx.pixi, [{ x1: -bleed, y1: height * 0.45, x2: width + bleed, y2: height * 0.45 }], palette.tone4, 1.2, 0.5),
        { delay: 0.2, span: 0.5, enterDX: width * 0.2 });
};

// Concentric wobbling lines, the surface of the water seen from just below it.
const rippleLines: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const count = 7;
    for (let index = 0; index < count; index += 1) {
        const y = height * (0.16 + index * 0.11);
        const amplitude = height * (0.006 + index * 0.004);
        ctx.add(drawPolyline(
            ctx.pixi,
            buildWavyPath(ctx.seed, 89 + index, -bleed, width + bleed, y, amplitude, 26),
            palette.tone4,
            index % 3 === 0 ? 2 : 1.1,
            0.55,
        ), { delay: index * 0.045, span: 0.6, enterDX: (index % 2 === 0 ? -1 : 1) * width * 0.15 });
    }
};

// A full-bleed hairline lattice; the phrase floats on top of it.
const hairGrid: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const columns = 6;
    const rows = 4;
    const vertical = Array.from({ length: columns + 1 }, (_, index) => ({
        x1: (width / columns) * index, y1: -bleed, x2: (width / columns) * index, y2: height + bleed,
    }));
    const horizontal = Array.from({ length: rows + 1 }, (_, index) => ({
        x1: -bleed, y1: (height / rows) * index, x2: width + bleed, y2: (height / rows) * index,
    }));
    ctx.add(drawLines(ctx.pixi, vertical, palette.line, 1, 0.8), { span: 0.6, enterDY: -height * 0.1 });
    ctx.add(drawLines(ctx.pixi, horizontal, palette.line, 1, 0.8), { delay: 0.08, span: 0.6, enterDX: width * 0.1 });
};

// A single heavy rule down one margin with a few register marks beside it.
const marginRule: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const fromLeft = temperaHash01(ctx.seed, 121, 127) > 0.5;
    const x = fromLeft ? width * 0.12 : width * 0.88;
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(x - 3, -bleed, 6, height + bleed * 2), palette.tone4, 0.9, ctx.gradient),
        { span: 0.6, enterDY: height * 0.15 });
    if (!ctx.showDecor) return;
    ctx.add(drawSquareMarks(
        ctx.pixi,
        [0, 1, 2].map(index => ({ x: x + (fromLeft ? 22 : -22), y: height * (0.32 + index * 0.18), size: 7, rotation: 0 })),
        palette.tone4,
        0.8,
    ), { delay: 0.22, drift: true });
};

// Dot lattice thinning out along one diagonal.
const dotDrift: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const spacing = Math.max(22, Math.sqrt((width * height) / 1200));
    const marks = buildDotGrid(width + bleed, height + bleed, spacing, 2.4);
    const span = width + height;
    const near = marks.filter(mark => mark.x + mark.y > span * 0.5);
    const far = marks.filter(mark => mark.x + mark.y <= span * 0.5 && (mark.x + mark.y) % 2 < 1);
    ctx.add(drawSquareMarks(ctx.pixi, near, palette.tone4, 0.5), { span: 0.6, enterDX: width * 0.12 });
    ctx.add(drawSquareMarks(ctx.pixi, far, palette.tone4, 0.24), { delay: 0.08, span: 0.6, enterDX: -width * 0.12 });
};

// Concentric rings centred off frame, so only their arcs cross the picture.
const arcSweep: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const cx = width * (temperaHash01(ctx.seed, 131, 137) > 0.5 ? 1.15 : -0.15);
    const cy = height * 1.05;
    const base = Math.hypot(width, height) * 0.42;
    for (let index = 0; index < 5; index += 1) {
        ctx.add(drawPolygonOutline(
            ctx.pixi,
            circlePolygon(cx, cy, base + index * base * 0.22, 72),
            palette.tone4,
            index % 2 === 0 ? 1.8 : 1,
            0.55,
        ), { delay: index * 0.05, span: 0.6, enterDY: height * 0.08 });
    }
};

// Almost bare paper with one small register mark. The breath before a verse.
const blankPage: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    ctx.add(drawLines(ctx.pixi, [
        { x1: width * 0.18, y1: height * 0.7, x2: width * 0.36, y2: height * 0.7 },
    ], palette.line, 1.4, 0.8), { span: 0.6, enterDX: -width * 0.12 });
    if (!ctx.showDecor) return;
    ctx.add(drawPolyline(
        ctx.pixi,
        buildScribblePath(ctx.decor.scribbleSeed, 139, width * 0.82, height * 0.26, Math.min(width, height) * 0.06, 2),
        palette.tone4,
        1.4,
        0.6,
    ), { delay: 0.28, span: 0.6 });
};

export const TEMPERA_SPARSE_COMPOSITIONS: Partial<Record<TemperaShotKind, TemperaCompositionDrawer>> = {
    'quiet-line': quietLine,
    'starfield-dots': starfieldDots,
    'ripple-lines': rippleLines,
    'hair-grid': hairGrid,
    'margin-rule': marginRule,
    'dot-drift': dotDrift,
    'arc-sweep': arcSweep,
    'blank-page': blankPage,
};
