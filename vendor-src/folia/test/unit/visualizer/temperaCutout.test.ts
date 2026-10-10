import { describe, expect, it } from 'vitest';
import { TEMPERA_SHOT_KINDS } from '@/components/visualizer/tempera/types';
import { TEMPERA_SHOT_PROFILES } from '@/components/visualizer/tempera/temperaShotProfiles';
import { resolveTemperaComposition } from '@/components/visualizer/tempera/temperaCompositions';
import { acrossFlow } from '@/components/visualizer/tempera/compositions/temperaCutout';
import type { TemperaCompositionContext } from '@/components/visualizer/tempera/temperaCompositionContext';

// test/unit/visualizer/temperaCutout.test.ts
// Locks the rule the punched families live by: an opening shows the DOM background layer,
// which WebGL cannot see, so the inversion filter has nothing to judge type against there.
// Every point of a layout region has to end up under opaque paint - the field, or a mass drawn
// over the opening - at any flow angle the compiler can produce, because corridors lean with
// the flow.
const WIDTH = 1280;
const HEIGHT = 720;
/** Fills fainter than this are washes, not cover; nothing in these families relies on one. */
const OPAQUE = 0.75;

interface Fill {
    polygon: number[];
    holes: number[][];
    alpha: number;
}

/**
 * The smallest Pixi stand-in that can run a composition. It records filled polygons and the
 * holes cut out of them, which is all the coverage question needs. Circles and rects are
 * ignored on purpose: leaving cover out can only make the assertion stricter.
 */
const createRecorder = () => {
    const collected: Fill[] = [];
    class StubGraphics {
        fills: Fill[] = [];
        lastPath: number[] = [];
        current: Fill | null = null;
        pivot = { set() {} };
        position = { set() {} };
        scale = { set() {} };
        rotation = 0;
        x = 0;
        y = 0;
        poly(points: number[]) {
            this.lastPath = points;
            return this;
        }
        circle() { return this; }
        rect() { return this; }
        moveTo() { return this; }
        lineTo() { return this; }
        fill(style?: { alpha?: number }) {
            if (this.lastPath.length >= 6) {
                this.current = { polygon: this.lastPath, holes: [], alpha: style?.alpha ?? 1 };
                this.fills.push(this.current);
            }
            return this;
        }
        stroke() { return this; }
        cut() {
            if (this.current) this.current.holes.push(this.lastPath);
            return this;
        }
    }
    class StubContainer {
        rotation = 0;
        position = { set() {} };
        addChild() {}
    }
    const pixi = {
        Graphics: StubGraphics,
        Container: StubContainer,
        Color: { shared: { setValue: () => ({ toNumber: () => 0 }) } },
        FillGradient: class {},
    } as unknown as TemperaCompositionContext['pixi'];
    return { collected, pixi, StubGraphics };
};

const palette = {
    paper: '#ffffff', ink: '#000000',
    blockA: '#111111', blockB: '#222222', blockC: '#333333',
    accent: '#444444', line: '#555555', shadow: '#666666',
    tone1: '#eeeeee', tone2: '#cccccc', tone3: '#888888', tone4: '#444444',
    gradient: null, textGradient: null,
} as unknown as TemperaCompositionContext['palette'];

const translate = (polygon: number[], dx: number, dy: number) => (
    dx === 0 && dy === 0
        ? polygon
        : polygon.map((value, index) => (index % 2 === 0 ? value + dx : value + dy))
);

const runComposition = (kind: typeof TEMPERA_SHOT_KINDS[number], flowAngle: number): Fill[] => {
    const { collected, pixi } = createRecorder();
    const offsets = new Map<unknown, { x: number; y: number }>();
    const ctx: TemperaCompositionContext = {
        pixi,
        kind,
        palette,
        decor: {
            motif: 'doodle',
            hatchAngle: 0.6,
            crossCount: 2,
            scribbleSeed: 11,
            fragments: [],
        } as unknown as TemperaCompositionContext['decor'],
        width: WIDTH,
        height: HEIGHT,
        seed: 4242,
        showDecor: true,
        flowAngle,
        bleed: 120,
        gradient: null,
        add: (node, _options, parent) => {
            const offset = (parent && offsets.get(parent)) || { x: 0, y: 0 };
            (node as unknown as { fills: Fill[] }).fills.forEach(fill => {
                collected.push({
                    polygon: translate(fill.polygon, offset.x, offset.y),
                    holes: fill.holes.map(hole => translate(hole, offset.x, offset.y)),
                    alpha: fill.alpha,
                });
            });
        },
        createGroup: (_rotation, x, y) => {
            const group = {} as never;
            offsets.set(group, { x, y });
            return group;
        },
    };
    resolveTemperaComposition(kind)(ctx);
    return collected;
};

/** Ray casting; the openings are not all convex, so a half-plane test would not do. */
const containsPoint = (polygon: number[], x: number, y: number) => {
    let inside = false;
    const count = polygon.length / 2;
    for (let index = 0, previous = count - 1; index < count; previous = index, index += 1) {
        const ax = polygon[index * 2];
        const ay = polygon[index * 2 + 1];
        const bx = polygon[previous * 2];
        const by = polygon[previous * 2 + 1];
        if ((ay > y) !== (by > y) && x < ((bx - ax) * (y - ay)) / (by - ay) + ax) inside = !inside;
    }
    return inside;
};

const isCovered = (fills: Fill[], x: number, y: number) => fills.some(fill => (
    fill.alpha >= OPAQUE
    && containsPoint(fill.polygon, x, y)
    && !fill.holes.some(hole => containsPoint(hole, x, y))
));

describe('Tempera cutouts', () => {
    it('keeps the flow-normal on one side of the frame however the flow points', () => {
        // Flow is vertical-dominant but points up in some shots and down in others; layout
        // regions are fixed data, so "offset by +n" has to mean the same side either way.
        [Math.PI / 2, Math.PI / 2 + 0.25, -Math.PI / 2, -Math.PI / 2 - 0.25].forEach(angle => {
            expect(acrossFlow(angle).x, `${angle}`).toBeGreaterThan(0);
        });
    });

    it('leaves no layout region see-through', () => {
        // Sampled rather than clipped: openings include concave crosses, wedges and ring
        // segments, and a sample grid states the actual requirement - no part of the type's box
        // has bare background behind it.
        const flowAngles = [Math.PI / 2, Math.PI / 2 + 0.25, Math.PI / 2 - 0.25, -Math.PI / 2, -Math.PI / 2 + 0.25];
        TEMPERA_SHOT_KINDS.forEach(kind => {
            const { region } = TEMPERA_SHOT_PROFILES[kind];
            const left = (region.cx - region.w / 2) * WIDTH;
            const top = (region.cy - region.h / 2) * HEIGHT;
            flowAngles.forEach(flowAngle => {
                const fills = runComposition(kind, flowAngle);
                if (!fills.some(fill => fill.holes.length > 0)) return;
                for (let column = 0; column <= 10; column += 1) {
                    for (let row = 0; row <= 6; row += 1) {
                        const x = left + (region.w * WIDTH * column) / 10;
                        const y = top + (region.h * HEIGHT * row) / 6;
                        expect(
                            isCovered(fills, x, y),
                            `${kind} @ ${flowAngle.toFixed(2)} (${Math.round(x)}, ${Math.round(y)})`,
                        ).toBe(true);
                    }
                }
            });
        });
    });

    it('cuts openings in the families that promise them', () => {
        const cutting = TEMPERA_SHOT_KINDS.filter(kind => (
            runComposition(kind, Math.PI / 2).some(fill => fill.holes.length > 0)
        ));
        // Both punched families plus the corridors; a silent regression to solid fields would
        // take the background layer out of the mode entirely.
        expect(cutting).toContain('iris-hole');
        expect(cutting).toContain('grid-focus');
        expect(cutting).toContain('bridge-span');
        expect(cutting.length).toBeGreaterThanOrEqual(20);
    });
});
