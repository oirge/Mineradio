import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useMobileMotion } from '../../hooks/useMobileMotion';
import { mobileMotionTokens } from '../../utils/mobileMotion';

// src/mineradio/local/useLocalTrackListMotion.ts
// Discrete page commits animate at most eight visible rows; scrolling never schedules an animation.
export type LocalListMemory = RefObject<{ scope: string; top: number }>;
interface Props {
    scope: string;
    stale: boolean;
    identity: string;
    scrollMemory: LocalListMemory;
    entered: RefObject<boolean>;
}
export function useLocalTrackListMotion({ scope, stale, identity, scrollMemory, entered }: Props) {
    const { mobile, reducedMotion } = useMobileMotion();
    const list = useRef<HTMLDivElement>(null);
    const displayScope = useRef(scope);
    const restoredScope = useRef<string | undefined>(undefined);
    const previousScope = useRef<string | undefined>(undefined);
    const positions = useRef(new Map<string, number>());
    const animations = useRef(new Set<Animation>());
    displayScope.current = scope;

    useLayoutEffect(() => {
        const element = list.current;
        return () => {
            if (element) scrollMemory.current = { scope: displayScope.current, top: element.scrollTop };
        };
    }, [scrollMemory]);

    useLayoutEffect(() => {
        const element = list.current;
        const cancel = () => {
            animations.current.forEach(animation => animation.cancel());
            animations.current.clear();
        };
        cancel();
        if (!element || stale || !scope) return cancel;
        if (restoredScope.current !== scope) {
            element.scrollTop = scrollMemory.current.scope === scope ? scrollMemory.current.top : 0;
            restoredScope.current = scope;
        }
        const initial = !entered.current;
        const sameScope = previousScope.current === scope;
        const nextPositions = new Map<string, number>();
        const visible: Array<{ element: HTMLElement; key: string; top: number }> = [];
        const top = element.scrollTop;
        const bottom = top + element.clientHeight;
        // The host page is bounded to 60 rows; layout reads happen once per identity change.
        element.querySelectorAll<HTMLElement>('[data-local-row-key]').forEach(row => {
            const key = row.dataset.localRowKey!;
            const position = row.offsetTop;
            nextPositions.set(key, position);
            if (visible.length < mobileMotionTokens.listLimit && position < bottom && position + row.offsetHeight > top) {
                visible.push({ element: row, key, top: position });
            }
        });
        if (mobile && !reducedMotion && (initial || sameScope)) {
            visible.forEach((row, index) => {
                const previousTop = positions.current.get(row.key);
                const entering = initial || previousTop === undefined;
                const offset = entering ? mobileMotionTokens.distance : previousTop - row.top;
                if (!entering && Math.abs(offset) < 0.5 || typeof row.element.animate !== 'function') return;
                const animation = row.element.animate([
                    { opacity: entering ? 0 : 1, translate: `0 ${offset}px` },
                    { opacity: 1, translate: '0px 0px' },
                ], {
                    duration: mobileMotionTokens.component,
                    delay: initial ? Math.min(index * mobileMotionTokens.stagger, mobileMotionTokens.maxStagger) : 0,
                    easing: `cubic-bezier(${mobileMotionTokens.ease.join(',')})`,
                    fill: 'backwards',
                });
                animations.current.add(animation);
                animation.onfinish = () => {
                    if (!animations.current.delete(animation)) return;
                    animation.cancel();
                };
            });
        }
        if (nextPositions.size) entered.current = true;
        positions.current = nextPositions;
        previousScope.current = scope;
        return cancel;
    }, [scope, stale, identity, mobile, reducedMotion, scrollMemory, entered]);

    return list;
}
