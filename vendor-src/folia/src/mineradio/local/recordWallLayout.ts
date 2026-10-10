import type { HexGridCoord } from '../../library/suites/grid/shared/hexViewport';

// src/mineradio/local/recordWallLayout.ts
// GridView's original breakpoint table, render buffer, drag bounds and directional navigation.
export const recordWallLayout = (width: number, height: number) => {
    const box = width < 768
        ? { cardWidth: 180, cardHeight: 280, spacingX: 205, spacingY: 270, maxDistance: 420, lodStart: 280, lodEnd: 320 }
        : width < 1440
            ? { cardWidth: 220, cardHeight: 330, spacingX: 250, spacingY: 320, maxDistance: 500, lodStart: 340, lodEnd: 385 }
            : width < 2000
                ? { cardWidth: 250, cardHeight: 375, spacingX: 285, spacingY: 365, maxDistance: 580, lodStart: 400, lodEnd: 450 }
                : { cardWidth: 280, cardHeight: 420, spacingX: 320, spacingY: 410, maxDistance: 660, lodStart: 450, lodEnd: 510 };
    const clipRadius = Math.hypot(width / 2, height / 2) + Math.hypot(box.cardWidth, box.cardHeight) / 2 + 200;
    const renderRadius = clipRadius + Math.max(box.spacingX, box.spacingY) * 0.75;
    return { ...box, clipRadius, renderRadius, renderRing: Math.ceil(renderRadius / Math.min(box.spacingX, box.spacingY)) + 1,
        viewportWidth: width, viewportHeight: height, visibilityBuffer: 96 };
};
export type RecordWallLayout = ReturnType<typeof recordWallLayout>;

export function recordWallBounds(coords: HexGridCoord[], layout: RecordWallLayout) {
    if (!coords.length) return { left: 0, right: 0, top: 0, bottom: 0 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const coord of coords) {
        minX = Math.min(minX, coord.baseX); maxX = Math.max(maxX, coord.baseX);
        minY = Math.min(minY, coord.baseY); maxY = Math.max(maxY, coord.baseY);
    }
    const bufferX = Math.max(0, layout.viewportWidth / 2 - 2 * layout.spacingX);
    const bufferY = Math.max(0, layout.viewportHeight / 2 - 2 * layout.spacingY);
    return { left: -maxX - bufferX, right: -minX + bufferX, top: -maxY - bufferY, bottom: -minY + bufferY };
}

export function recordWallNeighbor(coords: HexGridCoord[], index: number, key: string): number {
    const current = coords[index];
    if (!current) return index;
    let best = index, minDistance = Infinity;
    for (const coord of coords) {
        const dx = coord.baseX - current.baseX, dy = coord.baseY - current.baseY;
        const matches = (key === 'ArrowLeft' && dx < -50 && Math.abs(dy) < 180)
            || (key === 'ArrowRight' && dx > 50 && Math.abs(dy) < 180)
            || (key === 'ArrowUp' && dy < -50 && Math.abs(dx) < 200)
            || (key === 'ArrowDown' && dy > 50 && Math.abs(dx) < 200);
        const distance = dx * dx + dy * dy;
        if (matches && distance < minDistance) { best = coord.index; minDistance = distance; }
    }
    return best;
}
