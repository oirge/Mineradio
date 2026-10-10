// src/library/suites/grid/shared/gridCardLayout.ts
// Card-box adjustments the folia hex walls share. Kept out of GridView and ArtistGridView because
// both hold their own breakpoint table and would otherwise each carry a copy of this arithmetic.

export type GridCardBox = {
    cardWidth: number;
    cardHeight: number;
    spacingX: number;
    spacingY: number;
};

/**
 * Squares the card box for the square-card option, at constant area.
 *
 * The side is the geometric mean of the poster box, so the square card covers the same artwork
 * area the breakpoint was tuned to show — squaring by simply dropping the height instead loses a
 * third of the card and leaves the wall looking sparse. Each axis' spacing then scales by that
 * axis' own change, which keeps every gap in proportion and keeps the grid cell's area identical.
 *
 * The two scale factors multiply to exactly 1, so the wall's radial density is unchanged and
 * `maxDistance` / `lodStart` / `lodEnd` need no adjustment: a card N rings out sits where it did.
 */
export const squareGridCardBox = <T extends GridCardBox>(box: T): T => {
    const side = Math.round(Math.sqrt(box.cardWidth * box.cardHeight));
    return {
        ...box,
        cardWidth: side,
        cardHeight: side,
        spacingX: Math.round(box.spacingX * (side / box.cardWidth)),
        spacingY: Math.round(box.spacingY * (side / box.cardHeight)),
    };
};
