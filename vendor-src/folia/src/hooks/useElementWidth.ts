import { useEffect, useState } from 'react';

// src/hooks/useElementWidth.ts
// Tracks an element's rendered width so measured-size layout follows resizes.

/**
 * Returns the observed border-box width of `ref`, or 0 before the first measurement.
 *
 * Reading `window.innerWidth` during render is both unreactive — nothing re-renders on resize — and
 * wrong for an embedded renderer, where a small preview on a large display would size itself from
 * the display. Observe the container instead and let the caller decide its fallback.
 */
export const useElementWidth = (ref: React.RefObject<HTMLElement | null>): number => {
    const [width, setWidth] = useState(0);

    useEffect(() => {
        const node = ref.current;
        if (!node) {
            return;
        }

        const updateWidth = () => {
            const nextWidth = Math.round(node.clientWidth);
            setWidth(current => (current === nextWidth ? current : nextWidth));
        };

        updateWidth();

        if (typeof ResizeObserver === 'undefined') {
            return;
        }

        const observer = new ResizeObserver(updateWidth);
        observer.observe(node);
        return () => observer.disconnect();
    }, [ref]);

    return width;
};

export default useElementWidth;
