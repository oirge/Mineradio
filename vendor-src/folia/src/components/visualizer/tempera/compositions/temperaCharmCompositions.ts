import type { TemperaCompositionContext, TemperaCompositionDrawer } from '../temperaCompositionContext';
import type { TemperaShotKind } from '../types';
import { temperaHash01 } from '../temperaRandom';
import { buildHatchSpec, rectPolygon } from '../temperaHatch';
import {
    arcRibbonPolygon,
    buildDiscField,
    ellipsePolygon,
    heartPolygon,
    lobedPolygon,
    rotatePolygon,
    roundedRectPolygon,
    scallopBandPolygon,
    starPolygon,
} from '../temperaCurves';
import {
    drawDiscs,
    drawHatchFill,
    drawLines,
    drawPolygonFill,
    drawPolygonOutline,
    drawRings,
} from '../temperaShapes';

// src/components/visualizer/tempera/compositions/temperaCharmCompositions.ts
// The rounded family, after the motion design of visual novel promo PVs: bubbles, frills,
// hearts, sparkles and sticker plates. Every other family cuts the frame with straight edges;
// these lay curved shapes *on* a flat field instead, so the type reads as printed on a sticker
// rather than as straddling a panel seam. Geometry comes from `temperaCurves.ts`; only the
// convex shapes there may be hatched.
//
// Two rules hold the family to the rest of Tempera: the ink outline stays (a soft shape with
// no outline dissolves into the field and gives the inversion filter nothing to cut against),
// and nothing here pulses with audio - the float is the shared deterministic `drift`.

/** Every card starts from one flat field; the curved shapes sit on top of it. */
const addField = (ctx: TemperaCompositionContext, color: string, alpha = 0.92) => {
    const { width, height, bleed } = ctx;
    ctx.add(
        drawPolygonFill(ctx.pixi, rectPolygon(-bleed, -bleed, width + bleed * 2, height + bleed * 2), color, alpha, ctx.gradient),
        { span: 0.5 },
    );
};

// Bubbles rising past the type. The size spread is what sells it, so a large tier the lyric
// sits against carries the tone while a small tier drifts over it.
const bubbleDrift: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const unit = Math.min(width, height);
    addField(ctx, palette.tone1);
    const big = buildDiscField(ctx.seed, 11, width, height, 8, unit * 0.115);
    const small = buildDiscField(ctx.seed, 17, width, height, 13, unit * 0.042);
    ctx.add(drawDiscs(ctx.pixi, big, palette.tone3, 0.88, ctx.gradient), { delay: 0.05, span: 0.6, enterDY: height * 0.16, drift: true });
    ctx.add(drawRings(ctx.pixi, big, palette.ink, 2, 0.55), { delay: 0.12, span: 0.55, enterDY: height * 0.12 });
    ctx.add(drawDiscs(ctx.pixi, small, palette.tone4, 0.7), { delay: 0.18, span: 0.6, enterDY: height * 0.22, drift: true });
    if (!ctx.showDecor) return;
    // Highlights on the two lead bubbles. Without them the discs read as flat dots.
    ctx.add(drawDiscs(ctx.pixi, big.slice(0, 2).map(disc => ({
        x: disc.x - disc.radius * 0.36,
        y: disc.y - disc.radius * 0.36,
        radius: disc.radius * 0.16,
    })), palette.paper, 0.85), { delay: 0.28, drift: true });
};

// A lobed medallion: the cloud frame a promo drops one line of narration into.
const cloudWindow: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const unit = Math.min(width, height);
    const cx = width / 2;
    const cy = height * 0.52;
    const rx = width * 0.3;
    const ry = height * 0.3;
    addField(ctx, palette.tone3);
    const cloud = lobedPolygon(cx, cy, rx, ry, 9, 0.1);
    ctx.add(drawPolygonFill(ctx.pixi, lobedPolygon(cx, cy + height * 0.025, rx * 1.05, ry * 1.05, 9, 0.1), palette.tone4, 0.5), { delay: 0.04, span: 0.6 });
    ctx.add(drawPolygonFill(ctx.pixi, cloud, palette.paper, 0.96, ctx.gradient), { delay: 0.08, span: 0.55 });
    ctx.add(drawPolygonOutline(ctx.pixi, cloud, palette.ink, 2.4, 0.85), { delay: 0.12, span: 0.5 });
    if (!ctx.showDecor) return;
    // The tail of a speech balloon, made of the two bubbles that fell off it.
    ctx.add(drawDiscs(ctx.pixi, [
        { x: cx - rx * 1.16, y: cy + ry * 0.66, radius: unit * 0.035 },
        { x: cx - rx * 1.32, y: cy + ry * 0.9, radius: unit * 0.02 },
    ], palette.paper, 0.92, ctx.gradient), { delay: 0.22, drift: true });
};

// Hearts at three sizes marching off frame; the largest one carries the type.
const heartBurst: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const lean = temperaHash01(ctx.seed, 3, 83) > 0.5 ? 1 : -1;
    const cx = width * 0.5;
    const cy = height * 0.52;
    const rx = width * 0.32;
    const ry = height * 0.4;
    addField(ctx, palette.tone4, 0.94);
    const main = rotatePolygon(heartPolygon(cx, cy, rx, ry), cx, cy, lean * 0.06);
    // The offset copy goes down first: it reads as a mis-registered second printing, which is
    // the same idea as the type's echo layer, not as a drop shadow.
    ctx.add(drawPolygonFill(
        ctx.pixi,
        rotatePolygon(heartPolygon(cx + lean * width * 0.022, cy + height * 0.025, rx, ry), cx, cy, lean * 0.06),
        palette.tone2,
        0.6,
    ), { delay: 0.04, span: 0.6 });
    ctx.add(drawPolygonFill(ctx.pixi, main, palette.paper, 0.95, ctx.gradient), { delay: 0.08, span: 0.55, enterDY: height * 0.1 });
    ctx.add(drawPolygonOutline(ctx.pixi, main, palette.ink, 3, 0.9), { delay: 0.14, span: 0.5, enterDY: height * 0.08 });
    [0.4, 0.24].forEach((scale, index) => {
        const x = lean > 0 ? width * (0.88 + index * 0.08) : width * (0.12 - index * 0.08);
        const y = height * (0.24 + index * 0.42);
        // Drawn in local coordinates inside a positioned group: `drift` scales a node about
        // its own origin, so an off-centre shape has to be centred there or it orbits.
        const group = ctx.createGroup(0, x, y);
        ctx.add(drawPolygonFill(
            ctx.pixi,
            rotatePolygon(heartPolygon(0, 0, rx * scale, ry * scale), 0, 0, -lean * 0.22),
            palette.tone2,
            0.9,
            ctx.gradient,
        ), { delay: 0.2 + index * 0.06, span: 0.5, enterDX: lean * width * 0.12, drift: true }, group);
    });
};

// Kirakira: four-tipped sparkles at two tiers over an almost bare field.
const sparkleField: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const unit = Math.min(width, height);
    addField(ctx, palette.tone1, 0.88);
    const seeds = buildDiscField(ctx.seed, 23, width, height, 9, unit * 0.07);
    seeds.slice(0, 5).forEach((disc, index) => {
        // A tight waist is what makes a four-pointed star read as a glint instead of a cross.
        // Local coordinates inside a positioned group so `drift` twinkles in place.
        const star = starPolygon(0, 0, disc.radius, disc.radius * 0.16, 4, temperaHash01(ctx.seed, index, 29) * 0.9);
        const group = ctx.createGroup(0, disc.x, disc.y);
        ctx.add(drawPolygonFill(ctx.pixi, star, palette.tone4, 0.9, ctx.gradient), { delay: 0.06 + index * 0.05, span: 0.5, drift: true }, group);
    });
    ctx.add(drawDiscs(
        ctx.pixi,
        seeds.slice(5).map(disc => ({ ...disc, radius: disc.radius * 0.22 })),
        palette.tone4,
        0.7,
    ), { delay: 0.24, span: 0.55, drift: true });
    ctx.add(drawLines(ctx.pixi, [{ x1: width * 0.08, y1: height * 0.74, x2: width * 0.92, y2: height * 0.72 }], palette.tone4, 1.2, 0.5),
        { delay: 0.3, span: 0.5, enterDX: -width * 0.12 });
};

// Petals swung out of an off-frame hub, plus the rosette they came from.
const petalArc: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const fromLeft = temperaHash01(ctx.seed, 5, 89) > 0.5;
    const hubX = fromLeft ? -width * 0.1 : width * 1.1;
    const hubY = height * 0.12;
    const rx = width * 0.26;
    const ry = height * 0.085;
    addField(ctx, palette.tone2);
    for (let index = 0; index < 5; index += 1) {
        // Each petal is built touching the hub, then swung around it, so the fan stays a fan
        // whichever corner the seed picked.
        const base = ellipsePolygon(hubX + (fromLeft ? rx : -rx), hubY, rx, ry, 28);
        const petal = rotatePolygon(base, hubX, hubY, (fromLeft ? 1 : -1) * (0.18 + index * 0.3));
        ctx.add(drawPolygonFill(ctx.pixi, petal, index % 2 === 0 ? palette.tone3 : palette.tone1, 0.9, ctx.gradient),
            { delay: index * 0.05, span: 0.55, enterDY: -height * 0.1 });
        ctx.add(drawPolygonOutline(ctx.pixi, petal, palette.ink, 1.6, 0.5), { delay: 0.06 + index * 0.05, span: 0.5 });
    }
    const hub = ctx.createGroup(0, hubX, hubY);
    ctx.add(drawPolygonFill(ctx.pixi, lobedPolygon(0, 0, width * 0.11, width * 0.11, 6, 0.34), palette.tone4, 0.9, ctx.gradient),
        { delay: 0.28, span: 0.5, drift: true }, hub);
    if (!ctx.showDecor) return;
    // Petals that already fell, on the far side: without them the fan leaves that half bare.
    ctx.add(drawDiscs(ctx.pixi, [0, 1, 2].map(index => ({
        x: fromLeft ? width * (0.78 + index * 0.07) : width * (0.22 - index * 0.07),
        y: height * (0.7 + index * 0.1),
        radius: height * (0.03 - index * 0.006),
    })), palette.tone4, 0.75, ctx.gradient), { delay: 0.32, span: 0.5, drift: true });
};

// Two frilled bands closing in from the edges; the lyric sits in the bright slot between them.
const scallopBand: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    addField(ctx, palette.tone1, 0.9);
    const top = scallopBandPolygon(-bleed, width + bleed, -bleed, height * 0.28, 9);
    const bottom = scallopBandPolygon(-bleed, width + bleed, height + bleed, height * 0.72, 9);
    ctx.add(drawPolygonFill(ctx.pixi, top, palette.tone3, 0.92, ctx.gradient), { delay: 0.04, span: 0.55, enterDY: -height * 0.18 });
    ctx.add(drawPolygonFill(ctx.pixi, bottom, palette.tone4, 0.92, ctx.gradient), { delay: 0.1, span: 0.55, enterDY: height * 0.18 });
    ctx.add(drawPolygonOutline(ctx.pixi, top, palette.ink, 2, 0.75), { delay: 0.14, span: 0.5, enterDY: -height * 0.12 });
    ctx.add(drawPolygonOutline(ctx.pixi, bottom, palette.ink, 2, 0.75), { delay: 0.18, span: 0.5, enterDY: height * 0.12 });
    if (!ctx.showDecor) return;
    // Beads pinned on the cusps where two bumps meet, so they read as sewn to the frill
    // instead of scattered on it - hence the bump pitch rather than round fractions.
    const pitch = (width + bleed * 2) / 9;
    const beads = Array.from({ length: 5 }, (_, index) => ({
        x: -bleed + pitch * (index + 2),
        y: height * 0.28,
        radius: Math.min(width, height) * 0.018,
    }));
    ctx.add(drawDiscs(ctx.pixi, beads, palette.ink, 0.7), { delay: 0.26, drift: true });
};

// One ribbon arcing across the frame with a knot pinned on it: the caption banner of a promo.
const ribbonLoop: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const sag = height * (0.06 + temperaHash01(ctx.seed, 7, 97) * 0.05) * (temperaHash01(ctx.seed, 9, 97) > 0.5 ? 1 : -1);
    addField(ctx, palette.tone2);
    const band = arcRibbonPolygon(-bleed, width + bleed, height * 0.5, height * 0.3, sag);
    const echo = arcRibbonPolygon(-bleed, width + bleed, height * 0.68, height * 0.06, -sag);
    ctx.add(drawPolygonFill(ctx.pixi, echo, palette.tone4, 0.7, ctx.gradient), { delay: 0.04, span: 0.6, enterDX: -width * 0.16 });
    ctx.add(drawPolygonFill(ctx.pixi, band, palette.paper, 0.95, ctx.gradient), { delay: 0.08, span: 0.55, enterDX: width * 0.18 });
    ctx.add(drawPolygonOutline(ctx.pixi, band, palette.ink, 2.6, 0.85), { delay: 0.14, span: 0.5, enterDX: width * 0.14 });
    // A bow on the band. It deliberately lands under the type: the lyric crossing it is what
    // the inversion filter turns into a two-colour word.
    const knotX = width * (temperaHash01(ctx.seed, 11, 97) > 0.5 ? 0.24 : 0.76);
    const knotY = height * 0.5 + Math.sin((knotX + bleed) / (width + bleed * 2) * Math.PI) * sag;
    const bow = ctx.createGroup(0, knotX, knotY);
    ([-1, 1] as const).forEach((side, index) => {
        const loop = rotatePolygon(
            ellipsePolygon(side * width * 0.055, 0, width * 0.05, height * 0.07, 26),
            0,
            0,
            side * 0.3,
        );
        ctx.add(drawPolygonFill(ctx.pixi, loop, palette.tone4, 0.92, ctx.gradient), { delay: 0.2 + index * 0.04, span: 0.5, enterDX: side * width * 0.06 }, bow);
        ctx.add(drawPolygonOutline(ctx.pixi, loop, palette.ink, 2, 0.8), { delay: 0.24 + index * 0.04, span: 0.5 }, bow);
    });
    const knot = roundedRectPolygon(-width * 0.018, -height * 0.035, width * 0.036, height * 0.07, height * 0.02);
    ctx.add(drawPolygonFill(ctx.pixi, knot, palette.tone4, 0.95, ctx.gradient), { delay: 0.28, span: 0.5 }, bow);
    ctx.add(drawPolygonOutline(ctx.pixi, knot, palette.ink, 2, 0.85), { delay: 0.3, span: 0.5 }, bow);
};

// A sticker plate: rounded panel, double rule, four pins. The calmest card in the family.
const roundPlate: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const unit = Math.min(width, height);
    addField(ctx, palette.tone3);
    const plate = roundedRectPolygon(width * 0.16, height * 0.24, width * 0.68, height * 0.52, unit * 0.11);
    const inner = roundedRectPolygon(width * 0.19, height * 0.29, width * 0.62, height * 0.42, unit * 0.08);
    ctx.add(drawPolygonFill(ctx.pixi, plate, palette.paper, 0.95, ctx.gradient), { delay: 0.05, span: 0.55, enterDY: height * 0.06 });
    // Rounded rectangles are convex, so the hatch clipper fills them directly - a lobed plate
    // would have to go without.
    ctx.add(drawHatchFill(ctx.pixi, inner, buildHatchSpec(ctx.seed, 101, 1.3), palette.tone2, 0.35), { delay: 0.1, span: 0.6, grow: true });
    ctx.add(drawPolygonOutline(ctx.pixi, plate, palette.ink, 3, 0.9), { delay: 0.12, span: 0.5 });
    ctx.add(drawPolygonOutline(ctx.pixi, inner, palette.tone4, 1.2, 0.55), { delay: 0.16, span: 0.5 });
    if (!ctx.showDecor) return;
    ctx.add(drawDiscs(ctx.pixi, [
        { x: width * 0.22, y: height * 0.3, radius: unit * 0.016 },
        { x: width * 0.78, y: height * 0.3, radius: unit * 0.016 },
        { x: width * 0.22, y: height * 0.7, radius: unit * 0.016 },
        { x: width * 0.78, y: height * 0.7, radius: unit * 0.016 },
    ], palette.ink, 0.75), { delay: 0.22, span: 0.5 });
};

// A soft halo: wide radial wedges out of an off-centre hub, then the disc and rings on top.
const haloBurst: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const unit = Math.min(width, height);
    const cx = width * (0.44 + temperaHash01(ctx.seed, 13, 103) * 0.12);
    const cy = height * 0.5;
    const reach = Math.hypot(width, height) * 0.7;
    const wedges = 14;
    addField(ctx, palette.tone1);
    // Every other wedge only: the gap is what keeps a burst soft instead of dizzying.
    for (let index = 0; index < wedges; index += 2) {
        const angle = (index / wedges) * Math.PI * 2 + temperaHash01(ctx.seed, index, 107) * 0.09;
        const spread = 0.11;
        ctx.add(drawPolygonFill(ctx.pixi, [
            cx, cy,
            cx + Math.cos(angle - spread) * reach, cy + Math.sin(angle - spread) * reach,
            cx + Math.cos(angle + spread) * reach, cy + Math.sin(angle + spread) * reach,
        ], palette.tone3, 0.55, ctx.gradient), { delay: 0.04 + index * 0.012, span: 0.6 });
    }
    ctx.add(drawPolygonFill(ctx.pixi, ellipsePolygon(cx, cy, unit * 0.34, unit * 0.34, 48), palette.paper, 0.94, ctx.gradient),
        { delay: 0.14, span: 0.55 });
    // Rings via the disc factory rather than an outlined polygon: it pivots the node on the
    // ring centre, so the halo breathes in place instead of orbiting the frame origin.
    ([[0.34, 3], [0.44, 1.4]] as const).forEach(([scale, stroke], index) => {
        ctx.add(drawRings(ctx.pixi, [{ x: cx, y: cy, radius: unit * scale }], palette.ink, stroke, 0.75),
            { delay: 0.2 + index * 0.06, span: 0.5, drift: true });
    });
};

export const TEMPERA_CHARM_COMPOSITIONS: Partial<Record<TemperaShotKind, TemperaCompositionDrawer>> = {
    'bubble-drift': bubbleDrift,
    'cloud-window': cloudWindow,
    'heart-burst': heartBurst,
    'sparkle-field': sparkleField,
    'petal-arc': petalArc,
    'scallop-band': scallopBand,
    'ribbon-loop': ribbonLoop,
    'round-plate': roundPlate,
    'halo-burst': haloBurst,
};
