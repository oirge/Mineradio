import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

// src/hooks/useMediaQuery.ts
// Shared media query subscription so layout branches can read a breakpoint without hand-rolling matchMedia.

/**
 * Tracks whether `query` currently matches, staying in sync as the viewport changes.
 *
 * Reads the initial value straight from `matchMedia` through `useSyncExternalStore` rather than
 * settling it in an effect: a component that branches its markup on the result would otherwise
 * render the wrong branch on the first frame and visibly snap to the right one.
 */
export const useMediaQuery = (query: string): boolean => {
    const subscribe = useCallback((onStoreChange: () => void) => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return () => {};
        }

        const mediaQuery = window.matchMedia(query);
        mediaQuery.addEventListener('change', onStoreChange);
        return () => mediaQuery.removeEventListener('change', onStoreChange);
    }, [query]);

    const getSnapshot = useCallback(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return false;
        }

        return window.matchMedia(query).matches;
    }, [query]);

    return useSyncExternalStore(subscribe, getSnapshot, () => false);
};

const readDevicePixelRatio = (): number => (
    typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
);

/**
 * Current `devicePixelRatio`, so raster sources can be picked at the resolution the screen will
 * actually paint them at.
 *
 * Dragging a window onto a display with another density changes the ratio without changing the
 * CSS viewport, so `resize` misses it. The ratio is watched instead through a media query pinned
 * to its own current value: that query stops matching the instant the ratio moves, and the state
 * change re-runs the effect to pin a query to the new one.
 */
export const useDevicePixelRatio = (): number => {
    const [ratio, setRatio] = useState(readDevicePixelRatio);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
        const mediaQuery = window.matchMedia(`(resolution: ${ratio}dppx)`);
        const handleChange = () => setRatio(readDevicePixelRatio());
        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, [ratio]);

    return ratio;
};

export default useMediaQuery;
