import type { CSSProperties } from 'react';
import type { PonderRelativeRect } from '../../../types/ponder';

// src/components/ponder/surfaces/ponderSurfaceGeometry.ts
// 合成页面界面和教程锚点共用的一张几何表。
//
// 这层存在的唯一理由是不让两边走散：surface 用 relativeRectStyle 把一条记录翻成 CSS 定位，
// target 把同一条记录原样交给 relative 锚点。各写一遍百分比的写法做不到对齐 —— 高亮框会落在
// 真实元素旁边几个百分点，指向线也跟着指偏，看起来就是骨架和界面对不上。
//
// 坐标系一律是「所属容器的 0..1」，和 CSS 的 inset / aspect-square 同义。

/** 相对矩形 → 绝对定位样式。和 resolvePonderAnchors 的 relativeRectToPx 必须是同一套换算。 */
export const relativeRectStyle = (rect: PonderRelativeRect): CSSProperties => {
    const pct = (value: number) => `${value * 100}%`;
    return {
        position: 'absolute',
        ...(rect.left !== undefined ? { left: pct(rect.left) } : {}),
        ...(rect.right !== undefined ? { right: pct(rect.right) } : {}),
        ...(rect.top !== undefined ? { top: pct(rect.top) } : {}),
        ...(rect.bottom !== undefined ? { bottom: pct(rect.bottom) } : {}),
        ...(rect.width !== undefined ? { width: pct(rect.width) } : {}),
        ...(rect.square
            ? { aspectRatio: '1 / 1' }
            : rect.aspect !== undefined ? { aspectRatio: `1 / ${rect.aspect}` }
            : rect.height !== undefined ? { height: pct(rect.height) } : {}),
    };
};

/** 无限墙上的海报，坐标系是 wall。焦点那张同时是 `poster` 锚点，不另外写一份。 */
export const LATTICE_POSTERS: readonly PonderRelativeRect[] = [
    { left: 0.04, top: 0.08, width: 0.20, height: 0.24 },
    { left: 0.26, top: 0.04, width: 0.17, height: 0.29 },
    { left: 0.45, top: 0.10, width: 0.24, height: 0.22 },
    { left: 0.72, top: 0.04, width: 0.20, height: 0.27 },
    { left: 0.02, top: 0.38, width: 0.17, height: 0.25 },
    { left: 0.22, top: 0.37, width: 0.25, height: 0.28 },
    { left: 0.50, top: 0.36, width: 0.18, height: 0.23 },
    { left: 0.71, top: 0.34, width: 0.25, height: 0.30 },
    { left: 0.07, top: 0.68, width: 0.22, height: 0.25 },
    { left: 0.32, top: 0.70, width: 0.17, height: 0.22 },
    { left: 0.52, top: 0.64, width: 0.24, height: 0.27 },
    { left: 0.79, top: 0.70, width: 0.17, height: 0.21 },
];

/** 教程里被聚焦、被展开的那张海报的序号。 */
export const LATTICE_FOCUSED_POSTER = 5;

/**
 * 「拖动平移相机」那一步把墙挪走多少，单位是 wall 自身的比例。
 *
 * 平移之后的聚焦层必须沿用同一个位移：两层墙只在焦点描边上有差别时，交叉淡入看不出破绽；
 * 位移不一致的话，淡入淡出那半秒屏幕上就是两面错开的墙。
 */
export const LATTICE_PAN = { x: -0.068, y: 0.036 };

const latticePannedPoster = (poster: PonderRelativeRect): PonderRelativeRect => ({
    ...poster,
    left: (poster.left ?? 0) + LATTICE_PAN.x,
    top: (poster.top ?? 0) + LATTICE_PAN.y,
});

export const LATTICE_GEOMETRY = {
    /** 相对 page。 */
    wall: { left: 0.06, right: 0.06, top: 0.07, bottom: 0.10 },
    /** 相对 wall。 */
    poster: LATTICE_POSTERS[LATTICE_FOCUSED_POSTER],
    /** 相对 wall：相机平移之后那张焦点海报落在哪。 */
    pannedPoster: latticePannedPoster(LATTICE_POSTERS[LATTICE_FOCUSED_POSTER]),
    back: { left: 0.03, top: 0.04, width: 0.06, square: true },
    tools: { right: 0.04, bottom: 0.05, width: 0.07, square: true },
    expanded: { left: 0.20, right: 0.20, top: 0.13, bottom: 0.14 },
    /** 相对 expanded：展开海报底部那条播放控制。 */
    chrome: { left: 0.06, right: 0.06, bottom: 0.06, height: 0.26 },
    toolsPanel: { right: 0.04, bottom: 0.13, width: 0.38, height: 0.40 },
    command: { left: 0.18, right: 0.18, top: 0.14, bottom: 0.20 },
} satisfies Record<string, PonderRelativeRect>;

/** Grid3D 轨道上的五张卡，坐标系是 page。中间那张同时是 `focusedCard` 锚点。 */
export const GRID_CARDS: readonly PonderRelativeRect[] = [
    { left: 0.0785, top: 0.3725, width: 0.155, height: 0.30 },
    { left: 0.2455, top: 0.3725, width: 0.155, height: 0.30 },
    { left: 0.4125, top: 0.355, width: 0.175, height: 0.335 },
    { left: 0.5995, top: 0.3725, width: 0.155, height: 0.30 },
    { left: 0.7665, top: 0.3725, width: 0.155, height: 0.30 },
];

export const GRID_FOCUSED_CARD = 2;

const gridTabs = { left: 0.344, top: 0.069, width: 0.322, height: 0.062 };

export const GRID_GEOMETRY = {
    help: { left: 0.04, top: 0.05, width: 0.22, height: 0.10 },
    tabs: gridTabs,
    /** 切换后亮起来的那一格，跟着 tabs 走，不另写一组坐标。 */
    activeTab: {
        left: gridTabs.left + gridTabs.width * 0.26,
        top: gridTabs.top + gridTabs.height * 0.13,
        width: gridTabs.width * 0.21,
        height: gridTabs.height * 0.74,
    },
    search: { left: 0.748, top: 0.072, width: 0.212, height: 0.056 },
    map: { left: 0.42, top: 0.195, width: 0.16, height: 0.054 },
    sourceActions: { left: 0.79, top: 0.195, width: 0.17, height: 0.054 },
    shelf: { left: 0, right: 0, top: 0.357, height: 0.331 },
    focusedCard: GRID_CARDS[GRID_FOCUSED_CARD],
    focusedCopy: { left: 0.29, top: 0.715, width: 0.42, height: 0.105 },
    command: { left: 0.18, right: 0.18, top: 0.18, height: 0.58 },
} satisfies Record<string, PonderRelativeRect>;

/** 换源之后轨道上摆的那批卡。 */
export const TAB_SWITCH_CARDS: readonly PonderRelativeRect[] = [
    { left: 0.175, top: 0.375, width: 0.145, height: 0.29 },
    { left: 0.345, top: 0.375, width: 0.145, height: 0.29 },
    { left: 0.515, top: 0.375, width: 0.145, height: 0.29 },
    { left: 0.685, top: 0.375, width: 0.145, height: 0.29 },
];

/** GridView 的卡片阵列：六列错行，坐标系是 cards。 */
export const GRID_VIEW_CARD_COLUMNS = 6;
export const GRID_VIEW_CARD_COUNT = 17;
export const GRID_VIEW_FOCUSED_CARD = 8;

/**
 * 按序号算出一张卡在 cards 里的位置。锚点和界面都走它，错行偏移只写一遍。
 *
 * 列距、卡宽和错行量三个数要满足 5×列距 + 卡宽 + 错行量 ≤ 1：不满足的话，错行的那几排
 * 最后一张会整块长到 cards 之外 —— 屏幕上就是一张卡莫名其妙地比别的排凸出去一截。
 * 整排再按剩下的空隙左右居中，错行的一半往右、另一半往左。
 */
const GRID_VIEW_CARD_PITCH = 0.15;
const GRID_VIEW_CARD_WIDTH = 0.13;
const GRID_VIEW_CARD_STAGGER = 0.075;
const GRID_VIEW_CARD_INSET = (
    1 - ((GRID_VIEW_CARD_COLUMNS - 1) * GRID_VIEW_CARD_PITCH + GRID_VIEW_CARD_WIDTH + GRID_VIEW_CARD_STAGGER)
) / 2;

export const gridViewCardRect = (index: number): PonderRelativeRect => {
    const column = index % GRID_VIEW_CARD_COLUMNS;
    const row = Math.floor(index / GRID_VIEW_CARD_COLUMNS);
    return {
        left: GRID_VIEW_CARD_INSET + column * GRID_VIEW_CARD_PITCH + (row % 2 ? GRID_VIEW_CARD_STAGGER : 0),
        top: row * 0.34,
        width: GRID_VIEW_CARD_WIDTH,
        height: 0.26,
    };
};

export const GRID_VIEW_GEOMETRY = {
    back: { left: 0.03, top: 0.04, width: 0.06, square: true },
    title: { left: 0.33, top: 0.04, width: 0.34, height: 0.10 },
    cards: { left: 0.07, right: 0.07, top: 0.17, bottom: 0.08 },
    /** 相对 cards。 */
    card: gridViewCardRect(GRID_VIEW_FOCUSED_CARD),
    info: { left: 0.04, top: 0.16, bottom: 0.07, width: 0.34 },
    filter: { left: 0.22, right: 0.22, top: 0.08, height: 0.11 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 本地 Grid3D 顶栏：居中的是顶部视图胶囊的第二层（「全部」、分隔线、分类），右侧是导入维护操作。
 * 分类里当前的「文件夹」带文字、较宽，其余三个只有图标，所以「歌单」是最右那一格窄的。
 */
export const LOCAL_GRID_CONTROLS_GEOMETRY = {
    capsule: { left: 0.14, top: 0.18, width: 0.42, height: 0.32 },
    map: { left: 0.15, top: 0.2, width: 0.1, height: 0.28 },
    tabs: { left: 0.275, top: 0.18, width: 0.285, height: 0.32 },
    folders: { left: 0.28, top: 0.2, width: 0.12, height: 0.28 },
    playlists: { left: 0.505, top: 0.2, width: 0.05, height: 0.28 },
    imports: { left: 0.6, top: 0.18, right: 0.03, height: 0.32 },
    refresh: { left: 0.77, top: 0.18, width: 0.09, height: 0.32 },
    playlistImport: { left: 0.88, top: 0.18, right: 0.03, height: 0.32 },
} satisfies Record<string, PonderRelativeRect>;

/** GridView 在线集合信息面板底部的通用与来源专属动作。 */
export const ONLINE_COLLECTION_ACTIONS_GEOMETRY = {
    playAll: { left: 0.08, right: 0.08, top: 0.08, height: 0.13 },
    addQueue: { left: 0.08, right: 0.08, top: 0.25, height: 0.13 },
    addPlaylist: { left: 0.08, right: 0.08, top: 0.42, height: 0.13 },
    providerAction: { left: 0.08, right: 0.08, top: 0.59, height: 0.13 },
    destructiveAction: { left: 0.08, right: 0.08, top: 0.76, height: 0.13 },
} satisfies Record<string, PonderRelativeRect>;

/** 本地 GridMap 页面与标题展开的批量选择/目录树面板。 */
export const LOCAL_GRID_MAP_GEOMETRY = {
    back: { left: 0.03, top: 0.04, width: 0.06, square: true },
    title: { left: 0.34, top: 0.04, width: 0.32, height: 0.10 },
    cards: { left: 0.08, right: 0.08, top: 0.18, bottom: 0.08 },
    panel: { left: 0.03, top: 0.11, width: 0.21, bottom: 0.07 },
    tree: { left: 0.043, top: 0.25, width: 0.185, height: 0.44 },
    row: { left: 0.052, top: 0.34, width: 0.166, height: 0.065 },
    checkbox: { left: 0.069, top: 0.352, width: 0.019, square: true },
    expand: { left: 0.051, top: 0.352, width: 0.015, square: true },
    rootActions: { left: 0.196, top: 0.352, width: 0.022, height: 0.026 },
    actions: { left: 0.043, top: 0.87, width: 0.185, height: 0.05 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 底部控制条，坐标系是 bar 本身。
 *
 * 这条在真实界面里会随悬停展开/收起、还会被缩放，量当下的 DOM 得到的经常是一根收起来的
 * 进度条，甚至什么都量不到。所以教程里画的是一条完整尺寸的合成胶囊，几何固定在这里。
 */
export const PLAYER_BAR_GEOMETRY = {
    play: { left: 0.035, top: 0.24, width: 0.065, square: true },
    title: { left: 0.14, top: 0.13, width: 0.58, height: 0.30 },
    progress: { left: 0.14, top: 0.56, width: 0.58, height: 0.28 },
    slots: { left: 0.856, top: 0.30, right: 0.04, height: 0.40 },
    primarySlot: { left: 0.856, top: 0.30, width: 0.046, square: true },
    secondarySlot: { left: 0.914, top: 0.30, width: 0.046, square: true },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 播放页，坐标系是 page。
 *
 * 真实的播放页是整屏：可视化和歌词铺满，控制条浮在底部中间，侧边手柄贴右缘且和控制条同高。
 * 这里照这个关系摆，位置才讲得出「在哪」。
 */
export const PLAYER_PAGE_GEOMETRY = {
    lyrics: { left: 0.10, right: 0.34, top: 0.16, bottom: 0.30 },
    // 收窄到 60%，和真实那条一样：再宽就会压到右缘手柄背后那条滑轨上。
    bar: { left: 0.20, right: 0.20, bottom: 0.06, height: 0.14 },
    /** 侧边手柄贴右缘，底边和控制条对齐。 */
    toggle: { right: 0.03, bottom: 0.065, width: 0.058, square: true },
    /**
     * 手柄背后向左伸出的滑轨，长度是手柄的两倍、高度和手柄相同。
     * 高度必须按宽度推（aspect），不能写 height：手柄是 square，高度跟着页面宽度走，
     * 写死 height 就跟着页面高度走，宽高比一变手柄就缩到滑轨右下角去了。
     */
    track: { right: 0.03, bottom: 0.065, width: 0.116, aspect: 0.5 },
    /** 手柄上方展开的控制面板。 */
    panel: { right: 0.03, bottom: 0.225, width: 0.25, height: 0.60 },
    /** 命令窗口：水平居中，顶在 18vh 上。 */
    palette: { left: 0.19, right: 0.19, top: 0.14, height: 0.46 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 右侧展开的控制面板，坐标系是面板自身。
 *
 * 真实面板是 `w-80` 加 `p-5`，从上到下只有三段：一张正方形封面、紧挨着的一排标签页、
 * 再下面是当前标签页的内容。封面和标签排之间没有第四段 —— 歌名、歌手、专辑是封面页
 * *里面*的内容，不是面板结构的一层，所以这里不留曲目信息带。
 *
 * 这几个数是把真实尺寸按面板高度（= 2.15 × 面板宽，见 sidePanelAnchor）换算来的：
 * 内边距 20、封面 280（宽的 88%）、间距 16、标签排 48、间距 16，剩下的全是内容区。
 * 封面和标签排之间只有 16px —— 留出一整条空带就是「骨架和真实界面对不上」最显眼的那种。
 */
export const SIDE_PANEL_GEOMETRY = {
    cover: { left: 0.06, right: 0.06, top: 0.029, square: true },
    tabs: { left: 0.06, right: 0.06, top: 0.461, height: 0.070 },
    body: { left: 0.06, right: 0.06, top: 0.554, bottom: 0.029 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 来源那一格里的几块，坐标系是当前标签页内容区（body）。
 *
 * 本地、Navidrome、在线歌词三页共用这一组：三页的骨架是同一个形状 ——
 * 来源信息、音频增益、歌词管理、时间轴偏移，差别只在最上面那块写什么。
 */
export const SIDE_PANEL_SOURCE_PAGE = {
    info: { left: 0, right: 0, top: 0, height: 0.22 },
    gain: { left: 0, right: 0, top: 0.28, height: 0.22 },
    lyrics: { left: 0, right: 0, top: 0.56, height: 0.28 },
    offset: { left: 0, right: 0, top: 0.89, height: 0.11 },
    /** 按下歌词行那颗导入 / 导出之后弹出的歌词文件窗口：导入、导出这一首、批量导出三段。 */
    fileDialog: { left: 0.04, right: 0.04, top: 0.14, height: 0.8 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 歌词那一块标题行右端的两颗图标，坐标系是歌词块（SIDE_PANEL_SOURCE_PAGE.lyrics）。
 *
 * 左边那颗是导入 / 导出（两件事合在一颗按钮、一个窗口里），右边是在线匹配。单独量出来
 * 而不是交给 flex 排，是因为锚点要指的就是左边那颗：骨架和锚点读同一条记录，高亮才罩得准。
 */
export const SIDE_PANEL_SOURCE_LYRICS = {
    fileIcon: { right: 0.1, top: 0, width: 0.1, height: 0.3 },
    matchIcon: { right: 0, top: 0, width: 0.1, height: 0.3 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 控制页里那几块，坐标系是当前标签页内容区（body）。
 *
 * 两行取景器的中间那块要单独量：真实界面里它是一颗按钮 —— 点下去展开完整模式列表，
 * 而两端那对箭头只换到相邻的一个。屏幕上没有任何东西说中间可以点，所以骨架里它必须
 * 是一块能被指住的区域，而不是一行里随便一条占位文字。
 */
export const SIDE_PANEL_CONTROLS_PAGE = {
    songActions: { left: 0, right: 0, top: 0, height: 0.166 },
    volume: { left: 0, right: 0, top: 0.248, height: 0.124 },
    modeRowVisualizer: { left: 0, right: 0, top: 0.414, height: 0.110 },
    modeRowBackground: { left: 0, right: 0, top: 0.538, height: 0.110 },
    /** 主题来源那一行，以及最底下写着当前主题名的那一条。真实那一页到这里才到底。 */
    themeSource: { left: 0, right: 0, top: 0.662, height: 0.110 },
    currentTheme: { left: 0, right: 0, top: 0.855, height: 0.097 },
    /** 中间那块名称的点击范围：左边让开箭头和字形，右边让开参数槽和另一个箭头。 */
    modeName: { left: 0.20, right: 0.32, top: 0.414, height: 0.110 },
    modeNameBackground: { left: 0.20, right: 0.32, top: 0.538, height: 0.110 },
    /**
     * 点开之后压下来的完整列表，底部还有一条通往完整设置的出口。
     *
     * 起点压在取景器那一行**下面**：列表盖住被点开的那块名称的话，
     * 「点的是这里、掉下来的是它」就没了 —— 高亮也会落在一块看不见的元素上。
     */
    modeList: { left: 0.04, right: 0.04, top: 0.53, bottom: 0.02 },
    modeListFooter: { left: 0.04, right: 0.04, bottom: 0.02, height: 0.11 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 队列页里的一块，坐标系是 body。
 *
 * 队列页是 flex 排的：顶上一行占 body 高的 12%，打乱按钮是那一行最右端的图标。
 * 这里只圈出它所在的那一角，给「队列面板上也能打乱」那一章指过去。
 */
export const SIDE_PANEL_QUEUE_PAGE = {
    shuffle: { right: 0, top: 0, width: 0.12, height: 0.12 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 电台页里那几块，坐标系是 body。
 *
 * 私人 FM 打开时，队列那一格整格换成它 —— 同一个位置、同一格标签，内容却从一份可以
 * 拖动排序的清单变成了三颗传送按钮加一对喜欢/扔掉。没有队列，也就没有「接下来是什么」。
 */
export const SIDE_PANEL_FM_PAGE = {
    modeChip: { left: 0.26, right: 0.26, top: 0.03, height: 0.12 },
    transport: { left: 0.06, right: 0.06, top: 0.26, height: 0.30 },
    actions: { left: 0.16, right: 0.16, top: 0.68, height: 0.26 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 封面四角那四颗按钮，坐标系是封面自身。
 *
 * 它们平时不在屏幕上：`opacity-0 group-hover:opacity-100`，指针移上封面才浮出来。
 * 四个角各是一个独立动作，所以各自一个锚点 —— 笼统框住整张封面讲不出「右上角那颗
 * 是播放页透明背景」。真实尺寸是 44px 按钮、离边 12px，相对 280px 的封面就是这组数。
 */
export const SIDE_PANEL_COVER_ACTIONS = {
    settings: { left: 0.043, top: 0.043, width: 0.157, square: true },
    transparent: { right: 0.043, top: 0.043, width: 0.157, square: true },
    home: { left: 0.043, bottom: 0.043, width: 0.157, square: true },
    addToPlaylist: { right: 0.043, bottom: 0.043, width: 0.157, square: true },
} satisfies Record<string, PonderRelativeRect>;

/** 标签页的条数，和真实面板常驻的那四页一致。 */
export const SIDE_PANEL_TABS = ['cover', 'controls', 'queue', 'account'] as const;

export type SidePanelTabId = (typeof SIDE_PANEL_TABS)[number];

/**
 * Lattice 里展开海报底部那条播放控制，坐标系是展开的卡片。
 *
 * 四个额外按钮里，两端是上一首/下一首，中间两个就是底栏那两个可配置槽位 —— 这一章的全部重点
 * 在这里，所以它们各自是一个锚点，而不是笼统的一块「按钮区」。
 */
export const LATTICE_CHROME_GEOMETRY = {
    card: { left: 0.06, right: 0.06, top: 0.05, bottom: 0.06 },
    /** 以下都相对 chrome。 */
    play: { left: 0.03, top: 0.12, width: 0.10, square: true },
    prev: { left: 0.20, top: 0.16, width: 0.085, square: true },
    slotPrimary: { left: 0.315, top: 0.16, width: 0.085, square: true },
    slotSecondary: { left: 0.43, top: 0.16, width: 0.085, square: true },
    next: { left: 0.545, top: 0.16, width: 0.085, square: true },
    time: { left: 0.67, top: 0.26, width: 0.16, height: 0.2 },
    openPlayer: { right: 0.03, top: 0.16, width: 0.085, square: true },
    progress: { left: 0.03, right: 0.03, bottom: 0.14, height: 0.12 },
    /** 卡片之外：海报滚出视口时自动出现的那条底栏。相对 page。 */
    bottomBar: { left: 0.22, right: 0.22, bottom: 0.03, height: 0.13 },
    chrome: { left: 0.04, right: 0.04, bottom: 0.06, height: 0.34 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 播放与交互那几组设置的几何，坐标系都是各自那块面板。
 *
 * 分开量而不是共用一套：这几组行数不同，套同一组坐标会让高亮框落在别的行上 ——
 * 而「指着说这一行」正是这些教程唯一在做的事。
 */
export const TRANSITION_SETTINGS_GEOMETRY = {
    heading: { left: 0.04, top: 0.02, width: 0.30, height: 0.07 },
    card: { left: 0.03, right: 0.03, top: 0.12, bottom: 0.02 },
    enable: { left: 0.06, right: 0.06, top: 0.16, height: 0.11 },
    modeCrossfade: { left: 0.06, top: 0.36, width: 0.43, height: 0.22 },
    modeAutomix: { right: 0.06, top: 0.36, width: 0.43, height: 0.22 },
    /** 选中那张卡右上角那枚「使用中 / 已退回淡化」的小徽章。 */
    badge: { right: 0.09, top: 0.39, width: 0.16, height: 0.055 },
    detail: { left: 0.06, right: 0.06, top: 0.64, height: 0.14 },
    notice: { left: 0.06, right: 0.06, top: 0.82, height: 0.13 },
} satisfies Record<string, PonderRelativeRect>;

export const LIBRARY_WATCH_GEOMETRY = {
    heading: { left: 0.04, top: 0.02, width: 0.34, height: 0.08 },
    card: { left: 0.03, right: 0.03, top: 0.14, bottom: 0.02 },
    enable: { left: 0.06, right: 0.06, top: 0.19, height: 0.14 },
    roots: { left: 0.06, right: 0.06, top: 0.40, height: 0.32 },
    status: { left: 0.06, right: 0.35, top: 0.78, height: 0.08 },
    recheck: { right: 0.06, top: 0.76, width: 0.24, height: 0.12 },
} satisfies Record<string, PonderRelativeRect>;

/** 「加入队列」的默认行为：一句说明加两张并排的选项。 */
export const QUEUE_SETTINGS_GEOMETRY = {
    heading: { left: 0.04, top: 0.04, width: 0.30, height: 0.13 },
    card: { left: 0.03, right: 0.03, top: 0.25, bottom: 0.04 },
    copy: { left: 0.06, right: 0.06, top: 0.33, height: 0.18 },
    optionAppend: { left: 0.06, top: 0.58, width: 0.43, height: 0.3 },
    optionNext: { right: 0.06, top: 0.58, width: 0.43, height: 0.3 },
} satisfies Record<string, PonderRelativeRect>;

/** 歌词来源那一组：自动择优开关、本地/在线优先、以及全局时间轴偏移。 */
export const LYRICS_SOURCE_GEOMETRY = {
    heading: { left: 0.04, top: 0.02, width: 0.28, height: 0.07 },
    card: { left: 0.03, right: 0.03, top: 0.12, bottom: 0.02 },
    autoBest: { left: 0.06, right: 0.06, top: 0.16, height: 0.13 },
    priorityLocal: { left: 0.06, top: 0.40, width: 0.43, height: 0.2 },
    priorityOnline: { right: 0.06, top: 0.40, width: 0.43, height: 0.2 },
    globalOffset: { left: 0.06, right: 0.06, top: 0.70, height: 0.15 },
} satisfies Record<string, PonderRelativeRect>;

/** 网格上的 S 归谁：整组只有一行开关。 */
export const GRID_HOTKEY_GEOMETRY = {
    heading: { left: 0.04, top: 0.06, width: 0.32, height: 0.18 },
    card: { left: 0.03, right: 0.03, top: 0.34, bottom: 0.06 },
    toggle: { left: 0.06, right: 0.06, top: 0.42, height: 0.44 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 队列命令窗口，坐标系是那扇窗口。
 *
 * 它长得像命令窗口，做的事却是筛队列：输入行是队列的搜索框，`@` 收窄范围，
 * `--` 对筛出来的那些整批下手。三件事各占一块，所以分开量。
 */
export const QUEUE_COMMAND_GEOMETRY = {
    input: { left: 0.04, right: 0.04, top: 0.04, height: 0.13 },
    chips: { left: 0.04, right: 0.04, top: 0.21, height: 0.09 },
    suggestions: { left: 0.04, right: 0.04, top: 0.21, height: 0.32 },
    rows: { left: 0.04, right: 0.04, top: 0.34, bottom: 0.05 },
    /** 收窄之后行变少，底下腾出来给批量预览。 */
    narrowedRows: { left: 0.04, right: 0.04, top: 0.34, bottom: 0.24 },
    preview: { left: 0.04, right: 0.04, bottom: 0.05, height: 0.16 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 命令面板里「导出歌词缓存」那一页，坐标系是命令窗口。
 *
 * 顶上是输入行，下面一段说明，然后按「导哪些 → 导成什么 → 文件怎么命名」排成三节，
 * 每节一个小标题；前两节是并排两张可多选的卡，LRC 的附带项缩在格式那一节右下。
 * 开始按钮不在滚动区里，钉在窗口底边那条操作栏上。
 */
export const LYRIC_EXPORT_GEOMETRY = {
    input: { left: 0.04, right: 0.04, top: 0.03, height: 0.10 },
    /** 滚动区：三节内容所在的那一整块。 */
    card: { left: 0.10, right: 0.10, top: 0.16, bottom: 0.13 },
    copy: { left: 0.12, right: 0.12, top: 0.17, height: 0.05 },
    scope: { left: 0.12, right: 0.12, top: 0.25, height: 0.18 },
    formats: { left: 0.12, right: 0.12, top: 0.46, height: 0.25 },
    names: { left: 0.12, right: 0.12, top: 0.74, height: 0.11 },
    /** 底边操作栏：左边进度文字，右边开始 / 取消。 */
    run: { left: 0, right: 0, bottom: 0, height: 0.10 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 桌面端那三样东西的示意图，坐标系是 page。
 *
 * 画的是一整块桌面：主窗口摆在中间，任务栏贴底、托盘图标在它右端，遥控窗口是一张
 * 浮在上面的小卡。三样东西的关系（壁纸沉到最底、托盘在系统那一侧、遥控是另一个窗口）
 * 只有摆在同一张桌面上才看得出来。
 */
export const DESKTOP_FEATURES_GEOMETRY = {
    /** 桌面本身要一直铺到任务栏底下：只铺到窗口下沿的话，任务栏会飘在桌面外面。 */
    desktop: { left: 0.03, right: 0.03, top: 0.04, bottom: 0.03 },
    /** 相对 page：主窗口。壁纸模式下它沉到桌面最底层。 */
    mainWindow: { left: 0.12, top: 0.12, width: 0.5, height: 0.56 },
    /** 相对 page：遥控窗口，浮在主窗口之上的一张小卡。 */
    remoteWindow: { right: 0.08, top: 0.22, width: 0.22, height: 0.26 },
    /** 相对 page：系统任务栏，贴底。 */
    taskbar: { left: 0.03, right: 0.03, bottom: 0.05, height: 0.09 },
    /** 相对 page：托盘图标，在任务栏右端。 */
    trayIcon: { right: 0.06, bottom: 0.062, width: 0.032, square: true },
    /** 相对 page：托盘菜单，从托盘图标上方弹出。 */
    trayMenu: { right: 0.04, bottom: 0.16, width: 0.26, height: 0.42 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 入门教程用的示意图，坐标系是 page。
 *
 * 这一张不对应任何一个真实页面 —— 它画的是「思索是怎么用的」这件事本身：
 * 一页界面、指针停在其中一个组件上、旁边浮出提示胶囊、右下角那颗触屏用的灯泡。
 * 原本这里用的是通用的页面轮廓（标题条加两张卡加三行占位），读者从那张图上
 * 学不到任何东西，字幕只能对着一块空白讲。
 */
export const PONDER_ONBOARDING_GEOMETRY = {
    /** 顶栏在右边让出一截，灯泡才有地方站 —— 真实界面里它也是浮在页面之上的。 */
    topBar: { left: 0.05, right: 0.17, top: 0.05, height: 0.09 },
    cardA: { left: 0.06, top: 0.22, width: 0.26, height: 0.34 },
    cardB: { left: 0.37, top: 0.22, width: 0.26, height: 0.34 },
    /** 被指着的那个组件。提示胶囊浮在它下面。 */
    cardC: { right: 0.06, top: 0.22, width: 0.26, height: 0.34 },
    capsule: { right: 0.05, top: 0.61, width: 0.36, height: 0.11 },
    bottomBar: { left: 0.26, right: 0.26, bottom: 0.07, height: 0.11 },
    /**
     * 触屏上代替 Ctrl+G 的那颗灯泡，贴右上角。
     *
     * 不在右下角：那一块是操作按钮最密的地方（底部控制条、集合页的列表按钮、
     * 播放页的侧边手柄），一颗常驻浮动按钮压上去就是挡路。
     */
    touchBulb: { right: 0.035, top: 0.05, width: 0.075, square: true },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 海报墙右下角那颗操作按钮，坐标系是 page。
 *
 * 它和播放页那颗侧边手柄是同一个手势（都走 SlideActionButton 或它的同形实现），
 * 所以画法也照那边：按钮贴右下角，背后一条向左的滑轨画成虚线 —— 它在那里，只是没显出来。
 */
export const GRID_ACTION_BUTTON_GEOMETRY = {
    shelf: { left: 0.06, right: 0.06, top: 0.12, bottom: 0.26 },
    button: { right: 0.05, bottom: 0.07, width: 0.07, square: true },
    track: { right: 0.05, bottom: 0.07, width: 0.32, height: 0.135 },
    /** 滑轨左端那枚图标要停在轨道**里**：right 比轨道左沿再往里收一点点。 */
    trackEnd: { right: 0.31, bottom: 0.082, width: 0.055, square: true },
    listPanel: { right: 0.04, top: 0.08, width: 0.30, bottom: 0.06 },
    filterBar: { left: 0.22, right: 0.22, top: 0.06, height: 0.10 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 集合页那片网格里的卡片，坐标系是 page。
 *
 * 编辑模式和「手动匹配歌曲信息」共用这一张：两件事讲的都是同一张卡上按钮的增减，
 * 各画一份只会让两边的卡长得不一样。
 */
export const GRID_VIEW_CARDS_GEOMETRY = {
    cards: { left: 0.06, right: 0.06, top: 0.16, bottom: 0.16 },
    /** 相对 cards：中间那张。 */
    card: { left: 0.36, top: 0, width: 0.28, height: 1 },
    /** 以下都相对 card。 */
    title: { left: 0.08, right: 0.20, bottom: 0.30, height: 0.07 },
    pencil: { right: 0.06, bottom: 0.295, width: 0.12, square: true },
    actions: { left: 0.12, right: 0.12, bottom: 0.07, height: 0.14 },
    removeBadge: { right: 0.04, top: 0.04, width: 0.14, square: true },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 信息面板底部那一列来源专属动作，坐标系是那一列自身。
 *
 * 最后一颗是删除，红的。它和上面几颗长得一样只差颜色，这正是要单独讲的理由。
 */
export const LOCAL_FOLDER_ACTIONS_GEOMETRY = {
    playAll: { left: 0.04, right: 0.04, top: 0.04, height: 0.15 },
    addQueue: { left: 0.04, right: 0.04, top: 0.22, height: 0.15 },
    reimport: { left: 0.04, right: 0.04, top: 0.40, height: 0.15 },
    organize: { left: 0.04, right: 0.04, top: 0.58, height: 0.15 },
    remove: { left: 0.04, right: 0.04, top: 0.76, height: 0.15 },
} satisfies Record<string, PonderRelativeRect>;

/** 曲目列表侧板，坐标系是那块面板。排序那两颗只在本地文件夹里出现。 */
export const LOCAL_TRACK_LIST_GEOMETRY = {
    header: { left: 0.04, right: 0.04, top: 0.03, height: 0.09 },
    direction: { left: 0.05, top: 0.035, width: 0.085, square: true },
    sortMenu: { right: 0.05, top: 0.035, width: 0.085, square: true },
    rows: { left: 0.04, right: 0.04, top: 0.15, bottom: 0.03 },
    menu: { right: 0.05, top: 0.14, width: 0.52, height: 0.34 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 设置 · 外观里「首页卡片样式」那一组，坐标系是那块面板。
 *
 * 真实那一组只有三行：分组标题、一行说明、两张并排的选项。它矮，所以面板也要摆得矮 ——
 * 拉成一块方方正正的面会让骨架看起来像另一个更复杂的设置区。
 */
export const GRID3D_CARD_STYLE_GEOMETRY = {
    heading: { left: 0.04, top: 0.04, width: 0.30, height: 0.14 },
    card: { left: 0.03, right: 0.03, top: 0.26, bottom: 0.04 },
    copy: { left: 0.06, right: 0.06, top: 0.34, height: 0.20 },
    optionImage: { left: 0.06, top: 0.62, width: 0.43, height: 0.28 },
    optionCard: { right: 0.06, top: 0.62, width: 0.43, height: 0.28 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 设置 · 外观里「网格卡片」那一组，坐标系是那块面板。
 *
 * 「正方形卡片」那一行只在「全画幅封面」打开之后才存在，所以它在骨架里也要等一层
 * 结果层才出现 —— 一进场就摆着的话，字幕说「开了才有」就和画面对不上。
 */
export const GRID_VIEW_CARD_GEOMETRY = {
    heading: { left: 0.04, top: 0.02, width: 0.30, height: 0.07 },
    card: { left: 0.03, right: 0.03, top: 0.13, bottom: 0.02 },
    fullBleed: { left: 0.06, right: 0.06, top: 0.17, height: 0.13 },
    square: { left: 0.06, right: 0.06, top: 0.34, height: 0.13 },
    minScale: { left: 0.06, right: 0.06, top: 0.51, height: 0.14 },
    minOpacity: { left: 0.06, right: 0.06, top: 0.68, height: 0.14 },
    reset: { right: 0.06, top: 0.86, width: 0.28, height: 0.09 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 设置 · 外观里「队列拼贴」那一组，坐标系是那块面板。
 *
 * 叠色是层层嵌套的：开了叠色才有「自定义颜色」和强度，开了自定义颜色才有取色器。
 * 骨架照这个嵌套分两层结果层画，读者才看得出为什么自己那屏上没有取色器。
 */
export const LATTICE_STYLE_GEOMETRY = {
    heading: { left: 0.04, top: 0.02, width: 0.30, height: 0.06 },
    card: { left: 0.03, right: 0.03, top: 0.11, bottom: 0.02 },
    vignette: { left: 0.06, right: 0.06, top: 0.15, height: 0.11 },
    tint: { left: 0.06, right: 0.06, top: 0.30, height: 0.11 },
    customColor: { left: 0.06, right: 0.06, top: 0.45, height: 0.11 },
    picker: { left: 0.06, right: 0.06, top: 0.59, height: 0.20 },
    intensity: { left: 0.06, right: 0.06, top: 0.83, height: 0.11 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 设置里「歌词动画」那一组，坐标系是那块面板。
 *
 * 真实那一组是：分组标题、一个通往动画调参台的大按钮，再下面**一张**卡片，卡片里
 * 两个开关用一条分隔线隔开。两个开关不是两张卡 —— 画成两张卡就把「它们同属一张卡」
 * 这件事讲错了，高亮也会落在不存在的边框上。
 */
export const LYRICS_ANIMATION_SETTINGS_GEOMETRY = {
    heading: { left: 0.04, top: 0.02, width: 0.30, height: 0.10 },
    entry: { left: 0.04, right: 0.04, top: 0.16, height: 0.27 },
    card: { left: 0.04, right: 0.04, top: 0.48, bottom: 0.03 },
    /** 卡片里上下两行，中间那条分隔线是卡片自己画的。 */
    transparent: { left: 0.07, right: 0.07, top: 0.52, height: 0.20 },
    autoHide: { left: 0.07, right: 0.07, top: 0.76, height: 0.20 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 设置里「配色主题预设」那一组，坐标系是那块面板。
 *
 * 整组装在一张卡里：标题行右端一颗圆形的 Theme Park 按钮（36px 图标按钮，不是带文字的
 * 大胶囊），两张并排的预设按钮，一块「主题生成来源」子卡，再下面三个开关行。
 * 那三个开关占了这一组一半的高度，漏掉它们的骨架和真实界面对不上。
 */
export const THEME_SETTINGS_GEOMETRY = {
    heading: { left: 0.04, top: 0.01, width: 0.30, height: 0.07 },
    card: { left: 0.03, right: 0.03, top: 0.10, bottom: 0.01 },
    titleRow: { left: 0.06, right: 0.06, top: 0.13, height: 0.08 },
    /** 标题行右端那颗圆按钮。 */
    themePark: { right: 0.06, top: 0.125, width: 0.062, square: true },
    presetDefault: { left: 0.06, top: 0.24, width: 0.43, height: 0.16 },
    presetCustom: { right: 0.06, top: 0.24, width: 0.43, height: 0.16 },
    source: { left: 0.06, right: 0.06, top: 0.43, height: 0.23 },
    followSystem: { left: 0.06, right: 0.06, top: 0.69, height: 0.085 },
    preferCustom: { left: 0.06, right: 0.06, top: 0.79, height: 0.085 },
    autoSwitch: { left: 0.06, right: 0.06, top: 0.89, height: 0.085 },
} satisfies Record<string, PonderRelativeRect>;

/** 上面那三个开关在骨架里从上到下的顺序，以及各自的标记属性。surface 和 target 共用。 */
export const THEME_SETTINGS_TOGGLES = [
    { name: 'followSystem', marker: 'data-ponder-theme-follow-system' },
    { name: 'preferCustom', marker: 'data-ponder-theme-prefer-custom' },
    { name: 'autoSwitch', marker: 'data-ponder-theme-auto-switch' },
] as const;

/**
 * 设置 · 交互里「自定义快捷键」那一组，坐标系是那块面板。
 *
 * 真实那一组是一行两半：左边一对键帽（Alt 已经按下、旁边是待录的那一颗），右边一个
 * 命令下拉。Alt 画成常按下的样子而不是可编辑的一段，因为它在界面上就是不可改的 ——
 * 画成可录的话，这一章讲的那件事（录不出组合键）在图上就不成立。
 */
export const CUSTOM_SHORTCUT_GEOMETRY = {
    heading: { left: 0.04, top: 0.02, width: 0.34, height: 0.08 },
    card: { left: 0.03, right: 0.03, top: 0.14, bottom: 0.02 },
    copy: { left: 0.06, right: 0.06, top: 0.19, height: 0.18 },
    /** 左半边那对键帽，以及录到之后才出现的那颗清除叉。 */
    capAlt: { left: 0.07, top: 0.46, width: 0.10, height: 0.18 },
    capKey: { left: 0.205, top: 0.46, width: 0.10, height: 0.18 },
    clear: { left: 0.335, top: 0.505, width: 0.05, square: true },
    /** 右半边那个命令下拉，和展开之后压在它下面的那张列表。 */
    command: { right: 0.07, top: 0.46, width: 0.40, height: 0.18 },
    commandList: { right: 0.07, top: 0.66, width: 0.40, height: 0.30 },
    /** 按到一颗已经被占掉的字母时，红字长在键帽下面。 */
    rejection: { left: 0.07, top: 0.68, width: 0.42, height: 0.07 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 设置 · 通用里「固定命令」那一组，坐标系是那块面板。
 *
 * 三个槽位并排，各是一个下拉。结果层画的是命令窗口本身 —— 这一组配的东西不长在
 * 设置里，而是长在窗口下面那一排，不画出来就只是三个不知道通向哪儿的下拉框。
 */
export const PINNED_COMMANDS_GEOMETRY = {
    heading: { left: 0.04, top: 0.02, width: 0.32, height: 0.08 },
    card: { left: 0.03, right: 0.03, top: 0.14, bottom: 0.02 },
    copy: { left: 0.06, right: 0.06, top: 0.19, height: 0.18 },
    slotFirst: { left: 0.06, top: 0.46, width: 0.28, height: 0.22 },
    slotSecond: { left: 0.36, top: 0.46, width: 0.28, height: 0.22 },
    slotThird: { right: 0.06, top: 0.46, width: 0.28, height: 0.22 },
    /** 以下属于结果层：命令窗口，以及贴在它下面那一排三颗。 */
    palette: { left: 0.08, right: 0.08, top: 0.05, height: 0.60 },
    /** 相对 palette：会随使用次序自己重排的那份列表。 */
    paletteList: { left: 0.05, right: 0.05, top: 0.28, bottom: 0.06 },
    pinnedRow: { left: 0.08, right: 0.08, top: 0.70, height: 0.11 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 设置 · 播放里「音频增益」那一组，坐标系是那块面板。
 *
 * 结果层画的是控制面板来源页上那一小块同名控件：同一个值的另一处开关。两处并排画出来
 * 才看得出「改一处两处都变」，分别画在两张图上就又成了两个设置。
 */
export const REPLAY_GAIN_GEOMETRY = {
    heading: { left: 0.04, top: 0.03, width: 0.32, height: 0.10 },
    card: { left: 0.03, right: 0.03, top: 0.22, bottom: 0.04 },
    copy: { left: 0.06, right: 0.06, top: 0.30, height: 0.20 },
    modeOff: { left: 0.06, top: 0.58, width: 0.28, height: 0.28 },
    modeTrack: { left: 0.36, top: 0.58, width: 0.28, height: 0.28 },
    modeAlbum: { right: 0.06, top: 0.58, width: 0.28, height: 0.28 },
    /** 以下属于结果层：来源页上那一小块。标题行右端那串就是这首歌的 T/A 分贝。 */
    panelTab: { left: 0.18, right: 0.18, top: 0.22, height: 0.44 },
    /** 相对 panelTab。 */
    panelSummary: { right: 0.05, top: 0.12, width: 0.42, height: 0.16 },
    panelModes: { left: 0.05, right: 0.05, bottom: 0.14, height: 0.26 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 设置 · 外观里「备份与导入」那一组，坐标系是那块面板。
 *
 * 一排选「带哪个主题」的小胶囊、一块粘贴用的文本框、底下一排按钮（导出、复制 JSON，
 * 右端单独一颗导入）。导入那颗和别的按钮隔开，因为它是唯一会改动本机设置的那颗。
 */
export const IMPORT_EXPORT_GEOMETRY = {
    heading: { left: 0.04, top: 0.02, width: 0.34, height: 0.07 },
    card: { left: 0.03, right: 0.03, top: 0.12, bottom: 0.02 },
    copy: { left: 0.06, right: 0.06, top: 0.16, height: 0.13 },
    themeChips: { left: 0.06, right: 0.06, top: 0.34, height: 0.10 },
    textarea: { left: 0.06, right: 0.06, top: 0.49, height: 0.26 },
    exportButtons: { left: 0.06, top: 0.80, width: 0.40, height: 0.11 },
    importButton: { right: 0.06, top: 0.80, width: 0.20, height: 0.11 },
    /** 以下属于结果层：按下导入之后先弹的那个逐项对照框。 */
    dialog: { left: 0.10, right: 0.10, top: 0.07, bottom: 0.07 },
    /** 相对 dialog：分组标题、可逐条勾选的改动行、以及总是摊开的衍生改动。 */
    dialogGroups: { left: 0.06, right: 0.06, top: 0.16, height: 0.44 },
    dialogDerived: { left: 0.06, right: 0.06, top: 0.64, height: 0.18 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 音频效果对话框（十段均衡加效果链），坐标系是那扇对话框。
 *
 * 推子那一排要能指着其中一根讲：拖任何一根都会把当前预设**静默**换成自定义槽 1
 * 并把值写进去，而这件事只有对着一根推子和预设排同时说才成立。
 */
export const AUDIO_EQUALIZER_GEOMETRY = {
    enable: { left: 0.04, top: 0.04, width: 0.20, height: 0.08 },
    /** 六颗内置预设。 */
    presets: { left: 0.28, top: 0.04, width: 0.37, height: 0.08 },
    /** 排尾那两颗自定义槽，和它们右边那颗复位。 */
    customSlots: { left: 0.66, top: 0.04, width: 0.22, height: 0.08 },
    reset: { right: 0.04, top: 0.04, width: 0.06, square: true },
    bands: { left: 0.04, right: 0.04, top: 0.17, height: 0.44 },
    /**
     * 相对 bands：第四根推子，教程拖的就是它。
     *
     * 十根等宽、九道 1.5% 的缝，所以每根 8.65%、第四根从 3×(8.65+1.5)=30.45% 起。
     * 这组数是从排布算出来的，不是量出来的 —— 改了根数或缝宽，这里要跟着算。
     */
    bandFader: { left: 0.3045, top: 0, width: 0.0865, height: 1 },
    effects: { left: 0.04, right: 0.04, top: 0.65, bottom: 0.04 },
    /** 相对 effects：会加噪那几项标题旁边那枚小徽章。 */
    noiseBadge: { left: 0.22, top: 0.16, width: 0.10, height: 0.10 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 歌词动画调参台，坐标系是整屏。
 *
 * 预览上那三块热区是这一屏最藏的东西：它们平时完全透明、没有描边也没有底色，
 * 指针压上去才显形。所以骨架里它们必须是三块独立的区域，而不是预览里一块笼统的高亮。
 */
export const VIS_PLAYGROUND_GEOMETRY = {
    header: { left: 0.03, right: 0.03, top: 0.03, height: 0.10 },
    preview: { left: 0.03, right: 0.30, top: 0.16, bottom: 0.04 },
    /** 以下三块相对 preview：顶上一条是背景，中间一大块是可视化，底下一条是字幕。 */
    hotspotBackground: { left: 0.03, right: 0.03, top: 0.03, height: 0.20 },
    hotspotVisualizer: { left: 0.10, right: 0.10, top: 0.28, height: 0.48 },
    hotspotSubtitle: { left: 0.03, right: 0.03, bottom: 0.06, height: 0.18 },
    /** 相对 preview：右下角那颗暂停，按住它预览就停在当前这一帧。 */
    pause: { right: 0.03, bottom: 0.04, width: 0.08, square: true },
    panel: { right: 0.03, top: 0.16, width: 0.25, bottom: 0.04 },
    /** 以下相对 panel。「通用」那一页没有对应热区，只能从这排标签进。 */
    tabs: { left: 0.05, right: 0.05, top: 0.02, height: 0.06 },
    tabCommon: { left: 0.06, top: 0.027, width: 0.21, height: 0.046 },
    /**
     * 一页的内容：标题行加五行控件。四页共用这组槽位，各自往里填自己的行 ——
     * 真实那四页行数不同，但都是「标题 + 一颗本页复位 + 若干行」这个形状，
     * 各量一套只会让四页在骨架上长得像四个不相干的界面。
     */
    panelTitle: { left: 0.06, top: 0.115, width: 0.44, height: 0.05 },
    panelReset: { right: 0.06, top: 0.115, width: 0.22, height: 0.05 },
    rows: { left: 0.06, right: 0.06, top: 0.20, bottom: 0.145 },
    rowOne: { left: 0.06, right: 0.06, top: 0.20, height: 0.115 },
    rowTwo: { left: 0.06, right: 0.06, top: 0.335, height: 0.115 },
    rowThree: { left: 0.06, right: 0.06, top: 0.47, height: 0.115 },
    rowFour: { left: 0.06, right: 0.06, top: 0.605, height: 0.115 },
    rowFive: { left: 0.06, right: 0.06, top: 0.74, height: 0.115 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * 歌词样式那张图的预览内部，坐标系是 VIS_PLAYGROUND_GEOMETRY.preview。
 *
 * 外框（顶栏、预览、右栏、行）直接用调参台那张表：设置直达打开的就是调参台，
 * 教程里的样子和按下按钮之后看到的得是同一个东西。
 */
export const LYRIC_STYLE_GEOMETRY = {
    /** 一般样式的歌词：居中的几行。 */
    lyrics: { left: 0.14, right: 0.14, top: 0.24, height: 0.40 },
    /** 通用底部副字幕：大多数样式共用的那一条。莫奈等自己排版的样式没有它。 */
    subtitle: { left: 0.18, right: 0.18, bottom: 0.08, height: 0.12 },
    /** 莫奈：左边一列歌词，下面一段歌曲描述。 */
    monetRail: { left: 0.06, top: 0.12, width: 0.46, height: 0.50 },
    monetDescription: { left: 0.06, bottom: 0.10, width: 0.46, height: 0.16 },
    /** 莫奈：右边的肖像，顶上一颗拖拽调整按钮，底下一条音频图案。 */
    monetPortrait: { right: 0.07, top: 0.12, width: 0.34, bottom: 0.26 },
    monetHanger: { right: 0.21, top: 0.06, width: 0.06, square: true },
    monetAudio: { right: 0.07, bottom: 0.08, width: 0.34, height: 0.12 },
} satisfies Record<string, PonderRelativeRect>;

/**
 * Theme Park，坐标系是整屏。
 *
 * 和调参台同一个布局（左预览右设置栏），但要讲的东西全在顶栏和右栏上：
 * 在编辑哪一份主题、亮暗是两份独立配色、以及保存为什么灰着 —— 名字在另一页上。
 */
export const THEME_PARK_GEOMETRY = {
    header: { left: 0.03, right: 0.03, top: 0.03, height: 0.11 },
    /** 以下三块相对 header：编辑目标、重置、保存。 */
    targetToggle: { left: 0.52, top: 0.22, width: 0.20, height: 0.56 },
    reset: { left: 0.74, top: 0.22, width: 0.11, height: 0.56 },
    save: { left: 0.865, top: 0.22, width: 0.125, height: 0.56 },
    preview: { left: 0.03, right: 0.30, top: 0.17, bottom: 0.04 },
    panel: { right: 0.03, top: 0.17, width: 0.25, bottom: 0.04 },
    /** 以下相对 panel：四页标签、亮暗切换、四行颜色、取色器、HEX、推荐色。 */
    tabs: { left: 0.05, right: 0.05, top: 0.02, height: 0.055 },
    tabDetails: { left: 0.285, top: 0.026, width: 0.22, height: 0.047 },
    modeToggle: { left: 0.05, right: 0.05, top: 0.10, height: 0.05 },
    colorRows: { left: 0.05, right: 0.05, top: 0.18, height: 0.30 },
    picker: { left: 0.05, right: 0.05, top: 0.51, height: 0.24 },
    hex: { left: 0.08, right: 0.08, top: 0.77, height: 0.05 },
    recommended: { left: 0.05, right: 0.05, top: 0.855, height: 0.11 },
} satisfies Record<string, PonderRelativeRect>;
