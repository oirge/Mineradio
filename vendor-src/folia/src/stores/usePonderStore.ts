import { create } from 'zustand';
import { getStoredString } from './storagePrimitives';
import { isPonderHintVisibility, type PonderHintVisibility, type PonderTargetId } from '../types/ponder';
import { parsePonderSeen, serializePonderSeen, withPonderSeen } from '../utils/ponder/ponderSeenRecord';

// src/stores/usePonderStore.ts
// 「思索」教程的会话状态与设置。
//
// 这里只放离散事实：哪个目标正被悬停、有没有正在进行的教程、停在第几个场景、暂停没有。
// 光标坐标、擦除进度、时间线播放进度都不在这里 —— 它们是每帧值，分别住在 motionSignals
// 的 MotionValue、WAAPI 动画和 anime 的 timeline 里，一个都不许经过 React state。

const PONDER_HINT_VISIBILITY_STORAGE_KEY = 'ponder_hint_visibility';
const PONDER_TOUCH_BUTTON_STORAGE_KEY = 'ponder_touch_button';
const PONDER_SEEN_STORAGE_KEY = 'folia_ponder_seen';

const readStoredVisibility = (): PonderHintVisibility => {
    try {
        const saved = getStoredString(PONDER_HINT_VISIBILITY_STORAGE_KEY, 'unseen');
        return isPonderHintVisibility(saved) ? saved : 'unseen';
    } catch {
        // getStoredString 只挡 SSR，不挡隐私模式下 getItem 直接抛。
        // 这里必须自己兜住：读设置失败不该让整个 store 模块导入失败。
        return 'unseen';
    }
};

/**
 * 触屏上那颗思索按钮显不显示。默认显示。
 *
 * 它是触屏用户唯一的入口（没有悬停，也没有 Ctrl+G），所以默认不能关；但它确实是一颗
 * 浮在界面之上的常驻按钮，不想要的人必须能彻底关掉，而不是只能忍它露那几秒。
 */
const readStoredTouchButton = (): boolean => {
    try {
        return getStoredString(PONDER_TOUCH_BUTTON_STORAGE_KEY, 'on') !== 'off';
    } catch {
        return true;
    }
};

const readStoredSeen = (): Set<string> => {
    if (typeof window === 'undefined') {
        return new Set();
    }
    try {
        return parsePonderSeen(localStorage.getItem(PONDER_SEEN_STORAGE_KEY));
    } catch {
        // 隐私模式等读不到的情况：当作没看过，宁可多提示也不要让功能整个消失。
        return new Set();
    }
};

/** 正在进行的一次思索。null 表示没有教程在开。 */
type PonderSession = { targetId: PonderTargetId; sceneIndex: number };

type PonderState = {
    /** 悬停满 600ms 之后才会被置上，不是每次 pointermove 都写。 */
    hoveredTargetId: PonderTargetId | null;
    session: PonderSession | null;
    isPaused: boolean;
    seenTargetIds: ReadonlySet<string>;
    ponderHintVisibility: PonderHintVisibility;
    showPonderTouchButton: boolean;
    /** 思索导航页开着没有。帮助页那颗按钮开的就是它。 */
    isNavigationOpen: boolean;

    setHoveredTargetId: (targetId: PonderTargetId | null) => void;
    openPonder: (targetId: PonderTargetId, sceneIndex?: number) => void;
    closePonder: () => void;
    /** 在当前目标的场景之间循环切换；sceneCount 由调用方从注册表取。 */
    stepScene: (direction: -1 | 1, sceneCount: number) => void;
    setPaused: (paused: boolean) => void;
    markPonderSeen: (targetId: PonderTargetId) => void;
    setPonderHintVisibility: (visibility: PonderHintVisibility) => void;
    setShowPonderTouchButton: (show: boolean) => void;
    openNavigation: () => void;
    closeNavigation: () => void;
};

export const usePonderStore = create<PonderState>((set, get) => ({
    hoveredTargetId: null,
    session: null,
    isPaused: false,
    seenTargetIds: readStoredSeen(),
    ponderHintVisibility: readStoredVisibility(),
    showPonderTouchButton: readStoredTouchButton(),
    isNavigationOpen: false,

    setHoveredTargetId: targetId => {
        if (get().hoveredTargetId === targetId) {
            return;
        }
        set({ hoveredTargetId: targetId });
    },

    openPonder: (targetId, sceneIndex = 0) => {
        set({ session: { targetId, sceneIndex }, isPaused: false, hoveredTargetId: null });
        get().markPonderSeen(targetId);
    },

    closePonder: () => set({ session: null, isPaused: false }),

    stepScene: (direction, sceneCount) => {
        const { session } = get();
        if (!session || sceneCount <= 0) {
            return;
        }
        const nextIndex = (session.sceneIndex + direction + sceneCount) % sceneCount;
        set({ session: { ...session, sceneIndex: nextIndex }, isPaused: false });
    },

    setPaused: paused => set({ isPaused: paused }),

    markPonderSeen: targetId => {
        const next = withPonderSeen(get().seenTargetIds, targetId);
        if (!next) {
            return;
        }
        set({ seenTargetIds: next });
        try {
            localStorage.setItem(PONDER_SEEN_STORAGE_KEY, serializePonderSeen(next));
        } catch {
            // 写不进去就只在本次会话生效，不影响教程本身能看。
        }
    },

    setPonderHintVisibility: visibility => {
        set({ ponderHintVisibility: visibility });
        try {
            localStorage.setItem(PONDER_HINT_VISIBILITY_STORAGE_KEY, visibility);
        } catch {
            // 同上：设置不落盘也不该让当前会话失效。
        }
    },

    openNavigation: () => set({ isNavigationOpen: true }),

    closeNavigation: () => set({ isNavigationOpen: false }),

    setShowPonderTouchButton: show => {
        set({ showPonderTouchButton: show });
        try {
            localStorage.setItem(PONDER_TOUCH_BUTTON_STORAGE_KEY, show ? 'on' : 'off');
        } catch {
            // 同上。
        }
    },
}));

/** 设置面板与命令面板共用的一次性订阅。 */
export const selectPonderSettingsSnapshot = (state: PonderState) => ({
    ponderHintVisibility: state.ponderHintVisibility,
    setPonderHintVisibility: state.setPonderHintVisibility,
    showPonderTouchButton: state.showPonderTouchButton,
    setShowPonderTouchButton: state.setShowPonderTouchButton,
});
