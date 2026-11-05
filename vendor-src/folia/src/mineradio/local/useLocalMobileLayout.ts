import { useEffect, useRef, useState } from 'react';

// Embedded phone layout and Android back handling; continuous playback stays in MotionValues.
type MobileWindow = Window & { MineradioFoliaMobileBack?: () => boolean };
const compact = '(max-width: 900px), (pointer: coarse) and (max-width: 1100px) and (max-height: 600px)';
function isMobile() {
    try {
        if (window.parent !== window) return window.parent.document.body.classList.contains('mobile-layout');
    } catch { /* Standalone preview uses its own viewport. */ }
    return window.matchMedia(compact).matches;
}
export function useLocalMobileLayout(onBack: () => boolean) {
    const [mobile, setMobile] = useState(isMobile);
    const back = useRef(onBack);
    back.current = onBack;
    useEffect(() => {
        const root = document.documentElement;
        const media = window.matchMedia(compact);
        let unfocusedHeight = window.innerHeight;
        let previousWidth = window.innerWidth;
        const refresh = () => {
            const enabled = isMobile();
            setMobile(previous => previous === enabled ? previous : enabled);
            root.classList.toggle('local-mobile', enabled);
            const height = Math.min(window.innerHeight, window.visualViewport?.height ?? window.innerHeight);
            const editing = document.activeElement?.matches('input:not([type=range]):not([type=checkbox]), textarea');
            if (!editing || Math.abs(window.innerWidth - previousWidth) > 80) unfocusedHeight = height;
            previousWidth = window.innerWidth;
            root.classList.toggle('local-mobile-keyboard-open', enabled && !!editing && unfocusedHeight - height > 120);
            if (enabled) document.body.classList.remove('mineradio-bar-hidden', 'mineradio-topnav-hidden');
        };
        const handleBack = () => {
            const event = new Event('mineradio-mobile-back', { cancelable: true });
            return !window.dispatchEvent(event) || back.current();
        };
        (window as MobileWindow).MineradioFoliaMobileBack = handleBack;
        const observer = new MutationObserver(refresh);
        try { observer.observe(window.parent.document.body, { attributes: true, attributeFilter: ['class'] }); } catch { /* Cross-origin preview. */ }
        media.addEventListener('change', refresh);
        window.addEventListener('resize', refresh, { passive: true });
        window.visualViewport?.addEventListener('resize', refresh, { passive: true });
        document.addEventListener('focusin', refresh);
        document.addEventListener('focusout', refresh);
        refresh();
        return () => {
            observer.disconnect();
            media.removeEventListener('change', refresh);
            window.removeEventListener('resize', refresh);
            window.visualViewport?.removeEventListener('resize', refresh);
            document.removeEventListener('focusin', refresh);
            document.removeEventListener('focusout', refresh);
            delete (window as MobileWindow).MineradioFoliaMobileBack;
            root.classList.remove('local-mobile', 'local-mobile-keyboard-open');
        };
    }, []);
    return mobile;
}
