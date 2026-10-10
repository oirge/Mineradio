import { describe, expect, it } from 'vitest';
import { squareGridCardBox } from '../../../src/library/suites/grid/shared/gridCardLayout';

// test/unit/gridView/gridCardLayout.test.ts
// The square-card option changes the wall's whole rhythm, not just one card's height. The first
// attempt squared the card by dropping its height alone and shipped a visibly sparse wall of
// undersized cards, so the constant-area property is pinned here rather than left to the eye.

// The four shipped breakpoints, smallest to largest.
const BREAKPOINTS = [
    { cardWidth: 180, cardHeight: 280, spacingX: 205, spacingY: 270 },
    { cardWidth: 220, cardHeight: 330, spacingX: 250, spacingY: 320 },
    { cardWidth: 250, cardHeight: 375, spacingX: 285, spacingY: 365 },
    { cardWidth: 280, cardHeight: 420, spacingX: 320, spacingY: 410 },
];

const area = (box: { cardWidth: number; cardHeight: number }) => box.cardWidth * box.cardHeight;
const cellArea = (box: { spacingX: number; spacingY: number }) => box.spacingX * box.spacingY;

describe('squareGridCardBox', () => {
    it('squares the desktop breakpoint without shrinking the card', () => {
        expect(squareGridCardBox(BREAKPOINTS[1])).toEqual({
            cardWidth: 269,
            cardHeight: 269,
            spacingX: 306,
            spacingY: 261,
        });
    });

    it.each(BREAKPOINTS)('keeps card and cell area within 1% at $cardWidth x $cardHeight', (box) => {
        const squared = squareGridCardBox(box);

        expect(squared.cardWidth).toBe(squared.cardHeight);
        expect(Math.abs(area(squared) / area(box) - 1)).toBeLessThan(0.01);
        expect(Math.abs(cellArea(squared) / cellArea(box) - 1)).toBeLessThan(0.01);
    });

    it.each(BREAKPOINTS)('keeps the row overlap and column gap in proportion at $cardWidth x $cardHeight', (box) => {
        const squared = squareGridCardBox(box);

        // Columns are gapped and rows overlap slightly; squaring must not flip either sign.
        expect(squared.spacingX - squared.cardWidth).toBeGreaterThan(0);
        expect(squared.spacingY - squared.cardHeight).toBeLessThan(0);
    });

    it('keeps every other breakpoint field untouched', () => {
        const box = { ...BREAKPOINTS[3], maxDistance: 660, lodStart: 450, lodEnd: 510 };

        expect(squareGridCardBox(box)).toMatchObject({ maxDistance: 660, lodStart: 450, lodEnd: 510 });
    });

    it('leaves an already square box alone', () => {
        const box = { cardWidth: 200, cardHeight: 200, spacingX: 240, spacingY: 190 };

        expect(squareGridCardBox(box)).toEqual(box);
    });
});
