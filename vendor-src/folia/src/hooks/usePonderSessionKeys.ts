import { useEffect, useRef, type RefObject } from 'react';
import { usePonderStore } from '../stores/usePonderStore';
import { effectiveKeyCode } from '../utils/keyboardTargets';
import type { PonderTimelineControls } from '../components/ponder/usePonderTimeline';

// src/hooks/usePonderSessionKeys.ts
// 教程开着时的键盘：Esc 退出、←/→ 跳关键帧、[ ] 换场景、空格暂停。
//
// capture 阶段接管，并且**吃掉所有不带修饰键的按键**，不只是自己用到的那几个。
//
// 原本只拦自己处理的键，理由是「底下那些全局热键会因为教程层挂了
// data-folia-keyboard-window 而自动让路」。这个前提只对一部分成立：
// usePlaybackInteractionBridge 和 usePlayerPanelTabShortcut 确实查那个属性，
// 但命令面板的裸键处理走的是 App 传进去的 isBlocked prop，根本不读 DOM。
// 于是教程开着时按 S，命令面板会在教程层底下打开 —— e2e 抓到的就是这个。
//
// 全屏接管的教程层就该独占键盘。带 ctrl/alt/meta 的放过，浏览器和开发者工具的
// 快捷键不受影响；Tab 也放过，键盘焦点仍然走得动。

type UsePonderSessionKeysParams = {
    isActive: boolean;
    sceneCount: number;
    controlsRef: RefObject<PonderTimelineControls | null>;
    /** 任意一次会话内按键。自动续播的读条用它取消。 */
    onAnyKey?: () => void;
};

export const usePonderSessionKeys = ({ isActive, sceneCount, controlsRef, onAnyKey }: UsePonderSessionKeysParams) => {
    // 走 ref 而不是进依赖数组：回调每次渲染都是新函数，进去会让这个监听反复解绑重绑。
    const onAnyKeyRef = useRef(onAnyKey);
    onAnyKeyRef.current = onAnyKey;

    useEffect(() => {
        if (!isActive || typeof window === 'undefined') {
            return;
        }

        const handleKeyDown = (event: KeyboardEvent) => {
            // 浏览器/系统级组合键放过，Tab 放过：接管键盘不等于把无障碍焦点也锁死。
            if (event.ctrlKey || event.altKey || event.metaKey || effectiveKeyCode(event) === 'Tab') {
                return;
            }

            // 「按了键」这件事要在分发之前先报出去。自动续播的读条靠它取消，而下面
            // 认不出的键会被 stopImmediatePropagation 吃掉 —— 在外面再挂一个监听是收不到的。
            onAnyKeyRef.current?.();

            const controls = controlsRef.current;
            const store = usePonderStore.getState();

            switch (effectiveKeyCode(event)) {
                case 'Escape':
                    store.closePonder();
                    break;
                case 'ArrowLeft':
                    if (controls) {
                        controls.seekPrevKeyframe();
                        store.setPaused(true);
                    }
                    break;
                case 'ArrowRight':
                    if (controls) {
                        controls.seekNextKeyframe();
                        store.setPaused(true);
                    }
                    break;
                case 'BracketLeft':
                    store.stepScene(-1, sceneCount);
                    break;
                case 'BracketRight':
                    store.stepScene(1, sceneCount);
                    break;
                case 'Space':
                    if (controls) {
                        store.setPaused(controls.toggle());
                    }
                    break;
                default:
                    // 自己不认的键也要吃掉，别让它落到教程层底下的应用上。
                    // 不 preventDefault：这里没有任何要抑制的浏览器默认行为。
                    event.stopImmediatePropagation();
                    return;
            }

            event.preventDefault();
            event.stopImmediatePropagation();
        };

        window.addEventListener('keydown', handleKeyDown, { capture: true });
        return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
    }, [isActive, sceneCount, controlsRef]);
};

export default usePonderSessionKeys;
