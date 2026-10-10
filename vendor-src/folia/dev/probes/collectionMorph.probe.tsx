import React from 'react';
import { motion } from 'framer-motion';
import { CollectionMorphOverlay } from '../../src/library/suites/grid/transitions/CollectionMorphOverlay';
import { useCollectionMorphStore } from '../../src/library/suites/grid/transitions/collectionMorphStore';
import {
    ACTIVE_GRID_ATTR,
    ARTIST_AVATAR_ATTR,
    ARTIST_BIO_TITLE_ATTR,
    CARD_TITLE_ATTR,
    GRID3D_CARD_INDEX_ATTR,
    GRID_CARD_ITEM_ID_ATTR,
} from '../../src/library/suites/grid/transitions/gridMorphContract';
import { useReducedMotionFor } from '../../src/hooks/useReducedMotionFor';
import { useCollectionNavigationStore } from '../../src/stores/useCollectionNavigationStore';
import { useMotionSettingsStore } from '../../src/stores/useMotionSettingsStore';
import type { GridViewCollectionDescriptor } from '../../src/components/app/home/gridViewCollectionAdapters';
import type { ProbeDefinition } from './definition';
// dev/probes/collectionMorph.probe.tsx

/**
 * 歌单展开的「移形换影」转场。挂的是真的 store、真的探针测量、真的 overlay，只有外面的
 * 导航动作是手写的：首页卡片被点 → 捕获监听（capture 阶段）记下矩形 → React 的 onClick
 * 写导航 store → overlay 起飞。
 *
 * 要看的是四件事：
 * 1. 三件套（frame / cover / title）真的出现，并且会自己结束 —— 生命周期不能靠用户操作
 *    才会退出，否则详情页会一直停在 hero 隐藏的状态；
 * 2. 飞行目标取的是**活动**网格的卡片：这里额外渲染一个「正在退出的旧网格」，它没有
 *    data-folia-active-grid，卡片正好压在同一个位置上，而且排在前面。不限定测量范围时
 *    probeHeroTargets 会先命中它（距离相同时取文档顺序里的第一个），封面的交叉淡化就会
 *    变成旧网格那张图；
 * 3. 降级时完全不出现：localStorage 的 reduce_motion_collectionMorph 打开后，既不藏 hero
 *    也不提交计划；飞行途中拨上这个开关，合成层也要立刻收掉；
 * 4. 点封锁层能跳过转场，不用等整段飞完。
 *
 * 没盖到的：宿主 GridViewOverlayHost 的背景板时长与「嵌套返回落在被点的那张卡上」——
 * 那两段要真实歌单数据，属于整应用 UI 测试的范围。
 */

const cover = (label: string, color: string) => `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="${color}"/>
  <text x="100" y="110" font-size="34" text-anchor="middle" fill="#fff">${label}</text>
</svg>`)}`;

const HOME_COVER = cover('home', '#3b5bdb');
const DETAIL_COVER = cover('detail', '#2f9e44');
const STALE_COVER = cover('stale', '#c92a2a');
const AVATAR_COVER = cover('avatar', '#7048e8');

const PROBE_COLLECTION = (type: 'playlist' | 'artist') => ({
    source: 'navidrome',
    type,
    id: `probe-${type}`,
    name: type === 'artist' ? 'Probe Artist' : 'Probe Playlist',
}) as unknown as GridViewCollectionDescriptor;

const cardBox = { position: 'absolute', left: 620, top: 420, width: 200, height: 260 } as React.CSSProperties;
const coverBox = { width: 200, height: 200, display: 'block' } as React.CSSProperties;
// 歌手头像：正方形，形变落点必须在这里变成正圆（起点那张首页卡片是 200×260，不是方的）。
const avatarBox = { position: 'absolute', left: 600, top: 430, width: 240, height: 240 } as React.CSSProperties;
const avatarCoverBox = { width: 240, height: 240, display: 'block', borderRadius: '50%' } as React.CSSProperties;

const CollectionMorphProbe: React.FC = () => {
    const [open, setOpen] = React.useState(false);
    // 目标页面：歌单（卡片落点）还是歌手（圆形头像落点）。
    const [destination, setDestination] = React.useState<'playlist' | 'artist'>('playlist');
    // 「上一页」的网格：退出动画期间它还在 DOM 里，卡片属性一模一样。
    const [withStaleGrid, setWithStaleGrid] = React.useState(true);
    // 嵌套返回：hero 要落到上一层网格里那张「被点的卡」上，而那张卡自己还在飞入。
    const [nestedBack, setNestedBack] = React.useState(false);
    const morphEnabled = !useReducedMotionFor('collectionMorph');
    const plan = useCollectionMorphStore(state => state.plan);

    // 首页卡片被点：overlay 的捕获监听在 capture 阶段先看到 DOM，然后这里像真实导航那样
    // 写导航 store。计划由 overlay 在起飞时自己 commit（top-level 打开时宿主不 commit），
    // 所以这条断言同时验证了「计划的所有者」。
    const openCollection = () => {
        useCollectionNavigationStore.getState().openRoot(PROBE_COLLECTION(destination), 'home');
        setOpen(true);
    };

    const closeCollection = () => {
        useCollectionMorphStore.getState().clear();
        useCollectionNavigationStore.getState().clear();
        setOpen(false);
        setNestedBack(false);
    };

    // 「首次打开」的真相：hero 的封面是冷的（还没解码完）。真实场景里这是网络 + 解码，
    // 速度完全不受 UI 控制；探针里用一个被 spec 延迟响应的 URL 复现它。
    const [coldCover, setColdCover] = React.useState(false);

    // 模拟「歌手页返回歌单」：hero 是圆形的歌手头像，落点是上一层网格里被点的那张卡，
    // 而那张卡的内层还在做飞入。overlay 必须在卡片外框稳定后就起飞，不能等它落定。
    const startNestedBack = () => {
        const nav = useCollectionNavigationStore.getState();
        nav.openRoot(PROBE_COLLECTION('playlist'), 'home');
        nav.push(PROBE_COLLECTION('artist'));
        const morph = useCollectionMorphStore.getState();
        const source = {
            frame: { x: 40, y: 300, width: 200, height: 260 },
            cover: { x: 40, y: 300, width: 200, height: 200 },
            coverUrl: HOME_COVER,
            title: { x: 40, y: 510, width: 200, height: 24 },
            titleText: 'Home Playlist',
            sourceKey: 'item:a-1',
            navAtGestureStart: { wasOpen: true, depth: 1 },
            capturedAt: Date.now(),
        };
        morph.setLastSource(source, 2);
        morph.armNestedExit(
            {
                frame: { x: 500, y: 300, width: 232, height: 232 },
                cover: { x: 500, y: 300, width: 232, height: 232 },
                coverUrl: AVATAR_COVER,
                title: { x: 520, y: 560, width: 200, height: 24 },
                titleText: 'Artist Name',
                key: 'artist-intro',
                coverReady: true,
                round: true,
            },
            [],
        );
        setOpen(true);
        setNestedBack(true);
    };

    const buttonClass = 'rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-white/10';

    return (
        <div
            className="min-h-screen bg-zinc-900 p-8 text-zinc-200"
            style={{ ['--bg-color' as string]: '#18181b', ['--text-primary' as string]: '#fafafa' }}
        >
            <div className="flex flex-wrap gap-2">
                <button type="button" data-probe-action="close-navigation" className={buttonClass} onClick={() => {
                    // 模拟历史返回：只关闭导航，转场必须自行清理。
                    useCollectionNavigationStore.getState().clear();
                    setOpen(false);
                }}>
                    通过历史返回关闭
                </button>
                <button type="button" data-probe-action="close" className={buttonClass} onClick={closeCollection}>
                    返回首页（清空导航与计划）
                </button>
                <button
                    type="button"
                    data-probe-action="destination"
                    className={buttonClass}
                    onClick={() => {
                        closeCollection();
                        setDestination(current => (current === 'artist' ? 'playlist' : 'artist'));
                    }}
                >
                    目标：{destination === 'artist' ? '歌手页（圆形头像）' : '歌单（卡片）'}
                </button>
                <button
                    type="button"
                    data-probe-action="cold-cover"
                    className={buttonClass}
                    onClick={() => {
                        closeCollection();
                        setColdCover(current => !current);
                    }}
                >
                    hero 封面：{coldCover ? '冷（延迟 1.2s）' : '热（data URI）'}
                </button>
                <button type="button" data-probe-action="toggle-stale" className={buttonClass} onClick={() => setWithStaleGrid(v => !v)}>
                    旧网格：{withStaleGrid ? '在 DOM 里' : '已卸载'}
                </button>
                <button type="button" data-probe-action="nested-back" className={buttonClass} onClick={startNestedBack}>
                    歌手页返回（嵌套返回，落点卡片自己还在飞入）
                </button>
                {/* 走设置面板那条路径（store 的 setter），不是只改 localStorage。飞行途中
                    点不到它，所以测试用 .click() 直接触发，绕过封锁层的命中测试。 */}
                <button
                    type="button"
                    data-probe-action="reduce"
                    className={buttonClass}
                    onClick={() => useMotionSettingsStore.getState().handleToggleReducedMotionSurface('collectionMorph', true)}
                >
                    强制降级
                </button>
            </div>
            <p className="mt-3 text-xs text-zinc-400">
                点下面那张蓝色首页卡片开始。转场状态：
                <span data-probe-plan={plan?.kind ?? 'none'}>{plan?.kind ?? 'none'}</span>
                {' · '}转场启用：<span data-probe-enabled={String(morphEnabled)}>{String(morphEnabled)}</span>
                {' · '}详情页：<span data-probe-open={String(open)}>{String(open)}</span>
                {' · '}目标：<span data-probe-destination={destination}>{destination}</span>
            </p>

            {/* 首页卡片。真实首页在详情页打开时只是 visibility: hidden（仍然可测量），这里照做。 */}
            <div
                {...{ [GRID3D_CARD_INDEX_ATTR]: '2' }}
                data-probe-home-card
                onClick={openCollection}
                style={{
                    position: 'fixed',
                    left: 40,
                    top: 300,
                    width: 200,
                    height: 260,
                    visibility: open ? 'hidden' : 'visible',
                    cursor: 'pointer',
                }}
            >
                <img src={HOME_COVER} alt="" style={coverBox} />
                <div {...{ [CARD_TITLE_ATTR]: 'Home Playlist' }} style={{ width: 200, height: 24, fontSize: 14 }}>
                    Home Playlist
                </div>
            </div>

            {/* 正在退出的旧网格：刻意不带 data-folia-active-grid，并且排在活动网格之前。 */}
            {open && withStaleGrid && (
                <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none' }}>
                    <div {...{ [GRID_CARD_ITEM_ID_ATTR]: 'old-1' }} style={cardBox}>
                        <img src={STALE_COVER} alt="" style={coverBox} />
                        <div {...{ [CARD_TITLE_ATTR]: 'Stale Song' }} style={{ width: 200, height: 24, fontSize: 14 }}>
                            Stale Song
                        </div>
                    </div>
                </div>
            )}

            {/* 活动网格：hero 落在视口正中（1440x1100 时是 720,550）。歌手页用圆形头像 +
                简介标题作为落点（probeArtistIntroTargets 走的是这两个属性）。 */}
            {open && (
                <div {...{ [ACTIVE_GRID_ATTR]: '' }} data-probe-detail-grid style={{ position: 'fixed', inset: 0 }}>
                    {destination === 'artist' ? (
                        <>
                            <div {...{ [ARTIST_AVATAR_ATTR]: '' }} data-probe-artist-avatar style={avatarBox}>
                                <img src={AVATAR_COVER} alt="" style={avatarCoverBox} />
                            </div>
                            <h1
                                {...{ [ARTIST_BIO_TITLE_ATTR]: '' }}
                                data-probe-artist-title
                                style={{ position: 'absolute', left: 620, top: 700, width: 200, height: 24, fontSize: 14 }}
                            >
                                Artist Name
                            </h1>
                        </>
                    ) : (
                        <div {...{ [GRID_CARD_ITEM_ID_ATTR]: 'a-1' }} data-probe-detail-card style={cardBox}>
                            <img
                                src={coldCover ? '/slow-cover.png' : DETAIL_COVER}
                                alt=""
                                style={coverBox}
                                data-probe-detail-cover
                            />
                            <div {...{ [CARD_TITLE_ATTR]: 'Detail Song' }} style={{ width: 200, height: 24, fontSize: 14 }}>
                                Detail Song
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 嵌套返回的落点：上一层网格里被点的那张卡。外框（下面这个 div）从挂载起就在
                最终槽位上，内层 motion.div 才是飞入 —— 和真实 GridView 的结构一致，所以
                overlay 必须靠外框判位置，而不是等内层落定。飞入刻意给到 1.4s：旧实现要等它
                落定才会起飞，比 overlay 现在用的两拍（约 240ms）慢一个数量级。 */}
            {nestedBack && (
                <div {...{ [ACTIVE_GRID_ATTR]: '' }} data-probe-incoming-grid style={{ position: 'fixed', inset: 0 }}>
                    <div {...{ [GRID_CARD_ITEM_ID_ATTR]: 'a-1' }} data-probe-incoming-card style={cardBox}>
                        <motion.div
                            initial={{ x: 620, y: 320, scale: 0.92 }}
                            animate={{ x: 0, y: 0, scale: 1 }}
                            transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <img src={DETAIL_COVER} alt="" style={coverBox} />
                            <div {...{ [CARD_TITLE_ATTR]: 'Landed Song' }} style={{ width: 200, height: 24, fontSize: 14 }}>
                                Landed Song
                            </div>
                        </motion.div>
                    </div>
                </div>
            )}

            <CollectionMorphOverlay enabled={morphEnabled} />
        </div>
    );
};

const definition: ProbeDefinition = {
    id: 'collectionMorph',
    title: '歌单展开的移形换影转场',
    description: '首页卡片 → 详情 hero 的共享元素形变（含歌手圆形头像落点）、活动网格限定、降级与点击跳过。',
    Component: CollectionMorphProbe,
};

export default definition;
