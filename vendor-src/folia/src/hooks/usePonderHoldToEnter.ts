import { useEffect, useRef, type RefObject } from 'react';
import { usePonderStore } from '../stores/usePonderStore';
import { effectiveKeyCode, hasBlockingWindow, isTextEntryTarget } from '../utils/keyboardTargets';
import { PONDER_HOLD_DURATION_MS, startPonderHoldProgress, type PonderHoldProgressRefs } from './ponderHoldProgress';

// src/hooks/usePonderHoldToEnter.ts
// 长按 G 进入思索的状态机。
//
// 进度反馈本身在 ponderHoldProgress 里，和 Ctrl+G 那条页面级入口共用同一份 ——
// 两条路看起来必须完全一样。
//
// @note 长按 G 只属于非文本控件。输入框（包括命令面板搜索框）必须继续正常输入 g；
// 页面级入口由 Ctrl+G 承担，因此这里不需要再从文本输入中抢走可打印字符。

const BLOCKING_WINDOW_SELECTOR = '[data-folia-keyboard-window="true"]';

type PonderHoldRefs = PonderHoldProgressRefs & {
    hoveredElementRef: RefObject<Element | null>;
};

export const usePonderHoldToEnter = ({
    hoveredElementRef,
    wipeRef,
    labelRef,
    holdLabelRef,
}: PonderHoldRefs) => {
    const hoveredTargetId = usePonderStore(state => state.hoveredTargetId);
    const animationsRef = useRef<Animation[]>([]);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        if (!hoveredTargetId || typeof window === 'undefined') {
            return;
        }

        // 提示一出现就把教程层那个 chunk 预热，400ms 按满时通常已经就绪。
        void import('../components/ponder/PonderStage');

        const cancelHold = () => {
            animationsRef.current.forEach(animation => animation.cancel());
            animationsRef.current = [];
            if (timerRef.current !== null) {
                window.clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };

        const isArmed = () => timerRef.current !== null;

        const armHold = () => {
            animationsRef.current = startPonderHoldProgress({ wipeRef, labelRef, holdLabelRef });

            timerRef.current = window.setTimeout(() => {
                timerRef.current = null;
                animationsRef.current = [];
                // 按满的这一刻再确认一次：这 400ms 里指针可能已经移开了。
                if (usePonderStore.getState().hoveredTargetId !== hoveredTargetId) {
                    return;
                }
                usePonderStore.getState().openPonder(hoveredTargetId);
            }, PONDER_HOLD_DURATION_MS);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (effectiveKeyCode(event) !== 'KeyG' || event.repeat || event.isComposing) {
                return;
            }
            if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
                return;
            }

            // 可教学性看「悬停到的元素」，是否在打字看「焦点元素」—— 两者必须分开判断，
            // 否则命令面板那种输入框长期持有焦点的情况永远进不来。
            if (isTextEntryTarget(event.target)) {
                return;
            }
            const insideBlocking = Boolean(hoveredElementRef.current?.closest(BLOCKING_WINDOW_SELECTOR));
            if (!insideBlocking && hasBlockingWindow()) {
                return;
            }

            // 到这里 G 归我们了：吃掉它，别让字符落进底下的输入框。
            event.preventDefault();
            event.stopPropagation();

            if (!isArmed()) {
                armHold();
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (effectiveKeyCode(event) === 'KeyG') {
                cancelHold();
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden) cancelHold();
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        window.addEventListener('keyup', handleKeyUp, { capture: true });
        window.addEventListener('blur', cancelHold);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('keydown', handleKeyDown, { capture: true });
            window.removeEventListener('keyup', handleKeyUp, { capture: true });
            window.removeEventListener('blur', cancelHold);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            cancelHold();
        };
    }, [hoveredTargetId, hoveredElementRef, wipeRef, labelRef, holdLabelRef]);
};

export default usePonderHoldToEnter;
