import type { TemperaCompositionContext, TemperaCompositionDrawer } from './temperaCompositionContext';
import type { TemperaShotKind } from './types';
import { temperaHash01 } from './temperaRandom';
import { buildCrossRow, buildCrossingLines, buildHatchSpec, buildScribblePath, diamondPolygon, rectPolygon } from './temperaHatch';
import {
    drawConcentricDiamonds,
    drawCrossMarks,
    drawHatchFill,
    drawLines,
    drawPolygonFill,
    drawPolygonOutline,
    drawPolyline,
} from './temperaShapes';
import { TEMPERA_SPLIT_COMPOSITIONS } from './compositions/temperaSplitCompositions';
import { TEMPERA_BAND_COMPOSITIONS } from './compositions/temperaBandCompositions';
import { TEMPERA_FRAME_COMPOSITIONS } from './compositions/temperaFrameCompositions';
import { TEMPERA_POSTER_COMPOSITIONS } from './compositions/temperaPosterCompositions';
import { TEMPERA_SPARSE_COMPOSITIONS } from './compositions/temperaSparseCompositions';
import { TEMPERA_CINEMA_COMPOSITIONS } from './compositions/temperaCinemaCompositions';
import { TEMPERA_CHARM_COMPOSITIONS } from './compositions/temperaCharmCompositions';
import { TEMPERA_APERTURE_COMPOSITIONS } from './compositions/temperaApertureCompositions';
import { TEMPERA_SIGNAL_COMPOSITIONS } from './compositions/temperaSignalCompositions';
import { TEMPERA_CORRIDOR_COMPOSITIONS } from './compositions/temperaCorridorCompositions';
import { TEMPERA_MONOLITH_COMPOSITIONS } from './compositions/temperaMonolithCompositions';
import { TEMPERA_TERRAIN_COMPOSITIONS } from './compositions/temperaTerrainCompositions';
import { TEMPERA_MONOGATARI_COMPOSITIONS } from './compositions/temperaMonogatariCompositions';
import { resolveTemperaShotProfile } from './temperaShotProfiles';

// src/components/visualizer/tempera/temperaCompositions.ts
// Composition registry plus the two layers every shot kind shares. The per-kind drawing lives
// in `compositions/*`, grouped by family; layout regions and camera profiles for the same
// kinds live in `temperaShotProfiles.ts`.
export type { TemperaBlockOptions, TemperaCompositionContext } from './temperaCompositionContext';

const COMPOSITIONS: Partial<Record<TemperaShotKind, TemperaCompositionDrawer>> = {
    ...TEMPERA_SPLIT_COMPOSITIONS,
    ...TEMPERA_BAND_COMPOSITIONS,
    ...TEMPERA_FRAME_COMPOSITIONS,
    ...TEMPERA_POSTER_COMPOSITIONS,
    ...TEMPERA_SPARSE_COMPOSITIONS,
    ...TEMPERA_CINEMA_COMPOSITIONS,
    ...TEMPERA_CHARM_COMPOSITIONS,
    ...TEMPERA_APERTURE_COMPOSITIONS,
    ...TEMPERA_SIGNAL_COMPOSITIONS,
    ...TEMPERA_CORRIDOR_COMPOSITIONS,
    ...TEMPERA_MONOLITH_COMPOSITIONS,
    ...TEMPERA_TERRAIN_COMPOSITIONS,
    ...TEMPERA_MONOGATARI_COMPOSITIONS,
};

/** Every kind must resolve to a drawer; the registry test asserts there are no gaps. */
export const resolveTemperaComposition = (kind: TemperaShotKind): TemperaCompositionDrawer => (
    COMPOSITIONS[kind] ?? COMPOSITIONS['duo-split']!
);

// Shallow full-bleed guide lines shared by every kind; they carry the eye between shots.
const addCrossingLines = (ctx: TemperaCompositionContext) => {
    const lines = buildCrossingLines(ctx.seed, 31, ctx.width, ctx.height, ctx.decor.crossCount);
    if (lines.length === 0) return;
    ctx.add(drawLines(ctx.pixi, lines, ctx.palette.tone4, 1.3, 0.6), {
        delay: 0.14,
        span: 0.6,
        enterDX: ctx.width * 0.25,
    });
};

// Motif overlay: one extra screentone element chosen at compile time, layered on any kind.
const addMotif = (ctx: TemperaCompositionContext) => {
    const { width, height, palette, decor } = ctx;
    const cornerX = temperaHash01(ctx.seed, 61, 7) > 0.5 ? width * 0.14 : width * 0.86;
    const cornerY = temperaHash01(ctx.seed, 63, 7) > 0.5 ? height * 0.18 : height * 0.82;
    switch (decor.motif) {
        case 'diamonds':
            ctx.add(drawConcentricDiamonds(ctx.pixi, cornerX, cornerY, 34, 34, 3, palette.tone4, 0.8),
                { delay: 0.34, drift: true });
            return;
        case 'hatch-twin': {
            const spec = { ...buildHatchSpec(ctx.seed, 67), angle: decor.hatchAngle };
            [0, 1].forEach(index => {
                const box = rectPolygon(cornerX - 34 + index * 46, cornerY - 26, 38, 38);
                ctx.add(drawHatchFill(ctx.pixi, box, index === 0 ? spec : { ...spec, spacing: spec.spacing * 0.55 }, palette.tone4, 0.75),
                    { delay: 0.34 + index * 0.05, grow: true });
                ctx.add(drawPolygonOutline(ctx.pixi, box, palette.tone4, 1.2, 0.6), { delay: 0.38 + index * 0.05 });
            });
            return;
        }
        case 'band-cross':
            ctx.add(drawCrossMarks(
                ctx.pixi,
                buildCrossRow(ctx.seed, 71, cornerX - width * 0.1, cornerY, 5, width * 0.05, 8, decor.hatchAngle * 0.4),
                palette.tone4,
                2,
                0.8,
            ), { delay: 0.34, span: 0.5 });
            return;
        case 'poster-diamond':
            // Deliberately parked past the edge so the shape bleeds off frame.
            ctx.add(drawPolygonFill(
                ctx.pixi,
                diamondPolygon(cornerX < width / 2 ? -width * 0.04 : width * 1.04, cornerY, width * 0.14, height * 0.2),
                palette.tone3,
                0.85,
            ), { delay: 0.32, span: 0.55, enterDX: (cornerX < width / 2 ? -1 : 1) * width * 0.1 });
            return;
        case 'doodle':
        default:
            ctx.add(drawPolyline(
                ctx.pixi,
                buildScribblePath(decor.scribbleSeed, 73, cornerX, cornerY, Math.min(width, height) * 0.08, 3),
                palette.tone4,
                1.5,
                0.72,
            ), { delay: 0.34, span: 0.6 });
    }
};

export const drawTemperaComposition = (ctx: TemperaCompositionContext) => {
    resolveTemperaComposition(ctx.kind)(ctx);
    // Interstitial cards are a bare field by definition; the shared overlays would undo them.
    if (resolveTemperaShotProfile(ctx.kind).sharedDecor === false) return;
    addCrossingLines(ctx);
    if (ctx.showDecor) addMotif(ctx);
};
