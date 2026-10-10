import { useCallback, useEffect, useRef, useState } from 'react';
// src/hooks/useTrackTitlePreview.ts

/** 切歌后先把新曲目名亮出来的确认窗口时长 */
export const SWITCH_CONFIRM_MS = 1100;

export type TrackNavSide = 'prev' | 'next';

type UseTrackTitlePreviewParams = {
    /** 当前曲目标题（真实 props，切歌后会晚几帧才更新） */
    title: string;
    /** 当前曲目的稳定身份；相邻两首同名时标题字符串不变，只能靠它识别换歌 */
    trackKey: string;
    prevTitle: string | null;
    nextTitle: string | null;
    disabled?: boolean;
};

export type TrackTitlePreview = {
    /** 标题区当前应显示的文本；点箭头后立刻变为乐观接管的目标曲名 */
    displayTitle: string;
    /** 当前应显示的预览文本，已计入确认窗口抑制；无预览时为 null */
    previewTitle: string | null;
    /** 淡出过程中保留的上一次预览文本，避免文字先跳成空再消失 */
    shownPreview: string;
    /** 入场动画的 key；只在「新标题不是刚才预览过的那个」时才递增 */
    enterSeq: number;
    /** 方向性入场位移，正值表示新标题从右侧进入 */
    slide: number;
    enterZone: (side: TrackNavSide) => void;
    leaveZone: () => void;
    beginSwitch: (side: TrackNavSide) => void;
};

const SLIDE_PX = 14;

/**
 * 浮动播放条标题区的显示状态机。
 *
 * 三件事：
 *
 * 1. 预览：指针进入左右感应区时，半透明显示该方向的相邻曲名。
 *
 * 2. 确认窗口：一旦换歌就进入窗口，窗口内不显示预览，只留新曲名。窗口结束时指针若仍停在
 *    感应区，再恢复预览。连点会重置窗口（靠 confirmSeq），于是快速连跳会逐首把曲名念出来，
 *    而不是立刻跳到「再下一首」——那会让人误以为预览的就是正在播放的歌。
 *
 * 3. 乐观接管：点箭头时预览里显示的就是即将播放的那首，立即把它当作当前标题接管
 *    （pendingTitle）。playSong 是异步的，title prop 要晚几帧才更新；不接管的话会先闪一下
 *    旧曲名再滑进新曲名。真实 props 到达后若与预测一致，就不递增 enterSeq，也就不播入场
 *    动画——那段文字本来就已经在屏幕上了。只有预测落空（FM 现拉、队列变动）才滑入新标题。
 *
 * 全部是离散状态，只在指针进出、点击、换歌、窗口到期时各变化一次，不做逐帧追踪。
 */
export const useTrackTitlePreview = ({
    title,
    trackKey,
    prevTitle,
    nextTitle,
    disabled = false,
}: UseTrackTitlePreviewParams): TrackTitlePreview => {
    const [hoverSide, setHoverSide] = useState<TrackNavSide | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const [confirmSeq, setConfirmSeq] = useState(0);
    const [enterSeq, setEnterSeq] = useState(0);
    const [pendingTitle, setPendingTitle] = useState<string | null>(null);
    const [shownPreview, setShownPreview] = useState('');
    const lastSideRef = useRef<TrackNavSide>('next');
    const prevTrackKeyRef = useRef(trackKey);

    const beginSwitch = useCallback((side: TrackNavSide) => {
        lastSideRef.current = side;
        // 相邻曲名未知时（FM 走到队列末尾会现拉）留 null，退回等真实 props 到达再滑入
        setPendingTitle(side === 'prev' ? prevTitle : nextTitle);
        setIsConfirming(true);
        setConfirmSeq(seq => seq + 1);
    }, [nextTitle, prevTitle]);

    // 必须比对上一次的 trackKey 值，不能用「我挂载过没」这类布尔守卫：StrictMode 下 effect 会跑
    // 两次而 ref 不会重置，布尔守卫在第二次就失效，于是每次挂载都被误判成换歌。
    // ExpandedView 每次胶囊展开都重新挂载，那会导致标题一显示就播入场动画。
    //
    // pendingTitle 进依赖是安全的：它变化时 trackKey 没变，会走上面的提前返回。
    useEffect(() => {
        if (prevTrackKeyRef.current === trackKey) {
            return;
        }
        prevTrackKeyRef.current = trackKey;
        if (pendingTitle !== title) {
            setEnterSeq(seq => seq + 1);
        }
        setPendingTitle(null);
        setIsConfirming(true);
        setConfirmSeq(seq => seq + 1);
    }, [pendingTitle, title, trackKey]);

    // confirmSeq 进依赖是为了让连点重新计时，而不是沿用上一次没走完的窗口
    useEffect(() => {
        if (!isConfirming) {
            return;
        }
        const timer = window.setTimeout(() => setIsConfirming(false), SWITCH_CONFIRM_MS);
        return () => window.clearTimeout(timer);
    }, [confirmSeq, isConfirming]);

    const neighborTitle = hoverSide === 'prev' ? prevTitle : hoverSide === 'next' ? nextTitle : null;
    const previewTitle = disabled || isConfirming ? null : neighborTitle;

    useEffect(() => {
        if (previewTitle) {
            setShownPreview(previewTitle);
        }
    }, [previewTitle]);

    const enterZone = useCallback((side: TrackNavSide) => setHoverSide(side), []);
    const leaveZone = useCallback(() => setHoverSide(null), []);

    return {
        displayTitle: pendingTitle ?? title,
        previewTitle,
        shownPreview,
        enterSeq,
        slide: lastSideRef.current === 'next' ? SLIDE_PX : -SLIDE_PX,
        enterZone,
        leaveZone,
        beginSwitch,
    };
};
