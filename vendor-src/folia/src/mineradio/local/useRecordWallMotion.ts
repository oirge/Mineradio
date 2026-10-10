import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { animate, useDragControls, useMotionValue } from 'framer-motion';
import { useFoliaHexViewport } from '../../library/suites/grid/shared/useFoliaHexViewport';
import { recordWallBounds, recordWallNeighbor, type RecordWallLayout } from './recordWallLayout';
import { useRecordWallFrames } from './useRecordWallFrames';

// src/mineradio/local/useRecordWallMotion.ts
// Local composition of GridView's original hex viewport, drag inertia and spring parameters.
export function useRecordWallMotion(count: number, container: RefObject<HTMLDivElement | null>, layout: RecordWallLayout) {
    const x = useMotionValue(0), y = useMotionValue(0);
    const controls = useDragControls();
    const focus = useRef(0);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const dragging = useRef(false);
    const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const dragEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wheelTarget = useRef({ x: 0, y: 0 });
    const viewport = useFoliaHexViewport({
        itemCount: count, spacingX: layout.spacingX, spacingY: layout.spacingY,
        renderRadius: layout.renderRadius, renderRing: layout.renderRing, fallbackIndexRef: focus,
    });
    const { coords, renderedIndexes, renderedIndexesRef, updateRenderedIndexesForViewport: updateViewport } = viewport;
    const bounds = useMemo(() => recordWallBounds(coords, layout), [coords, layout]);
    const bindCard = useRecordWallFrames(coords, layout, x, y, renderedIndexesRef, focus, updateViewport);

    const clearCommit = useCallback(() => {
        if (commitTimer.current !== null) clearTimeout(commitTimer.current);
        commitTimer.current = null;
    }, []);
    const commitFocus = useCallback((index = focus.current) => {
        clearCommit();
        const safe = Math.max(0, Math.min(index, Math.max(count - 1, 0)));
        focus.current = safe;
        setFocusedIndex(previous => previous === safe ? previous : safe);
    }, [clearCommit, count]);
    const scheduleCommit = useCallback((delay: number) => {
        clearCommit();
        commitTimer.current = setTimeout(() => commitFocus(), delay);
    }, [clearCommit, commitFocus]);
    const centerOnIndex = useCallback((index: number, snap = true) => {
        const target = coords[index];
        if (!target) return;
        commitFocus(index);
        updateViewport(-target.baseX, -target.baseY, true);
        if (snap) {
            animate(x, -target.baseX, { type: 'spring', stiffness: 220, damping: 28 });
            animate(y, -target.baseY, { type: 'spring', stiffness: 220, damping: 28 });
        } else {
            x.stop(); y.stop(); x.set(-target.baseX); y.set(-target.baseY);
        }
    }, [coords, commitFocus, updateViewport, x, y]);

    useEffect(() => {
        centerOnIndex(Math.max(0, Math.min(focus.current, count - 1)), false);
    }, [centerOnIndex, count]);
    useEffect(() => {
        const syncTarget = () => { wheelTarget.current = { x: x.get(), y: y.get() }; };
        const stopX = x.on('change', syncTarget), stopY = y.on('change', syncTarget);
        return () => { stopX(); stopY(); };
    }, [x, y]);
    useEffect(() => {
        const element = container.current;
        if (!element) return;
        const onWheel = (event: WheelEvent) => {
            if (!count || event.ctrlKey || (event.target instanceof Element && event.target.closest('[data-wheel-scroll-region]'))) return;
            event.preventDefault();
            const scale = (event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? Math.max(layout.viewportHeight, 1) : 1) * 2.8;
            const shift = event.shiftKey && Math.abs(event.deltaX) < 1;
            const targetX = wheelTarget.current.x - (shift ? event.deltaY : event.deltaX) * scale;
            const targetY = wheelTarget.current.y - (shift ? 0 : event.deltaY) * scale;
            const next = { x: Math.max(bounds.left, Math.min(bounds.right, targetX)), y: Math.max(bounds.top, Math.min(bounds.bottom, targetY)) };
            wheelTarget.current = next;
            animate(x, next.x, { type: 'spring', stiffness: 560, damping: 48, mass: 0.65 });
            animate(y, next.y, { type: 'spring', stiffness: 560, damping: 48, mass: 0.65 });
            scheduleCommit(240);
        };
        element.addEventListener('wheel', onWheel, { passive: false });
        return () => element.removeEventListener('wheel', onWheel);
    }, [bounds, container, count, layout.viewportHeight, scheduleCommit, x, y]);
    useEffect(() => () => {
        clearCommit();
        if (dragEndTimer.current !== null) clearTimeout(dragEndTimer.current);
        x.stop(); y.stop();
    }, [clearCommit, x, y]);

    return { x, y, controls, bounds, coords, renderedIndexes, focusedIndex, bindCard, centerOnIndex, dragging,
        moveFocus: (key: string) => centerOnIndex(recordWallNeighbor(coords, focusedIndex, key)),
        onDragStart: () => {
            clearCommit();
            if (dragEndTimer.current !== null) clearTimeout(dragEndTimer.current);
            dragging.current = true;
        },
        onDragEnd: () => {
            dragEndTimer.current = setTimeout(() => { dragging.current = false; scheduleCommit(140); }, 50);
        },
    };
}
