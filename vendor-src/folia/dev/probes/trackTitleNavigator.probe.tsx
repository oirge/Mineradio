import React, { useCallback, useRef, useState } from 'react';
import { motionValue } from 'framer-motion';
import FloatingPlayerControls from '../../src/components/FloatingPlayerControls';
import { PlayerState } from '../../src/types';
import type { ProbeDefinition } from './definition';
// dev/probes/trackTitleNavigator.probe.tsx

const QUEUE = ['Alpha Song', 'Bravo Song', 'Charlie Song', 'Delta Song'];
/**
 * 刻意模拟 playSong 的异步：真实应用里点箭头后 currentSong/trackKey 要晚几帧才更新。
 * 没有这段延迟，「点击后闪一下旧曲名」这个 bug 根本复现不出来。
 */
const SWITCH_LATENCY_MS = 260;

const currentTime = motionValue(42);

const TrackTitleNavigatorProbe: React.FC = () => {
    const [index, setIndex] = useState(1);
    const timerRef = useRef<number | null>(null);

    const scheduleSwitch = useCallback((delta: number) => {
        if (timerRef.current !== null) {
            window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
            setIndex(current => Math.min(QUEUE.length - 1, Math.max(0, current + delta)));
            timerRef.current = null;
        }, SWITCH_LATENCY_MS);
    }, []);

    return (
        <div className="relative h-screen" data-probe-track={QUEUE[index]} data-probe-index={index}>
            <FloatingPlayerControls
                currentSong={{ name: QUEUE[index] }}
                playerState={PlayerState.PLAYING}
                currentTime={currentTime}
                duration={200}
                loopMode="all"
                currentView="player"
                audioSrc="probe://audio"
                canTogglePlay
                lyrics={null}
                onSeek={() => {}}
                onTogglePlay={() => {}}
                onToggleLoop={() => {}}
                onNavigateToPlayer={() => {}}
                isDaylight={false}
                slotPrimary="loop"
                slotSecondary="lyrics-timeline"
                slotContext={{
                    onShuffle: () => {},
                    canShuffle: false,
                    onLike: () => {},
                    isLiked: false,
                    likeDisabled: true,
                    invokeCommandById: () => {},
                    canInvokeCommandById: () => true,
                }}
                onCommitBottomBarOffset={() => {}}
                trackNavigation={{
                    currentTrackKey: `probe:${index}`,
                    onPrev: () => scheduleSwitch(-1),
                    onNext: () => scheduleSwitch(1),
                    canPrev: index > 0,
                    canNext: index < QUEUE.length - 1,
                    prevTitle: QUEUE[index - 1] ?? null,
                    nextTitle: QUEUE[index + 1] ?? null,
                    prevLabel: 'Previous track',
                    nextLabel: 'Next track',
                }}
            />
        </div>
    );
};

const definition: ProbeDefinition = {
    id: 'trackTitleNavigator',
    title: '浮动播放条 · 标题切歌箭头',
    description: '悬浮预览相邻曲名、切歌确认窗口、箭头命中区。带 260ms 异步切歌延迟。',
    Component: TrackTitleNavigatorProbe,
};

export default definition;
