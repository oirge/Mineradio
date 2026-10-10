import { describe, expect, it } from 'vitest';
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
} from '@/components/visualizer/tempera/temperaCurves';
import { buildHatchLines, buildHatchSpec } from '@/components/visualizer/tempera/temperaHatch';

// test/unit/visualizer/temperaCurves.test.ts
// Locks the rounded generators: the shapes that claim to be convex really are (the hatch
// clipper only works on those), every shape stays inside the box it was asked for, and the
// seeded disc field is deterministic.
const bounds = (polygon: number[]) => {
    const xs = polygon.filter((_, index) => index % 2 === 0);
    const ys = polygon.filter((_, index) => index % 2 === 1);
    return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
    };
};

/** Sign-consistent cross products around the ring means convex. */
const isConvex = (polygon: number[]) => {
    const count = polygon.length / 2;
    let sign = 0;
    for (let index = 0; index < count; index += 1) {
        const ax = polygon[index * 2];
        const ay = polygon[index * 2 + 1];
        const bx = polygon[((index + 1) % count) * 2];
        const by = polygon[((index + 1) % count) * 2 + 1];
        const cx = polygon[((index + 2) % count) * 2];
        const cy = polygon[((index + 2) % count) * 2 + 1];
        const cross = (bx - ax) * (cy - by) - (by - ay) * (cx - bx);
        if (Math.abs(cross) < 1e-9) continue;
        const current = cross > 0 ? 1 : -1;
        if (sign === 0) sign = current;
        else if (sign !== current) return false;
    }
    return true;
};

describe('Tempera curve generators', () => {
    it('keeps the hatchable shapes convex', () => {
        // buildHatchLines clips against edge half-planes; a concave shape would bleed strokes
        // outside itself, which is invisible until that one composition comes up in a song.
        expect(isConvex(ellipsePolygon(100, 80, 60, 40))).toBe(true);
        expect(isConvex(roundedRectPolygon(10, 20, 200, 120, 40))).toBe(true);
        expect(isConvex(rotatePolygon(roundedRectPolygon(10, 20, 200, 120, 40), 100, 80, 0.4))).toBe(true);

        const plate = roundedRectPolygon(10, 20, 200, 120, 40);
        const lines = buildHatchLines(plate, buildHatchSpec(7, 11));
        expect(lines.length).toBeGreaterThan(2);
        const box = bounds(plate);
        lines.forEach(line => {
            [[line.x1, line.y1], [line.x2, line.y2]].forEach(([x, y]) => {
                expect(x).toBeGreaterThanOrEqual(box.minX - 0.5);
                expect(x).toBeLessThanOrEqual(box.maxX + 0.5);
                expect(y).toBeGreaterThanOrEqual(box.minY - 0.5);
                expect(y).toBeLessThanOrEqual(box.maxY + 0.5);
            });
        });
    });

    it('clamps a rounded corner to half the shorter side', () => {
        // An over-large radius must degrade to a stadium, not fold the outline inside out.
        const stadium = roundedRectPolygon(0, 0, 200, 100, 400);
        expect(isConvex(stadium)).toBe(true);
        const box = bounds(stadium);
        expect(box.minX).toBeCloseTo(0, 5);
        expect(box.maxX).toBeCloseTo(200, 5);
        expect(box.maxY).toBeCloseTo(100, 5);
    });

    it('normalises the lobed outline and the heart into the requested box', () => {
        // Both curves carry their own natural scale; callers size them like any other shape.
        [lobedPolygon(100, 100, 60, 40, 6, 0.34), heartPolygon(100, 100, 60, 40)].forEach(polygon => {
            const box = bounds(polygon);
            expect(box.minX).toBeGreaterThanOrEqual(40 - 1);
            expect(box.maxX).toBeLessThanOrEqual(160 + 1);
            expect(box.minY).toBeGreaterThanOrEqual(60 - 1);
            expect(box.maxY).toBeLessThanOrEqual(140 + 1);
            expect(box.maxX - box.minX).toBeGreaterThan(60);
        });
        // A heart points down, so its widest part sits above its own centre.
        const heart = heartPolygon(100, 100, 60, 40);
        const widest = bounds(heart);
        expect(widest.maxY - 100).toBeCloseTo(40, 0);
    });

    it('emits closed rings with the tips and bumps the caller asked for', () => {
        expect(starPolygon(0, 0, 40, 8, 4).length / 2).toBe(8);
        expect(lobedPolygon(0, 0, 40, 40, 6, 0.3).length / 2).toBeGreaterThanOrEqual(24);
        // Scallop: the flat edge is two points, then one arc per bump.
        const frill = scallopBandPolygon(0, 300, 0, 100, 5, 8);
        expect(frill.length / 2).toBe(2 + 5 * 9);
        const box = bounds(frill);
        expect(box.minX).toBeCloseTo(0, 5);
        expect(box.maxX).toBeCloseTo(300, 5);
        // Bumps hang past the base line by the bump radius, which is half a bump's width.
        expect(box.maxY).toBeCloseTo(130, 5);
    });

    it('sags the ribbon without moving its ends', () => {
        const ribbon = arcRibbonPolygon(0, 400, 200, 60, 50);
        const box = bounds(ribbon);
        expect(box.minX).toBeCloseTo(0, 5);
        expect(box.maxX).toBeCloseTo(400, 5);
        // Ends stay on the straight centreline; only the middle drops.
        expect(ribbon[1]).toBeCloseTo(170, 5);
        expect(box.maxY).toBeCloseTo(280, 5);
    });

    it('builds a deterministic disc field inside the frame', () => {
        const field = buildDiscField(1234, 7, 1280, 720, 9, 60);
        expect(field).toEqual(buildDiscField(1234, 7, 1280, 720, 9, 60));
        expect(field).toHaveLength(9);
        // A different seed must move the discs, otherwise every shot bubbles identically.
        expect(buildDiscField(99, 7, 1280, 720, 9, 60)).not.toEqual(field);
        field.forEach(disc => {
            expect(disc.x).toBeGreaterThan(0);
            expect(disc.x).toBeLessThan(1280);
            expect(disc.y).toBeGreaterThan(0);
            expect(disc.y).toBeLessThan(720);
            expect(disc.radius).toBeGreaterThan(0);
        });
        // Sizes have to spread, or the field reads as a printed dot screen.
        const radii = field.map(disc => disc.radius);
        expect(Math.max(...radii) / Math.min(...radii)).toBeGreaterThan(1.2);
        expect(buildDiscField(1, 1, 1280, 720, 0, 10)).toEqual([]);
    });
});
