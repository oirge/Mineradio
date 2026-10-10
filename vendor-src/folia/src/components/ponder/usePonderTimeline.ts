import { useEffect, useRef, type RefObject } from 'react';
import { createTimeline, type Timeline } from 'animejs';
import { readReducedMotion } from '../../stores/useMotionSettingsStore';
import { anchorPointToPx } from '../../utils/ponder/resolvePonderAnchors';
import { keyframeIndexAt, keyframeSettleAt, nextKeyframeAt, prevKeyframeAt } from '../../utils/ponder/ponderKeyframes';
import { PONDER_HIGHLIGHT_MAX_OPACITY, type PonderRect, type PonderTimelinePlan } from '../../types/ponder';
import { PONDER_SURFACE_BASE_STATE } from './surfaces/PonderSurfaceStateLayer';
import type { PonderStageNodes, PonderSurfaceStateNode } from './ponderStageNodes';

// src/components/ponder/usePonderTimeline.ts
// 把编译好的 plan 翻译成 anime.js v4 的 timeline，并提供播放控制。
//
// 这是整个功能里唯一 import animejs 的文件，且只被懒加载的 PonderStage 引用 —— animejs
// 约 38KB gz，不能进 bootstrap chunk（同 App.tsx:20-22 对 AutomixTransitionAnimation 的处理）。
//
// 进度条和当前关键帧都由 onUpdate 直接写 DOM，不经过 React：它们是每帧值。

type UsePonderTimelineParams = {
    plan: PonderTimelinePlan;
    rects: Record<string, PonderRect>;
    nodesRef: RefObject<PonderStageNodes>;
    /** 一段跑完时通知外面把「下一章」卡片放出来。 */
    onComplete: () => void;
};

export type PonderTimelineControls = {
    toggle: () => boolean;
    restart: () => void;
    isCompleted: () => boolean;
    /** 三个 seek 都会把落点那一拍播完后停住；调用方负责把 store 的 isPaused 同步成 true。 */
    seekPrevKeyframe: () => void;
    seekNextKeyframe: () => void;
    seekToTick: (index: number) => void;
};

/** 光标步骤的落点；锚点解析不出来时退回视口中心，宁可演得不准也不要飞到左上角。 */
const pointOrCenter = (
    point: Parameters<typeof anchorPointToPx>[0] | undefined,
    rects: Record<string, PonderRect>,
) => (point ? anchorPointToPx(point, rects) : null)
    ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };

export const usePonderTimeline = ({
    plan,
    rects,
    nodesRef,
    onComplete,
}: UsePonderTimelineParams): RefObject<PonderTimelineControls | null> => {
    const controlsRef = useRef<PonderTimelineControls | null>(null);

    useEffect(() => {
        const nodes = nodesRef.current;
        if (!nodes || plan.totalMs <= 0) {
            return;
        }

        const calm = readReducedMotion('uiMicroMotion');
        // 刻意不循环。无限循环既看不出「这一章讲完了」，也就无从提示还有下一章；
        // 跑完停在末帧，由 PonderStage 放出下一章卡片。
        const timeline: Timeline = createTimeline({
            defaults: { ease: calm ? 'linear' : 'outQuad' },
            autoplay: true,
        });

        // 光标先摆到第一个 cursor/drag 步骤的起点，免得第一帧从左上角窜出来。
        const firstMove = plan.entries.find(entry => entry.step.kind === 'cursor' || entry.step.kind === 'drag');
        if (nodes.cursor && firstMove) {
            const step = firstMove.step;
            const origin = step.kind === 'cursor' ? pointOrCenter(step.from ?? step.to, rects)
                : step.kind === 'drag' ? pointOrCenter(step.from, rects)
                : null;
            if (origin) {
                nodes.cursor.style.transform = `translate(${origin.x}px, ${origin.y}px)`;
            }
        }

        // 每段字幕的起点，升序。下一段一开口，上一段就得收声。
        const captionStarts = plan.entries
            .filter(entry => entry.step.kind === 'caption')
            .map(entry => entry.atMs)
            .sort((a, b) => a - b);

        // 每个「锚点 + 被替换的层」槽位上，当前露在最上面的是谁。叠加层（工具面板、命令面板）
        // 不进这张表，因为它们不该把底下那屏带走。
        const visibleLayers = new Map<string, PonderSurfaceStateNode>();

        for (const { step, atMs, durationMs } of plan.entries) {
            if (step.kind === 'caption') {
                const node = nodes.captions.get(step.id);
                if (!node) continue;
                // 一段字幕最迟在下一段开口时收声。字幕都画在同一条底边上，两段并存就是
                // 两行字叠在一起，谁也读不出来 —— 这比截掉尾巴那点阅读时间糟得多。
                const nextCaptionAtMs = captionStarts.find(start => start > atMs);
                const endMs = Math.min(atMs + durationMs, nextCaptionAtMs ?? Infinity);
                const fadeOutAtMs = Math.max(atMs, endMs - 200);

                timeline.add(node, calm
                    ? { opacity: [0, 1], duration: 240 }
                    : { opacity: [0, 1], y: [8, 0], duration: 240 }, atMs);
                timeline.add(node, { opacity: 0, duration: 200 }, fadeOutAtMs);

                // 指向线挂在同一段时间上：文字在讲谁，线就指着谁，两者不能错开。
                const pointer = nodes.pointers.get(step.id);
                if (pointer) {
                    timeline.add(pointer, { opacity: [0, 1], duration: 300 }, atMs);
                    timeline.add(pointer, { opacity: 0, duration: 200 }, fadeOutAtMs);
                }

                // 被指着的那个区域，这段时间里把名字标出来；讲完就收，不留在后面的浮层上。
                const label = step.pointTo ? nodes.labels.get(step.pointTo.anchor) : undefined;
                if (label) {
                    timeline.add(label, { opacity: [0, 1], duration: 300 }, atMs);
                    timeline.add(label, { opacity: 0, duration: 200 }, fadeOutAtMs);
                }
            } else if (step.kind === 'cursor' || step.kind === 'drag') {
                if (!nodes.cursor) continue;
                const to = pointOrCenter(step.to, rects);
                const from = step.kind === 'cursor'
                    ? (step.from ? pointOrCenter(step.from, rects) : null)
                    : pointOrCenter(step.from, rects);
                timeline.add(nodes.cursor, {
                    x: from ? [from.x, to.x] : to.x,
                    y: from ? [from.y, to.y] : to.y,
                    duration: calm ? 1 : durationMs,
                    ease: step.ease ?? (calm ? 'linear' : 'outCubic'),
                }, atMs);

                if (step.kind === 'cursor' && step.press && nodes.cursorRing) {
                    timeline.add(nodes.cursorRing, {
                        scale: [0.7, 1.6],
                        opacity: [0.9, 0],
                        duration: 420,
                    }, atMs);
                }
            } else if (step.kind === 'keypress') {
                const node = nodes.keyChips.get(step.id);
                if (!node) continue;
                timeline.add(node, calm
                    ? { opacity: [0, 1], duration: 180 }
                    : { opacity: [0, 1], scale: [0.82, 1], duration: 180 }, atMs);
                timeline.add(node, { opacity: 0, duration: 160 }, atMs + Math.max(durationMs - 160, 0));
            } else if (step.kind === 'highlight') {
                const node = nodes.highlights.get(step.anchor);
                if (!node) continue;
                // intensity 是 0..1 的「有多亮」，乘上限才落到画面 —— 直接画 1.0 会是一整块纯色。
                const [from, to] = step.intensity ?? [0, 1];
                timeline.add(node, {
                    opacity: [from * PONDER_HIGHLIGHT_MAX_OPACITY, to * PONDER_HIGHLIGHT_MAX_OPACITY],
                    duration: durationMs,
                }, atMs);
            } else if (step.kind === 'reveal') {
                // 这个框此前根本不在场。名字和框一起出现 —— 先有名字后有框读起来是错的。
                const box = nodes.boxes.get(step.anchor);
                if (!box) continue;
                const animation = {
                    opacity: [0, 1],
                    duration: calm ? 1 : durationMs,
                    ease: calm ? 'linear' : 'outCubic',
                };
                if (step.transition === 'slide-up') {
                    timeline.add(box, { ...animation, y: [14, 0] }, atMs);
                } else if (step.transition === 'zoom' || step.transition === undefined) {
                    timeline.add(box, { ...animation, scale: [0.92, 1] }, atMs);
                } else {
                    timeline.add(box, animation, atMs);
                }

                const label = nodes.labels.get(step.anchor);
                if (label) {
                    timeline.add(label, { opacity: [0, 1], duration: calm ? 1 : durationMs }, atMs);
                }
            } else if (step.kind === 'surfaceState') {
                const layers = nodes.surfaceStates.get(step.anchor);
                const entry = layers?.get(step.state);
                if (!layers || !entry) continue;
                const animation = {
                    opacity: [0, 1],
                    duration: calm ? 1 : durationMs,
                    ease: calm ? 'linear' : 'outCubic',
                };
                if (step.transition === 'slide-up') {
                    timeline.add(entry.node, { ...animation, y: [18, 0] }, atMs);
                } else if (step.transition === 'zoom') {
                    timeline.add(entry.node, { ...animation, scale: [0.88, 1] }, atMs);
                } else {
                    timeline.add(entry.node, animation, atMs);
                }

                // 替换型的结果层要把它顶掉的那一层同时淡出。少了这一步，重画一遍的海报墙
                // 和底下那面原墙会同时在屏幕上，差着一点位移 —— 看起来就是骨架和界面对不上。
                if (entry.replaces) {
                    const replacedState = typeof entry.replaces === 'string'
                        ? entry.replaces
                        : PONDER_SURFACE_BASE_STATE;
                    // 同一个槽位可以被接连替换（平移之后再聚焦），所以记住的是「这个槽位现在是谁」。
                    const slot = `${step.anchor}:${replacedState}`;
                    const covered = visibleLayers.get(slot) ?? layers.get(replacedState);
                    if (covered && covered.node !== entry.node) {
                        timeline.add(covered.node, {
                            opacity: [1, 0],
                            duration: calm ? 1 : durationMs,
                            ease: calm ? 'linear' : 'outCubic',
                        }, atMs);
                    }
                    visibleLayers.set(slot, entry);
                }
            } else {
                // pausePoint：时间线上的一段空隙。用裸 timer 占位，不动任何节点。
                timeline.add({ duration: durationMs }, atMs);
            }
        }

        // 进度条与当前关键帧：每帧直接写 DOM。keyframeIndexRef 也是 ←/→ 读的那个值，
        // 所以「现在在第几帧」从头到尾不需要是 React 状态。
        const keyframeIndexRef = { current: -1 };

        /**
         * 把当前进度刷到 DOM 上。
         *
         * 单独抽出来是因为 seek 必须显式调它：seek 的第二个参数 muteCallbacks 连 onUpdate
         * 一起静音了（这正是我们要的 —— 卷过 marker 不该触发它），于是暂停状态下按 ←/→
         * 时间线确实跳了，进度条却停在原处。
         */
        const paintProgress = () => {
            const nodes = nodesRef.current;
            if (!nodes) return;
            if (nodes.progressFill) {
                nodes.progressFill.style.transform = `scaleX(${timeline.iterationProgress})`;
            }
            const index = keyframeIndexAt(plan, timeline.iterationCurrentTime);
            if (index !== keyframeIndexRef.current) {
                keyframeIndexRef.current = index;
                nodes.ticks.forEach((tick, i) => {
                    if (tick) tick.toggleAttribute('data-active', i === index);
                });
            }
        };

        // 跳关键帧后要停住的时间点。非 null 时时间线在播，但只是在把这一拍播完。
        let settleAtMs: number | null = null;

        timeline.onUpdate = () => {
            if (settleAtMs !== null && timeline.iterationCurrentTime >= settleAtMs) {
                const stopAtMs = settleAtMs;
                settleAtMs = null;
                timeline.pause();
                // 按帧检测会多走一点，拉回到准确的停点，免得把下一个动作的第一帧露出来。
                timeline.seek(stopAtMs, true);
            }
            paintProgress();
        };

        timeline.onComplete = () => onComplete();

        /**
         * 跳到某个关键帧，把这一拍播完后停住。
         *
         * 跳关键帧是「我要看这一帧」：一直播下去的话字幕刚出来就被下一段顶掉，等于白跳；
         * 停在关键帧开头又是一帧空白。停点由 keyframeSettleAt 算。
         * muteCallbacks，理由和 AutomixTransitionAnimation 里那次 seek 一样：
         * 卷过一个 marker 不该把它触发一遍。
         */
        const seekKeyframe = (atMs: number) => {
            timeline.pause();
            timeline.seek(atMs, true);
            const stopAtMs = keyframeSettleAt(plan, atMs);
            settleAtMs = stopAtMs > atMs ? stopAtMs : null;
            if (settleAtMs !== null) {
                timeline.play();
            }
            paintProgress();
        };

        controlsRef.current = {
            toggle: () => {
                // 正在把一拍播完时，外面显示的是暂停态；这时按播放就是「接着播」，不是再暂停一次。
                if (settleAtMs !== null) {
                    settleAtMs = null;
                    return false;
                }
                if (timeline.paused) {
                    timeline.play();
                    return false;
                }
                timeline.pause();
                paintProgress();
                return true;
            },
            restart: () => {
                settleAtMs = null;
                timeline.restart();
                paintProgress();
            },
            isCompleted: () => timeline.completed,
            seekPrevKeyframe: () => seekKeyframe(prevKeyframeAt(plan, timeline.iterationCurrentTime)),
            seekNextKeyframe: () => seekKeyframe(nextKeyframeAt(plan, timeline.iterationCurrentTime)),
            seekToTick: index => {
                const keyframe = plan.keyframes[index];
                if (!keyframe) return;
                seekKeyframe(keyframe.atMs);
            },
        };

        // 无限循环开着就一直有 rAF，切到后台必须停 —— 否则在别的窗口里持续烧 CPU。
        const handleVisibility = () => {
            if (document.hidden) {
                timeline.pause();
            } else if (!timeline.completed) {
                // 已经播完的不要复活 —— 否则从后台切回来会把「下一章」卡片顶掉。
                timeline.play();
            }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibility);
            timeline.revert();
            controlsRef.current = null;
        };
    }, [plan, rects, nodesRef, onComplete]);

    return controlsRef;
};

export default usePonderTimeline;
