import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMobileMotion } from '../../hooks/useMobileMotion';
import { mobileMotionTokens } from '../../utils/mobileMotion';

// src/mineradio/local/useLocalViewMotion.ts
// One lightweight surface fades after its lazy renderer commits; old GPU runtimes never wait for an exit.
export function useLocalViewMotion(key: string, active: boolean, direction: number) {
    const { mobile, reducedMotion } = useMobileMotion();
    const surface = useRef<HTMLDivElement>(null);
    const animation = useRef<Animation | null>(null);
    const ticket = useMemo(() => ({ key }), [key]);
    const latest = useRef(ticket);
    const animatedTicket = useRef<typeof ticket | null>(null);
    latest.current = ticket;
    const [readyTicket, setReadyTicket] = useState<typeof ticket | null>(null);
    const ready = readyTicket === ticket;
    const onReady = useCallback(() => {
        if (latest.current === ticket) setReadyTicket(ticket);
    }, [ticket]);

    useLayoutEffect(() => {
        const element = surface.current;
        if (!element) return;
        animation.current?.cancel();
        animation.current = null;
        const enabled = mobile && !reducedMotion && active;
        element.style.opacity = enabled && !ready ? '0' : '1';
        element.style.translate = enabled && !ready ? `${direction * mobileMotionTokens.distance}px 0` : 'none';
        if (ready && animatedTicket.current !== ticket && enabled && typeof element.animate === 'function') {
            animatedTicket.current = ticket;
            const record = element.animate([
                { opacity: 0, translate: `${direction * mobileMotionTokens.distance}px 0` },
                { opacity: 1, translate: '0px 0px' },
            ], {
                duration: mobileMotionTokens.page,
                easing: `cubic-bezier(${mobileMotionTokens.pageEase.join(',')})`,
            });
            animation.current = record;
            record.onfinish = () => {
                if (animation.current !== record) return;
                animation.current = null;
                record.cancel();
            };
        }
        if (ready && !enabled) animatedTicket.current = ticket;
        return () => {
            animation.current?.cancel();
            animation.current = null;
            element.style.opacity = '1';
            element.style.translate = 'none';
        };
    }, [ticket, ready, active, mobile, reducedMotion, direction]);

    return { surface, onReady, loading: mobile && active && !ready, reducedMotion };
}
