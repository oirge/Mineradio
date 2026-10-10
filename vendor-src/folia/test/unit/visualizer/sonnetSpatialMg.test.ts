import { describe, expect, it } from 'vitest';
import {
    SONNET_GEO_VARIANT_COUNT,
    resolveSonnetHudRotationQuarterTurns,
    resolveSonnetGeoVariant,
    resolveSonnetMoleculeVariant,
} from '@/components/visualizer/sonnet/sonnetSpatialMgGeometry';
import {
    drawThemedSonnetShotMg,
    SONNET_THEMED_GEO_VARIANT_COUNT,
    SONNET_THEMED_GEO_VARIANT_START,
    SONNET_THEMED_GEO_VARIANTS,
} from '@/components/visualizer/sonnet/sonnetThemedShotMg';
import { drawAdditionalSonnetShotMg } from '@/components/visualizer/sonnet/sonnetAdditionalShotMg';
import {
    drawOpenSonnetShotMg,
    SONNET_OPEN_GEO_VARIANT_COUNT,
    SONNET_OPEN_GEO_VARIANT_START,
    SONNET_OPEN_GEO_VARIANTS,
} from '@/components/visualizer/sonnet/sonnetOpenFrameShotMg';
import {
    drawExtendedSonnetShotMg,
    SONNET_EXTENDED_GEO_VARIANT_COUNT,
    SONNET_EXTENDED_GEO_VARIANT_START,
    SONNET_EXTENDED_GEO_VARIANTS,
} from '@/components/visualizer/sonnet/sonnetExtendedShotMg';

// test/unit/visualizer/sonnetSpatialMg.test.ts
// Locks the expanded geometric recipes into Sonnet's existing single MG scene collection.
describe('Sonnet spatial MG variants', () => {
    it('extends the original collection without a second layer family', () => {
        expect(SONNET_GEO_VARIANT_COUNT).toBe(100);
        expect(Array.from({ length: 24 }, (_, seed) => resolveSonnetGeoVariant(seed)))
            .toEqual(Array.from({ length: 24 }, (_, seed) => seed));
    });

    it('keeps selection deterministic and safe for negative seeds', () => {
        for (let seed = -24; seed <= 24; seed += 1) {
            const variant = resolveSonnetGeoVariant(seed);
            expect(variant).toBe(resolveSonnetGeoVariant(seed));
            expect(variant).toBeGreaterThanOrEqual(0);
            expect(variant).toBeLessThan(SONNET_GEO_VARIANT_COUNT);
        }
    });

    it('distributes variant 3 across all molecule sub-variants', () => {
        expect([0, 1, 2].map(cycle => resolveSonnetMoleculeVariant(3 + cycle * SONNET_GEO_VARIANT_COUNT)))
            .toEqual([0, 1, 2]);
    });

    it('distributes variant 8 across all quarter-turn rotations', () => {
        expect([0, 1, 2, 3].map(cycle => resolveSonnetHudRotationQuarterTurns(8 + cycle * SONNET_GEO_VARIANT_COUNT)))
            .toEqual([0, 1, 2, 3]);
    });

    it('reserves twelve themed variants after the existing collection', () => {
        expect(SONNET_THEMED_GEO_VARIANT_START).toBe(24);
        expect(SONNET_THEMED_GEO_VARIANT_COUNT).toBe(12);
        expect(SONNET_THEMED_GEO_VARIANTS).toHaveLength(12);
        expect(SONNET_OPEN_GEO_VARIANT_START)
            .toBe(SONNET_THEMED_GEO_VARIANT_START + SONNET_THEMED_GEO_VARIANT_COUNT);
    });

    it('reserves twelve open-frame variants after the themed collection', () => {
        expect(SONNET_OPEN_GEO_VARIANT_START).toBe(36);
        expect(SONNET_OPEN_GEO_VARIANT_COUNT).toBe(12);
        expect(SONNET_OPEN_GEO_VARIANTS).toHaveLength(12);
        expect(SONNET_OPEN_GEO_VARIANT_START + SONNET_OPEN_GEO_VARIANT_COUNT)
            .toBe(SONNET_EXTENDED_GEO_VARIANT_START);
    });

    it('reserves fifty-two extended variants after the open-frame collection', () => {
        expect(SONNET_EXTENDED_GEO_VARIANT_START).toBe(48);
        expect(SONNET_EXTENDED_GEO_VARIANT_COUNT).toBe(52);
        expect(SONNET_EXTENDED_GEO_VARIANTS).toHaveLength(52);
        expect(SONNET_EXTENDED_GEO_VARIANT_START + SONNET_EXTENDED_GEO_VARIANT_COUNT)
            .toBe(SONNET_GEO_VARIANT_COUNT);
    });

    it('builds every extended background from staggered stroke commands', () => {
        let totalFills = 0;
        for (let index = 0; index < SONNET_EXTENDED_GEO_VARIANT_COUNT; index += 1) {
            let strokes = 0;
            let fills = 0;
            const target = {
                moveTo: () => target,
                lineTo: () => target,
                quadraticCurveTo: () => target,
                bezierCurveTo: () => target,
                arc: () => target,
                circle: () => target,
                rect: () => target,
                stroke: () => { strokes += 1; return target; },
                fill: () => { fills += 1; return target; },
            };
            const options = {
                target,
                variant: SONNET_EXTENDED_GEO_VARIANT_START + index,
                radius: 600,
                width: 1200,
                height: 600,
                seed: index + 31,
                primary: 0xffffff,
                secondary: 0x88ccff,
            };
            expect(drawExtendedSonnetShotMg(options)).toBe(true);
            expect(drawAdditionalSonnetShotMg(options)).toBe(true);
            // Multiple stroke commands per variant keep the shared stagger
            // schedule staggered instead of one monolithic draw.
            expect(strokes).toBeGreaterThan(2);
            totalFills += fills;
        }
        expect(totalFills).toBeGreaterThan(0);
    });

    it('builds every themed background from both wireframe and filled paths', () => {
        for (let index = 0; index < SONNET_THEMED_GEO_VARIANT_COUNT; index += 1) {
            let strokes = 0;
            let fills = 0;
            const target = {
                moveTo: () => target,
                lineTo: () => target,
                quadraticCurveTo: () => target,
                bezierCurveTo: () => target,
                arc: () => target,
                circle: () => target,
                rect: () => target,
                stroke: () => { strokes += 1; return target; },
                fill: () => { fills += 1; return target; },
            };
            expect(drawThemedSonnetShotMg({
                target,
                variant: SONNET_THEMED_GEO_VARIANT_START + index,
                radius: 600,
                width: 1200,
                height: 600,
                seed: index + 31,
                primary: 0xffffff,
                secondary: 0x88ccff,
            })).toBe(true);
            expect(strokes).toBeGreaterThan(0);
            expect(fills).toBeGreaterThan(0);
        }
    });

    it('builds every open-frame background from both wireframe and filled paths', () => {
        for (let index = 0; index < SONNET_OPEN_GEO_VARIANT_COUNT; index += 1) {
            let strokes = 0;
            let fills = 0;
            const target = {
                moveTo: () => target,
                lineTo: () => target,
                quadraticCurveTo: () => target,
                bezierCurveTo: () => target,
                arc: () => target,
                circle: () => target,
                rect: () => target,
                stroke: () => { strokes += 1; return target; },
                fill: () => { fills += 1; return target; },
            };
            const options = {
                target,
                variant: SONNET_OPEN_GEO_VARIANT_START + index,
                radius: 600,
                width: 1200,
                height: 600,
                seed: index + 31,
                primary: 0xffffff,
                secondary: 0x88ccff,
            };
            expect(drawOpenSonnetShotMg(options)).toBe(true);
            expect(drawAdditionalSonnetShotMg(options)).toBe(true);
            expect(strokes).toBeGreaterThan(0);
            expect(fills).toBeGreaterThan(0);
        }
    });

    it('overscans variants with exposed rectangular or landscape edges', () => {
        const width = 1200;
        const height = 600;
        for (const variant of [20, 22, 23, 30, 31, 32, 33, 34, 35]) {
            const xs: number[] = [];
            const target = {
                moveTo: (x: number) => { xs.push(x); return target; },
                lineTo: (x: number) => { xs.push(x); return target; },
                quadraticCurveTo: (cx: number, _cy: number, tx: number) => { xs.push(cx, tx); return target; },
                bezierCurveTo: (c1x: number, _c1y: number, c2x: number, _c2y: number, tx: number) => { xs.push(c1x, c2x, tx); return target; },
                arc: (cx: number) => { xs.push(cx); return target; },
                circle: (x: number) => { xs.push(x); return target; },
                rect: (x: number, _y: number, rectWidth: number) => { xs.push(x, x + rectWidth); return target; },
                stroke: () => target,
                fill: () => target,
            };
            expect(drawAdditionalSonnetShotMg({
                target,
                variant,
                radius: 600,
                width,
                height,
                seed: variant + 17,
                primary: 0xffffff,
                secondary: 0x88ccff,
            })).toBe(true);
            expect(Math.max(...xs.map(Math.abs))).toBeGreaterThan(width / 2);
        }
    });
});
