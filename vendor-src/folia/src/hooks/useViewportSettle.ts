import { useSyncExternalStore } from 'react';

// src/hooks/useViewportSettle.ts
// One listener for every measured-text consumer in the app. Viewport-relative type — the poster
// title is `clamp(22px, 2vw, 36px)` — changes size continuously while a window is dragged, which
// invalidates every fit measured against the old size. Refitting per frame would cost far more
// than the fits are worth, so subscribers are told that a resize is under way, and then once that
// stops, that the new size is worth measuring against.

const QUIET_MS = 140;
let epoch = 0;
let resizing = false;
let snapshot = { epoch, resizing };
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

const publish = () => {
    snapshot = { epoch, resizing };
    for (const listener of listeners) listener();
};

const onResize = () => {
    clearTimeout(timer);
    if (!resizing) {
        resizing = true;
        publish();
    }
    timer = setTimeout(() => {
        resizing = false;
        epoch += 1;
        publish();
    }, QUIET_MS);
};

const subscribe = (listener: () => void) => {
    listeners.add(listener);
    if (listeners.size === 1 && typeof window !== 'undefined') window.addEventListener('resize', onResize);
    return () => {
        listeners.delete(listener);
        if (listeners.size || typeof window === 'undefined') return;
        window.removeEventListener('resize', onResize);
        clearTimeout(timer);
        timer = undefined;
        // The last subscriber leaving mid-drag must not strand the flag for the next one.
        if (resizing) {
            resizing = false;
            snapshot = { epoch, resizing };
        }
    };
};

const read = () => snapshot;

/** `resizing` while the window is being dragged; `epoch` increments once it comes to rest. */
export const useViewportSettle = () => useSyncExternalStore(subscribe, read, read);

export default useViewportSettle;
