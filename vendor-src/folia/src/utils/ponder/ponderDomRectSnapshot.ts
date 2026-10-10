import type { PonderRect, PonderSceneScript } from '../../types/ponder';

// src/utils/ponder/ponderDomRectSnapshot.ts
// A tutorial target is sampled while the pointer still holds its hover-only controls open. Later
// chapters reuse that geometry because the full-screen tutorial itself makes the real UI collapse.

export type PonderDomRectSnapshot = Record<string, PonderRect>;

/** Refresh every DOM selector that is currently measurable, retaining the last good missing ones. */
export const refreshPonderDomRectSnapshot = (
    scenes: readonly PonderSceneScript[],
    readRect: (selector: string) => PonderRect | null,
    previous: PonderDomRectSnapshot = {},
): PonderDomRectSnapshot => {
    const next = { ...previous };
    const visited = new Set<string>();

    scenes.forEach(scene => {
        Object.values(scene.anchors).forEach(source => {
            if (source.kind !== 'dom' || visited.has(source.selector)) return;
            visited.add(source.selector);
            const rect = readRect(source.selector);
            if (rect) next[source.selector] = rect;
        });
    });

    return next;
};
