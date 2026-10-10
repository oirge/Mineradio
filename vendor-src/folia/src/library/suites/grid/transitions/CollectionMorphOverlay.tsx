import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCollectionNavigationStore } from '../../../../stores/useCollectionNavigationStore';
import MorphExitLayer from './MorphExitLayer';
import MorphFlightLayer, { CROSSFADE_SECONDS, type MorphFastForwardStart } from './MorphFlightLayer';
import { reportMorphCapture, useCollectionMorphStore } from './collectionMorphStore';
import {
    COLLECTION_MORPH_Z_INDEX,
    estimateCenterTarget,
    isMorphTargetSettled,
    MORPH_NESTED_LANDING_DETAIL_MS,
    type CollectionMorphExit,
    type CollectionMorphGeometry,
    type CollectionMorphHeroMeasured,
    type CollectionMorphPending,
    type CollectionMorphRect,
    type CollectionMorphTarget,
} from './morphGeometry';
import { attachMorphCapture, findMorphCard, probeArtistIntroTargets, probeHeroTargets, rectOfElement } from './morphProbes';

// src/library/suites/grid/transitions/CollectionMorphOverlay.tsx
// The match-cut both ways of the「移形换影」transition. Rendered via portal:
//
// Forward (open): the clicked home card's frame, cover artwork and title line
// each morph from their captured rectangles onto the detail grid's centered
// hero song card, carrying a motion blur that sharpens as they land; the title
// and cover crossfade into the song's content mid-flight, then the composite
// fades out over the positioned hero for a seamless cut.
//
// Reverse (back): the hero card's elements fly back onto the original home
// card rectangles with the same blur/crossfade language, while the backdrop
// fades the home surface in underneath. Symmetric easing makes the two halves
// read as one continuous gesture.
//
// This file owns the LIFECYCLE only (stages, timers, polling, store wiring);
// the two composites live in MorphFlightLayer / MorphExitLayer and the geometry
// and probes live in morphGeometry.ts / morphProbes.ts.
//
// Timing contract (kept snappy and self-terminating): springs fly fast toward
// live hero measurements polled on a throttled schedule; if the hero never
// renders the lifecycle still runs to consume — the poll's deadline always hands
// over to the fade, so a missing hero can never leave the composite parked over
// an already-revealed grid — and a hard watchdog guarantees the morph plan can
// never leave the detail grid stuck with its hero hidden.

type MorphStage = 'idle' | 'flying' | 'settling' | 'fading' | 'exiting';

// 时间线（首次打开，冷封面）：
//   0        点击 → 合成层起飞，朝 hero 的估算位滑过去
//   ~200ms   连续两拍量到同一张卡（含 hero 落在最终位置）→ 锁定真实落点
//   +140ms   形状到位 → settling（封面/标题开始交叉淡化），**输入封锁在这一刻解除**
//   +240ms   fading：外框与标题淡出，形状变化到此结束
//   之后     封面层单独留到 hero 自己的封面解码完（或兜底上限）再淡出
//
// 关键取舍：**飞行与淡入淡出不再等封面**。之前 requirable 的 coverReady 让整段动画的长度
// 由一张 512px 缩略图的网络请求决定（首次打开它是冷的），实测把 2s 的封锁层和 2s 的合成层
// 都拖在那里。现在封面层是唯一等待方，而且它只是静静停在 hero 的封面上 —— 不会露出 hero
// 自己的加载占位（灰底转圈），也不需要挡住任何交互。
const SETTLE_AFTER_TARGET_MS = 140;
const FAST_FORWARD_FLIGHT_MS = 260;
// …and the whole accelerated lifecycle ends on this hard timer so the input
// blockade never outlives it.
const FAST_FORWARD_FINISH_MS = 140;
// 探针每 70ms 一次：连续两拍确认（见下）决定了锁定落点的最早时刻，所以这个间隔直接是
// 动画前段的延迟。测量本身只是几个 getBoundingClientRect，加密到这里仍然可以忽略。
const HERO_POLL_INTERVAL_MS = 70;
// The probe only ever measures the ACTIVE grid (see morphProbes.activeGridRoot),
// so the outgoing grid's cards can no longer be mistaken for the hero. What is
// left is the incoming grid's own restore pan: on its first frames the cards are
// still sliding, so a target is accepted only once two consecutive polls measure
// the SAME card at (nearly) the same rectangles. That gate — not a fixed delay —
// is what keeps the flight from retargeting onto a moving card; the warmup below
// only skips the first tick, before the grid has rendered at all.
const HERO_POLL_WARMUP_MS = 60;
const HERO_POLL_MAX_MS = 2400;
// A candidate counts as settled when the same card repeats within this tolerance.
const HERO_STABLE_TOLERANCE_PX = 1.5;
// settling → fading 之间的停留：交叉淡化（0.28s）走完就够，不需要再多等。
const CROSSFADE_HOLD_MS = 240;
// 封面层最多多留这么久等 hero 自己的封面解码；超过就淡掉，宁可闪一下占位也不把合成层
// 无限期挂在屏幕上。
const COVER_HOLD_MAX_MS = 1400;
// 退出的最短寿命。落点会在中途 retarget，framer 对每一段都会报一次「动画完成」，
// 加上 hold 阶段本身很短，不设这条下限就会在 hero 刚要起飞时把整层收掉。
const EXIT_MIN_LIFETIME_MS = 420;
// Absolute watchdog: beyond this the store is consumed whatever happens.
const WATCHDOG_MS = 3000;

interface CollectionMorphOverlayProps {
    /**
     * 是否允许播放转场。由宿主读「降低动态效果」的 collectionMorph 面得出，为 false 时
     * 既不挂捕获监听也不领任何计划 —— 转场是纯装饰，降级时应当完全不出现，而不是缩短。
     */
    enabled?: boolean;
}

export const CollectionMorphOverlay: React.FC<CollectionMorphOverlayProps> = ({ enabled = true }) => {
    const pending = useCollectionMorphStore((state) => state.pending);
    const ackPending = useCollectionMorphStore((state) => state.ackPending);
    const commitPlan = useCollectionMorphStore((state) => state.commitPlan);
    const setHero = useCollectionMorphStore((state) => state.setHero);
    const setLastHome = useCollectionMorphStore((state) => state.setLastHome);
    const setLastSource = useCollectionMorphStore((state) => state.setLastSource);
    const consume = useCollectionMorphStore((state) => state.consume);
    const exit = useCollectionMorphStore((state) => state.exit);
    const navigationOrigin = useCollectionNavigationStore((state) => state.snapshot?.origin);
    const navSnapshot = useCollectionNavigationStore((state) => state.snapshot);

    const [stage, setStage] = useState<MorphStage>('idle');
    const [flown, setFlown] = useState<CollectionMorphPending | null>(null);
    // 目标是探针量出来的完整落点：除了几何，还带着 key（稳定性判据）和 coverReady
    // （封面层要不要多顶一会儿）。层只需要几何，但生命周期要读 coverReady。
    const [targets, setTargets] = useState<CollectionMorphHeroMeasured | null>(null);
    const [exitPayload, setExitPayload] = useState<CollectionMorphExit | null>(null);
    // True once a scroll fast-forwarded the flight: fades snap shut and the
    // lifecycle ends on a hard timer so the input blockade is released fast.
    const [fastForwarding, setFastForwarding] = useState(false);
    // 输入封锁在「飞行停下来」的那一刻就解除，而不是等封面解码、等淡出结束。合成层本身是
    // pointer-events: none，停在 hero 上不挡任何点击；真正挡交互的只有封锁层。
    const [blockerReleased, setBlockerReleased] = useState(false);
    // hero 自己的封面还没解码时，封面层单独多留一会儿（不然会露出灰底转圈占位）。
    // 它一旦解码（交叉淡化那张 img 的 load/error）就立刻放手，超过上限也放手。
    const [coverHoldExpired, setCoverHoldExpired] = useState(false);
    const [heroCoverArrived, setHeroCoverArrived] = useState(false);
    // On-screen rects of the three flying elements at fast-forward time — the
    // compressed replay starts from these, continuing mid-flight instead of
    // rewinding or flashing away.
    const [ffStart, setFfStart] = useState<MorphFastForwardStart | null>(null);
    const frameFlightRef = useRef<HTMLDivElement | null>(null);
    const coverFlightRef = useRef<HTMLDivElement | null>(null);
    const titleFlightRef = useRef<HTMLDivElement | null>(null);
    // Latches on the first scroll/click intent so repeated events never restart
    // or extend the accelerated flight; reset when the lifecycle ends.
    const acceleratedRef = useRef(false);
    // Nested-back landing: the remounted previous grid's card this level was
    // pushed from (e.g. the song card that opened the artist page). It cannot
    // be measured at arm time — the previous grid remounts only AFTER back is
    // pressed — so a poll hunts it and the exit springs retarget onto it.
    const [nestedLanding, setNestedLanding] = useState<CollectionMorphTarget | null>(null);
    const [nestedGaveUp, setNestedGaveUp] = useState(false);
    const nestedPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const watchdogTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const fastForwardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // When the current flight launched — gates the warmup of the first hero probe.
    const flightStartedAtRef = useRef(0);
    // Last polled hero candidate: the stability gate compares against it so a
    // measurement taken while the incoming grid is still panning cannot become
    // the flight target.
    const heroCandidateRef = useRef<CollectionMorphHeroMeasured | null>(null);

    // 这两个派生值要在回调里用到（handleFadeComplete 判断能不能收尾），所以放在回调之前。
    const fading = stage === 'fading';
    // 封面层是否要压在 hero 上多留一会儿：hero 的封面还没解码完（否则会露出灰底转圈），
    // 而且兜底时间还没到、它也没有自己到达。只有这一层等封面，外框/标题/封锁层都不等。
    const coverHolding = Boolean(
        fading
        && !heroCoverArrived
        && !coverHoldExpired
        && targets
        && !targets.coverReady,
    );

    const stopPolling = useCallback(() => {
        if (pollTimerRef.current !== null) {
            clearInterval(pollTimerRef.current);
            pollTimerRef.current = null;
        }
    }, []);

    const stopNestedPoll = useCallback(() => {
        if (nestedPollRef.current !== null) {
            clearInterval(nestedPollRef.current);
            nestedPollRef.current = null;
        }
    }, []);

    const clearSettleTimer = useCallback(() => {
        if (settleTimerRef.current !== null) {
            clearTimeout(settleTimerRef.current);
            settleTimerRef.current = null;
        }
    }, []);

    const clearWatchdog = useCallback(() => {
        if (watchdogTimerRef.current !== null) {
            clearTimeout(watchdogTimerRef.current);
            watchdogTimerRef.current = null;
        }
    }, []);

    const clearFastForwardTimer = useCallback(() => {
        if (fastForwardTimerRef.current !== null) {
            clearTimeout(fastForwardTimerRef.current);
            fastForwardTimerRef.current = null;
        }
    }, []);

    const finishLifecycle = useCallback(() => {
        stopPolling();
        stopNestedPoll();
        clearSettleTimer();
        clearWatchdog();
        clearFastForwardTimer();
        consume();
        setFlown(null);
        setTargets(null);
        setExitPayload(null);
        setFastForwarding(false);
        setFfStart(null);
        setNestedLanding(null);
        setNestedGaveUp(false);
        setBlockerReleased(false);
        setCoverHoldExpired(false);
        setHeroCoverArrived(false);
        acceleratedRef.current = false;
        setStage('idle');
    }, [clearFastForwardTimer, clearSettleTimer, clearWatchdog, consume, stopNestedPoll, stopPolling]);

    // Settle → crossfade text/cover → fade, only after targets are known (or
    // the poll gave up and the estimate stands in).
    const armSettle = useCallback(() => {
        clearSettleTimer();
        settleTimerRef.current = setTimeout(() => {
            settleTimerRef.current = null;
            setStage('settling');
        }, SETTLE_AFTER_TARGET_MS);
    }, [clearSettleTimer]);

    // 飞行停下来（framer 报这一层动画完成）就解除封锁：此刻合成层已经停在落点上，
    // 它自己不挡点击，用户等的是「能操作」，不是「封面解码完」。
    const handleFlightSettled = useCallback(() => {
        setBlockerReleased(true);
    }, []);

    // 封锁层只为转场的开场一拍存在。两条触发：framer 报外框动画完成（精确）、
    // 或者已经进入 settling/fading（结算计时器先到，比弹簧的尾巴早一点）。
    useEffect(() => {
        if (stage === 'settling' || stage === 'fading') {
            setBlockerReleased(true);
        }
    }, [stage]);

    useEffect(() => {
        if (!targets || stage !== 'flying') {
            return;
        }
        armSettle();
    }, [targets, stage, armSettle]);

    useEffect(() => {
        if (stage !== 'settling') {
            return;
        }
        clearSettleTimer();
        settleTimerRef.current = setTimeout(() => {
            settleTimerRef.current = null;
            setStage('fading');
        }, CROSSFADE_HOLD_MS);
    }, [stage, clearSettleTimer]);

    // fading 开始时 hero 的封面可能还在路上：封面层单独留一会儿（形状与标题照常按时淡出），
    // 但不会无限期等 —— COVER_HOLD_MAX_MS 之后照淡，宁可闪一下占位。
    useEffect(() => {
        if (stage !== 'fading' || !targets || targets.coverReady) {
            return;
        }
        const timer = setTimeout(() => setCoverHoldExpired(true), COVER_HOLD_MAX_MS);
        return () => clearTimeout(timer);
    }, [stage, targets]);

    // Records which card the user clicked. Attached from an effect (and disposed
    // with it) rather than as a module side effect, so HMR cannot stack a second
    // document listener behind the first.
    useEffect(() => {
        if (!enabled) {
            return;
        }
        return attachMorphCapture(reportMorphCapture);
    }, [enabled]);

    // The setting can be flipped while a flight is in the air: finish it on the
    // store so the grid can never be left with its hero hidden.
    useEffect(() => {
        if (enabled || stage === 'idle') {
            return;
        }
        finishLifecycle();
    }, [enabled, stage, finishLifecycle]);

    // Is this candidate the same card, in the same place, as the previous tick?
    // Only then is it safe to fly to: the incoming grid pans to its restored
    // focus a few frames after mounting, and retargeting onto a card mid-pan is
    // what makes the flight change direction in the air.
    const startPolling = useCallback(() => {
        stopPolling();
        heroCandidateRef.current = null;
        const deadline = Date.now() + HERO_POLL_WARMUP_MS + HERO_POLL_MAX_MS;
        pollTimerRef.current = setInterval(() => {
            if (Date.now() - (flightStartedAtRef.current || Date.now()) < HERO_POLL_WARMUP_MS) {
                return;
            }
            const found = ((): CollectionMorphHeroMeasured | null => {
                // Artist destinations morph onto the page's intro cluster
                // (circular avatar + bio title) instead of a song card —
                // the generic probe would latch onto whatever song/album
                // card happens to sit nearest to centre.
                const stack = useCollectionNavigationStore.getState().snapshot?.stack;
                const activeType = stack?.[stack.length - 1]?.type;
                return activeType === 'artist'
                    ? probeArtistIntroTargets()
                    : probeHeroTargets();
            })();
            // 目标只要求几何稳定 —— **不等封面**。封面是否解码完只影响「封面层什么时候淡出」，
            // 不该决定飞行和封锁层的长度：那会让整段转场的时长由一张缩略图的网络请求决定。
            if (found) {
                const settled = isMorphTargetSettled(heroCandidateRef.current, found, HERO_STABLE_TOLERANCE_PX);
                heroCandidateRef.current = found;
                if (settled) {
                    setTargets(found);
                    setHero(found);
                    stopPolling();
                    return;
                }
            }
            if (Date.now() > deadline) {
                // Never park the composite: handing over to the fade is
                // unconditional, even when the plan already expired. Otherwise
                // the flight would freeze over an already-revealed grid until
                // the watchdog fired.
                stopPolling();
                armSettle();
            }
        }, HERO_POLL_INTERVAL_MS);
    }, [armSettle, setHero, stopPolling]);

    const launchFlight = useCallback((payload: CollectionMorphPending) => {
        setFlown(payload);
        setTargets(null);
        setExitPayload(null);
        clearSettleTimer();
        clearFastForwardTimer();
        acceleratedRef.current = false;
        setFastForwarding(false);
        setFfStart(null);
        flightStartedAtRef.current = Date.now();
        // Remember the top-level source card: the reverse morph flies back onto
        // exactly this home card when the user backs out later. Nested opens
        // (song card → album/artist) must NOT overwrite it — the eventual
        // top-level back still targets the original home card, not the song
        // card. Instead, the nested push's own source card is remembered for
        // the nested back: the hero then flies back onto THE CARD THAT WAS
        // CLICKED (e.g. the song card that opened the artist page).
        const stackDepth = useCollectionNavigationStore.getState().snapshot?.stack.length ?? 0;
        if (stackDepth <= 1) {
            setLastHome(payload);
        } else if (payload.sourceKey) {
            setLastSource(payload, stackDepth);
        }
        // The composite covers this grid's hero: hide it and reveal it as the
        // composite fades. Contrast with 'cascade', which has nothing covering
        // the hero and must therefore leave it visible.
        commitPlan({ kind: 'morph' });
        setStage('flying');
        startPolling();
    }, [clearFastForwardTimer, clearSettleTimer, commitPlan, setLastHome, setLastSource, startPolling]);

    // Did the CURRENT navigation state move in the opening direction relative
    // to when the captured click's gesture began? A click that opens a
    // collection (home open or nested push) always deepens the nav state after
    // the click; a click that merely plays/centers a card leaves it identical.
    // Comparing snapshots needs no subscription ordering — the launch effects
    // re-run on every pending/nav change and simply do nothing until they
    // diverge in the opening direction.
    const navOpenedByGesture = useCallback((payload: CollectionMorphPending): boolean => {
        const currentWasOpen = Boolean(navSnapshot);
        const currentDepth = navSnapshot?.stack.length ?? 0;
        const { wasOpen, depth } = payload.navAtGestureStart;
        return (!wasOpen && currentWasOpen) || currentDepth > depth;
    }, [navSnapshot]);

    // A brand-new home-origin open starts the flight from its captured rects.
    // Stray card clicks (play/center) never change the nav signature, so the
    // observation window discards them instead of a phantom flight launching.
    useEffect(() => {
        if (
            !enabled
            || navigationOrigin !== 'home'
            || !pending
            || stage !== 'idle'
            || !navOpenedByGesture(pending)
        ) {
            return;
        }
        launchFlight(pending);
        ackPending();
    }, [ackPending, enabled, launchFlight, navOpenedByGesture, navigationOrigin, pending, stage]);

    // A second capture while settling/fading restarts from the new pending
    // (e.g. quick back-out + reopen, or a nested push mid-settle) — but only
    // when that capture's gesture actually deepened the navigation.
    useEffect(() => {
        if (!enabled || !pending || !flown || pending === flown || !navOpenedByGesture(pending)) {
            return;
        }
        launchFlight(pending);
        ackPending();
    }, [ackPending, enabled, flown, launchFlight, navOpenedByGesture, pending]);

    // Reverse flight: armed by the host right before backing out. It displaces
    // any forward-flight remnant and flies the hero elements back home.
    useEffect(() => {
        if (!exit) {
            return;
        }
        setFlown(null);
        setTargets(null);
        setExitPayload(exit);
        setNestedLanding(null);
        setNestedGaveUp(false);
        stopNestedPoll();
        clearSettleTimer();
        clearFastForwardTimer();
        acceleratedRef.current = false;
        setFastForwarding(false);
        setFfStart(null);
        setStage('exiting');
    }, [exit, clearFastForwardTimer, clearSettleTimer, stopNestedPoll]);

    // Nested-back destination poll. The previous grid remounts underneath only
    // after back is pressed, so the card this level was pushed from
    // (exit.sourceKey) cannot be measured at arm time. Two phases, because the
    // hero must not sit frozen while that card's own fly-in settles:
    //
    // 1. the card's WRAPPER is already at its final slot the moment the grid
    //    mounts (the fly-in animates the inner motion.div), so once the wrapper
    //    holds still for two polls the hero is sent to the card's box — the
    //    frame lands exactly, with no visible wait;
    // 2. the cover/title insets are only final after that inner animation
    //    finishes, so the poll keeps refining and updates the landing once they
    //    hold still — the springs absorb the small retarget instead of the
    //    whole composite standing still for up to a second.
    //
    // No trustworthy card by the deadline → give up and fall back to the
    // in-place shrink.
    useEffect(() => {
        if (stage !== 'exiting' || !exitPayload?.nested || !exitPayload.sourceKey) {
            return;
        }
        // Only a detail-grid card (`item:`) can reappear inside the remounted
        // grid; a home-slider handle has nothing to look for here.
        if (!exitPayload.sourceKey.startsWith('item:')) {
            return;
        }
        const startedAt = Date.now();
        const deadline = startedAt + 1800;
        let lastWrapperRect: CollectionMorphRect | null = null;
        let lastCoverRect: CollectionMorphRect | null = null;
        let landedAt: number | null = null;
        nestedPollRef.current = setInterval(() => {
            // 只在当前这一层网格里找：正在退出的那一页（例如歌手页）可能带着同一个
            // item id，文档级查询会先命中它，落点就飞到一张正在消失的卡上。
            const el = findMorphCard(exitPayload.sourceKey, 'active-grid');
            const wrapRect = el ? rectOfElement(el) : null;
            if (!el || !wrapRect || wrapRect.width < 1) {
                if (Date.now() > deadline) {
                    stopNestedPoll();
                    setNestedGaveUp(true);
                }
                return;
            }
            const now = Date.now();
            const coverEl = el.querySelector<HTMLImageElement>('img');
            const coverRect = rectOfElement(coverEl);
            const titleEl = el.querySelector<HTMLElement>('h3, [data-folia-card-title], [class*="font-bold"]');
            const titleRect = rectOfElement(titleEl);
            const wrapperSettled = isMorphTargetSettled(
                lastWrapperRect && { key: 'wrapper', frame: lastWrapperRect, cover: lastWrapperRect, title: lastWrapperRect },
                { key: 'wrapper', frame: wrapRect, cover: wrapRect, title: wrapRect },
                HERO_STABLE_TOLERANCE_PX,
            );
            const coverSettled = coverRect && isMorphTargetSettled(
                lastCoverRect && { key: 'cover', frame: lastCoverRect, cover: lastCoverRect, title: lastCoverRect },
                { key: 'cover', frame: coverRect, cover: coverRect, title: coverRect },
                HERO_STABLE_TOLERANCE_PX,
            );
            lastWrapperRect = wrapRect;
            lastCoverRect = coverRect;

            const geometry = (cover: CollectionMorphRect, title: CollectionMorphRect) => ({
                frame: wrapRect,
                cover,
                coverUrl: coverEl?.getAttribute('src') ?? null,
                title,
                titleText: (titleEl?.textContent ?? '').trim(),
            });

            if (landedAt === null) {
                if (!wrapperSettled) {
                    return;
                }
                // 第一落点只用外框：此刻封面/标题可能还在屏外飞，量到的位置不能当落点。
                landedAt = now;
                setNestedLanding(geometry(wrapRect, wrapRect));
                return;
            }
            // 细化：内层落定之后再更新一次封面与标题的位置。
            if (coverSettled) {
                stopNestedPoll();
                setNestedLanding(geometry(coverRect ?? wrapRect, titleRect ?? wrapRect));
                return;
            }
            if (now > landedAt + MORPH_NESTED_LANDING_DETAIL_MS) {
                stopNestedPoll();
            }
        }, HERO_POLL_INTERVAL_MS);
        return stopNestedPoll;
    }, [stage, exitPayload, stopNestedPoll]);

    // Leaving the detail view mid-forward-morph (back to home) without the host
    // having armed an exit — e.g. Escape handling — kills the overlay and its
    // plan immediately rather than waiting for the watchdog.
    useEffect(() => {
        if (
            !navSnapshot
            && !exit
            && (stage === 'flying' || stage === 'settling' || stage === 'fading')
        ) {
            finishLifecycle();
        }
    }, [navSnapshot, exit, stage, finishLifecycle]);

    // Exit lifecycle: a single continuous gesture — fly home, crossfade back to the
    // home artwork and title, motion-blur out and fade away, all on the same curve.
    const handleExitComplete = useCallback(() => {
        if (stage !== 'exiting') {
            return;
        }
        // A nested back still HOLDING for its landing card: the hold animation
        // completing is not the end — wait until the poll lands the hero or
        // gives up before the lifecycle may finish.
        if (
            exitPayload?.nested
            && exitPayload.sourceKey
            && !nestedLanding
            && !nestedGaveUp
        ) {
            return;
        }
        // A landing retargets the springs mid-gesture, and framer reports
        // completion for EVERY leg — including the short hold before the landing
        // arrives. Only a completion after the whole exit window counts,
        // otherwise the composite is torn down right as it starts moving (the
        // "artist exit does nothing" symptom). The watchdog still bounds the
        // pathological case.
        if (exitPayload && Date.now() - exitPayload.armedAt < EXIT_MIN_LIFETIME_MS) {
            return;
        }
        finishLifecycle();
    }, [finishLifecycle, stage, exitPayload, nestedLanding, nestedGaveUp]);

    // Hard watchdog: the whole morph must end and consume the plan whatever
    // happens, so the detail grid can never remain in its "hero hidden +
    // staggered entrances" state.
    useEffect(() => {
        if (stage !== 'flying' && stage !== 'settling' && stage !== 'exiting') {
            return;
        }
        clearWatchdog();
        watchdogTimerRef.current = setTimeout(() => {
            watchdogTimerRef.current = null;
            finishLifecycle();
        }, WATCHDOG_MS);
        return clearWatchdog;
    }, [stage, clearWatchdog, finishLifecycle]);

    useEffect(() => {
        return () => {
            stopPolling();
            stopNestedPoll();
            clearSettleTimer();
            clearWatchdog();
            clearFastForwardTimer();
        };
    }, [clearFastForwardTimer, clearSettleTimer, clearWatchdog, stopNestedPoll, stopPolling]);

    const handleFadeComplete = useCallback(() => {
        if (stage !== 'fading') {
            return;
        }
        // 封面层还在替 hero 顶着（它的封面没解码完）：外框淡完不等于整层收完，
        // 等封面层自己的完成回调。
        if (coverHolding) {
            return;
        }
        finishLifecycle();
    }, [coverHolding, finishLifecycle, stage]);

    const handleCoverFadeComplete = useCallback(() => {
        if (stage !== 'fading') {
            return;
        }
        // 这个回调不只属于「淡出」：封面层落点那一次弹簧到位也会报它，而后者常常落在
        // fading 之后 —— 直接收尾就会把还在替 hero 顶着的封面切掉（等于露出灰底转圈）。
        if (coverHolding) {
            return;
        }
        finishLifecycle();
    }, [coverHolding, finishLifecycle, stage]);

    // Scroll — or a click on the blockade — = fast-forward. The morph doubles as
    // a load cover, so when the user has already moved on the flight must
    // visibly RUSH to its landing, not flash away mid-air. Each flying element's
    // current on-screen rect is snapshotted and the remaining distance replays
    // on a compressed tween (260ms), then a quick fade ends the lifecycle and
    // releases the input blockade (~400ms total).
    const accelerate = useCallback(() => {
        if (acceleratedRef.current) {
            return;
        }
        acceleratedRef.current = true;
        if (stage === 'exiting') {
            // 退出本来就短：给它一点点时间收势，别一按就凭空消失。
            fastForwardTimerRef.current = setTimeout(() => finishLifecycle(), 120);
            return;
        }
        if (stage === 'fading') {
            // Already dissolving — just cap the remainder.
            fastForwardTimerRef.current = setTimeout(() => finishLifecycle(), 180);
            return;
        }
        const rectOfFlight = (el: HTMLElement | null) => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) return null;
            return { x: r.left, y: r.top, width: r.width, height: r.height };
        };
        const frameRect = rectOfFlight(frameFlightRef.current);
        const coverRect = rectOfFlight(coverFlightRef.current);
        const titleRect = rectOfFlight(titleFlightRef.current);
        if (!frameRect || !coverRect || !titleRect) {
            fastForwardTimerRef.current = setTimeout(() => finishLifecycle(), 120);
            return;
        }
        stopPolling();
        clearSettleTimer();
        setFfStart({ frame: frameRect, cover: coverRect, title: titleRect });
        setFastForwarding(true);
        // The compressed flight lands after FAST_FORWARD_FLIGHT_MS; hand
        // over to the (already fast) fading stage from there.
        fastForwardTimerRef.current = setTimeout(() => setStage('fading'), FAST_FORWARD_FLIGHT_MS);
    }, [stage, finishLifecycle, stopPolling, clearSettleTimer]);

    useEffect(() => {
        if (stage === 'idle') {
            return;
        }
        let dragStart: { x: number; y: number } | null = null;
        const onPointerDown = (event: PointerEvent) => {
            dragStart = { x: event.clientX, y: event.clientY };
        };
        const onPointerMove = (event: PointerEvent) => {
            if (!dragStart || event.buttons === 0) {
                return;
            }
            if (Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) > 12) {
                accelerate();
            }
        };
        const onPointerUp = () => {
            dragStart = null;
        };
        window.addEventListener('wheel', accelerate, { capture: true, passive: true });
        window.addEventListener('touchmove', accelerate, { capture: true, passive: true });
        window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
        window.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
        window.addEventListener('pointerup', onPointerUp, { capture: true, passive: true });
        return () => {
            window.removeEventListener('wheel', accelerate, true);
            window.removeEventListener('touchmove', accelerate, true);
            window.removeEventListener('pointerdown', onPointerDown, true);
            window.removeEventListener('pointermove', onPointerMove, true);
            window.removeEventListener('pointerup', onPointerUp, true);
        };
    }, [stage, accelerate]);

    // Fast-forwarded fades end on a hard timer instead of waiting for every
    // spring to settle: the composite is invisible by then, but the input
    // blockade must not outlive the accelerated flight.
    useEffect(() => {
        if (stage !== 'fading' || !fastForwarding) {
            return;
        }
        const finishTimer = setTimeout(() => finishLifecycle(), FAST_FORWARD_FINISH_MS);
        return () => clearTimeout(finishTimer);
    }, [stage, fastForwarding, finishLifecycle]);

    if (!enabled || stage === 'idle') {
        return null;
    }

    const portalRoot = typeof document !== 'undefined' ? document.body : null;
    if (!portalRoot) {
        return null;
    }

    // Reverse flight = the entrance played backwards. The hero's frame/cover/title
    // fly home while crossfading back into the home card's content; every other
    // card ghosts outward along its radial, scattering into blur — the fly-in
    // cascade in reverse. All curves share one Apple ease; opacity only
    // dissolves at the very end so the movement itself stays fully visible.
    if (stage === 'exiting' && exitPayload) {
        // Nested backs land on the pushed-from card once the remounted grid
        // renders it (nestedLanding, hunted by the poll effect) — until then
        // the hero HOLDS in place over the incoming cascade; if the poll gave
        // up it shrinks away in place as before.
        const landing: CollectionMorphGeometry | null = exitPayload.to ?? nestedLanding;
        const holding = exitPayload.nested
            && Boolean(exitPayload.sourceKey)
            && !landing
            && !nestedGaveUp;
        return createPortal(
            <MorphExitLayer
                exit={exitPayload}
                landing={landing}
                holding={holding}
                isNested={!landing}
                onSkip={accelerate}
                onExitComplete={handleExitComplete}
            />,
            portalRoot,
        );
    }

    if (!flown) {
        return null;
    }

    const start = flown;
    const estimated = estimateCenterTarget({ width: window.innerWidth, height: window.innerHeight });
    const target: CollectionMorphTarget = targets ?? {
        frame: estimated,
        cover: estimated,
        coverUrl: null,
        title: estimated,
        titleText: '',
    };
    // Crossfade the song content in as soon as the springs are settling, not
    // after — keeps the transition feeling like one continuous morph.
    const showHeroContent = stage === 'settling' || fading;    // Artist destinations land on the circular avatar: the flying frame/cover
    // round themselves into a circle mid-flight instead of staying card-shaped.
    const artistLanding = navSnapshot?.stack[navSnapshot.stack.length - 1]?.type === 'artist';

    return createPortal(
        <MorphFlightLayer
            start={start}
            target={target}
            fastForwarding={fastForwarding}
            ffStart={ffStart}
            fading={fading}
            blockerReleased={blockerReleased}
            coverHolding={coverHolding}
            showHeroContent={showHeroContent}
            artistLanding={artistLanding}
            frameRef={frameFlightRef}
            coverRef={coverFlightRef}
            titleRef={titleFlightRef}
            onSkip={accelerate}
            onHeroCoverSettled={() => setHeroCoverArrived(true)}
            onCoverAnimationComplete={handleCoverFadeComplete}
            onFrameAnimationComplete={() => {
                if (fading) {
                    handleFadeComplete();
                } else {
                    // 外框停了 = 形状到位：这时解除输入封锁，用户不必等封面和淡出。
                    handleFlightSettled();
                }
            }}
        />,
        portalRoot,
    );
};

export default CollectionMorphOverlay;
