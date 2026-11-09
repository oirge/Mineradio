import { useSyncExternalStore } from 'react';

// src/hooks/useMobileMotion.ts
// Shared subscriptions observe discrete preferences, never playback time or animation frames.
const compact = '(max-width: 900px), (pointer: coarse) and (max-width: 1100px) and (max-height: 600px)';
let reducedMedia: MediaQueryList | undefined;
let compactMedia: MediaQueryList | undefined;
const listeners = new Set<() => void>();
let observer: MutationObserver | undefined;
let parentObserver: MutationObserver | undefined;

function readReduced() {
    return typeof window !== 'undefined' && (reducedMedia ??= window.matchMedia('(prefers-reduced-motion: reduce)')).matches;
}
function readMobile() {
    if (typeof window === 'undefined') return false;
    try {
        if (window.parent !== window) return window.parent.document.body.classList.contains('mobile-layout');
    } catch { /* A standalone preview can have a different origin. */ }
    return (compactMedia ??= window.matchMedia(compact)).matches;
}
function notify() { listeners.forEach(listener => listener()); }

function subscribe(listener: () => void) {
    listeners.add(listener);
    if (listeners.size === 1) {
        readReduced(); readMobile();
        compactMedia ??= window.matchMedia(compact);
        reducedMedia?.addEventListener('change', notify);
        compactMedia.addEventListener('change', notify);
        observer = new MutationObserver(notify);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        try {
            if (window.parent !== window) {
                parentObserver = new MutationObserver(notify);
                parentObserver.observe(window.parent.document.body, { attributes: true, attributeFilter: ['class'] });
            }
        } catch { /* The local media query is sufficient outside the embedded app. */ }
    }
    return () => {
        listeners.delete(listener);
        if (listeners.size) return;
        reducedMedia?.removeEventListener('change', notify);
        compactMedia?.removeEventListener('change', notify);
        observer?.disconnect(); parentObserver?.disconnect();
        observer = parentObserver = undefined;
    };
}
const serverSnapshot = () => false;

export function useMobileMotion() {
    const mobile = useSyncExternalStore(subscribe, readMobile, serverSnapshot);
    const reducedMotion = useSyncExternalStore(subscribe, readReduced, serverSnapshot);
    return { mobile, reducedMotion };
}
