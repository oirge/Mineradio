import type { SonnetTypographyPlacement } from './sonnetTypographyLayout';
import type { SonnetParagraphKind, SonnetShot, SonnetShotKind } from './types';
import { resolveSonnetFrameLocalDimensions } from './sonnetFrameDecor';
import {
    SONNET_THEMED_GEO_VARIANT_START,
    SONNET_THEMED_GEO_VARIANTS,
} from './sonnetThemedShotMg';
import {
    SONNET_OPEN_GEO_VARIANT_START,
    SONNET_OPEN_GEO_VARIANTS,
} from './sonnetOpenFrameShotMg';
import { SONNET_ADDITIONAL_GEO_VARIANT_START } from './sonnetAdditionalShotMg';
import {
    SONNET_EXTENDED_GEO_VARIANT_START,
    SONNET_EXTENDED_GEO_VARIANTS,
} from './sonnetExtendedShotMg';
import { SONNET_BACKGROUND_MG_VARIANTS } from './sonnetBackgroundMgVariants';
import { SONNET_BACKGROUND_DECOR_VARIANTS } from './sonnetBackgroundDecor';
import { SONNET_FIXED_GEO_VARIANTS } from './sonnetFixedGeoVariants';

// src/components/visualizer/sonnet/sonnetDebug.ts
// Debug-only overlays for visual verification during layout development.
// Flip DEBUG_SONNET_MEASURED_BOUNDS to true to draw every segment's measured
// packing box (the same bounds the flow layouts use) on top of the shot.
export const DEBUG_SONNET_MEASURED_BOUNDS = false;

type PixiModule = typeof import('pixi.js');

const ROLE_COLORS: Record<SonnetTypographyPlacement['role'], number> = {
    hero: 0xff4466,
    'semi-hero': 0xffaa00,
    support: 0x44ccff,
    decoration: 0x888888,
};

// Draws one stroked rect per placement, centered on its anchor and rotated like
// the rendered text, plus a small center dot to make the anchor visible.
export const buildSonnetMeasuredBoundsDebug = (
    pixi: PixiModule,
    placements: SonnetTypographyPlacement[],
) => {
    const layer = new pixi.Container();
    layer.visible = DEBUG_SONNET_MEASURED_BOUNDS;
    if (!DEBUG_SONNET_MEASURED_BOUNDS) return layer;

    placements.forEach(placement => {
        const color = ROLE_COLORS[placement.role] ?? 0xffffff;
        // measuredWidth/Height are screen-space bounds; restore the local text
        // dimensions first so the rotation below doesn't double-rotate the box.
        const local = resolveSonnetFrameLocalDimensions(placement);
        const box = new pixi.Graphics()
            .rect(
                -local.width / 2,
                -local.height / 2,
                local.width,
                local.height,
            )
            .stroke({ color, width: 1.5, alpha: 0.9 })
            .circle(0, 0, 2.5)
            .fill({ color, alpha: 0.9 });
        box.position.set(placement.x, placement.y);
        box.rotation = placement.rotation;
        layer.addChild(box);
    });
    return layer;
};

// --- Dev overlay state channel -------------------------------------------------
// The Pixi scene builder snapshots every shot's layout at build time and the
// runtime publishes the active one each frame; DevDebugOverlay's Sonnet tab
// reads this mutable store during render (dev tooling only, no reactivity).

export interface SonnetDebugSegmentSnapshot {
    text: string;
    role: SonnetTypographyPlacement['role'];
    x: number;
    y: number;
    width: number;
    height: number;
    fontScale: number;
    vertical: boolean;
}

export interface SonnetDebugShotInfo {
    programSeed: string;
    paragraphId: string;
    paragraphKind: SonnetParagraphKind;
    shotId: string;
    shotKind: SonnetShotKind;
    shotIndex: number;
    shotCount: number;
    lineIndices: number[];
    startTime: number;
    endTime: number;
    camera: SonnetShot['camera'];
    baseFontSize: number;
    wordCount: number;
    geoVariant: number | null;
    geoVariantLabel: string | null;
    backgroundMgLabel: string;
    fixedGeoLabel: string | null;
    backgroundDecorLabel: string;
    segments: SonnetDebugSegmentSnapshot[];
}

export const sonnetDebugState: {
    activeShot: SonnetDebugShotInfo | null;
    paragraphIndex: number;
} = {
    activeShot: null,
    paragraphIndex: -1,
};

// Human-readable label for a geo MG variant; only the themed/open ranges carry
// real names, the core/additional ranges stay numeric.
export const resolveSonnetGeoVariantLabel = (variant: number) => {
    if (variant >= SONNET_EXTENDED_GEO_VARIANT_START) {
        const name = SONNET_EXTENDED_GEO_VARIANTS[variant - SONNET_EXTENDED_GEO_VARIANT_START];
        return name ? `extended #${variant} ${name}` : `extended #${variant}`;
    }
    if (variant >= SONNET_OPEN_GEO_VARIANT_START) {
        const name = SONNET_OPEN_GEO_VARIANTS[variant - SONNET_OPEN_GEO_VARIANT_START];
        return name ? `open #${variant} ${name}` : `open #${variant}`;
    }
    if (variant >= SONNET_THEMED_GEO_VARIANT_START) {
        const name = SONNET_THEMED_GEO_VARIANTS[variant - SONNET_THEMED_GEO_VARIANT_START];
        return name ? `themed #${variant} ${name}` : `themed #${variant}`;
    }
    if (variant >= SONNET_ADDITIONAL_GEO_VARIANT_START) {
        return `additional #${variant}`;
    }
    return `core #${variant}`;
};

// Labels for the seeded background-layer variants; names come from each
// module's variant registry so the debug tab stays in sync automatically.
const labelFor = (prefix: string, names: readonly string[], variant: number) => {
    const name = names[variant];
    return name ? `${prefix} #${variant} ${name}` : `${prefix} #${variant}`;
};

// Builds the static per-shot snapshot consumed by the debug tab.
export const createSonnetShotDebugInfo = (options: {
    programSeed: string;
    paragraphId: string;
    paragraphKind: SonnetParagraphKind;
    shot: SonnetShot;
    shotIndex: number;
    shotCount: number;
    baseFontSize: number;
    wordCount: number;
    geoVariant: number | null;
    backgroundMgVariant: number;
    fixedGeoVariant: number | null;
    backgroundDecorVariant: number;
    placements: SonnetTypographyPlacement[];
    segmentTexts: string[];
}): SonnetDebugShotInfo => ({
    programSeed: options.programSeed,
    paragraphId: options.paragraphId,
    paragraphKind: options.paragraphKind,
    shotId: options.shot.id,
    shotKind: options.shot.kind,
    shotIndex: options.shotIndex,
    shotCount: options.shotCount,
    lineIndices: [...options.shot.lineIndices],
    startTime: options.shot.startTime,
    endTime: options.shot.endTime,
    camera: { ...options.shot.camera },
    baseFontSize: options.baseFontSize,
    wordCount: options.wordCount,
    geoVariant: options.geoVariant,
    geoVariantLabel: options.geoVariant === null
        ? null
        : resolveSonnetGeoVariantLabel(options.geoVariant),
    backgroundMgLabel: labelFor('bgMG', SONNET_BACKGROUND_MG_VARIANTS, options.backgroundMgVariant),
    fixedGeoLabel: options.fixedGeoVariant === null
        ? null
        : labelFor('fixedGeo', SONNET_FIXED_GEO_VARIANTS, options.fixedGeoVariant),
    backgroundDecorLabel: labelFor('decor', SONNET_BACKGROUND_DECOR_VARIANTS, options.backgroundDecorVariant),
    segments: options.placements.map(placement => ({
        text: options.segmentTexts[placement.segmentIndex] ?? placement.displayText,
        role: placement.role,
        x: placement.x,
        y: placement.y,
        width: placement.measuredWidth,
        height: placement.measuredHeight,
        fontScale: placement.fontScale,
        vertical: placement.vertical,
    })),
});
