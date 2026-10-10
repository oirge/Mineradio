import type { TemperaCompositionDrawer } from '../temperaCompositionContext';
import type { TemperaShotKind } from '../types';
import { temperaHash01 } from '../temperaRandom';
import { rectPolygon } from '../temperaHatch';
import { drawLines, drawPolygonFill, drawPolygonOutline } from '../temperaShapes';
import { addCutField, addHoleLip } from './temperaCutout';
import { addCornerTicks, addFaceRuling, addGround, addMass, addSurveyLines, addWireTrace } from './temperaMonolithKit';

// src/components/visualizer/tempera/compositions/temperaMonolithCompositions.ts
// Brutalism: one enormous matte solid, cropped by the frame, with the type sitting on its
// silhouette. The whole family is built on a single move - a mass whose scale the frame cannot
// contain - and `temperaMonolithKit.ts` holds the thin marks that give it that scale.
//
// The type is placed *across* the silhouette wherever the field behind it is solid, because a
// glyph half on the mass and half off it is where the inversion filter does its best work.
// Where a composition opens the ground to the background instead, the region moves onto the
// mass; `temperaCutout.ts` explains why it can never straddle an opening.
const apexMass: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const apexX = width * (0.46 + temperaHash01(ctx.seed, 3, 227) * 0.12);
    const apexY = height * 0.38;
    addGround(ctx, palette.tone1);
    const mass = [-bleed, height + bleed, apexX, apexY, width + bleed, height + bleed];
    addMass(ctx, mass, palette.tone3, { enterDY: height * 0.1 });
    // Ruled on one flank only. Both flanks would read as a texture rather than as a lit face.
    addFaceRuling(ctx, [apexX, apexY, width + bleed, height + bleed, apexX + width * 0.24, height + bleed], 229);
    addSurveyLines(ctx, 3);
    if (!ctx.showDecor) return;
    addCornerTicks(ctx);
    addWireTrace(ctx, width * 0.12, height * 0.84, Math.min(width, height) * 0.09);
};

// A stepped mountain of slabs. Each course is its own node so the stack builds upward.
const ziggurat: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    addGround(ctx, palette.tone1);
    const tones = [palette.tone4, palette.tone3, palette.tone3, palette.tone2];
    for (let course = 0; course < 4; course += 1) {
        const half = width * (0.44 - course * 0.09);
        const top = height * (0.9 - course * 0.13) - height * 0.13;
        addMass(ctx, rectPolygon(width / 2 - half, top, half * 2, height * 0.13 + bleed), tones[course], {
            delay: 0.04 + course * 0.05,
            enterDY: height * 0.08,
            edgeWidth: 2,
        });
    }
    addSurveyLines(ctx, 2);
    if (!ctx.showDecor) return;
    addCornerTicks(ctx);
};

// A wall filling most of the frame with one deep joint down its leading edge.
const slabWall: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const edge = width * 0.36;
    addGround(ctx, palette.tone1);
    addMass(ctx, rectPolygon(edge, -bleed, width - edge + bleed, height + bleed * 2), palette.tone3, { edge: false });
    ctx.add(drawLines(ctx.pixi, [{ x1: edge, y1: -bleed, x2: edge, y2: height + bleed }], palette.ink, 3.5, 0.9),
        { delay: 0.1, span: 0.55, enterDX: width * 0.06 });
    addFaceRuling(ctx, rectPolygon(width * 0.62, height * 0.1, width * 0.3, height * 0.8), 233);
    addSurveyLines(ctx, 3);
    if (!ctx.showDecor) return;
    addWireTrace(ctx, width * 0.16, height * 0.24, Math.min(width, height) * 0.08);
};

// A beam thrown out over nothing, with the one stub of support that makes it a cantilever.
const cantilever: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    addGround(ctx, palette.tone1);
    addMass(ctx, rectPolygon(0.16 * width, height * 0.5, width * 0.1, height * 0.5 + bleed), palette.tone4, {
        delay: 0.02,
        enterDY: height * 0.1,
        edge: false,
    });
    addMass(ctx, rectPolygon(-bleed, height * 0.34, width * 0.78 + bleed, height * 0.16), palette.tone3, {
        delay: 0.08,
        enterDX: -width * 0.14,
    });
    addFaceRuling(ctx, rectPolygon(width * 0.3, height * 0.36, width * 0.44, height * 0.12), 239, palette.paper, 0.35);
    addSurveyLines(ctx, 2);
    if (!ctx.showDecor) return;
    addCornerTicks(ctx);
};

// Two pylons and the lintel they carry. The bay between them is cut clean out of the ground,
// so the gap is sky rather than paper.
const pylonPair: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const bay = rectPolygon(width * 0.26, height * 0.3, width * 0.48, height * 0.7 + bleed);
    addCutField(ctx, palette.tone1, [bay], { alpha: 0.94 });
    addHoleLip(ctx, bay, 2, 0.6, 0.12);
    ([0.1, 0.74] as const).forEach((x, index) => {
        addMass(ctx, rectPolygon(width * x, height * 0.28, width * 0.16, height * 0.72 + bleed), palette.tone4, {
            delay: 0.04 + index * 0.05,
            enterDY: height * 0.08,
            edgeWidth: 2,
        });
    });
    addMass(ctx, rectPolygon(width * 0.04, height * 0.14, width * 0.92, height * 0.16), palette.tone3, {
        delay: 0.14,
        enterDY: -height * 0.1,
    });
    addSurveyLines(ctx, 2);
};

// A blockhouse with one observation slit. The slit is cut from the ground as well as the mass:
// a hole in the mass alone would only show the paper behind it.
const bunkerSlit: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const slit = rectPolygon(-bleed, height * 0.62, width + bleed * 2, height * 0.06);
    addCutField(ctx, palette.tone1, [slit], { alpha: 0.94 });
    // The mass arrives as two courses that stop either side of the slit. Drawing it as one
    // block and cutting the slit out of that would work too, but the halves entering from
    // opposite directions is what makes the opening read as prised apart.
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, height * 0.34, width + bleed * 2, height * 0.28), palette.tone4, 0.95, ctx.gradient),
        { delay: 0.05, span: 0.6, enterDY: -height * 0.08 });
    ctx.add(drawPolygonFill(ctx.pixi, rectPolygon(-bleed, height * 0.68, width + bleed * 2, height * 0.32 + bleed), palette.tone4, 0.95, ctx.gradient),
        { delay: 0.08, span: 0.6, enterDY: height * 0.1 });
    ctx.add(drawLines(ctx.pixi, [
        { x1: -bleed, y1: height * 0.34, x2: width + bleed, y2: height * 0.34 },
    ], palette.ink, 3, 0.85), { delay: 0.14, span: 0.5 });
    addFaceRuling(ctx, rectPolygon(width * 0.08, height * 0.72, width * 0.36, height * 0.2), 241, palette.paper, 0.3);
    addSurveyLines(ctx, 2);
};

// Three courses of plinth, each one stepped in from the one below it.
const plinthStack: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    addGround(ctx, palette.tone1);
    addMass(ctx, rectPolygon(width * 0.06, height * 0.72, width * 0.88, height * 0.28 + bleed), palette.tone4, { edgeWidth: 2 });
    addMass(ctx, rectPolygon(width * 0.16, height * 0.52, width * 0.68, height * 0.2), palette.tone3, { delay: 0.08, edgeWidth: 2 });
    addMass(ctx, rectPolygon(width * 0.28, height * 0.34, width * 0.44, height * 0.18), palette.tone2, { delay: 0.14, enterDY: height * 0.06 });
    addFaceRuling(ctx, rectPolygon(width * 0.2, height * 0.76, width * 0.6, height * 0.16), 243);
    addSurveyLines(ctx, 3);
    if (!ctx.showDecor) return;
    addCornerTicks(ctx);
};

// A row of buttresses. The ground is opened in one band and the fins are set into it, so the
// sky shows between them without every gap needing its own cut.
const buttressRun: TemperaCompositionDrawer = ctx => {
    const { width, height, palette, bleed } = ctx;
    const band = rectPolygon(-bleed, height * 0.42, width + bleed * 2, height * 0.58 + bleed);
    addCutField(ctx, palette.tone1, [band], { alpha: 0.94 });
    for (let index = 0; index < 5; index += 1) {
        const left = width * (index * 0.2 + 0.01);
        addMass(ctx, [
            left, height + bleed,
            left + width * 0.09, height * 0.42,
            left + width * 0.17, height + bleed,
        ], index % 2 === 0 ? palette.tone4 : palette.tone3, {
            delay: 0.04 + index * 0.04,
            enterDY: height * 0.12,
            edgeWidth: 2,
        });
    }
    ctx.add(drawLines(ctx.pixi, [{ x1: -bleed, y1: height * 0.42, x2: width + bleed, y2: height * 0.42 }], palette.ink, 2.4, 0.8),
        { delay: 0.2, span: 0.5, enterDX: -width * 0.1 });
    addSurveyLines(ctx, 2);
};

// A single mass with its middle removed. The opening is the largest in the mode, and the band
// left above it is exactly what the type stands on.
const voidCore: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const core = rectPolygon(width * 0.22, height * 0.34, width * 0.56, height * 0.46);
    addCutField(ctx, palette.tone3, [core], { alpha: 0.95 });
    addHoleLip(ctx, core, 3.5, 0.9, 0.08);
    addFaceRuling(ctx, rectPolygon(width * 0.04, height * 0.36, width * 0.14, height * 0.42), 247, palette.tone4, 0.45);
    addSurveyLines(ctx, 3);
    if (!ctx.showDecor) return;
    addCornerTicks(ctx);
    addWireTrace(ctx, width * 0.86, height * 0.86, Math.min(width, height) * 0.08);
};

// One block sheared along a diagonal and the halves pushed past each other.
const shearBlock: TemperaCompositionDrawer = ctx => {
    const { width, height, palette } = ctx;
    const left = width * 0.14;
    const right = width * 0.86;
    const top = height * 0.2;
    const bottom = height * 0.8;
    const cutTop = width * 0.56;
    const cutBottom = width * 0.44;
    addGround(ctx, palette.tone1);
    addMass(ctx, [left, top, cutTop, top, cutBottom, bottom, left, bottom], palette.tone3, {
        enterDX: -width * 0.08,
        enterDY: -height * 0.03,
        edgeWidth: 2,
    });
    addMass(ctx, [cutTop + width * 0.03, top + height * 0.04, right, top + height * 0.04, right, bottom + height * 0.04, cutBottom + width * 0.03, bottom + height * 0.04], palette.tone4, {
        delay: 0.1,
        enterDX: width * 0.08,
        enterDY: height * 0.03,
        edgeWidth: 2,
    });
    addSurveyLines(ctx, 2);
    if (!ctx.showDecor) return;
    ctx.add(drawPolygonOutline(ctx.pixi, rectPolygon(width * 0.1, height * 0.16, width * 0.8, height * 0.68), palette.paper, 1.2, 0.35),
        { delay: 0.28, span: 0.55 });
};

export const TEMPERA_MONOLITH_COMPOSITIONS: Partial<Record<TemperaShotKind, TemperaCompositionDrawer>> = {
    'apex-mass': apexMass,
    'ziggurat': ziggurat,
    'slab-wall': slabWall,
    'cantilever': cantilever,
    'pylon-pair': pylonPair,
    'bunker-slit': bunkerSlit,
    'plinth-stack': plinthStack,
    'buttress-run': buttressRun,
    'void-core': voidCore,
    'shear-block': shearBlock,
};
