import { useEffect, useRef } from 'react';
import { ponderPointerX, ponderPointerY } from '../stores/motionSignals';
import { usePonderStore } from '../stores/usePonderStore';
import { hasBlockingWindow } from '../utils/keyboardTargets';
import { FINE_POINTER_QUERY } from './useSupportsFinePointer';
import { shouldOfferPonderHint } from '../utils/ponder/ponderHintGate';
import { resolveHoveredPonderTarget } from '../components/ponder/ponderRegistry';
import type { PonderTargetDefinition } from '../types/ponder';

// src/hooks/usePonderHoverProbe.ts
// 「指针停在可教学区域上满 600ms」的探测。
//
// 一个委托监听，不做逐目标绑定 —— 目标可能根本没挂载（命令面板打开前不存在），
// 而且 N 个订阅者做一件事正是 guardrails 要避免的形状。
//
// 每帧只做一件事：把光标坐标写进 MotionValue。进 React state 的只有「悬停满 600ms 的是哪个
// 目标」这一个离散事实，且由 store 自己做相等性保护。

const HOVER_DELAY_MS = 600;

const BLOCKING_WINDOW_SELECTOR = '[data-folia-keyboard-window="true"]';

/** 返回当前悬停元素的 ref，长按那条链要用它判断是否落在模态内部。 */
export const usePonderHoverProbe = () => {
    const hoveredElementRef = useRef<Element | null>(null);
    const targetRef = useRef<PonderTargetDefinition | null>(null);
    const timerRef = useRef<number | null>(null);
    const finePointerRef = useRef(true);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const media = window.matchMedia(FINE_POINTER_QUERY);
        finePointerRef.current = media.matches;
        // 指针能力变化是离散事件（插拔鼠标、平板切换），可以进 ref 而不必重渲染。
        const handleMediaChange = (event: MediaQueryListEvent) => {
            finePointerRef.current = event.matches;
        };
        media.addEventListener('change', handleMediaChange);
        return () => media.removeEventListener('change', handleMediaChange);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        const clearTimer = () => {
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };

        const pumpPointer = (event: PointerEvent) => {
            ponderPointerX.set(event.clientX);
            ponderPointerY.set(event.clientY);
        };

        // pointermove 只在确实悬停着某个目标时才挂上。全程常开的话，整个应用的每一次
        // 鼠标移动都要过一遍这个回调，而它在 99% 的时间里无事可做。
        let isPumping = false;
        const startPumping = () => {
            if (isPumping) return;
            isPumping = true;
            window.addEventListener('pointermove', pumpPointer, { passive: true });
        };
        const stopPumping = () => {
            if (!isPumping) return;
            isPumping = false;
            window.removeEventListener('pointermove', pumpPointer);
        };

        const reset = () => {
            clearTimer();
            stopPumping();
            hoveredElementRef.current = null;
            targetRef.current = null;
            usePonderStore.getState().setHoveredTargetId(null);
        };

        const handlePointerOver = (event: PointerEvent) => {
            const element = event.target instanceof Element ? event.target : null;
            const target = resolveHoveredPonderTarget(element);

            if (!target) {
                if (targetRef.current) reset();
                return;
            }

            // 同一个目标内部移动不重启计时器，否则在按钮上蹭一下就永远等不到 600ms。
            if (targetRef.current?.id === target.id) {
                hoveredElementRef.current = element;
                return;
            }

            clearTimer();
            usePonderStore.getState().setHoveredTargetId(null);

            const { ponderHintVisibility, seenTargetIds } = usePonderStore.getState();
            const insideBlocking = Boolean(element?.closest(BLOCKING_WINDOW_SELECTOR));
            const allowed = shouldOfferPonderHint({
                visibility: ponderHintVisibility,
                targetId: target.id,
                seenIds: seenTargetIds,
                hasBlockingWindow: hasBlockingWindow(),
                isInsideBlockingWindow: insideBlocking,
                supportsFinePointer: finePointerRef.current,
            });
            if (!allowed || target.isAvailable?.() === false) {
                hoveredElementRef.current = null;
                targetRef.current = null;
                stopPumping();
                return;
            }

            hoveredElementRef.current = element;
            targetRef.current = target;
            pumpPointer(event);
            startPumping();

            timerRef.current = window.setTimeout(() => {
                timerRef.current = null;
                // 600ms 里状态可能变了（面板被打开、模态弹出），到点再确认一次。
                if (targetRef.current?.id !== target.id || target.isAvailable?.() === false) {
                    return;
                }
                usePonderStore.getState().setHoveredTargetId(target.id);
            }, HOVER_DELAY_MS);
        };

        const handlePointerOut = (event: PointerEvent) => {
            // relatedTarget 仍在同一目标内时不算离开。
            const next = event.relatedTarget instanceof Element ? event.relatedTarget : null;
            if (next && resolveHoveredPonderTarget(next)?.id === targetRef.current?.id) {
                return;
            }
            reset();
        };

        window.addEventListener('pointerover', handlePointerOver, { passive: true });
        window.addEventListener('pointerout', handlePointerOut, { passive: true });
        window.addEventListener('blur', reset);

        return () => {
            window.removeEventListener('pointerover', handlePointerOver);
            window.removeEventListener('pointerout', handlePointerOut);
            window.removeEventListener('blur', reset);
            stopPumping();
            clearTimer();
        };
    }, []);

    return hoveredElementRef;
};

export default usePonderHoverProbe;
