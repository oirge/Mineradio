import { useEffect, useRef, type RefObject } from 'react';
import type { MotionValue } from 'framer-motion';
import { applyHexCardFrameStyles, computeHexCardFrame, type HexCardFrameStyleCache } from '../../library/suites/grid/shared/hexCardTransform';
import type { HexGridCoord } from '../../library/suites/grid/shared/hexViewport';
import type { RecordWallLayout } from './recordWallLayout';

// src/mineradio/local/useRecordWallFrames.ts
// One coalesced frame performs the upstream transforms; drag frames never set React focus state.
export function useRecordWallFrames(
    coords: HexGridCoord[], layout: RecordWallLayout, x: MotionValue<number>, y: MotionValue<number>,
    indexes: RefObject<number[]>, focus: RefObject<number>, updateViewport: (x: number, y: number, force?: boolean) => void,
) {
    const elements = useRef(new Map<number, HTMLDivElement>());
    const caches = useRef(new Map<number, HexCardFrameStyleCache>());
    useEffect(() => {
        let raf: number | null = null;
        const update = () => {
            if (raf !== null) return;
            raf = requestAnimationFrame(() => {
                raf = null;
                const dx = x.get(), dy = y.get();
                updateViewport(dx, dy);
                let closest = focus.current, minDistance = Infinity;
                for (const index of indexes.current) {
                    const coord = coords[index];
                    if (!coord) continue;
                    const frame = computeHexCardFrame(coord, dx, dy, layout);
                    if (frame.distanceSq < minDistance) { closest = index; minDistance = frame.distanceSq; }
                    const element = elements.current.get(index);
                    if (!element) continue;
                    const cache = caches.current.get(index) || {};
                    caches.current.set(index, cache);
                    applyHexCardFrameStyles(element, frame, cache);
                }
                focus.current = closest;
            });
        };
        update();
        const stopX = x.on('change', update), stopY = y.on('change', update);
        return () => { stopX(); stopY(); if (raf !== null) cancelAnimationFrame(raf); };
    }, [coords, layout, x, y, indexes, focus, updateViewport]);
    return (index: number, element: HTMLDivElement | null) => {
        if (!element) { elements.current.delete(index); caches.current.delete(index); return; }
        elements.current.set(index, element);
        // A newly virtualized node needs its current transform even after the last motion frame.
        const coord = coords[index];
        if (coord) {
            const cache = {};
            applyHexCardFrameStyles(element, computeHexCardFrame(coord, x.get(), y.get(), layout), cache);
            caches.current.set(index, cache);
        }
    };
}
