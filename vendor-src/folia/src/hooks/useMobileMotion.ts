import { useSyncExternalStore } from 'react';
import { attachMobilePressFeedback } from './mobilePressFeedback';

// src/hooks/useMobileMotion.ts
// Shared subscriptions observe discrete preferences, never playback time or animation frames.
const compact = '(max-width: 900px), (pointer: coarse) and (max-width: 1100px) and (max-height: 600px)';
let reducedMedia: MediaQueryList | undefined;
let compactMedia: MediaQueryList | undefined;
const listeners = new Set<() => void>();
let observer: MutationObserver | undefined;
let parentObserver: MutationObserver | undefined;
let pressFeedback: ReturnType<typeof attachMobilePressFeedback> | undefined;

function readReduced() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
    return (reducedMedia ??= window.matchMedia('(prefers-reduced-motion: reduce)')).matches;
}
function readMobile() {
    if (typeof window === 'undefined') return false;
    try {
        if (window.parent !== window) return window.parent.document.body.classList.contains('mobile-layout');
    } catch { /* A standalone preview can have a different origin. */ }
    return typeof window.matchMedia === 'function' && (compactMedia ??= window.matchMedia(compact)).matches;
}
function notify() { pressFeedback?.clear(); listeners.forEach(listener => listener()); }
function observeMedia(media: MediaQueryList | undefined, observe: boolean) {
    if (!media) return;
    if (typeof media.addEventListener === 'function') {
        if (observe) media.addEventListener('change', notify);
        else media.removeEventListener('change', notify);
    } else {
        if (observe) media.addListener(notify);
        else media.removeListener(notify);
    }
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    if (listeners.size === 1) {
        readReduced(); readMobile();
        pressFeedback = attachMobilePressFeedback(() => readMobile() && !readReduced());
        if (typeof window.matchMedia === 'function') compactMedia ??= window.matchMedia(compact);
        observeMedia(reducedMedia, true);
        observeMedia(compactMedia, true);
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
        pressFeedback?.dispose(); pressFeedback = undefined;
        observeMedia(reducedMedia, false);
        observeMedia(compactMedia, false);
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
