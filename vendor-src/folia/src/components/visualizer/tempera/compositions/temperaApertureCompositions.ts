import type { TemperaCompositionDrawer } from '../temperaCompositionContext';
import type { TemperaShotKind } from '../types';
import { temperaHash01 } from '../temperaRandom';
import { buildHatchSpec, circlePolygon, rectPolygon } from '../temperaHatch';
import {
    drawHatchFill,
    drawLines,
    drawPolygonFill,
    drawRings,
} from '../temperaShapes';
import { annularSectorPolygon } from '../temperaCurves';
import { addCutField, addHoleLip } from './temperaCutout';

// src/components/visualizer/tempera/compositions/temperaApertureCompositions.ts
// Punched plates: one flat tone sheet with a hole cut clean through it, so the shell's live
// background becomes the subject of the shot. The shape of the opening is the whole
// composition, which is why these carry almost no other geometry - a decorated plate would
// compete with its own window.
//
// The layout regions all sit on solid tone, never over an opening; see `temperaCutout.ts` for
// why. Hole positions are fixed per kind rather than seed-mirrored, because the region that
// has to stay clear of them is fixed data too.
const irisHole: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const unit = Math.min(width, height);
    const cx = width * 0.68;
    const cy = height * 0.42;
    const radius = unit * 0.3;
    const hole = circlePolygon(cx, cy, radius, 56);
    addCutField(ctx, palette.tone3, [hole]);
    addHoleLip(ctx, hole, 3, 0.9, 0.08);
    // A bar running in from the far edge: the opening reads as mounted rather than floating.
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-ctx.bleed, cy - unit * 0.035, cx - radius * 0.7 + ctx.bleed, unit * 0.07), palette.tone4, 0.9, ctx.gradient),
        { delay: 0.14, span: 0.55, enterDX: -width * 0.12 });
    if (!ctx.showDecor) return;
    ctx.add(drawRings(ctx.pixi, [{ x: cx, y: cy, radius: radius * 1.14 }], palette.tone4, 1.4, 0.6), { delay: 0.2, span: 0.5, drift: true });
};

// A single letterbox slit across the plate. The mass above and below it is what the type sits
// on, so the opening reads as a horizon rather than as a window.
const slotRail: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const top = height * 0.22;
    const slot = rectPolygon(-bleed, top, width + bleed * 2, height * 0.16);
    addCutField(ctx, palette.tone4, [slot]);
    addHoleLip(ctx, slot, 2.4, 0.8, 0.1);
    // The tab straddling the slit is the focal mass; it is also the only thing crossing it.
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(width * 0.66, top - height * 0.06, width * 0.12, height * 0.28), palette.tone2, 0.95, ctx.gradient),
        { delay: 0.16, span: 0.55, enterDY: -height * 0.1 });
    ctx.add(drawLines(ctx.pixi, [{ x1: -bleed, y1: top + height * 0.22, x2: width + bleed, y2: top + height * 0.22 }], palette.tone2, 1.4, 0.55),
        { delay: 0.22, span: 0.5, enterDX: width * 0.14 });
};

// Sprocket holes down both edges of the plate: the frame between them is the picture.
const punchRow: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const unit = Math.min(width, height);
    const radius = unit * 0.028;
    const holes: number[][] = [];
    for (let index = 0; index < 9; index += 1) {
        const x = width * (0.08 + index * 0.105);
        holes.push(circlePolygon(x, height * 0.14, radius, 20));
        holes.push(circlePolygon(x, height * 0.86, radius, 20));
    }
    addCutField(ctx, palette.tone3, holes);
    ([0.22, 0.78] as const).forEach((y, index) => {
        ctx.add(drawLines(ctx.pixi, [{ x1: 0, y1: height * y, x2: width, y2: height * y }], palette.tone4, 1.6, 0.6),
            { delay: 0.12 + index * 0.04, span: 0.5, enterDX: (index === 0 ? 1 : -1) * width * 0.12 });
    });
};

// A film gate: the big rectangular opening is the frame being exposed, the small ones are the
// transport holes pulling it past.
const filmGate: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const unit = Math.min(width, height);
    const gate = rectPolygon(width * 0.2, height * 0.1, width * 0.6, height * 0.52);
    const holes = [gate];
    for (let index = 0; index < 4; index += 1) {
        const y = height * (0.14 + index * 0.13);
        holes.push(rectPolygon(width * 0.08, y, width * 0.05, height * 0.06));
        holes.push(rectPolygon(width * 0.87, y, width * 0.05, height * 0.06));
    }
    addCutField(ctx, palette.tone4, holes);
    addHoleLip(ctx, gate, 3, 0.9, 0.08);
    ctx.add(drawHatchFill(ctx.pixi, rectPolygon(width * 0.2, height * 0.68, width * 0.6, height * 0.1), buildHatchSpec(ctx.seed, 131, 1.2), palette.tone2, 0.5),
        { delay: 0.18, span: 0.6, grow: true });
};

// A cross cut clean through, sitting high so the type keeps the lower mass to itself.
const crossVent: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const cx = width * 0.5;
    const cy = height * 0.38;
    const arm = Math.min(width, height) * 0.3;
    const bar = Math.min(width, height) * 0.1;
    const cross = [
        cx - bar, cy - arm, cx + bar, cy - arm, cx + bar, cy - bar,
        cx + arm, cy - bar, cx + arm, cy + bar, cx + bar, cy + bar,
        cx + bar, cy + arm, cx - bar, cy + arm, cx - bar, cy + bar,
        cx - arm, cy + bar, cx - arm, cy - bar, cx - bar, cy - bar,
    ];
    addCutField(ctx, palette.tone3, [cross]);
    addHoleLip(ctx, cross, 2.6, 0.85, 0.1);
    if (!ctx.showDecor) return;
    ctx.add(drawRings(ctx.pixi, [{ x: cx, y: cy, radius: arm * 1.24 }], palette.tone4, 1.2, 0.5), { delay: 0.2, span: 0.5 });
};

// Louvre slats: parallel slits leaning off the horizontal, thinning as they descend.
const louvre: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const holes: number[][] = [];
    for (let index = 0; index < 6; index += 1) {
        const y = height * (0.08 + index * 0.1);
        const lean = height * 0.03;
        const thickness = height * (0.05 - index * 0.004);
        holes.push([
            -bleed, y, width + bleed, y - lean,
            width + bleed, y - lean + thickness, -bleed, y + thickness,
        ]);
    }
    addCutField(ctx, palette.tone4, holes);
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(width * 0.1, height * 0.72, width * 0.08, height * 0.2), palette.tone2, 0.9, ctx.gradient),
        { delay: 0.2, span: 0.55, enterDY: height * 0.1 });
};

// A rose window: the ring is punched as twelve segments, so the spokes between them and the
// hub inside them are still the plate itself. The type rides that hub - it is the only region
// in the family sitting inside an opening, and it only works because the hub was never cut.
// Re-covering a round hole with a disc drawn on top would look the same and be a lie: the
// first change to the draw order would drop the type onto bare background.
const ringEye: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const unit = Math.min(width, height);
    const cx = width * 0.5;
    const cy = height * 0.5;
    const inner = unit * 0.31;
    const outer = unit * 0.44;
    const segments = 12;
    const gap = 0.03;
    const holes = Array.from({ length: segments }, (_, index) => {
        const start = (index / segments) * Math.PI * 2 + gap;
        const end = ((index + 1) / segments) * Math.PI * 2 - gap;
        return annularSectorPolygon(cx, cy, inner, outer, start, end, 8);
    });
    addCutField(ctx, palette.tone3, holes);
    ctx.add(drawRings(ctx.pixi, [
        { x: cx, y: cy, radius: inner },
        { x: cx, y: cy, radius: outer },
    ], palette.ink, 2.4, 0.85), { delay: 0.12, span: 0.5 });
};

// Square openings stepping down one side, each a size smaller than the one above it.
const notchStack: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const unit = Math.min(width, height);
    const holes: number[][] = [];
    for (let index = 0; index < 4; index += 1) {
        const size = unit * (0.26 - index * 0.05);
        holes.push(rectPolygon(width * (0.6 + index * 0.06), height * (0.1 + index * 0.19), size, size));
    }
    addCutField(ctx, palette.tone4, holes);
    holes.forEach((hole, index) => addHoleLip(ctx, hole, 2, 0.75, 0.1 + index * 0.04));
};

// A wedge driven in from the top edge. The plate keeps its whole lower half, which is where
// the type goes.
const wedgeGap: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const apexX = width * (0.4 + temperaHash01(ctx.seed, 3, 137) * 0.2);
    const wedge = [width * 0.1, -bleed, width * 0.92, -bleed, apexX, height * 0.56];
    addCutField(ctx, palette.tone3, [wedge]);
    addHoleLip(ctx, wedge, 3, 0.9, 0.08);
    ctx.add(drawLines(ctx.pixi, [{ x1: apexX, y1: height * 0.58, x2: apexX, y2: height + bleed }], palette.tone4, 1.6, 0.6),
        { delay: 0.18, span: 0.5, enterDY: height * 0.12 });
};

// A sieve: small holes thinning out across the plate, so the background bleeds through as a
// gradient of light rather than as one opening.
const dotSieve: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const unit = Math.min(width, height);
    const holes: number[][] = [];
    for (let row = 0; row < 6; row += 1) {
        // Five columns, not nine: the falloff has to reach zero well before the layout region
        // starts, or the last stragglers punch straight through the type's half of the plate.
        for (let column = 0; column < 5; column += 1) {
            const density = 1 - column / 4.5;
            if (temperaHash01(ctx.seed, row * 9 + column, 139) > density) continue;
            const x = width * (0.06 + column * 0.105) + (row % 2 === 0 ? 0 : width * 0.05);
            holes.push(circlePolygon(x, height * (0.1 + row * 0.16), unit * 0.045 * density + unit * 0.012, 18));
        }
    }
    addCutField(ctx, palette.tone2, holes, { alpha: 0.92 });
};

export const TEMPERA_APERTURE_COMPOSITIONS: Partial<Record<TemperaShotKind, TemperaCompositionDrawer>> = {
    'iris-hole': irisHole,
    'slot-rail': slotRail,
    'punch-row': punchRow,
    'film-gate': filmGate,
    'cross-vent': crossVent,
    'louvre-slats': louvre,
    'ring-eye': ringEye,
    'notch-stack': notchStack,
    'wedge-gap': wedgeGap,
    'dot-sieve': dotSieve,
};
