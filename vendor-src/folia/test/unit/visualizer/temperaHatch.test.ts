import { describe, expect, it } from 'vitest';
import {
    buildCrossRow,
    buildCrossingLines,
    buildDotGrid,
    buildDotRow,
    buildHatchLines,
    buildHatchSpec,
    buildScribblePath,
    buildWavyPath,
    diamondPolygon,
    rectPolygon,
} from '@/components/visualizer/tempera/temperaHatch';

// test/unit/visualizer/temperaHatch.test.ts
// Locks the screentone generators: same seed means the same geometry, and every generated
// point stays inside the shape it was asked to fill.
const RECT = rectPolygon(10, 20, 200, 120);
const DIAMOND = diamondPolygon(100, 100, 60, 80);

const insideBounds = (polygon: number[]) => {
    const xs = polygon.filter((_, index) => index % 2 === 0);
    const ys = polygon.filter((_, index) => index % 2 === 1);
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
    };
};

describe('Tempera hatch generators', () => {
    it('derives a stable hatch spec from the seed', () => {
        expect(buildHatchSpec(1234, 7)).toEqual(buildHatchSpec(1234, 7));
        const spec = buildHatchSpec(1234, 7);
        expect(spec.spacing).toBeGreaterThan(0);
        expect(spec.width).toBeGreaterThan(0);
        expect(Math.abs(spec.angle)).toBeLessThanOrEqual(Math.PI);
        // Different salts must decorrelate, otherwise every shape in a shot hatches alike.
        const salts = new Set([7, 11, 13, 17, 23, 29].map(salt => JSON.stringify(buildHatchSpec(1234, salt))));
        expect(salts.size).toBeGreaterThan(1);
    });

    it('scales hatch spacing with the requested scale factor', () => {
        expect(buildHatchSpec(99, 3, 2).spacing).toBeCloseTo(buildHatchSpec(99, 3).spacing * 2, 6);
    });

    it('clips hatch lines to the polygon it fills', () => {
        [RECT, DIAMOND].forEach(polygon => {
            const lines = buildHatchLines(polygon, buildHatchSpec(42, 5));
            expect(lines.length).toBeGreaterThan(0);
            const bounds = insideBounds(polygon);
            lines.forEach(line => {
                [[line.x1, line.y1], [line.x2, line.y2]].forEach(([x, y]) => {
                    expect(x).toBeGreaterThanOrEqual(bounds.minX - 0.01);
                    expect(x).toBeLessThanOrEqual(bounds.maxX + 0.01);
                    expect(y).toBeGreaterThanOrEqual(bounds.minY - 0.01);
                    expect(y).toBeLessThanOrEqual(bounds.maxY + 0.01);
                });
            });
        });
    });

    it('is deterministic and shortens strokes as coverage drops', () => {
        const spec = buildHatchSpec(42, 5);
        expect(buildHatchLines(RECT, spec)).toEqual(buildHatchLines(RECT, spec));
        const full = buildHatchLines(RECT, spec);
        const half = buildHatchLines(RECT, spec, 0.5);
        expect(half).toHaveLength(full.length);
        const lengthOf = (line: { x1: number; y1: number; x2: number; y2: number }) => (
            Math.hypot(line.x2 - line.x1, line.y2 - line.y1)
        );
        half.forEach((line, index) => {
            expect(lengthOf(line)).toBeCloseTo(lengthOf(full[index]) * 0.5, 6);
        });
    });

    it('returns nothing for a degenerate shape or spacing', () => {
        expect(buildHatchLines([0, 0, 1, 1], buildHatchSpec(1, 1))).toEqual([]);
        expect(buildHatchLines(RECT, { angle: 0, spacing: 0, width: 1 })).toEqual([]);
    });

    it('keeps scribble paths bounded and repeatable', () => {
        const path = buildScribblePath(9001, 3, 100, 100, 40, 2);
        expect(path).toEqual(buildScribblePath(9001, 3, 100, 100, 40, 2));
        expect(path.length % 2).toBe(0);
        expect(path.length).toBeGreaterThanOrEqual(28);
        for (let index = 0; index < path.length; index += 2) {
            expect(Math.hypot(path[index] - 100, path[index + 1] - 100)).toBeLessThanOrEqual(40 * 1.5);
        }
        expect(buildScribblePath(9002, 3, 100, 100, 40, 2)).not.toEqual(path);
    });

    it('keeps the wavy edge inside its amplitude band', () => {
        const path = buildWavyPath(77, 5, 0, 200, 50, 6);
        expect(path).toEqual(buildWavyPath(77, 5, 0, 200, 50, 6));
        for (let index = 1; index < path.length; index += 2) {
            expect(Math.abs(path[index] - 50)).toBeLessThanOrEqual(6 * 1.5);
        }
    });

    it('spaces decor rows along their direction with bounded jitter', () => {
        const crosses = buildCrossRow(5, 9, 100, 50, 4, 30, 8);
        expect(crosses).toHaveLength(4);
        expect(crosses).toEqual(buildCrossRow(5, 9, 100, 50, 4, 30, 8));
        crosses.forEach((mark, index) => {
            expect(Math.abs(mark.x - (100 + index * 30))).toBeLessThanOrEqual(30 * 0.08 + 1e-6);
            expect(mark.y).toBeCloseTo(50, 6);
            expect(mark.size).toBeGreaterThan(0);
        });
        const dots = buildDotRow(5, 9, 100, 50, 3, 20, 4);
        expect(dots).toHaveLength(3);
        // Dots default to a vertical run, so the column keeps its x.
        dots.forEach(mark => expect(mark.x).toBeCloseTo(100, 6));
    });

    it('caps crossing lines at three and runs them past both edges', () => {
        expect(buildCrossingLines(11, 2, 800, 600, 9)).toHaveLength(3);
        expect(buildCrossingLines(11, 2, 800, 600, 0)).toHaveLength(0);
        buildCrossingLines(11, 2, 800, 600, 3).forEach(line => {
            expect(line.x1).toBeLessThan(0);
            expect(line.x2).toBeGreaterThan(800);
        });
    });

    it('builds an offset dot lattice for the paper screentone', () => {
        const marks = buildDotGrid(100, 100, 25);
        expect(marks.length).toBeGreaterThan(0);
        expect(marks).toEqual(buildDotGrid(100, 100, 25));
        // Odd rows are nudged by half a step so the lattice never reads as a square grid.
        const firstRowX = marks.filter(mark => mark.y === 0).map(mark => mark.x);
        const secondRowX = marks.filter(mark => mark.y === 25).map(mark => mark.x);
        expect(secondRowX[0] - firstRowX[0]).toBeCloseTo(12.5, 6);
        expect(buildDotGrid(100, 100, 0)).toEqual([]);
    });
});
