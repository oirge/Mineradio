import { create } from 'zustand';
import { playerBottomBarLiveOffset } from './motionSignals';
import { PLAYER_BOTTOM_BAR_BASE_OFFSET_PX, clampPlayerBottomBarOffset } from '../utils/playerBottomBarLayout';

// src/stores/usePlayerBottomBarLayoutStore.ts
// Player 页底部基线的离散定位状态；pointer-move 频率的值留在 motionSignals。

type PlayerBottomBarLayoutState = {
    /** 定位模式：胶囊维持展开、不响应普通控制、可垂直拖动。 */
    isPositioning: boolean;
    /** 进入定位模式前的偏移量，用于取消时回滚。 */
    positioningStartOffset: number;
    /** 跨设置页和命令入口发送定位请求；对象身份保证重复请求也会触发。 */
    positioningRequest: { seq: number };
    requestPositioning: () => void;
    startPositioning: () => void;
    /** 提交当前共享 motion signal 的值，并返回应持久化的偏移量。 */
    commitPositioning: () => number;
    cancelPositioning: () => void;
};

export const usePlayerBottomBarLayoutStore = create<PlayerBottomBarLayoutState>((set, get) => ({
    isPositioning: false,
    positioningStartOffset: PLAYER_BOTTOM_BAR_BASE_OFFSET_PX,
    positioningRequest: { seq: 0 },
    requestPositioning: () => set(state => ({
        positioningRequest: { seq: state.positioningRequest.seq + 1 },
    })),
    startPositioning: () => {
        if (get().isPositioning) {
            return;
        }
        set({
            isPositioning: true,
            positioningStartOffset: playerBottomBarLiveOffset.get(),
        });
    },
    commitPositioning: () => {
        const committed = clampPlayerBottomBarOffset(
            playerBottomBarLiveOffset.get(),
            typeof window === 'undefined' ? 0 : window.innerHeight,
        );
        playerBottomBarLiveOffset.set(committed);
        set({ isPositioning: false, positioningStartOffset: committed });
        return committed;
    },
    cancelPositioning: () => {
        playerBottomBarLiveOffset.set(get().positioningStartOffset);
        set({ isPositioning: false });
    },
}));
