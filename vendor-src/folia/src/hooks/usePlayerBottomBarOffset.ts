import { useEffect } from 'react';
import { playerBottomBarLiveOffset } from '../stores/motionSignals';
import { usePlayerBottomBarLayoutStore } from '../stores/usePlayerBottomBarLayoutStore';
import { clampPlayerBottomBarOffset } from '../utils/playerBottomBarLayout';

// src/hooks/usePlayerBottomBarOffset.ts
// 把持久化的底部基线偏移量推进全局共享 MotionValue，让各页面的底部组件使用同一抬升量。

/** 定位期间不覆盖拖动信号；视口变化时重夹一次，避免窗口变矮后越过半屏。 */
export const usePlayerBottomBarOffset = (savedOffsetPx: number): void => {
    const isPositioning = usePlayerBottomBarLayoutStore(state => state.isPositioning);

    useEffect(() => {
        if (isPositioning) {
            return;
        }

        const apply = () => {
            playerBottomBarLiveOffset.set(clampPlayerBottomBarOffset(savedOffsetPx, window.innerHeight));
        };

        apply();
        window.addEventListener('resize', apply);
        return () => window.removeEventListener('resize', apply);
    }, [isPositioning, savedOffsetPx]);
};
