import React from 'react';
import { motion } from 'framer-motion';

// src/library/suites/grid/transitions/MorphExitLayer.tsx
// 反向飞行的合成层：hero 的三件套飞回来源卡片，其余卡片作为「幽灵」沿各自径向四散。
// 纯展示组件 —— 它只知道「飞回哪里」「要不要原地等待落点」，不知道导航和定时器。
//
// 和正向飞行一样，三件套动画的是盒子而不是非等比 scale：封面用的是 object-cover，按布局
// 盒子裁图，scaleX/scaleY 会把内容拉变形（歌手页方形头像飞回纵向卡片时会被压窄）。
// 幽灵块是等比缩放（scale 0.84），不受这条限制。

import {
    boxOf,
    COLLECTION_MORPH_Z_INDEX,
    collectionMorphScatterTravel,
    collectionMorphRectSeed,
    MORPH_ANIMATED_BOX_PROPERTIES,
    MORPH_CARD_COVER_RADIUS_PX,
    MORPH_CARD_FRAME_RADIUS_PX,
    MORPH_CIRCLE_RADIUS,
    radiusPercent,
    type CollectionMorphExit,
    type CollectionMorphGeometry,
    type CollectionMorphRect,
} from './morphGeometry';

// Exit 弹簧同样用 Apple 的签名，但稍微「有生气」一点（bounce 0.2）：返回的落点是用户刚刚
// 离开的那张卡，多一点点收势能让人看出「它回到原位了」。宽高同参数，过冲成比例。
const EXIT_SPRING = { type: 'spring', visualDuration: 0.36, bounce: 0.2 } as const;
// Apple-style exit curve for dissolves (opacity/backdrop still breathe on this).
const EXIT_EASE = [0.32, 0.72, 0, 1] as const;
const EXIT_DURATION_SECONDS = 0.5;
const EXIT_BACKDROP_SECONDS = 0.62;

interface MorphExitLayerProps {
    exit: CollectionMorphExit;
    /**
     * Where the hero lands: the original home card, or (nested back) the card
     * this level was pushed from. Null while a nested back still waits for that
     * card to render, or when no trustworthy source exists. Its `title` may be
     * null (a click capture with no title line): the title layer then holds the
     * hero's own title rect instead of flying to a box it never occupied.
     */
    landing: CollectionMorphGeometry | null;
    /** Nested back that has not found its landing card yet: hold in place. */
    holding: boolean;
    /** No landing at all: the hero shrinks away in place. */
    isNested: boolean;
    /** 点击封锁层 = 跳过转场（不然第一次点击只会被无声吞掉）。 */
    onSkip: () => void;
    onExitComplete: () => void;
}

const MorphExitLayer: React.FC<MorphExitLayerProps> = ({
    exit,
    landing,
    holding,
    isNested,
    onSkip,
    onExitComplete,
}) => {
    const heroRect = exit.from;
    // Nested backs land on the pushed-from card once the remounted grid renders
    // it (hunted by the overlay's poll) — until then the hero HOLDS in place
    // over the incoming cascade; if the poll gave up it shrinks away in place.
    const homeRect: CollectionMorphRect = landing?.frame ?? heroRect.frame;
    const homeCover: CollectionMorphRect = landing?.cover ?? heroRect.cover;
    const homeTitle: CollectionMorphRect = landing?.title ?? heroRect.title;
    const key = `exit-${exit.armedAt}`;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    // 四散的距离刻意比原来的「飞到屏幕外」短得多：读作「散开并淡出」，而不是炸出去；
    // 顺带少掉一大截位移，返回时同时要喂的动画也轻。
    const reach = collectionMorphScatterTravel({ width: window.innerWidth, height: window.innerHeight });
    const squadMaxDist = Math.max(
        1,
        ...exit.squad.map((ghost) => Math.hypot(
            ghost.rect.x + ghost.rect.width / 2 - cx,
            ghost.rect.y + ghost.rect.height / 2 - cy,
        )),
    );
    // 圆角两端都用百分比：起点是圆形头像（`50%` 就在 hero 的方形盒子上），飞回卡片时换成
    // 卡片角半径的等值百分比 —— 混用 px 与 % framer 插不出来，会跳。
    const frameStartRadius = heroRect.round ? MORPH_CIRCLE_RADIUS : undefined;
    const coverStartRadius = heroRect.round ? MORPH_CIRCLE_RADIUS : undefined;
    const frameEndRadius = heroRect.round
        ? (isNested ? MORPH_CIRCLE_RADIUS : radiusPercent(MORPH_CARD_FRAME_RADIUS_PX, homeRect.width))
        : undefined;
    const coverEndRadius = heroRect.round
        ? (isNested ? MORPH_CIRCLE_RADIUS : radiusPercent(MORPH_CARD_COVER_RADIUS_PX, homeCover.width))
        : undefined;

    return (
        <>
            {/* Same input blockade as the forward flight — the exit is short, and
                a stray click mid-flight must not re-trigger navigation
                underneath the scattering cards. Hidden from AT: no content. */}
            <div
                data-folia-collection-morph="input-blocker"
                aria-hidden="true"
                className="fixed inset-0"
                style={{ zIndex: COLLECTION_MORPH_Z_INDEX + 10, pointerEvents: 'auto' }}
                onClick={onSkip}
            />
            <motion.div
                key={`${key}-backdrop`}
                data-folia-collection-morph="exit-backdrop"
                aria-hidden="true"
                className="fixed inset-0 pointer-events-none"
                style={{ zIndex: COLLECTION_MORPH_Z_INDEX - 1, background: 'var(--bg-color)' }}
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: EXIT_BACKDROP_SECONDS, ease: [...EXIT_EASE] }}
            />
            {/* Surrounding cards scatter outward — the fly-in in reverse,
                replayed as their real covers so the exit reads as the grid
                itself dissolving instead of empty frames. */}
            {exit.squad.map((ghost, index) => {
                const rect = ghost.rect;
                const dX = rect.x + rect.width / 2 - cx;
                const dY = rect.y + rect.height / 2 - cy;
                const distance = Math.hypot(dX, dY);
                const direction = distance > 1
                    ? { x: dX / distance, y: dY / distance }
                    : { x: 0, y: -1 };
                // Deterministic jitter from the rect so the scatter breathes
                // like the entrance instead of sweeping.
                const seed = collectionMorphRectSeed(rect);
                const jitter = ((seed % 1000) / 1000 - 0.5) * 0.08;
                const normalized = Math.min(distance / squadMaxDist, 1);
                // Farther ghosts leave sooner and faster: a depth wave rolls
                // outward from the hero instead of a uniform sweep.
                const duration = 0.46 + normalized * 0.3;
                return (
                    <motion.div
                        key={`${key}-squad-${index}`}
                        data-folia-collection-morph="squad"
                        aria-hidden="true"
                        className="fixed rounded-xl overflow-hidden pointer-events-none"
                        style={{
                            zIndex: COLLECTION_MORPH_Z_INDEX,
                            boxShadow: '0 6px 18px rgba(0,0,0,0.28)',
                            borderRadius: 14,
                            left: rect.x,
                            top: rect.y,
                            width: rect.width,
                            height: rect.height,
                            transformOrigin: '50% 50%',
                            willChange: 'transform, opacity',
                        }}
                        initial={{
                            x: 0,
                            y: 0,
                            rotate: 0,
                            scale: 1,
                            opacity: 1,
                        }}
                        animate={{
                            x: direction.x * reach,
                            y: direction.y * reach,
                            rotate: (seed % 2 === 0 ? 1 : -1) * (1.8 + (seed % 3) * 0.8),
                            scale: 0.9,
                            opacity: [1, 0.72, 0],
                        }}
                        transition={{
                            duration,
                            ease: [0.22, 1, 0.36, 1],
                            delay: 0.04 + normalized * 0.26 + jitter,
                            opacity: { duration, times: [0, 0.5, 1], ease: 'easeInOut' },
                        }}
                    >
                        {ghost.coverUrl ? (
                            <img
                                src={ghost.coverUrl}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover"
                                draggable={false}
                            />
                        ) : (
                            <div className="absolute inset-0 bg-zinc-800/40" />
                        )}
                        {/* Scrim + title strip keeps the ghost reading as
                            the real card it stood in for. */}
                        <div
                            className="absolute inset-0"
                            style={{
                                background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,0.62) 100%)',
                            }}
                        />
                        <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.14)' }} />
                        {ghost.titleText ? (
                            <div className="absolute inset-x-0 bottom-0 px-2.5 pb-2">
                                <div
                                    className="text-[11px] font-bold text-white truncate"
                                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}
                                >
                                    {ghost.titleText}
                                </div>
                            </div>
                        ) : null}
                    </motion.div>
                );
            })}
            {/* Hero frame flies straight back onto the home card. While a nested
                back waits for its landing card, it holds in place (opacity 1)
                over the incoming cascade instead of dissolving before the
                destination exists. */}
            <motion.div
                key={`${key}-frame`}
                data-folia-collection-morph="frame"
                aria-hidden="true"
                className="fixed rounded-2xl border shadow-[0_10px_28px_rgba(0,0,0,0.3)] pointer-events-none overflow-hidden"
                style={{
                    zIndex: COLLECTION_MORPH_Z_INDEX + 1,
                    background: 'var(--bg-color)',
                    ...boxOf(heroRect.frame),
                    willChange: MORPH_ANIMATED_BOX_PROPERTIES,
                }}
                initial={{ ...boxOf(heroRect.frame), scale: 1, opacity: 1, borderRadius: frameStartRadius }}
                animate={holding
                    ? {
                        ...boxOf(heroRect.frame),
                        scale: 0.97,
                        borderRadius: frameStartRadius,
                        opacity: 1,
                    }
                    : {
                        ...boxOf(homeRect),
                        scale: isNested ? 0.8 : 0.985,
                        borderRadius: frameEndRadius,
                        opacity: [1, 1, 0],
                    }}
                transition={{
                    ...EXIT_SPRING,
                    opacity: { duration: EXIT_DURATION_SECONDS, times: [0, 0.72, 1], ease: 'easeOut' },
                }}
                onAnimationComplete={onExitComplete}
            />
            {/* Cover crossfades back into the home artwork mid-flight. */}
            <motion.div
                key={`${key}-cover`}
                data-folia-collection-morph="cover"
                aria-hidden="true"
                className="fixed overflow-hidden rounded-xl pointer-events-none"
                style={{
                    zIndex: COLLECTION_MORPH_Z_INDEX + 2,
                    ...boxOf(heroRect.cover),
                    willChange: `${MORPH_ANIMATED_BOX_PROPERTIES}, rotate, filter`,
                }}
                initial={{ ...boxOf(heroRect.cover), scale: 1, rotate: 0, filter: 'blur(0px)', opacity: 1, borderRadius: coverStartRadius }}
                animate={holding
                    ? {
                        ...boxOf(heroRect.cover),
                        scale: 0.96,
                        rotate: 0,
                        filter: 'blur(0px)',
                        borderRadius: coverStartRadius,
                        opacity: 1,
                    }
                    : {
                        ...boxOf(homeCover),
                        scale: isNested ? 0.78 : 1,
                        rotate: [0, 5, 1.6],
                        borderRadius: coverEndRadius,
                        filter: ['blur(0px)', 'blur(1px)', 'blur(8px)'],
                        opacity: [1, 1, 0],
                    }}
                transition={{
                    ...EXIT_SPRING,
                    opacity: { duration: EXIT_DURATION_SECONDS, times: [0, 0.72, 1], ease: 'easeOut' },
                }}
            >
                {heroRect.coverUrl ? (
                    <img src={heroRect.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                ) : (
                    <div className="absolute inset-0 bg-zinc-800/40" />
                )}
                {landing?.coverUrl && landing.coverUrl !== heroRect.coverUrl ? (
                    <motion.img
                        src={landing.coverUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: EXIT_DURATION_SECONDS * 0.7, ease: 'easeOut' }}
                        draggable={false}
                    />
                ) : null}
            </motion.div>
            {/* Title glides home while the song title dissolves into the
                playlist title on the same curve. Box animation, not FLIP:
                hero and home title rects have different aspect ratios and
                non-uniform scale would stretch the glyphs. */}
            <motion.div
                key={`${key}-title`}
                data-folia-collection-morph="title"
                aria-hidden="true"
                className="fixed pointer-events-none"
                style={{
                    zIndex: COLLECTION_MORPH_Z_INDEX + 3,
                    ...boxOf(heroRect.title),
                    willChange: `${MORPH_ANIMATED_BOX_PROPERTIES}, filter`,
                }}
                initial={{
                    ...boxOf(heroRect.title),
                    filter: 'blur(0px)',
                    opacity: [1, 1, 0],
                }}
                animate={holding
                    ? {
                        ...boxOf(heroRect.title),
                        filter: 'blur(0px)',
                        opacity: 1,
                    }
                    : {
                        ...boxOf(homeTitle),
                        filter: ['blur(0px)', 'blur(1px)', 'blur(8px)'],
                        opacity: [1, 1, 0],
                    }}
                transition={{
                    ...EXIT_SPRING,
                    opacity: { duration: EXIT_DURATION_SECONDS, times: [0, 0.72, 1], ease: 'easeOut' },
                }}
            >
                <span
                    className="absolute inset-0 font-bold truncate"
                    style={{
                        color: 'var(--text-primary)',
                        fontSize: 'inherit',
                        opacity: 1,
                        transition: 'none',
                        textShadow: '0 1px 2px rgba(0,0,0,0.55)',
                    }}
                >
                    {heroRect.titleText || ' '}
                </span>
                <motion.span
                    className="absolute inset-0 font-bold truncate"
                    style={{
                        color: 'var(--text-primary)',
                        fontSize: 'inherit',
                        textShadow: '0 1px 2px rgba(0,0,0,0.55)',
                    }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: EXIT_DURATION_SECONDS * 0.7, ease: 'easeOut' }}
                >
                    {landing?.titleText || ' '}
                </motion.span>
            </motion.div>
        </>
    );
};

export default MorphExitLayer;
