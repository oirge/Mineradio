// src/hooks/mobilePressFeedback.ts
// Keep touch feedback independent of compatibility mouse events and React renders.
export function attachMobilePressFeedback(enabled: () => boolean) {
    let pressed: { pointerId: number; button: HTMLElement } | undefined;
    const clear = () => {
        pressed?.button.removeAttribute('data-mobile-pressed');
        pressed = undefined;
    };
    const down = (event: PointerEvent) => {
        if (event.defaultPrevented || !event.isPrimary || event.pointerType === 'mouse'
            || document.hidden || !enabled()) return;
        const button = event.target instanceof Element ? event.target.closest<HTMLElement>(
            '.local-player button:not(:where(.lattice-root *, .local-record-wall *))') : null;
        if (!button || button.matches(':disabled') || button.closest('[inert],[aria-disabled="true"]')) return;
        clear();
        pressed = { pointerId: event.pointerId, button };
        button.setAttribute('data-mobile-pressed', 'true');
    };
    const up = (event: PointerEvent) => { if (event.pointerId === pressed?.pointerId) clear(); };
    const visibility = () => { if (document.hidden) clear(); };
    // Bubble after the host's wake-only capture handler; consumed wake taps never press a button.
    document.addEventListener('pointerdown', down, { passive: true });
    document.addEventListener('pointerup', up, true);
    document.addEventListener('pointercancel', up, true);
    document.addEventListener('lostpointercapture', up, true);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('blur', clear);
    window.addEventListener('pagehide', clear);
    return {
        clear,
        dispose() {
            clear();
            document.removeEventListener('pointerdown', down);
            document.removeEventListener('pointerup', up, true);
            document.removeEventListener('pointercancel', up, true);
            document.removeEventListener('lostpointercapture', up, true);
            document.removeEventListener('visibilitychange', visibility);
            window.removeEventListener('blur', clear);
            window.removeEventListener('pagehide', clear);
        },
    };
}
