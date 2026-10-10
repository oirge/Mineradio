import React from 'react';
import { motion } from 'framer-motion';

// src/library/suites/grid/transitions/MorphFlightLayer.tsx
// 正向飞行的合成层：卡片外框、封面、标题三件套各自从点击时的矩形形变到详情页 hero 的
// 对应矩形。纯展示组件，不知道生命周期阶段，只接收「现在是否在淡出 / 是否处于快进」。
//
// 三层全部动画**盒子**（left/top/width/height），不使用 x/y/scaleX/scaleY 的 FLIP：
// object-cover 是按布局盒子裁图的，非等比 scale 会把封面内容拉变形（首页满幅卡片飞进
// 歌手页方形头像时尤其明显）。每一帧换布局盒子则让裁图跟着重算，内容永不变形，百分比
// 圆角也自动跟着盒子走。旋转和那点"抬起"仍用 transform，但都是等比缩放，不影响比例。

import {
    boxOf,
    COLLECTION_MORPH_Z_INDEX,
    MORPH_ANIMATED_BOX_PROPERTIES,
    MORPH_CARD_COVER_RADIUS_PX,
    MORPH_CARD_FRAME_RADIUS_PX,
    MORPH_CIRCLE_RADIUS,
    radiusPercent,
    type CollectionMorphPending,
    type CollectionMorphRect,
    type CollectionMorphTarget,
} from './morphGeometry';

// 用 Apple（SwiftUI）那套弹簧签名写，而不是手算 stiffness/damping/mass：
// `visualDuration` 就是 response（视觉上「到」目标所需的时间），`bounce` 就是 1 - dampingFraction。
// ζ ≈ 0.84 只留 ~0.8% 的收势 —— 肉眼读作「落定」而不是「停住」，也不会变成橡皮。
// 上下两条弹簧同参数，所以宽高的过冲成比例，不会出现「呼吸」式的比例抖动。
const MORPH_SPRING = { type: 'spring', visualDuration: 0.34, bounce: 0.16 } as const;
export const FADE_DURATION_SECONDS = 0.18;
export const CROSSFADE_SECONDS = 0.28;
const FAST_FORWARD_TWEEN = { duration: 0.26, ease: [0.22, 1, 0.36, 1] } as const;
export const FAST_FORWARD_FADE_SECONDS = 0.1;

export type MorphFastForwardStart = {
    frame: CollectionMorphRect;
    cover: CollectionMorphRect;
    title: CollectionMorphRect;
};

interface MorphFlightLayerProps {
    start: CollectionMorphPending;
    target: CollectionMorphTarget;
    /** Fades snap shut instead of dissolving once the user fast-forwarded. */
    fastForwarding: boolean;
    /** On-screen rects at fast-forward time; the replay continues from these. */
    ffStart: MorphFastForwardStart | null;
    /** True once the flight stopped moving: the input blockade is released then. */
    blockerReleased: boolean;
    /**
     * True while the hero's own cover is still decoding: this layer keeps its
     * (already decoded) artwork parked exactly over the hero's cover slot, so the
     * handoff never uncovers the card's grey spinner plate. Only this layer
     * waits — the frame, the title and the blockade are already done.
     */
    coverHolding: boolean;
    /** True while the flight is dissolving (stage 'fading'). */
    fading: boolean;
    /** True once the hero content should replace the card content. */
    showHeroContent: boolean;
    /** 目的地是歌手页的圆形头像：飞行中把圆角收成圆。 */
    artistLanding: boolean;
    frameRef: React.Ref<HTMLDivElement>;
    coverRef: React.Ref<HTMLDivElement>;
    titleRef: React.Ref<HTMLDivElement>;
    /** 点击封锁层 = 跳过转场（不然第一次点击只会被无声吞掉）。
     * 绑的是 click 而不是 pointerdown：触摸/按下就开始的拖动不应该把飞行催成一次急冲。 */
    onSkip: () => void;
    /** hero 那张封面解码完成（或失败）：封面层可以放手了。 */
    onHeroCoverSettled: () => void;
    onCoverAnimationComplete: () => void;
    onFrameAnimationComplete: () => void;
}

const MorphFlightLayer: React.FC<MorphFlightLayerProps> = ({
    start,
    target,
    fastForwarding,
    ffStart,
    blockerReleased,
    coverHolding,
    fading,
    showHeroContent,
    artistLanding,
    frameRef,
    coverRef,
    titleRef,
    onSkip,
    onHeroCoverSettled,
    onCoverAnimationComplete,
    onFrameAnimationComplete,
}) => {
    const fadeSeconds = fastForwarding ? FAST_FORWARD_FADE_SECONDS : FADE_DURATION_SECONDS;
    const spring = fastForwarding ? FAST_FORWARD_TWEEN : MORPH_SPRING;
    const suffix = fastForwarding ? '-ff' : '';
    // 收圆的两端都必须用百分比：混用 px 与 % framer 插不出来，落点会跳一下。
    // 非歌手落点不碰圆角，保持卡片自己的类名圆角。
    const frameRadius = artistLanding
        ? { initial: { borderRadius: radiusPercent(MORPH_CARD_FRAME_RADIUS_PX, start.frame.width) }, animate: { borderRadius: MORPH_CIRCLE_RADIUS } }
        : { initial: {}, animate: {} };
    const coverRadius = artistLanding
        ? { initial: { borderRadius: radiusPercent(MORPH_CARD_COVER_RADIUS_PX, start.cover.width) }, animate: { borderRadius: MORPH_CIRCLE_RADIUS } }
        : { initial: {}, animate: {} };

    return (
        <>
            {/* Input blockade: it exists for the flight's opening beat, not for
                the whole lifecycle — it is dropped the moment the composite stops
                moving (see the overlay's handleFlightSettled), so the detail view
                is interactive while a cold cover is still loading. Clicking it
                fast-forwards the flight (the overlay's accelerate). Hidden from
                AT: it carries no content. */}
            {blockerReleased ? null : (
                <div
                    data-folia-collection-morph="input-blocker"
                    aria-hidden="true"
                    className="fixed inset-0"
                    style={{ zIndex: COLLECTION_MORPH_Z_INDEX + 10, pointerEvents: 'auto' }}
                    onClick={onSkip}
                />
            )}
            {/* Card frame: the whole border box glides and resizes onto the hero
                card, lifting slightly (scale) then settling flat. */}
            <motion.div
                key={`morph-frame-${start.capturedAt}${suffix}`}
                ref={frameRef}
                data-folia-collection-morph="frame"
                aria-hidden="true"
                className="fixed rounded-2xl border shadow-[0_10px_28px_rgba(0,0,0,0.3)] pointer-events-none overflow-hidden"
                style={{
                    zIndex: COLLECTION_MORPH_Z_INDEX,
                    background: 'var(--bg-color)',
                    ...boxOf(start.frame),
                    willChange: MORPH_ANIMATED_BOX_PROPERTIES,
                }}
                initial={fastForwarding && ffStart
                    ? { ...boxOf(ffStart.frame), scale: 1, opacity: 1, ...frameRadius.initial }
                    : { ...boxOf(start.frame), scale: 0.97, opacity: 1, ...frameRadius.initial }}
                animate={{
                    ...boxOf(target.frame),
                    scale: 1,
                    ...frameRadius.animate,
                    opacity: fading ? 0 : 1,
                }}
                transition={{
                    ...spring,
                    opacity: { duration: fadeSeconds, ease: 'easeOut' },
                }}
                onAnimationComplete={onFrameAnimationComplete}
            />
            {/* Cover: the same <img> the user clicked gliding onto the hero cover
                with a whisper of rotation; motion blur sharpens to zero as it
                lands, then the song artwork crossfades in. */}
            <motion.div
                key={`morph-cover-${start.capturedAt}${suffix}`}
                ref={coverRef}
                data-folia-collection-morph="cover"
                aria-hidden="true"
                className="fixed overflow-hidden rounded-xl pointer-events-none"
                style={{
                    zIndex: COLLECTION_MORPH_Z_INDEX + 1,
                    ...boxOf(start.cover),
                    willChange: `${MORPH_ANIMATED_BOX_PROPERTIES}, rotate, filter`,
                }}
                initial={fastForwarding && ffStart
                    ? { ...boxOf(ffStart.cover), scale: 1, rotate: 0, filter: 'blur(3px)', opacity: 1, ...coverRadius.initial }
                    : { ...boxOf(start.cover), scale: 0.96, rotate: 2.4, filter: 'blur(6px)', opacity: 1, ...coverRadius.initial }}
                animate={{
                    ...boxOf(target.cover),
                    scale: 1,
                    rotate: 0,
                    ...coverRadius.animate,
                    filter: 'blur(0px)',
                    // 封面层是唯一会为了 hero 的封面多留一会儿的一层：它顶着的那张图
                    // 已经解码好了，露出来的和 hero 待会儿自己画的完全是同一张画。
                    opacity: fading && !coverHolding ? 0 : 1,
                }}
                transition={{
                    ...spring,
                    opacity: { duration: fadeSeconds, ease: 'easeOut' },
                }}
                onAnimationComplete={onCoverAnimationComplete}
            >
                {start.coverUrl ? (
                    <img src={start.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                ) : (
                    <div className="absolute inset-0 bg-zinc-800/40" />
                )}
                {target.coverUrl ? (
                    <img
                        src={target.coverUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ opacity: showHeroContent ? 1 : 0, transition: `opacity ${CROSSFADE_SECONDS}s ease` }}
                        draggable={false}
                        // 这张就是 hero 自己的封面：它解码完成（或失败）意味着可以把画面交还给
                        // hero 卡片，封面层不必再顶着了。
                        onLoad={onHeroCoverSettled}
                        onError={onHeroCoverSettled}
                    />
                ) : null}
            </motion.div>
            {/* Title: label glides to the hero title slot; text swaps to the song
                title mid-flight via crossfade. Both spans stack on the same spot
                so the swap is a pure fade, never a layout shift.
                NOTE: box animation, not a scaled transform — the start (home card
                title line) and target (hero title slot) boxes have different
                aspect ratios, and scaling them would permanently stretch the
                glyphs ("一大坨"). */}
            <motion.div
                key={`morph-title-${start.capturedAt}${suffix}`}
                ref={titleRef}
                data-folia-collection-morph="title"
                aria-hidden="true"
                className="fixed pointer-events-none"
                style={{
                    zIndex: COLLECTION_MORPH_Z_INDEX + 2,
                    ...boxOf(start.title ?? start.frame),
                    willChange: `${MORPH_ANIMATED_BOX_PROPERTIES}, filter`,
                }}
                initial={fastForwarding && ffStart
                    ? { ...boxOf(ffStart.title), filter: 'blur(2px)', opacity: 1 }
                    : { ...boxOf(start.title ?? start.frame), filter: 'blur(3.5px)', opacity: 1 }}
                animate={{
                    ...boxOf(target.title),
                    filter: 'blur(0px)',
                    opacity: fading ? 0 : 1,
                }}
                transition={{
                    ...spring,
                    opacity: { duration: fadeSeconds, ease: 'easeOut' },
                }}
            >
                <span
                    className="absolute inset-0 font-bold truncate"
                    style={{
                        color: 'var(--text-primary)',
                        fontSize: 'inherit',
                        opacity: showHeroContent ? 0 : 1,
                        transition: `opacity ${CROSSFADE_SECONDS}s ease`,
                        textShadow: '0 1px 2px rgba(0,0,0,0.55)',
                    }}
                >
                    {start.titleText || ' '}
                </span>
                <span
                    className="absolute inset-0 font-bold truncate"
                    style={{
                        color: 'var(--text-primary)',
                        fontSize: 'inherit',
                        opacity: showHeroContent ? 1 : 0,
                        transition: `opacity ${CROSSFADE_SECONDS}s ease`,
                        textShadow: '0 1px 2px rgba(0,0,0,0.55)',
                    }}
                >
                    {target.titleText || ' '}
                </span>
            </motion.div>
        </>
    );
};

export default MorphFlightLayer;
