import { temperaHash01 } from './temperaRandom';

// src/components/visualizer/tempera/temperaHatch.ts
// Pure, seed-driven generators for the screentone graphic language: diagonal hatch fills,
// hand-drawn scribble polylines and repeated decor rows. No Pixi, no Math.random.
export interface TemperaHatchSpec {
    /** Radians; the hatch direction inside the shape. */
    angle: number;
    /** Distance between two parallel strokes, in pixels. */
    spacing: number;
    /** Stroke width, in pixels. */
    width: number;
}

export interface TemperaHatchLine {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

export interface TemperaDecorMark {
    x: number;
    y: number;
    size: number;
    rotation: number;
}

const TAU = Math.PI * 2;
const MAX_HATCH_LINES = 320;

// Picks a hatch angle/spacing/width triple from the seed; density steps stay coarse so the
// same shape reads as one tone rather than as moiré.
export const buildHatchSpec = (seed: number, salt: number, scale = 1): TemperaHatchSpec => {
    const angleIndex = Math.floor(temperaHash01(seed, 1, salt) * 4);
    const angle = [-Math.PI / 4, Math.PI / 4, -Math.PI / 3, Math.PI / 6][angleIndex] ?? Math.PI / 4;
    const density = Math.floor(temperaHash01(seed, 2, salt) * 3);
    const spacing = ([9, 13, 18][density] ?? 13) * scale;
    const width = Math.max(0.8, spacing * (0.16 + temperaHash01(seed, 3, salt) * 0.14));
    return { angle, spacing, width };
};

export const rectPolygon = (x: number, y: number, width: number, height: number): number[] => [
    x, y,
    x + width, y,
    x + width, y + height,
    x, y + height,
];

// Convex polygon approximation of a circle, so the hatch clipper can fill round windows too.
export const circlePolygon = (cx: number, cy: number, radius: number, segments = 28): number[] => {
    const points: number[] = [];
    const count = Math.max(6, Math.round(segments));
    for (let index = 0; index < count; index += 1) {
        const angle = (index / count) * TAU;
        points.push(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
    }
    return points;
};

export const diamondPolygon = (cx: number, cy: number, rx: number, ry: number): number[] => [
    cx, cy - ry,
    cx + rx, cy,
    cx, cy + ry,
    cx - rx, cy,
];

// Clips an infinite line against a convex polygon by intersecting the edge half-planes;
// returns null when the line misses the shape entirely.
const clipToConvex = (
    polygon: number[],
    ax: number,
    ay: number,
    dx: number,
    dy: number,
    span: number,
): TemperaHatchLine | null => {
    const count = polygon.length / 2;
    let cx = 0;
    let cy = 0;
    for (let index = 0; index < count; index += 1) {
        cx += polygon[index * 2];
        cy += polygon[index * 2 + 1];
    }
    cx /= count;
    cy /= count;

    let tMin = -span;
    let tMax = span;
    for (let index = 0; index < count; index += 1) {
        const x0 = polygon[index * 2];
        const y0 = polygon[index * 2 + 1];
        const x1 = polygon[((index + 1) % count) * 2];
        const y1 = polygon[((index + 1) % count) * 2 + 1];
        let nx = y1 - y0;
        let ny = -(x1 - x0);
        // Force the normal outward by testing it against the polygon centroid.
        if (nx * (cx - x0) + ny * (cy - y0) > 0) {
            nx = -nx;
            ny = -ny;
        }
        const denominator = nx * dx + ny * dy;
        const numerator = nx * (ax - x0) + ny * (ay - y0);
        if (Math.abs(denominator) < 1e-9) {
            if (numerator > 0) return null;
            continue;
        }
        const t = -numerator / denominator;
        if (denominator > 0) tMax = Math.min(tMax, t);
        else tMin = Math.max(tMin, t);
        if (tMin > tMax) return null;
    }
    if (tMax - tMin < 0.5) return null;
    return {
        x1: ax + dx * tMin,
        y1: ay + dy * tMin,
        x2: ax + dx * tMax,
        y2: ay + dy * tMax,
    };
};

// Fills a convex polygon with parallel strokes; `coverage` (0..1) trims the ends so the fill
// can grow open from the shape center during a shot enter animation.
export const buildHatchLines = (
    polygon: number[],
    spec: TemperaHatchSpec,
    coverage = 1,
): TemperaHatchLine[] => {
    if (polygon.length < 6 || spec.spacing <= 0) return [];
    const xs: number[] = [];
    const ys: number[] = [];
    for (let index = 0; index < polygon.length; index += 2) {
        xs.push(polygon[index]);
        ys.push(polygon[index + 1]);
    }
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const diagonal = Math.hypot(maxX - minX, maxY - minY);
    if (diagonal <= 0) return [];

    const dx = Math.cos(spec.angle);
    const dy = Math.sin(spec.angle);
    // Step perpendicular to the stroke direction, sweeping the full shape diagonal.
    const px = -dy;
    const py = dx;
    // The sweep runs both ways from the shape center, so half the diagonal is enough.
    const steps = Math.min(MAX_HATCH_LINES / 2, Math.ceil(diagonal / (spec.spacing * 2)) + 2);
    const clampedCoverage = Math.min(1, Math.max(0, coverage));
    const lines: TemperaHatchLine[] = [];
    for (let step = -steps; step <= steps; step += 1) {
        const offset = step * spec.spacing;
        const clipped = clipToConvex(
            polygon,
            centerX + px * offset,
            centerY + py * offset,
            dx,
            dy,
            diagonal,
        );
        if (!clipped) continue;
        if (clampedCoverage >= 1) {
            lines.push(clipped);
            continue;
        }
        const midX = (clipped.x1 + clipped.x2) / 2;
        const midY = (clipped.y1 + clipped.y2) / 2;
        lines.push({
            x1: midX + (clipped.x1 - midX) * clampedCoverage,
            y1: midY + (clipped.y1 - midY) * clampedCoverage,
            x2: midX + (clipped.x2 - midX) * clampedCoverage,
            y2: midY + (clipped.y2 - midY) * clampedCoverage,
        });
    }
    return lines;
};

// Hand-drawn look without textures: a jittered spiral polyline that reads as a scribbled loop.
export const buildScribblePath = (
    seed: number,
    salt: number,
    cx: number,
    cy: number,
    radius: number,
    turns = 2,
): number[] => {
    const perTurn = 13;
    const total = Math.max(perTurn, Math.round(perTurn * Math.max(1, turns)));
    const points: number[] = [];
    for (let index = 0; index <= total; index += 1) {
        const progress = index / total;
        const angle = progress * TAU * Math.max(1, turns);
        const jitterR = (temperaHash01(seed, index, salt) - 0.5) * radius * 0.26;
        const jitterA = (temperaHash01(seed, index, salt + 7) - 0.5) * 0.22;
        const currentRadius = radius * (0.52 + 0.48 * progress) + jitterR;
        points.push(
            cx + Math.cos(angle + jitterA) * currentRadius,
            cy + Math.sin(angle + jitterA) * currentRadius * 0.82,
        );
    }
    return points;
};

// Wobbling horizontal edge used along the bottom of poster compositions.
export const buildWavyPath = (
    seed: number,
    salt: number,
    x0: number,
    x1: number,
    y: number,
    amplitude: number,
    steps = 24,
): number[] => {
    const points: number[] = [];
    const safeSteps = Math.max(2, Math.round(steps));
    for (let index = 0; index <= safeSteps; index += 1) {
        const progress = index / safeSteps;
        const wave = Math.sin(progress * TAU * 1.5 + temperaHash01(seed, 0, salt) * TAU);
        const jitter = (temperaHash01(seed, index, salt) - 0.5) * amplitude * 0.5;
        points.push(x0 + (x1 - x0) * progress, y + wave * amplitude + jitter);
    }
    return points;
};

// Evenly spaced marks along a direction, with per-mark seed jitter so the row never looks printed.
const buildMarkRow = (
    seed: number,
    salt: number,
    x: number,
    y: number,
    count: number,
    spacing: number,
    size: number,
    angle: number,
): TemperaDecorMark[] => {
    const marks: TemperaDecorMark[] = [];
    const total = Math.max(0, Math.round(count));
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    for (let index = 0; index < total; index += 1) {
        const jitter = (temperaHash01(seed, index, salt) - 0.5) * spacing * 0.16;
        const distance = index * spacing + jitter;
        marks.push({
            x: x + dx * distance,
            y: y + dy * distance,
            size: size * (0.82 + temperaHash01(seed, index, salt + 3) * 0.36),
            rotation: (temperaHash01(seed, index, salt + 11) - 0.5) * 0.3,
        });
    }
    return marks;
};

export const buildCrossRow = (
    seed: number,
    salt: number,
    x: number,
    y: number,
    count: number,
    spacing: number,
    size = 9,
    angle = 0,
) => buildMarkRow(seed, salt, x, y, count, spacing, size, angle);

export const buildDotRow = (
    seed: number,
    salt: number,
    x: number,
    y: number,
    count: number,
    spacing: number,
    size = 4,
    angle = Math.PI / 2,
) => buildMarkRow(seed, salt, x, y, count, spacing, size, angle);

// Even dot lattice used for the faint paper screentone behind the whole scene.
export const buildDotGrid = (
    width: number,
    height: number,
    spacing: number,
    size = 1.6,
): TemperaDecorMark[] => {
    const marks: TemperaDecorMark[] = [];
    if (spacing <= 0 || width <= 0 || height <= 0) return marks;
    const columns = Math.min(200, Math.ceil(width / spacing) + 1);
    const rows = Math.min(200, Math.ceil(height / spacing) + 1);
    for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
            // Offset every other row so the lattice reads as halftone rather than as a grid.
            marks.push({
                x: column * spacing + (row % 2 === 0 ? 0 : spacing / 2),
                y: row * spacing,
                size,
                rotation: 0,
            });
        }
    }
    return marks;
};

// One to three shallow lines that run past the viewport edges and carry the composition.
export const buildCrossingLines = (
    seed: number,
    salt: number,
    width: number,
    height: number,
    count: number,
): TemperaHatchLine[] => {
    const total = Math.min(3, Math.max(0, Math.round(count)));
    const lines: TemperaHatchLine[] = [];
    for (let index = 0; index < total; index += 1) {
        const anchorY = height * (0.18 + temperaHash01(seed, index, salt) * 0.64);
        const sign = temperaHash01(seed, index, salt + 5) > 0.5 ? 1 : -1;
        const angle = sign * (0.07 + temperaHash01(seed, index, salt + 9) * 0.11);
        // Reach well past both edges: the layer slides with the composition, and a line that
        // stopped at the frame would visibly detach from it.
        const reach = width * 0.9;
        lines.push({
            x1: -width * 0.3,
            y1: anchorY - Math.tan(angle) * reach,
            x2: width * 1.3,
            y2: anchorY + Math.tan(angle) * reach,
        });
    }
    return lines;
};
