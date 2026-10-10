import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePonderStore } from '../stores/usePonderStore';
import { effectiveKeyCode } from '../utils/keyboardTargets';
import { openCurrentPagePonder, readCurrentPagePonderTarget } from '../services/ponder/pagePonderTarget';
import type { PonderTargetId } from '../types/ponder';
import { PONDER_HOLD_DURATION_MS, startPonderHoldProgress, type PonderHoldProgressRefs } from './ponderHoldProgress';

// src/hooks/usePagePonderShortcut.ts
// 页面级入口：长按 Ctrl+G。
//
// 和组件级那条（悬停后长按 G）走同一组进度动画。之前这里是按下即开，于是同一个功能有两种
// 触发感受 —— 一边要按住看擦除走满，一边一按就进。统一成长按之后，用户学会的是一件事。
//
// @note Ctrl+G 是页面级的，输入框（含命令面板搜索框）里也照常生效，所以不做文本目标判断。

export type PagePonderShortcutState = {
    /** 正在按住 Ctrl+G。提示胶囊靠它决定要不要出现。 */
    isHolding: boolean;
    /**
     * 松手会打开哪个页面教程。胶囊把它的名字写出来，用户按住的时候就知道讲的是哪一页。
     *
     * 在 keydown 当场解析一次：readVisiblePagePonderScope 要读 DOM，放进 render 里
     * 等于每次重渲染都强制一次重排，而它只在按下那一刻会变。
     */
    targetId: PonderTargetId | null;
};

export const usePagePonderShortcut = (refs: PonderHoldProgressRefs): PagePonderShortcutState => {
    const [isHolding, setIsHolding] = useState(false);
    const [targetId, setTargetId] = useState<PonderTargetId | null>(null);
    const { wipeRef, labelRef, holdLabelRef } = refs;
    const heldRef = useRef(false);

    useEffect(() => {
        const stopHold = () => {
            heldRef.current = false;
            setIsHolding(false);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (
                effectiveKeyCode(event) !== 'KeyG'
                || !event.ctrlKey
                || event.altKey
                || event.metaKey
                || event.shiftKey
                || event.isComposing
                || usePonderStore.getState().session
            ) {
                return;
            }

            // 自动重复的 keydown 也要吃掉：按住的这 400ms 里它一旦开始，
            // 一串 g 就会落进底下的输入框。
            event.preventDefault();
            event.stopPropagation();

            if (event.repeat || heldRef.current) {
                return;
            }
            const nextTargetId = readCurrentPagePonderTarget();
            setTargetId(nextTargetId);
            if (nextTargetId === null) return;
            heldRef.current = true;
            // 提示一出现就把教程层那个 chunk 预热，400ms 按满时通常已经就绪。
            void import('../components/ponder/PonderStage');
            setIsHolding(true);
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            // 松开 G 或松开 Ctrl 都算放弃 —— 按住 G 再松 Ctrl 之后擦除还在走会很怪。
            if (effectiveKeyCode(event) === 'KeyG' || event.key === 'Control') {
                stopHold();
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden) stopHold();
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        window.addEventListener('keyup', handleKeyUp, { capture: true });
        window.addEventListener('blur', stopHold);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
            window.removeEventListener('keyup', handleKeyUp, { capture: true });
            window.removeEventListener('blur', stopHold);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    // 动画和计时都挂在这里而不是 keydown 里：胶囊是 isHolding 变 true 之后才渲染的，
    // 在 keydown 当场去拿那几个 ref 只会拿到 null。
    useLayoutEffect(() => {
        if (!isHolding) {
            return;
        }
        const animations = startPonderHoldProgress({ wipeRef, labelRef, holdLabelRef });
        const timer = window.setTimeout(() => {
            heldRef.current = false;
            setIsHolding(false);
            openCurrentPagePonder();
        }, PONDER_HOLD_DURATION_MS);

        return () => {
            animations.forEach(animation => animation.cancel());
            window.clearTimeout(timer);
        };
    }, [isHolding, wipeRef, labelRef, holdLabelRef]);

    return { isHolding, targetId };
};

export default usePagePonderShortcut;
