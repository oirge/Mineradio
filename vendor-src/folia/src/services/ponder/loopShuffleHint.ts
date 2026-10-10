import { Lightbulb } from 'lucide-react';
import i18n from '../../i18n/config';
import { usePonderStore } from '../../stores/usePonderStore';
import { setStatusMessage, useStatusMessageStore } from '../../stores/useStatusMessageStore';

// src/services/ponder/loopShuffleHint.ts
// 连点循环按钮时的「想找随机播放吗」提示。
//
// 别的播放器把随机做成循环按钮上的一档，于是找随机的人会在循环按钮上一直点。Folia 没有随机
// 模式，所以连点到第三下就弹一条不打断操作的提示，点它进 queue-shuffle 思索。
// 提示只弹两次：看过两次还在点的人，不是在找随机。
// 凑满三下后不立刻弹，而是等连点停下（MAX_PRESS_GAP_MS 内没有新的一下）再弹，
// 否则会被后续每一下点击带出的循环模式 toast 盖掉。

const HINT_COUNT_STORAGE_KEY = 'folia_loop_shuffle_hint_count';
const PRESSES_TO_TRIGGER = 3;
/** 两下之间超过这个间隔就不算连点，从头数。 */
const MAX_PRESS_GAP_MS = 1500;
const MAX_HINT_SHOWS = 2;
const HINT_DURATION_MS = 8000;

export type LoopPressStreak = { count: number; lastAt: number };

/** 记一次按下，返回新的连点状态和这一下是否凑满了次数。凑满后从零重新数。 */
export const advanceLoopPressStreak = (
    streak: LoopPressStreak,
    now: number,
): { streak: LoopPressStreak; triggered: boolean } => {
    const count = now - streak.lastAt <= MAX_PRESS_GAP_MS ? streak.count + 1 : 1;
    return count >= PRESSES_TO_TRIGGER
        ? { streak: { count: 0, lastAt: now }, triggered: true }
        : { streak: { count, lastAt: now }, triggered: false };
};

const readShownCount = (): number => {
    try {
        const value = Number(localStorage.getItem(HINT_COUNT_STORAGE_KEY));
        return Number.isFinite(value) && value > 0 ? value : 0;
    } catch {
        return 0;
    }
};

const writeShownCount = (count: number) => {
    try {
        localStorage.setItem(HINT_COUNT_STORAGE_KEY, String(count));
    } catch {
        // 写不进去就只在本次会话里少弹：宁可多弹一次，也不让按钮因为存储失败出错。
    }
};

let streak: LoopPressStreak = { count: 0, lastAt: -Infinity };
let shownThisSession = 0;
/** 连点凑满后挂起的提示：等连点停下才弹，期间任何新的一下都会把它顺延。 */
let pendingHintTimer: ReturnType<typeof setTimeout> | null = null;

const clearPendingHint = () => {
    if (pendingHintTimer !== null) {
        clearTimeout(pendingHintTimer);
        pendingHintTimer = null;
    }
};

/**
 * 连点停下之后真正弹提示。开关、教程会话和累计次数在这一刻才判断，
 * 次数也在 toast 写进去之后才记，所以被条件挡掉的或还没呈现的提示不会耗额度。
 */
const presentHint = () => {
    pendingHintTimer = null;
    const ponder = usePonderStore.getState();
    // 关了思索提示的人也不要这条；教程已经开着时更不该再弹。
    if (ponder.ponderHintVisibility === 'off' || ponder.session) {
        return;
    }
    const shown = Math.max(readShownCount(), shownThisSession);
    if (shown >= MAX_HINT_SHOWS) {
        return;
    }
    // 等待期间可能来了错误提示或需要用户确认的常驻提示（如不可用歌曲的跳过确认），不能被这条教程盖掉。
    const current = useStatusMessageStore.getState().message;
    if (current && (current.persistent || current.type === 'error')) {
        return;
    }

    setStatusMessage({
        type: 'info',
        text: i18n.t('status.loopShuffleHint'),
        actionLabel: i18n.t('status.loopShuffleHintAction'),
        actionIcon: Lightbulb,
        durationMs: HINT_DURATION_MS,
        onAction: () => {
            setStatusMessage(null);
            usePonderStore.getState().openPonder('queue-shuffle');
        },
    });
    shownThisSession = shown + 1;
    writeShownCount(shownThisSession);
};

/**
 * 循环按钮每被点一下调用一次，必须排在切循环之后。只接真实按钮，命令和快捷键切循环不算。
 *
 * 切循环本身会弹一条模式 toast，而连点时每一下都会弹，凑满三下就立刻弹提示会被第四下的
 * 模式 toast 盖掉。所以凑满只是「挂起」，等 MAX_PRESS_GAP_MS 内没有新的一下再弹；
 * 挂起期间又点了就重新计时，一整串连点只会合并成一次提示。
 */
export const noteLoopButtonPress = (now = Date.now()) => {
    const next = advanceLoopPressStreak(streak, now);
    streak = next.streak;
    if (!next.triggered && pendingHintTimer === null) {
        return;
    }
    clearPendingHint();
    pendingHintTimer = setTimeout(presentHint, MAX_PRESS_GAP_MS);
};
