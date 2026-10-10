import { useRef, useState } from 'react';

// src/hooks/useDragToScroll.ts
// Drag-to-scroll for the horizontal settings chip strip on narrow layouts.

/** Movement past this many pixels counts as a drag, so the release does not also select a chip. */
const DRAG_THRESHOLD_PX = 5;

export interface DragToScrollBinding {
    isDragging: boolean;
    /** True when the pointer moved far enough that the release should not be treated as a click. */
    hasDragged: () => boolean;
    handlers: {
        onMouseDown: (event: React.MouseEvent) => void;
        onMouseLeave: () => void;
        onMouseUp: () => void;
        onMouseMove: (event: React.MouseEvent) => void;
    };
}

export const useDragToScroll = (scrollContainerRef: React.RefObject<HTMLDivElement | null>): DragToScrollBinding => {
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);
    const hasDraggedRef = useRef(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (!scrollContainerRef.current) return;
        setIsDragging(true);
        hasDraggedRef.current = false;
        setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
        setScrollLeft(scrollContainerRef.current.scrollLeft);
    };

    const handleMouseLeave = () => {
        setIsDragging(false);
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollContainerRef.current) return;
        e.preventDefault();
        const x = e.pageX - scrollContainerRef.current.offsetLeft;
        const walk = (x - startX) * 1.5;
        if (Math.abs(walk) > DRAG_THRESHOLD_PX) {
            hasDraggedRef.current = true;
        }
        scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    };

    return {
        isDragging,
        hasDragged: () => hasDraggedRef.current,
        handlers: {
            onMouseDown: handleMouseDown,
            onMouseLeave: handleMouseLeave,
            onMouseUp: handleMouseUp,
            onMouseMove: handleMouseMove,
        },
    };
};

export default useDragToScroll;
