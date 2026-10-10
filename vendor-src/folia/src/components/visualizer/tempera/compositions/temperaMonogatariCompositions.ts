import type { TemperaCompositionContext, TemperaCompositionDrawer } from '../temperaCompositionContext';
import type { TemperaShotKind } from '../types';
import { temperaHash01 } from '../temperaRandom';
import { buildCrossRow, buildHatchSpec, rectPolygon } from '../temperaHatch';
import { drawCrossMarks, drawHatchFill, drawLines, drawPolygonFill } from '../temperaShapes';

// src/components/visualizer/tempera/compositions/temperaMonogatariCompositions.ts
// Interstitial cards in the Monogatari manner: one flat field edge to edge, and the type is
// the whole picture. These carry almost no geometry on purpose - the shot before and after
// does the work, and the card is the beat of silence between them.

// The field alternates which end of the tone ladder it takes, so consecutive cards in a song
// read as a cut rather than as a hold.
const addField = (ctx: TemperaCompositionContext, tone: string) => {
    const { width, height, bleed } = ctx;
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), tone, 1, ctx.gradient),
        { span: 0.45 });
};

const pickField = (ctx: TemperaCompositionContext) => (
    temperaHash01(ctx.seed, 167, 173) > 0.5 ? ctx.palette.tone4 : ctx.palette.tone1
);

// Bare card: flat field, nothing else. The type carries it alone.
const monogatariCard: TemperaCompositionDrawer = ctx => {
    addField(ctx, pickField(ctx));
    if (!ctx.showDecor) return;
    // A single hairline at the very bottom, the way a title card carries a footer rule.
    ctx.add(drawLines(ctx.pixi, [
        { x1: ctx.width * 0.12, y1: ctx.height * 0.9, x2: ctx.width * 0.88, y2: ctx.height * 0.9 },
    ], ctx.palette.paper, 1.2, 0.45), { delay: 0.22, span: 0.6, enterDX: ctx.width * 0.15 });
};

// Flat field with a heavy rule under the type, splitting the card in two.
const monogatariRule: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    addField(ctx, pickField(ctx));
    const y = height * (0.62 + temperaHash01(ctx.seed, 179, 181) * 0.08);
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, y, width + bleed * 2, height * 0.012), palette.paper, 0.85, ctx.gradient),
        { delay: 0.12, span: 0.55, enterDX: -width * 0.3 });
    if (!ctx.showDecor) return;
    ctx.add(drawLines(ctx.pixi, [
        { x1: -bleed, y1: y + height * 0.05, x2: width + bleed, y2: y + height * 0.05 },
    ], palette.paper, 1, 0.35), { delay: 0.2, span: 0.6, enterDX: width * 0.2 });
};

// Flat field with a contrasting band down one edge, like a bound page.
const monogatariEdge: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const field = pickField(ctx);
    addField(ctx, field);
    const band = width * (0.1 + temperaHash01(ctx.seed, 191, 193) * 0.05);
    const fromLeft = temperaHash01(ctx.seed, 197, 199) > 0.5;
    const spine = rectPolygon(fromLeft ? -bleed : width - band, -bleed, band + bleed, height + bleed * 2);
    ctx.add(drawPolygonFill(ctx.pixi, spine, field === palette.tone4 ? palette.tone1 : palette.tone4, 0.95, ctx.gradient),
        { delay: 0.1, span: 0.55, enterDX: (fromLeft ? -1 : 1) * width * 0.2 });
    if (!ctx.showDecor) return;
    ctx.add(drawHatchFill(ctx.pixi, spine, buildHatchSpec(ctx.seed, 211), palette.paper, 0.2),
        { delay: 0.18, span: 0.6, grow: true });
};

// Flat field, narrow type column: the card reads as a stacked caption.
const monogatariStack: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    addField(ctx, pickField(ctx));
    const column = width * 0.5;
    ctx.add(drawLines(ctx.pixi, [
        { x1: (width - column) / 2, y1: -bleed, x2: (width - column) / 2, y2: height + bleed },
        { x1: (width + column) / 2, y1: -bleed, x2: (width + column) / 2, y2: height + bleed },
    ], palette.paper, 1.1, 0.4), { delay: 0.14, span: 0.6, enterDY: height * 0.12 });
};

// The loud one: field at the far end of the ladder, type at its largest, a row of marks.
const monogatariFlash: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    addField(ctx, palette.tone4);
    if (!ctx.showDecor) return;
    ctx.add(drawCrossMarks(
        ctx.pixi,
        buildCrossRow(ctx.seed, 223, width * 0.1, height * 0.18, 4, width * 0.05, 10),
        palette.paper,
        2.4,
        0.6,
    ), { delay: 0.2, span: 0.5, enterDX: -width * 0.1 });
};

export const TEMPERA_MONOGATARI_COMPOSITIONS: Partial<Record<TemperaShotKind, TemperaCompositionDrawer>> = {
    'monogatari-card': monogatariCard,
    'monogatari-rule': monogatariRule,
    'monogatari-edge': monogatariEdge,
    'monogatari-stack': monogatariStack,
    'monogatari-flash': monogatariFlash,
};
