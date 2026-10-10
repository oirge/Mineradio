import type { Theme } from '../../../types';
import type { SonnetSemanticSegment } from './types';
import { hashSonnetSeed } from './sonnetRandom';
import { resolveSonnetGlyphMotionDuration } from './sonnetGlyphLayout';
import { easeSonnetElasticOut, easeSonnetExpoOut, clamp01 } from './sonnetMotion';
import type { SonnetTypographyPlacement } from './sonnetTypographyLayout';

// src/components/visualizer/sonnet/sonnetFrameDecor.ts
// Decorative open frames around a deterministic 30% subset of segments. Each
// frame traces its sides in with a growth animation, never fully closes at the
// corners, and finishes with a small floral/geometric ornament per corner.
export interface SonnetFrameDecorView {
    container: import('pixi.js').Container;
    startTime: number;
    endTime: number;
    update: (progress: number) => void;
}

type PixiModule = typeof import('pixi.js');

export const SONNET_FRAME_DECOR_PROBABILITY = 0.4;
export const SONNET_FRAME_DECOR_VARIANTS = 4;

interface SonnetFrameDecorSpec {
    applied: boolean;
    variant: number;
}

// Deterministic per-segment choice so seeks and replays keep the same frames.
export const resolveSonnetFrameDecorSpec = (segment: SonnetSemanticSegment): SonnetFrameDecorSpec => {
    const hash = hashSonnetSeed([
        segment.text,
        segment.startOffset,
        segment.endOffset,
        'frame-decor',
    ].join(':'));
    return {
        applied: (hash & 1023) / 1024 < SONNET_FRAME_DECOR_PROBABILITY,
        variant: (hash >>> 10) % SONNET_FRAME_DECOR_VARIANTS,
    };
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

// Dims the text color so frames read as a quiet secondary layer.
const dimmedColor = (pixi: PixiModule, color: string, multiplier: number) => {
    const base = pixi.Color.shared.setValue(color).toNumber();
    const r = Math.round(((base >> 16) & 255) * multiplier);
    const g = Math.round(((base >> 8) & 255) * multiplier);
    const b = Math.round((base & 255) * multiplier);
    return (r << 16) | (g << 8) | b;
};

interface FrameGeometry {
    halfW: number;
    halfH: number;
    cornerGap: number;
    pad: number;
}

interface Corner {
    x: number;
    y: number;
    sx: number;
    sy: number;
}

const resolveCorners = ({ halfW, halfH }: FrameGeometry): Corner[] => [
    { x: -halfW, y: -halfH, sx: -1, sy: -1 },
    { x: halfW, y: -halfH, sx: 1, sy: -1 },
    { x: halfW, y: halfH, sx: 1, sy: 1 },
    { x: -halfW, y: halfH, sx: -1, sy: 1 },
];

// Sides run clockwise from each corner to the next, inset by the corner gap so
// the outline stays deliberately unclosed.
const resolveSideEnds = (geometry: FrameGeometry, corners: Corner[], side: number) => {
    const from = corners[side];
    const to = corners[(side + 1) % 4];
    const insetX = to.x === from.x ? 0 : geometry.cornerGap * (to.x > from.x ? 1 : -1);
    const insetY = to.y === from.y ? 0 : geometry.cornerGap * (to.y > from.y ? 1 : -1);
    return {
        startX: from.x + insetX,
        startY: from.y + insetY,
        endX: to.x - insetX,
        endY: to.y - insetY,
    };
};

export interface SonnetFrameDecorOptions {
    segment: SonnetSemanticSegment;
    placement: SonnetTypographyPlacement;
    theme: Theme;
    fontSize: number;
    shotStartTime: number;
    shotEndTime: number;
    firstGlyphStartTime: number;
}

// Restores the local text dimensions before the frame container applies its rotation.
export const resolveSonnetFrameLocalDimensions = (
    placement: Pick<SonnetTypographyPlacement, 'measuredWidth' | 'measuredHeight' | 'rotation'>,
) => {
    const quarterTurns = Math.round(placement.rotation / (Math.PI / 2));
    const snappedRotation = quarterTurns * (Math.PI / 2);
    const isOddQuarterTurn = (
        Math.abs(placement.rotation - snappedRotation) < 1e-6
        && Math.abs(quarterTurns % 2) === 1
    );

    return isOddQuarterTurn
        ? { width: placement.measuredHeight, height: placement.measuredWidth }
        : { width: placement.measuredWidth, height: placement.measuredHeight };
};

// Builds the frame layer for one segment, or null when the segment draws no frame.
export const buildSonnetFrameDecor = (
    pixi: PixiModule,
    options: SonnetFrameDecorOptions,
): SonnetFrameDecorView | null => {
    if (options.placement.role === 'decoration') return null;
    const spec = resolveSonnetFrameDecorSpec(options.segment);
    if (!spec.applied) return null;

    const { placement, fontSize } = options;
    const pad = clamp(fontSize * 0.22, 8, 20);
    const frameDimensions = resolveSonnetFrameLocalDimensions(placement);
    const geometry: FrameGeometry = {
        halfW: frameDimensions.width / 2 + pad,
        halfH: frameDimensions.height / 2 + pad,
        cornerGap: 0,
        pad,
    };
    geometry.cornerGap = clamp(
        Math.min(geometry.halfW, geometry.halfH) * (spec.variant === 1 ? 0.42 : 0.3),
        6,
        30,
    );

    const color = dimmedColor(pixi, options.theme.primaryColor, 0.55);
    const corners = resolveCorners(geometry);
    const container = new pixi.Container();
    container.position.set(placement.x, placement.y);
    container.rotation = placement.rotation;
    const graphics = new pixi.Graphics();
    container.addChild(graphics);
    container.alpha = 0;

    const strokeWidth = clamp(fontSize * 0.03, 1.2, 2.2);

    // Traces the four sides clockwise, each side growing over its own window.
    const traceSides = (eased: number, dashed: boolean) => {
        for (let side = 0; side < 4; side++) {
            const sideProgress = clamp01((eased - side * 0.2) / 0.4);
            if (sideProgress <= 0) continue;
            const { startX, startY, endX, endY } = resolveSideEnds(geometry, corners, side);
            const tipX = startX + (endX - startX) * sideProgress;
            const tipY = startY + (endY - startY) * sideProgress;
            if (!dashed) {
                graphics.moveTo(startX, startY).lineTo(tipX, tipY)
                    .stroke({ color, width: strokeWidth, alpha: 0.85 });
                continue;
            }
            // Dashed variant: only dashes fully inside the traced tip are drawn.
            const sideLength = Math.hypot(endX - startX, endY - startY);
            if (sideLength < 1) continue;
            const ux = (endX - startX) / sideLength;
            const uy = (endY - startY) / sideLength;
            const dash = clamp(fontSize * 0.14, 5, 8);
            const gap = dash * 0.7;
            const traced = sideLength * sideProgress;
            for (let offset = 0; offset + dash <= traced + 0.001; offset += dash + gap) {
                graphics
                    .moveTo(startX + ux * offset, startY + uy * offset)
                    .lineTo(startX + ux * (offset + dash), startY + uy * (offset + dash))
                    .stroke({ color, width: strokeWidth, alpha: 0.85 });
            }
        }
    };

    const ornamentProgress = (eased: number, corner: number) => (
        easeSonnetElasticOut(clamp01((eased - 0.35 - corner * 0.14) / 0.3))
    );

    // Variant 0: crop-mark ticks sitting just outside each corner.
    const drawCornerTicks = (eased: number) => {
        const arm = clamp(pad * 0.8, 5, 12);
        const offset = 3;
        corners.forEach((corner, index) => {
            const op = ornamentProgress(eased, index);
            if (op <= 0.02) return;
            const innerX = corner.x + corner.sx * offset;
            const innerY = corner.y + corner.sy * offset;
            graphics
                .moveTo(innerX + corner.sx * arm * op, innerY)
                .lineTo(innerX, innerY)
                .lineTo(innerX, innerY + corner.sy * arm * op)
                .stroke({ color, width: strokeWidth, alpha: 0.9 * Math.min(1, op) });
        });
    };

    // Variant 1: a four-petal flower blooming at each corner.
    const drawCornerFlowers = (eased: number) => {
        const radius = clamp(pad * 0.55, 4, 9);
        corners.forEach((corner, index) => {
            const op = ornamentProgress(eased, index);
            if (op <= 0.02) return;
            const petal = radius * 0.44 * op;
            graphics.circle(corner.x - radius, corner.y, petal).fill({ color, alpha: 0.8 });
            graphics.circle(corner.x + radius, corner.y, petal).fill({ color, alpha: 0.8 });
            graphics.circle(corner.x, corner.y - radius, petal).fill({ color, alpha: 0.8 });
            graphics.circle(corner.x, corner.y + radius, petal).fill({ color, alpha: 0.8 });
            graphics.circle(corner.x, corner.y, radius * 0.3 * op).fill({ color: 0xffffff, alpha: 0.5 });
        });
    };

    // Variant 2: nested right-angle brackets plus a diamond at each side middle.
    const drawBrackets = (eased: number) => {
        const arm = clamp(pad, 6, 14);
        const offset = 2.5;
        corners.forEach((corner, index) => {
            const op = ornamentProgress(eased, index);
            if (op <= 0.02) return;
            const innerX = corner.x + corner.sx * offset;
            const innerY = corner.y + corner.sy * offset;
            graphics
                .moveTo(innerX + corner.sx * arm * op, innerY)
                .lineTo(innerX, innerY)
                .lineTo(innerX, innerY + corner.sy * arm * op)
                .stroke({ color, width: strokeWidth * 1.4, alpha: 0.9 });
            graphics
                .moveTo(innerX + corner.sx * (arm * op + 4), innerY + corner.sy * 4)
                .lineTo(innerX + corner.sx * 4, innerY + corner.sy * 4)
                .lineTo(innerX + corner.sx * 4, innerY + corner.sy * (arm * op + 4))
                .stroke({ color, width: strokeWidth * 0.8, alpha: 0.5 });
        });
        const diamond = clamp(pad * 0.45, 3.5, 7);
        for (let side = 0; side < 4; side++) {
            const op = ornamentProgress(eased, side);
            if (op <= 0.02) continue;
            const { startX, startY, endX, endY } = resolveSideEnds(geometry, corners, side);
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            const size = diamond * op;
            graphics
                .poly([midX, midY - size, midX + size, midY, midX, midY + size, midX - size, midY])
                .fill({ color, alpha: 0.85 });
        }
    };

    // Variant 3: small triangles pointing diagonally outward at each corner.
    const drawCornerTriangles = (eased: number) => {
        const size = clamp(pad * 0.6, 4, 9);
        const offset = 2;
        corners.forEach((corner, index) => {
            const op = ornamentProgress(eased, index);
            if (op <= 0.02) return;
            const diagX = corner.sx / Math.SQRT2;
            const diagY = corner.sy / Math.SQRT2;
            const perpX = corner.sy / Math.SQRT2;
            const perpY = -corner.sx / Math.SQRT2;
            const tipX = corner.x + diagX * (offset + size * op);
            const tipY = corner.y + diagY * (offset + size * op);
            const baseX = corner.x + diagX * offset;
            const baseY = corner.y + diagY * offset;
            const half = size * 0.7 * op;
            graphics
                .poly([
                    tipX, tipY,
                    baseX + perpX * half, baseY + perpY * half,
                    baseX - perpX * half, baseY - perpY * half,
                ])
                .fill({ color, alpha: 0.85 });
            graphics.circle(corner.x, corner.y, strokeWidth).fill({ color, alpha: 0.9 });
        });
    };

    // Redraws the frame for an animation progress; pure function, seek-safe.
    const update = (progress: number) => {
        const eased = easeSonnetExpoOut(clamp01(progress));
        graphics.clear();
        container.alpha = eased <= 0 ? 0 : 1;
        if (eased <= 0) return;
        traceSides(eased, spec.variant === 3);
        if (spec.variant === 0) drawCornerTicks(eased);
        else if (spec.variant === 1) drawCornerFlowers(eased);
        else if (spec.variant === 2) drawBrackets(eased);
        else drawCornerTriangles(eased);
    };

    const growDuration = resolveSonnetGlyphMotionDuration({
        startTime: options.shotStartTime,
        endTime: options.shotEndTime,
    }) * 1.25;
    const startTime = options.firstGlyphStartTime;
    return {
        container,
        startTime,
        endTime: startTime + growDuration,
        update,
    };
};
