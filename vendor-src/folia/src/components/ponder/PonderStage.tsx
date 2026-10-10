import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePonderStore } from '../../stores/usePonderStore';
import { resolveReducedMotion, useMotionSettingsStore } from '../../stores/useMotionSettingsStore';
import { OVERLAY_CALM_TRANSITION, OVERLAY_TRANSITION, overlayBackdropMotion, overlayPanelMotionFor } from '../shared/overlayEntranceMotion';
import { usePonderSessionKeys } from '../../hooks/usePonderSessionKeys';
import { compilePonderScene, sceneAnchorNames } from '../../utils/ponder/compilePonderTimeline';
import { keyframeTicks } from '../../utils/ponder/ponderKeyframes';
import { resolvePonderAnchors } from '../../utils/ponder/resolvePonderAnchors';
import { fitRectsToStage } from '../../utils/ponder/fitRectsToStage';
import { refreshPonderDomRectSnapshot, type PonderDomRectSnapshot } from '../../utils/ponder/ponderDomRectSnapshot';
import { findPonderTarget } from './ponderRegistry';
import { type SettingsAnchorId } from '../modal/settings/navigation/settingsAnchorModel';
import { openSettingsFromPonder, openVisualizerSettingsFromPonder } from '../../services/ponder/pagePonderTarget';
import type { VisualizerSettingsSection } from '../../stores/useSettingsModalStore';
import { openPonderActionUrl } from '../../services/ponder/ponderActionUrl';
import { createPonderStageNodes } from './ponderStageNodes';
import { usePonderTimeline, type PonderTimelineControls } from './usePonderTimeline';
import PonderActors from './PonderActors';
import PonderChrome from './PonderChrome';
import PonderSkeletonLayer from './PonderSkeletonLayer';
import PonderNextChapterCue from './PonderNextChapterCue';
import PonderRelatedTargets from './PonderRelatedTargets';
import { PONDER_AUTO_ADVANCE_MS, type PonderRect } from '../../types/ponder';
import type { Theme } from '../../types';

// src/components/ponder/PonderStage.tsx
// 教程层本体。这是懒加载 chunk 的根 —— animejs 只经由 usePonderTimeline 进到这条链里。
//
// 矩形在进入瞬间采一次就定住，不订阅任何东西：底栏基线是 React 之外的 MotionValue、
// Lattice 相机也绕过 React，订阅既拿不到正确值也违反 guardrails。窗口尺寸变了才重采一次。
//
// 退场那 240ms 里 store 的 session 已经是 null 了，这一层却还要留在屏幕上。所以这里存一份
// 最后的 session 快照，整棵树在退场期间继续按它渲染 —— 少了这一步，关闭时会先整屏闪成空白
// 再淡出，等于没有退场动画。

/** resize 后等这么久再重采，避免拖动窗口时连续重建时间线。 */
const RESAMPLE_DEBOUNCE_MS = 250;

/** 上下外框占掉的高度，骨架要整体装进它们之间。与 PonderActors 里字幕避让用的是同一组数。 */
const CHROME_BANDS = { top: 84, bottom: 156 };

/** 「本页可单独思索的组件」那张浮层卡占掉的右侧宽度（卡宽 224 + 右边距）。 */
const RELATED_PANEL_GUTTER_PX = 248;

type PonderStageProps = {
    theme?: Theme;
    isDaylight: boolean;
};

const readRect = (selector: string): PonderRect | null => {
    const element = document.querySelector(selector);
    if (!element) {
        return null;
    }
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 && rect.height <= 0) {
        return null;
    }
    // 圆角照量：真实界面里是圆按钮，骨架就该是圆的。
    const radius = window.getComputedStyle(element).borderRadius;
    return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        ...(radius && radius !== '0px' ? { radius } : {}),
    };
};

const PonderStage: React.FC<PonderStageProps> = ({ theme, isDaylight }) => {
    const { t } = useTranslation();
    const calm = useMotionSettingsStore(state => resolveReducedMotion(state, 'uiMicroMotion'));
    const liveSession = usePonderStore(state => state.session);
    const isPaused = usePonderStore(state => state.isPaused);
    const closePonder = usePonderStore(state => state.closePonder);
    const stepScene = usePonderStore(state => state.stepScene);
    const setPaused = usePonderStore(state => state.setPaused);

    // 退场期间 liveSession 已经是 null，但这一层还要按最后那次会话继续渲染完这 240ms。
    const lastSessionRef = useRef(liveSession);
    if (liveSession) {
        lastSessionRef.current = liveSession;
    }
    const session = liveSession ?? lastSessionRef.current;
    const isLeaving = liveSession === null;

    const target = session ? findPonderTarget(session.targetId) : null;

    // 章节按「此刻讲不讲得通」过滤：目标是按组件划分的，一个组件里却不是每件事都始终存在 ——
    // 两个槽位可以放十个动作中的任意两个，没放随机时就不该有「随机其实是洗一次牌」这一章。
    // 只在进入或换目标时求值一次，教程跑着的时候章节数不会变。
    const scenes = useMemo(
        () => (target ? target.scenes.filter(candidate => candidate.isAvailable?.() !== false) : []),
        [target],
    );
    const scene = scenes[session?.sceneIndex ?? 0] ?? null;

    const nodesRef = useRef(createPonderStageNodes());
    const [rects, setRects] = useState<Record<string, PonderRect>>({});
    const [sampleToken, setSampleToken] = useState(0);
    const domRectSnapshotRef = useRef<PonderDomRectSnapshot>({});
    const snapshotTargetIdRef = useRef<string | null>(null);
    const sampledTokenRef = useRef(-1);

    // 换场景或换目标时，节点表必须先清空 —— 上一场景的字幕节点已经卸载，留着会让
    // 时间线对着 detached 节点写属性。
    useLayoutEffect(() => {
        nodesRef.current = createPonderStageNodes();
    }, [session?.targetId, session?.sceneIndex]);

    useLayoutEffect(() => {
        if (!scene || !target || !session) {
            return;
        }
        const viewport = { width: window.innerWidth, height: window.innerHeight };
        const targetChanged = snapshotTargetIdRef.current !== session.targetId;
        if (targetChanged) {
            // A different target has unrelated selectors and geometry; never mix both snapshots.
            domRectSnapshotRef.current = {};
            snapshotTargetIdRef.current = session.targetId;
            sampledTokenRef.current = -1;
        }
        if (sampledTokenRef.current !== sampleToken) {
            // Capture every chapter now, while hover-only controls are still mounted. On resize,
            // update what is measurable and retain the last good rect for anything now collapsed.
            domRectSnapshotRef.current = refreshPonderDomRectSnapshot(
                target.scenes,
                readRect,
                domRectSnapshotRef.current,
            );
            sampledTokenRef.current = sampleToken;
        }
        // 先按真实位置解析，再把整幅图等比装进教程外框之间那条带子。
        // 必须在这里一次性做完：骨架、字幕、指向线、光标全都消费这同一份 rects，
        // 任何一处单独变换都会让它们互相错位。
        setRects(fitRectsToStage({
            rects: resolvePonderAnchors(scene.anchors, {
                readRect: selector => domRectSnapshotRef.current[selector] ?? null,
                viewport,
            }),
            viewport,
            // 列了相关组件就要给那张浮层卡让开右边一条，否则它正压在页面右上角的控件上。
            chrome: { ...CHROME_BANDS, right: target.relatedTargetIds ? RELATED_PANEL_GUTTER_PX : 0 },
        }));
    }, [scene, sampleToken, session, target]);

    useEffect(() => {
        if (!scene) {
            return;
        }
        let timer: number | null = null;
        const handleResize = () => {
            if (timer !== null) window.clearTimeout(timer);
            timer = window.setTimeout(() => {
                timer = null;
                setSampleToken(token => token + 1);
            }, RESAMPLE_DEBOUNCE_MS);
        };
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
            if (timer !== null) window.clearTimeout(timer);
        };
    }, [scene]);

    const plan = useMemo(() => (scene ? compilePonderScene(scene) : null), [scene]);
    // 骨架层只给本章讲到的锚点标名字；surface 始终留着，它的名字就是「你正看着哪一页」。
    const activeAnchors = useMemo(() => {
        const names = scene ? sceneAnchorNames(scene) : new Set<string>();
        if (scene) {
            Object.entries(scene.anchors).forEach(([name, source]) => {
                if (source.role === 'surface') names.add(name);
            });
        }
        return names;
    }, [scene]);
    const ticks = useMemo(() => (plan ? keyframeTicks(plan) : []), [plan]);

    // 一章播完停下，由卡片接手。isFinished 是离散事实，可以进 state。
    const [isFinished, setIsFinished] = useState(false);
    // 读条被取消过没有。取消是单向的：这一章里一旦取消，就不再自己往下走。
    const [autoAdvanceCancelled, setAutoAdvanceCancelled] = useState(false);
    useLayoutEffect(() => {
        setIsFinished(false);
        setAutoAdvanceCancelled(false);
    }, [session?.targetId, session?.sceneIndex]);
    const handleComplete = useCallback(() => setIsFinished(true), []);

    const hasNextScene = Boolean(scenes[(session?.sceneIndex ?? 0) + 1]);
    const isAutoAdvancing = isFinished && hasNextScene && !isPaused && !autoAdvanceCancelled && !isLeaving;

    /**
     * 读条走完就进下一章。
     *
     * 暂停、把指针移到「下一章」上、或者在读条期间按任意键都会取消它 —— 这三件事
     * 都说明用户此刻在看这一屏，而不是在等下一章。
     */
    useEffect(() => {
        if (!isAutoAdvancing) {
            return;
        }
        const timer = window.setTimeout(() => stepScene(1, scenes.length), PONDER_AUTO_ADVANCE_MS);
        return () => window.clearTimeout(timer);
    }, [isAutoAdvancing, stepScene, scenes.length]);

    // 按键的取消由 usePonderSessionKeys 转发进来：它在 capture 阶段把认不出的键
    // stopImmediatePropagation 掉，在外面再挂一个 keydown 监听是收不到的。
    const cancelAutoAdvance = useCallback(() => setAutoAdvanceCancelled(true), []);

    // 「本页可单独思索的组件」那张卡浮在骨架之上，字幕得绕开它。
    // 高度随列出的组件条数变，所以量一次而不是写死一个框 —— 播放页列四条，比只列一条高出一倍。
    const [relatedRects, setRelatedRects] = useState<PonderRect[]>([]);
    useLayoutEffect(() => {
        const element = document.querySelector('[data-testid="ponder-related-targets"]');
        const measured = element?.getBoundingClientRect();
        const next: PonderRect[] = measured
            ? [{ left: measured.left, top: measured.top, width: measured.width, height: measured.height }]
            : [];
        // 量到的值每次都是新对象，不比一下会自己把自己再渲染一遍。
        setRelatedRects(previous => (
            previous.length === next.length
            && previous.every((rect, index) => (
                rect.left === next[index].left && rect.top === next[index].top
                && rect.width === next[index].width && rect.height === next[index].height
            ))
                ? previous
                : next
        ));
    }, [target, scene, rects]);

    const emptyPlan = useMemo(() => ({ totalMs: 0, entries: [], keyframes: [] }), []);
    const controlsRef = usePonderTimeline({
        plan: plan ?? emptyPlan,
        rects,
        nodesRef,
        onComplete: handleComplete,
    });

    usePonderSessionKeys({
        // 退场那几帧按 liveSession 判：会话已经关了，键盘就该立刻还给底下的界面。
        isActive: Boolean(liveSession),
        sceneCount: scenes.length,
        controlsRef,
        onAnyKey: cancelAutoAdvance,
    });

    /** 屏幕上的关键帧跳转：时间线那头已经停了，这里把播放键的图标同步成暂停态。 */
    const seekKeyframe = (seek: (controls: PonderTimelineControls) => void) => {
        const controls = controlsRef.current;
        if (!controls) return;
        seek(controls);
        setPaused(true);
    };

    if (!session || !target || !scene || !plan) {
        return null;
    }

    return (
        <motion.div
            {...overlayBackdropMotion}
            transition={calm ? OVERLAY_CALM_TRANSITION : OVERLAY_TRANSITION}
            // 接管键盘：底下那些全局热键靠这个属性让路，这也是 G 不会在教程里再次触发的原因。
            // 退场期间就该摘掉 —— 教程已经关了，底下的热键不必再等这 280ms。
            data-folia-keyboard-window={isLeaving ? undefined : 'true'}
            data-testid="ponder-stage"
            // z-[220]：压过状态 toast（210），教程是全屏接管，不该被任何东西盖住。
            // backdrop-blur 让底下的真实界面退成一团轮廓而不是仍然可读的文字：
            // 保留「这是同一个地方」的空间感，又不至于和骨架抢注意力。
            className={`fixed inset-0 z-[220] overflow-hidden backdrop-blur-md ${isLeaving ? 'pointer-events-none' : ''}`}
            style={{ backgroundColor: isDaylight ? 'rgba(250, 250, 250, 0.94)' : 'rgba(9, 9, 11, 0.94)' }}
            role="dialog"
            aria-modal="true"
            aria-label={t(target.titleKey)}
        >
            {/* 缩放挂在内层：底衬要一直铺满，跟着缩会在四边露出没盖住的真实界面。 */}
            <motion.div {...overlayPanelMotionFor(calm)} data-ponder-stage-content className="absolute inset-0">
                <PonderSkeletonLayer
                    rects={rects}
                    anchors={scene.anchors}
                    activeAnchors={activeAnchors}
                    nodes={nodesRef.current}
                    theme={theme}
                    isDaylight={isDaylight}
                />
                <PonderActors plan={plan} rects={rects} nodes={nodesRef.current} reserved={relatedRects} theme={theme} isDaylight={isDaylight} />
                <PonderChrome
                    title={t(target.titleKey)}
                    sceneTitle={t(scene.titleKey)}
                    sceneIndex={session.sceneIndex}
                    sceneCount={scenes.length}
                    isPaused={isPaused}
                    ticks={ticks}
                    nodes={nodesRef.current}
                    onPrevScene={() => stepScene(-1, scenes.length)}
                    onNextScene={() => stepScene(1, scenes.length)}
                    onTogglePlay={() => {
                        const controls = controlsRef.current;
                        if (controls) setPaused(controls.toggle());
                    }}
                    onRestart={() => controlsRef.current?.restart()}
                    onSeekToTick={index => seekKeyframe(controls => controls.seekToTick(index))}
                    onPrevKeyframe={() => seekKeyframe(controls => controls.seekPrevKeyframe())}
                    onNextKeyframe={() => seekKeyframe(controls => controls.seekNextKeyframe())}
                    actionLabel={scene.action ? t(scene.action.labelKey) : null}
                    onRunAction={() => {
                        if (!scene.action) return;
                        // 外链不关教程：看完文档回来还想接着看这一章。
                        if (scene.action.kind === 'openUrl') {
                            openPonderActionUrl(scene.action.url);
                            return;
                        }
                        if (scene.action.kind === 'openVisualizerSettings') {
                            openVisualizerSettingsFromPonder(scene.action.section as VisualizerSettingsSection);
                            return;
                        }
                        // 顺序和「还要收掉哪几层」都在 openSettingsFromPonder 里 ——
                        // 设置窗口是整个应用里最低的浮层，漏关一层就会把它盖住。
                        openSettingsFromPonder(scene.action.anchorId as SettingsAnchorId);
                    }}
                    theme={theme}
                    isDaylight={isDaylight}
                />
                <PonderRelatedTargets
                    target={target}
                    accent={theme?.accentColor || (isDaylight ? '#27272a' : '#fafafa')}
                    isDaylight={isDaylight}
                />
                {isFinished && (
                    <PonderNextChapterCue
                        nextSceneTitle={scenes[session.sceneIndex + 1]
                            ? t(scenes[session.sceneIndex + 1].titleKey)
                            : null}
                        onNextScene={() => stepScene(1, scenes.length)}
                        autoAdvanceMs={isAutoAdvancing ? PONDER_AUTO_ADVANCE_MS : null}
                        onCancelAutoAdvance={cancelAutoAdvance}
                        theme={theme}
                        isDaylight={isDaylight}
                    />
                )}

                {/* 做成有边框的按钮而不是一行灰字：触屏没有 Esc，得一眼看出这里能点。 */}
                <button
                    type="button"
                    data-testid="ponder-exit"
                    onClick={closePonder}
                    title={t('ponder.exit')}
                    className={`absolute right-5 top-5 flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-colors active:scale-[0.97] ${
                        isDaylight
                            ? 'border-black/15 bg-black/5 text-zinc-800 hover:bg-black/10'
                            : 'border-white/20 bg-white/10 text-zinc-50 hover:bg-white/20'
                    }`}
                >
                    <X size={15} />
                    {t('ponder.legend.exit')}
                </button>
            </motion.div>
        </motion.div>
    );
};

export default PonderStage;
