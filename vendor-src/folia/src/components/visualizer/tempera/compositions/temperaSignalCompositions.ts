import type { TemperaCompositionContext, TemperaCompositionDrawer } from '../temperaCompositionContext';
import type { TemperaShotKind } from '../types';
import { temperaHash01 } from '../temperaRandom';
import { buildHatchSpec, circlePolygon, rectPolygon } from '../temperaHatch';
import { annularSectorPolygon } from '../temperaCurves';
import {
    drawHatchFill,
    drawLines,
    drawPolygonFill,
    drawPolygonFillWithHoles,
    drawPolygonOutline,
    drawRings,
} from '../temperaShapes';
import { addCutField, addHoleLip, axisRect, flowSpan } from './temperaCutout';

// src/components/visualizer/tempera/compositions/temperaSignalCompositions.ts
// Instrument panels: hard geometric decoration - rules, ticks, brackets, repeated slats -
// arranged around one heavy mass that the type shares the frame with. The decoration is
// deliberately measured rather than expressive; it reads as a printed diagram, and the mass is
// the only thing in the frame allowed to be loud.
//
// Several kinds punch their opening through the mass itself rather than through the field, so
// the hole travels with the shape instead of sitting behind it.
const addField = (ctx: TemperaCompositionContext, color: string, alpha = 0.92) => {
    const { width, height, bleed } = ctx;
    ctx.add(
        drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), color, alpha, ctx.gradient),
        { span: 0.5 },
    );
};

// Crosshair: full-bleed rules, a boxed centre and corner ticks. The solid block under the
// crossing is what the lyric stands on.
const sightMark: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const cx = width * 0.5;
    const cy = height * 0.5;
    addField(ctx, palette.tone1);
    ctx.add(drawLines(ctx.pixi, [
        { x1: -bleed, y1: cy, x2: width + bleed, y2: cy },
        { x1: cx, y1: -bleed, x2: cx, y2: height + bleed },
    ], palette.tone4, 1.4, 0.6), { delay: 0.04, span: 0.55, enterDX: width * 0.1 });
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(width * 0.24, height * 0.36, width * 0.52, height * 0.28), palette.tone3, 0.94, ctx.gradient),
        { delay: 0.1, span: 0.55, enterDY: height * 0.06 });
    ctx.add(drawPolygonOutline(ctx.pixi, rectPolygon(width * 0.2, height * 0.32, width * 0.6, height * 0.36), palette.ink, 2.4, 0.85),
        { delay: 0.16, span: 0.5 });
    if (!ctx.showDecor) return;
    // Corner ticks, one arm each, pointing in at the box.
    ([[0.2, 0.32, 1, 1], [0.8, 0.32, -1, 1], [0.2, 0.68, 1, -1], [0.8, 0.68, -1, -1]] as const).forEach(([fx, fy, sx, sy], index) => {
        const x = width * fx;
        const y = height * fy;
        ctx.add(drawLines(ctx.pixi, [
            { x1: x, y1: y, x2: x + sx * width * 0.04, y2: y },
            { x1: x, y1: y, x2: x, y2: y + sy * height * 0.05 },
        ], palette.ink, 3, 0.8), { delay: 0.2 + index * 0.03, span: 0.5 });
    });
};

// A dial: solid ring, tick marks around it, one heavy pointer. The hub is left solid for type.
const dialScale: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const unit = Math.min(width, height);
    const cx = width * 0.5;
    const cy = height * 0.5;
    addField(ctx, palette.tone2);
    // A drawn annulus, not a disc with a hole cut in it: the hub carries the type, so it has
    // to be opaque field rather than an opening that happens to have something behind it.
    ctx.add(drawPolygonFill(
        ctx.pixi,
        annularSectorPolygon(cx, cy, unit * 0.34, unit * 0.44, 0, Math.PI * 2 - 0.006, 60),
        palette.tone4,
        0.92,
        ctx.gradient,
    ), { delay: 0.05, span: 0.6 });
    const ticks = Array.from({ length: 24 }, (_, index) => {
        const angle = (index / 24) * Math.PI * 2;
        const inner = unit * (index % 6 === 0 ? 0.46 : 0.475);
        return {
            x1: cx + Math.cos(angle) * inner,
            y1: cy + Math.sin(angle) * inner,
            x2: cx + Math.cos(angle) * unit * 0.5,
            y2: cy + Math.sin(angle) * unit * 0.5,
        };
    });
    ctx.add(drawLines(ctx.pixi, ticks, palette.ink, 1.6, 0.7), { delay: 0.14, span: 0.55 });
    const pointer = 0.4 + temperaHash01(ctx.seed, 5, 149) * 0.5;
    ctx.add(drawPolygonFill(ctx.pixi, axisRect(
        cx + Math.cos(pointer * Math.PI * 2) * unit * 0.2,
        cy + Math.sin(pointer * Math.PI * 2) * unit * 0.2,
        unit * 0.4,
        unit * 0.035,
        pointer * Math.PI * 2,
    ), palette.ink, 0.9), { delay: 0.2, span: 0.5 });
};

// Chevrons repeating down the frame with one inverted: the repeat is what makes a hand-off
// invisible, the odd one out is what the eye lands on.
const chevronRun: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const focus = 2;
    addField(ctx, palette.tone1);
    for (let index = 0; index < 5; index += 1) {
        const y = height * (0.02 + index * 0.24);
        const rise = height * 0.12;
        const thickness = height * 0.07;
        const chevron = [
            -bleed, y, width * 0.5, y - rise, width + bleed, y,
            width + bleed, y + thickness, width * 0.5, y - rise + thickness, -bleed, y + thickness,
        ];
        ctx.add(drawPolygonFill(ctx.pixi, chevron, index === focus ? palette.tone4 : palette.tone3, index === focus ? 0.95 : 0.7, ctx.gradient),
            { delay: index * 0.04, span: 0.55, enterDY: -height * 0.12 });
    }
};

// A tally column hugging one edge, with the long mark as the focal element.
const tallyColumn: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const x = width * 0.82;
    addField(ctx, palette.tone1);
    const marks = Array.from({ length: 11 }, (_, index) => {
        const long = index % 4 === 0;
        return {
            x1: x,
            y1: height * (0.1 + index * 0.075),
            x2: x + width * (long ? 0.12 : 0.06),
            y2: height * (0.1 + index * 0.075),
        };
    });
    ctx.add(drawLines(ctx.pixi, marks, palette.tone4, 2.4, 0.75), { delay: 0.06, span: 0.6, enterDX: width * 0.1 });
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(x - width * 0.02, height * 0.4, width * 0.16, height * 0.12), palette.tone4, 0.95, ctx.gradient),
        { delay: 0.16, span: 0.55, enterDX: width * 0.14 });
    ctx.add(drawLines(ctx.pixi, [{ x1: x, y1: height * 0.06, x2: x, y2: height * 0.92 }], palette.ink, 1.6, 0.6), { delay: 0.2, span: 0.5 });
};

// A hairline grid where one cell is filled and two are punched clean through.
const gridFocus: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const left = width * 0.08;
    const top = height * 0.12;
    const cellWidth = (width * 0.84) / 4;
    const cellHeight = (height * 0.76) / 3;
    const cell = (column: number, row: number) => rectPolygon(left + cellWidth * column, top + cellHeight * row, cellWidth, cellHeight);
    addCutField(ctx, palette.tone2, [cell(0, 0), cell(3, 2)]);
    addHoleLip(ctx, cell(0, 0), 2, 0.7, 0.1);
    addHoleLip(ctx, cell(3, 2), 2, 0.7, 0.14);
    ctx.add(drawPolygonFill(ctx.pixi, cell(3, 0), palette.tone4, 0.95, ctx.gradient), { delay: 0.08, span: 0.55, enterDX: width * 0.08 });
    const lines = [];
    for (let column = 0; column <= 4; column += 1) {
        lines.push({ x1: left + cellWidth * column, y1: top, x2: left + cellWidth * column, y2: top + cellHeight * 3 });
    }
    for (let row = 0; row <= 3; row += 1) {
        lines.push({ x1: left, y1: top + cellHeight * row, x2: left + cellWidth * 4, y2: top + cellHeight * row });
    }
    ctx.add(drawLines(ctx.pixi, lines, palette.tone4, 1.2, 0.6), { delay: 0.16, span: 0.55 });
};

// One heavy axis running the length of the frame with a port bored through it and a cap block
// at each end. The hole travels with the bar, not with the field behind it.
const axisCaps: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const unit = Math.min(width, height);
    const cx = width * 0.5;
    const cy = height * 0.42;
    const bar = axisRect(cx, cy, flowSpan(ctx), unit * 0.22, ctx.flowAngle);
    // The port is cut from the field as well as from the bar. Cutting only the bar would show
    // the field through it, not the background - a hole is only a window if nothing is left
    // behind it.
    const port = circlePolygon(cx, cy, unit * 0.08, 32);
    addCutField(ctx, palette.tone1, [port], { alpha: 0.92 });
    ctx.add(drawPolygonFillWithHoles(ctx.pixi, bar, [port], palette.tone4, 0.94, ctx.gradient),
        { delay: 0.05, span: 0.6 });
    ctx.add(drawRings(ctx.pixi, [{ x: cx, y: cy, radius: unit * 0.08 }], palette.ink, 2.4, 0.85), { delay: 0.12, span: 0.5 });
    ([1, -1] as const).forEach((side, index) => {
        const distance = unit * 0.46;
        const capX = cx + Math.cos(ctx.flowAngle) * distance * side;
        const capY = cy + Math.sin(ctx.flowAngle) * distance * side;
        ctx.add(drawPolygonFill(ctx.pixi, axisRect(capX, capY, unit * 0.1, unit * 0.34, ctx.flowAngle), palette.ink, 0.85),
            { delay: 0.16 + index * 0.04, span: 0.5 });
    });
};

// Slats of alternating width. The widest one is where the type goes, so it is drawn in the
// pale tone while the rest close in around it.
const strobeSlats: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    addField(ctx, palette.tone1);
    const widths = [0.06, 0.03, 0.09, 0.04, 0.34, 0.04, 0.08, 0.03, 0.06];
    let cursor = width * 0.03;
    widths.forEach((fraction, index) => {
        const slat = rectPolygon(cursor, -bleed, width * fraction, height + bleed * 2);
        const wide = fraction > 0.2;
        ctx.add(drawPolygonFill(ctx.pixi, slat, wide ? palette.tone2 : palette.tone4, wide ? 0.9 : 0.85, ctx.gradient),
            { delay: index * 0.03, span: 0.55, enterDY: (index % 2 === 0 ? 1 : -1) * height * 0.14 });
        cursor += width * (fraction + 0.02);
    });
};

// Three plates of the same size stacked out of register, in the classic misprint stagger. The
// top plate carries a register hole punched right through the stack.
const offsetPlate: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const unit = Math.min(width, height);
    const step = unit * 0.06;
    // One register hole drilled straight through the whole misregistered stack - the field and
    // every plate get the same opening at the same place, so it really is see-through.
    const holeX = width * 0.72;
    const holeY = height * 0.36;
    const hole = circlePolygon(holeX, holeY, unit * 0.05, 28);
    addCutField(ctx, palette.tone1, [hole], { alpha: 0.9 });
    ([palette.tone2, palette.tone3, palette.tone4] as const).forEach((tone, index) => {
        const plate = rectPolygon(width * 0.2 + step * index, height * 0.2 + step * index, width * 0.5, height * 0.5);
        ctx.add(drawPolygonFillWithHoles(ctx.pixi, plate, [hole], tone, index === 2 ? 0.95 : 0.8, ctx.gradient),
            { delay: index * 0.06, span: 0.55, enterDX: -step * 2, enterDY: -step });
    });
    ctx.add(drawRings(ctx.pixi, [{ x: holeX, y: holeY, radius: unit * 0.05 }], palette.ink, 2, 0.8), { delay: 0.22, span: 0.5 });
};

// A comb of rays from a hub parked off frame, with one solid sector as the mass.
const radialComb: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const hubX = width * 1.06;
    const hubY = height * 1.1;
    const reach = Math.hypot(width, height) * 1.3;
    addField(ctx, palette.tone2);
    const rays = Array.from({ length: 11 }, (_, index) => {
        const angle = Math.PI + 0.16 + index * 0.062;
        return {
            x1: hubX,
            y1: hubY,
            x2: hubX + Math.cos(angle) * reach,
            y2: hubY + Math.sin(angle) * reach,
        };
    });
    ctx.add(drawLines(ctx.pixi, rays, palette.tone4, 2.6, 0.8), { delay: 0.06, span: 0.6 });
    const start = Math.PI + 0.44;
    const end = Math.PI + 0.56;
    ctx.add(drawPolygonFill(ctx.pixi, [
        hubX, hubY,
        hubX + Math.cos(start) * reach, hubY + Math.sin(start) * reach,
        hubX + Math.cos(end) * reach, hubY + Math.sin(end) * reach,
    ], palette.tone4, 0.95, ctx.gradient), { delay: 0.14, span: 0.6 });
    if (!ctx.showDecor) return;
    ctx.add(drawHatchFill(ctx.pixi, rectPolygon(width * 0.06, height * 0.08, width * 0.2, height * 0.14), buildHatchSpec(ctx.seed, 151), palette.tone4, 0.4),
        { delay: 0.24, span: 0.6, grow: true });
};

// A viewfinder: brackets around an opening low in the frame, type on the plate above it.
const bracketTarget: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const box = rectPolygon(width * 0.28, height * 0.54, width * 0.44, height * 0.34);
    addCutField(ctx, palette.tone3, [box]);
    addHoleLip(ctx, box, 2.4, 0.85, 0.08);
    const arm = Math.min(width, height) * 0.08;
    ([[0.28, 0.54, 1, 1], [0.72, 0.54, -1, 1], [0.28, 0.88, 1, -1], [0.72, 0.88, -1, -1]] as const).forEach(([fx, fy, sx, sy], index) => {
        const x = width * fx + sx * width * 0.03;
        const y = height * fy + sy * height * 0.04;
        ctx.add(drawLines(ctx.pixi, [
            { x1: x, y1: y, x2: x + sx * arm, y2: y },
            { x1: x, y1: y, x2: x, y2: y + sy * arm },
        ], palette.ink, 3.5, 0.9), { delay: 0.12 + index * 0.04, span: 0.5, enterDX: sx * width * 0.05 });
    });
    ctx.add(drawLines(ctx.pixi, [{ x1: width * 0.1, y1: height * 0.44, x2: width * 0.9, y2: height * 0.44 }], palette.tone4, 1.6, 0.6),
        { delay: 0.24, span: 0.5, enterDX: -width * 0.1 });
};

export const TEMPERA_SIGNAL_COMPOSITIONS: Partial<Record<TemperaShotKind, TemperaCompositionDrawer>> = {
    'sight-mark': sightMark,
    'dial-scale': dialScale,
    'chevron-run': chevronRun,
    'tally-column': tallyColumn,
    'grid-focus': gridFocus,
    'axis-caps': axisCaps,
    'strobe-slats': strobeSlats,
    'offset-plate': offsetPlate,
    'radial-comb': radialComb,
    'bracket-target': bracketTarget,
};
