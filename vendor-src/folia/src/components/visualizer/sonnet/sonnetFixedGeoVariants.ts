import { AnimatedGraphics } from './sonnetAnimatedGraphics';
import { mixSonnetSeed } from './sonnetRandom';

// src/components/visualizer/sonnet/sonnetFixedGeoVariants.ts
// Seed-driven fixed-geometry compositions for the Sonnet `fixedGeo` layer.
// Fixed geometry counter-rotates against the camera, so these pieces read as
// stable print blocks (solid fill + hollow outline + hatching) behind the text.

export const SONNET_FIXED_GEO_VARIANT_COUNT = 8;

export const SONNET_FIXED_GEO_VARIANTS = [
    'classic-blocks', 'twin-pillars', 'disc-ring', 'diamond-pair',
    'stripe-stack', 'corner-els', 'twin-wedges', 'cross-ring',
] as const;

type PixiModule = typeof import('pixi.js');

export interface SonnetFixedGeoOptions {
    pixi: PixiModule;
    layer: import('pixi.js').Container;
    variant: number;
    radius: number;
    seed: number;
    primary: number;
    secondary: number;
}

export const resolveSonnetFixedGeoVariant = (seed: number) => (
    mixSonnetSeed(seed, 0x85ebca6b) % SONNET_FIXED_GEO_VARIANT_COUNT
);

// Diagonal hatch patch clipped by a static rect mask; the hatch strokes are
// recorded on an AnimatedGraphics so they grow with the shared stagger schedule.
const drawHatching = (
    pixi: PixiModule,
    primary: number,
    x: number,
    y: number,
    w: number,
    h: number,
    spacing: number,
    target: import('pixi.js').Container,
) => {
    const hatch = new AnimatedGraphics(pixi);
    for (let i = -w; i < w + h; i += spacing) {
        hatch.moveTo(x + i, y).lineTo(x + i + h, y + h).stroke({ color: primary, width: 1, alpha: 0.15 });
    }

    const mask = new pixi.Graphics();
    mask.rect(x, y, w, h).fill({ color: 0xffffff });
    hatch.mask = mask;

    target.addChild(hatch.display);
    target.addChild(mask);
    return hatch;
};

interface VariantContext extends SonnetFixedGeoOptions {
    geo: AnimatedGraphics;
    parts: AnimatedGraphics[];
    // Alternate accent color so identical shapes still differ between shots.
    accent: number;
}

const addHatch = (
    context: VariantContext,
    x: number,
    y: number,
    w: number,
    h: number,
    spacing = 6,
) => {
    context.parts.push(drawHatching(context.pixi, context.primary, x, y, w, h, spacing, context.layer));
};

// Variant 0: the original solid block + hollow frame + hatch patch trio.
const drawClassicBlocks = (context: VariantContext) => {
    const { geo, radius: r, primary } = context;
    geo.rect(-r * 0.4, -r * 0.2, r * 0.6, r * 0.15).fill({ color: primary, alpha: 0.7 });
    geo.rect(-r * 0.1, r * 0.1, r * 0.5, r * 0.3).stroke({ color: primary, width: 2, alpha: 0.6 });
    addHatch(context, -r * 0.3, -r * 0.4, r * 0.4, r * 0.25);
};

// Variant 1: one solid pillar beside a taller hollow frame, hatch strip between.
const drawTwinPillars = (context: VariantContext) => {
    const { geo, radius: r, primary, accent } = context;
    geo.rect(-r * 0.34, -r * 0.28, r * 0.12, r * 0.56).fill({ color: accent, alpha: 0.65 });
    geo.rect(-r * 0.34 + r * 0.035, -r * 0.28 + r * 0.035, r * 0.05, r * 0.49)
        .fill({ color: primary, alpha: 0.35 });
    geo.rect(r * 0.06, -r * 0.34, r * 0.28, r * 0.68).stroke({ color: primary, width: 2, alpha: 0.6 });
    geo.rect(r * 0.06 + r * 0.04, -r * 0.34 + r * 0.04, r * 0.2, r * 0.6)
        .stroke({ color: primary, width: 1, alpha: 0.3 });
    addHatch(context, -r * 0.14, -r * 0.2, r * 0.12, r * 0.4, 5);
};

// Variant 2: solid disc paired with a concentric hollow ring and a hatch chord.
const drawDiscRing = (context: VariantContext) => {
    const { geo, radius: r, primary, accent } = context;
    geo.circle(-r * 0.2, r * 0.12, r * 0.15).fill({ color: accent, alpha: 0.7 });
    geo.circle(-r * 0.2, r * 0.12, r * 0.06).fill({ color: primary, alpha: 0.5 });
    geo.circle(r * 0.14, -r * 0.06, r * 0.3).stroke({ color: primary, width: 2, alpha: 0.6 });
    geo.circle(r * 0.14, -r * 0.06, r * 0.22).stroke({ color: primary, width: 1, alpha: 0.3 });
    addHatch(context, r * 0.02, -r * 0.14, r * 0.24, r * 0.16, 5);
};

// Variant 3: large hollow diamond with a small solid companion diamond.
const drawDiamondPair = (context: VariantContext) => {
    const { geo, radius: r, primary, accent, seed } = context;
    const direction = seed % 2 === 0 ? 1 : -1;
    const dr = r * 0.3;
    const cx = -r * 0.08 * direction;
    geo.moveTo(cx, -dr).lineTo(cx + dr, 0).lineTo(cx, dr).lineTo(cx - dr, 0).lineTo(cx, -dr)
        .stroke({ color: primary, width: 2, alpha: 0.6 });
    geo.moveTo(cx, -dr * 0.7).lineTo(cx + dr * 0.7, 0).lineTo(cx, dr * 0.7).lineTo(cx - dr * 0.7, 0)
        .lineTo(cx, -dr * 0.7)
        .stroke({ color: primary, width: 1, alpha: 0.3 });
    const sr = r * 0.11;
    const sx = r * 0.3 * direction;
    const sy = -r * 0.2;
    geo.moveTo(sx, sy - sr).lineTo(sx + sr, sy).lineTo(sx, sy + sr).lineTo(sx - sr, sy).lineTo(sx, sy - sr)
        .fill({ color: accent, alpha: 0.7 });
    addHatch(context, sx - sr * 0.8, r * 0.16, sr * 1.6, sr * 1.2, 4);
};

// Variant 4: staggered horizontal stripe stack (solid / hollow / thin accent).
const drawStripeStack = (context: VariantContext) => {
    const { geo, radius: r, primary, accent, seed } = context;
    const direction = seed % 2 === 0 ? 1 : -1;
    geo.rect(-r * 0.36 * direction - r * 0.2, -r * 0.26, r * 0.56, r * 0.09)
        .fill({ color: accent, alpha: 0.7 });
    geo.rect(-r * 0.28, -r * 0.06, r * 0.56, r * 0.16).stroke({ color: primary, width: 2, alpha: 0.6 });
    geo.rect(-r * 0.2 * direction, r * 0.2, r * 0.4, r * 0.045).fill({ color: primary, alpha: 0.5 });
    addHatch(context, r * 0.26 * direction, -r * 0.3, r * 0.12, r * 0.6, 5);
};

// Variant 5: two thick corner Ls on a diagonal plus a hollow center square.
const drawCornerEls = (context: VariantContext) => {
    const { geo, radius: r, primary, accent, seed } = context;
    const direction = seed % 2 === 0 ? 1 : -1;
    const arm = r * 0.24;
    const thick = r * 0.07;
    // Top-left / bottom-right L pair (mirrored when direction flips).
    const x1 = -r * 0.3 * direction;
    const y1 = -r * 0.24;
    geo.rect(x1 - (direction < 0 ? arm : 0), y1, arm, thick).fill({ color: accent, alpha: 0.7 });
    geo.rect(direction < 0 ? x1 - arm : x1, y1, thick, arm).fill({ color: accent, alpha: 0.7 });
    const x2 = r * 0.3 * direction;
    const y2 = r * 0.24;
    geo.rect(direction < 0 ? x2 : x2 - arm, y2 - thick, arm, thick).fill({ color: primary, alpha: 0.55 });
    geo.rect(direction < 0 ? x2 + arm - thick : x2 - thick, y2 - arm, thick, arm)
        .fill({ color: primary, alpha: 0.55 });
    geo.rect(-r * 0.13, -r * 0.13, r * 0.26, r * 0.26).stroke({ color: primary, width: 2, alpha: 0.6 });
    addHatch(context, -r * 0.09 * direction, r * 0.02, r * 0.16, r * 0.1, 4);
};

// Variant 6: solid upward wedge against a hollow downward wedge.
const drawTwinWedges = (context: VariantContext) => {
    const { geo, radius: r, primary, accent, seed } = context;
    const direction = seed % 2 === 0 ? 1 : -1;
    const wx = -r * 0.14 * direction;
    geo.moveTo(wx, -r * 0.3).lineTo(wx + r * 0.24, r * 0.02).lineTo(wx - r * 0.24, r * 0.02)
        .lineTo(wx, -r * 0.3)
        .fill({ color: accent, alpha: 0.6 });
    const hx = r * 0.16 * direction;
    geo.moveTo(hx, r * 0.3).lineTo(hx + r * 0.24, -r * 0.02).lineTo(hx - r * 0.24, -r * 0.02)
        .lineTo(hx, r * 0.3)
        .stroke({ color: primary, width: 2, alpha: 0.6 });
    geo.moveTo(hx, r * 0.2).lineTo(hx + r * 0.15, 0).lineTo(hx - r * 0.15, 0).lineTo(hx, r * 0.2)
        .stroke({ color: primary, width: 1, alpha: 0.3 });
    addHatch(context, -r * 0.3 * direction - r * 0.05, r * 0.1, r * 0.2, r * 0.18, 5);
};

// Variant 7: solid plus mark centered inside a hollow ring with a hatch square.
const drawCrossRing = (context: VariantContext) => {
    const { geo, radius: r, primary, accent, seed } = context;
    const cx = (seed % 3 - 1) * r * 0.08;
    const arm = r * 0.17;
    const thick = r * 0.075;
    geo.rect(cx - arm, -thick / 2, arm * 2, thick).fill({ color: accent, alpha: 0.7 });
    geo.rect(cx - thick / 2, -arm, thick, arm * 2).fill({ color: accent, alpha: 0.7 });
    geo.circle(cx, 0, r * 0.3).stroke({ color: primary, width: 2, alpha: 0.6 });
    geo.circle(cx, 0, r * 0.36).stroke({ color: primary, width: 1, alpha: 0.25 });
    addHatch(context, cx + r * 0.18, r * 0.14, r * 0.16, r * 0.16, 4);
};

// Builds the seeded fixed-geometry composition into `layer` and returns every
// AnimatedGraphics part so the shot update loop can grow them together.
export const buildSonnetFixedGeo = (options: SonnetFixedGeoOptions): AnimatedGraphics[] => {
    const geo = new AnimatedGraphics(options.pixi);
    const context: VariantContext = {
        ...options,
        geo,
        parts: [geo],
        accent: options.seed % 2 === 0 ? options.secondary : options.primary,
    };
    options.layer.addChild(geo.display);

    switch (options.variant % SONNET_FIXED_GEO_VARIANT_COUNT) {
        case 1:
            drawTwinPillars(context);
            break;
        case 2:
            drawDiscRing(context);
            break;
        case 3:
            drawDiamondPair(context);
            break;
        case 4:
            drawStripeStack(context);
            break;
        case 5:
            drawCornerEls(context);
            break;
        case 6:
            drawTwinWedges(context);
            break;
        case 7:
            drawCrossRing(context);
            break;
        default:
            drawClassicBlocks(context);
    }
    return context.parts;
};
