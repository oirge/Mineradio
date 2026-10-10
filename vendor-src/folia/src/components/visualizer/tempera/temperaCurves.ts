import { temperaHash01 } from './temperaRandom';

// src/components/visualizer/tempera/temperaCurves.ts
// Pure, seed-driven generators for Tempera's rounded vocabulary: discs, lobed medallions,
// scalloped frills, arced ribbons and sticker plates. Same contract as `temperaHatch.ts` -
// no Pixi, no Math.random, geometry only - and every curve is emitted as a flat polygon so
// the existing fill/outline factories take them unchanged.
//
// Convexity is load bearing: `buildHatchLines` clips a line against edge half-planes, which
// only holds for convex shapes. `ellipsePolygon` and `roundedRectPolygon` are convex and may
// be handed to `drawHatchFill`; everything else here is concave (lobes, tips, notches) and is
// fill/outline only. Pixi triangulates concave polygons with earcut, so filling them is fine.
const TAU = Math.PI * 2;

/** A circle in composition space. `drawDiscs` / `drawRings` take arrays of these. */
export interface TemperaDisc {
    x: number;
    y: number;
    radius: number;
}

/** Convex. */
export const ellipsePolygon = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    segments = 32,
): number[] => {
    const count = Math.max(8, Math.round(segments));
    const points: number[] = [];
    for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * TAU;
        points.push(cx + Math.cos(angle) * rx, cy + Math.sin(angle) * ry);
    }
    return points;
};

/** Convex. The sticker plate: a rectangle whose corners are quarter arcs. */
export const roundedRectPolygon = (
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    cornerSegments = 6,
): number[] => {
    const limit = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
    const steps = Math.max(1, Math.round(cornerSegments));
    const corners: Array<[number, number, number]> = [
        [x + width - limit, y + limit, -Math.PI / 2],
        [x + width - limit, y + height - limit, 0],
        [x + limit, y + height - limit, Math.PI / 2],
        [x + limit, y + limit, Math.PI],
    ];
    const points: number[] = [];
    corners.forEach(([ccx, ccy, start]) => {
        for (let step = 0; step <= steps; step += 1) {
            const angle = start + (step / steps) * (Math.PI / 2);
            points.push(ccx + Math.cos(angle) * limit, ccy + Math.sin(angle) * limit);
        }
    });
    return points;
};

/** Rotates a polygon about a pivot. Convexity is preserved, so hatchable shapes stay hatchable. */
export const rotatePolygon = (polygon: number[], cx: number, cy: number, angle: number): number[] => {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const points: number[] = [];
    for (let index = 0; index < polygon.length; index += 2) {
        const dx = polygon[index] - cx;
        const dy = polygon[index + 1] - cy;
        points.push(cx + dx * cos - dy * sin, cy + dx * sin + dy * cos);
    }
    return points;
};

/**
 * Concave. An outline with `lobes` sinusoidal bumps, normalised so it still fits exactly in
 * rx/ry. A small amplitude reads as a cloud or a lace medallion, a large one as a rosette.
 */
export const lobedPolygon = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    lobes: number,
    amplitude: number,
    segments = 96,
): number[] => {
    const count = Math.max(24, Math.round(segments));
    const petals = Math.max(1, Math.round(lobes));
    const swell = Math.max(0, amplitude);
    const points: number[] = [];
    for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * TAU;
        const scale = (1 + Math.cos(angle * petals) * swell) / (1 + swell);
        points.push(cx + Math.cos(angle) * rx * scale, cy + Math.sin(angle) * ry * scale);
    }
    return points;
};

/**
 * Concave. A band with a flat edge at `flatY` and a row of tangent half-round bumps hanging
 * off `baseY` - the frill. Bump radius is half the bump width, so the count alone sets how
 * fine the lace reads.
 */
export const scallopBandPolygon = (
    x0: number,
    x1: number,
    flatY: number,
    baseY: number,
    bumps: number,
    segmentsPerBump = 10,
): number[] => {
    const count = Math.max(1, Math.round(bumps));
    const steps = Math.max(3, Math.round(segmentsPerBump));
    const span = (x1 - x0) / count;
    const radius = Math.abs(span) / 2;
    const direction = baseY >= flatY ? 1 : -1;
    const points: number[] = [x0, flatY, x1, flatY];
    // Walked right to left so the bumps chain onto the flat edge in one winding.
    for (let bump = count - 1; bump >= 0; bump -= 1) {
        const cx = x0 + span * (bump + 0.5);
        for (let step = 0; step <= steps; step += 1) {
            const angle = (step / steps) * Math.PI;
            points.push(cx + Math.cos(angle) * (span / 2), baseY + direction * Math.sin(angle) * radius);
        }
    }
    return points;
};

/**
 * Concave. The classic parametric heart, sampled and then normalised into the rx/ry box, so
 * callers size it like any other shape instead of carrying the curve's own scale.
 */
export const heartPolygon = (
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    segments = 64,
): number[] => {
    const count = Math.max(16, Math.round(segments));
    const raw: number[] = [];
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < count; index += 1) {
        const t = (index / count) * TAU;
        const x = Math.sin(t) ** 3 * 16;
        // Negated: the curve is written for maths-up, compositions draw in screen-down space.
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        raw.push(x, y);
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
    }
    const halfWidth = Math.max(1e-6, (maxX - minX) / 2);
    const halfHeight = Math.max(1e-6, (maxY - minY) / 2);
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const points: number[] = [];
    for (let index = 0; index < raw.length; index += 2) {
        points.push(
            cx + ((raw[index] - midX) / halfWidth) * rx,
            cy + ((raw[index + 1] - midY) / halfHeight) * ry,
        );
    }
    return points;
};

/**
 * Concave. One segment of a ring, from `startAngle` to `endAngle`. A ring of these leaves the
 * spokes between them and the hub inside them standing - which is how a ring gets punched out
 * of a plate without the middle falling out of it.
 */
export const annularSectorPolygon = (
    cx: number,
    cy: number,
    innerRadius: number,
    outerRadius: number,
    startAngle: number,
    endAngle: number,
    segments = 10,
): number[] => {
    const steps = Math.max(2, Math.round(segments));
    const points: number[] = [];
    for (let step = 0; step <= steps; step += 1) {
        const angle = startAngle + ((endAngle - startAngle) * step) / steps;
        points.push(cx + Math.cos(angle) * outerRadius, cy + Math.sin(angle) * outerRadius);
    }
    for (let step = steps; step >= 0; step -= 1) {
        const angle = startAngle + ((endAngle - startAngle) * step) / steps;
        points.push(cx + Math.cos(angle) * innerRadius, cy + Math.sin(angle) * innerRadius);
    }
    return points;
};

/** Concave. Four tips with a tight waist is the VN sparkle; more tips read as a star. */
export const starPolygon = (
    cx: number,
    cy: number,
    outerRadius: number,
    innerRadius: number,
    points: number,
    rotation = 0,
): number[] => {
    const tips = Math.max(3, Math.round(points));
    const polygon: number[] = [];
    for (let index = 0; index < tips * 2; index += 1) {
        const radius = index % 2 === 0 ? outerRadius : innerRadius;
        const angle = rotation - Math.PI / 2 + (index / (tips * 2)) * TAU;
        polygon.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    return polygon;
};

/**
 * Concave. A band whose centreline sags along half a sine wave and whose ends are cut square,
 * so it can run past both frame edges and still read as one curved ribbon.
 */
export const arcRibbonPolygon = (
    x0: number,
    x1: number,
    y: number,
    thickness: number,
    sag: number,
    steps = 28,
): number[] => {
    const count = Math.max(4, Math.round(steps));
    const half = thickness / 2;
    const top: number[] = [];
    const bottom: number[] = [];
    for (let index = 0; index <= count; index += 1) {
        const progress = index / count;
        const x = x0 + (x1 - x0) * progress;
        const centre = y + Math.sin(progress * Math.PI) * sag;
        top.push(x, centre - half);
        bottom.push(x, centre + half);
    }
    const points = [...top];
    for (let index = bottom.length - 2; index >= 0; index -= 2) {
        points.push(bottom[index], bottom[index + 1]);
    }
    return points;
};

/**
 * A seeded disc field on a jittered lattice. The lattice keeps the coverage even across the
 * frame; the per-cell jitter is what stops it reading as a grid of dots.
 */
export const buildDiscField = (
    seed: number,
    salt: number,
    width: number,
    height: number,
    count: number,
    radius: number,
): TemperaDisc[] => {
    const total = Math.max(0, Math.round(count));
    if (total === 0 || width <= 0 || height <= 0) return [];
    const columns = Math.max(1, Math.round(Math.sqrt(total * (width / height))));
    const rows = Math.max(1, Math.ceil(total / columns));
    const cellWidth = width / columns;
    const cellHeight = height / rows;
    const discs: TemperaDisc[] = [];
    for (let index = 0; index < total; index += 1) {
        const column = index % columns;
        const row = Math.floor(index / columns);
        discs.push({
            x: cellWidth * (column + 0.15 + temperaHash01(seed, index, salt) * 0.7),
            y: cellHeight * (row + 0.15 + temperaHash01(seed, index, salt + 3) * 0.7),
            radius: radius * (0.55 + temperaHash01(seed, index, salt + 7) * 0.75),
        });
    }
    return discs;
};
