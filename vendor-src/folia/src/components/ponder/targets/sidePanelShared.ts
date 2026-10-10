import {
    SIDE_PANEL_CONTROLS_PAGE as C,
    SIDE_PANEL_COVER_ACTIONS as A,
    SIDE_PANEL_FM_PAGE as F,
    SIDE_PANEL_GEOMETRY as G,
    SIDE_PANEL_SOURCE_LYRICS as L,
    SIDE_PANEL_SOURCE_PAGE as S,
} from '../surfaces/ponderSurfaceGeometry';
import type { PonderAnchorSource, PonderRelativeRect, PonderSceneScript, PonderTargetId } from '../../../types/ponder';

// src/components/ponder/targets/sidePanelShared.ts
// 右侧控制面板那一族目标共用的锚点和场景形状。
//
// 文件名刻意不是 *.target.ts：注册表用 import.meta.glob('./targets/*.target.ts') 收目标，
// 共用件混进去会被当成一个缺 default export 的目标而直接抛错。
//
// 为什么是一族而不是一个目标：面板里真正需要解释的东西彼此没有关系 —— 封面四角那四颗
// 按钮是四个不相干的动作，四个标签页各是一整套设置。全部塞进一个目标，用户悬停在队列
// 标签上得到的是从封面讲起的六章；拆开之后，指哪儿讲哪儿。

/** 面板本身。几何和 PonderSidePanelSurface 画的那块是同一组数。 */
export const sidePanelAnchor = {
    kind: 'synthetic',
    // aspect 就是真实面板的 690 ÷ 320（w-80 加 p-5，装下封面、标签排和一页内容的高度）。
    // 不锁比例的话，宽屏上按宽度定尺寸的正方形封面会长到压住按高度定位的标签排。
    rect: { left: 0.5, top: 0.10, width: 0.22, height: 0.62, aspect: 2.15, anchorX: 'center' },
    role: 'surface',
    surfaceKind: 'side-panel',
    labelKey: 'ponder.anchors.sidePanel.panel',
} satisfies PonderAnchorSource;

const region = (from: string, rect: PonderRelativeRect, labelKey: string): PonderAnchorSource => (
    { kind: 'relative', from, rect, role: 'region', labelKey }
);

/** 面板结构：封面、标签排、当前标签页内容。 */
export const SIDE_PANEL_ANCHORS = {
    panel: sidePanelAnchor,
    cover: region('panel', G.cover, 'ponder.anchors.sidePanel.cover'),
    tabs: region('panel', G.tabs, 'ponder.anchors.sidePanel.tabs'),
    body: region('panel', G.body, 'ponder.anchors.sidePanel.body'),
} satisfies Record<string, PonderAnchorSource>;

/** 结构锚点加封面四个角。四颗按钮各自一个锚点，才指得到「右上角那颗」。 */
export const SIDE_PANEL_COVER_ANCHORS = {
    ...SIDE_PANEL_ANCHORS,
    coverSettings: region('cover', A.settings, 'ponder.anchors.sidePanel.coverSettings'),
    coverTransparent: region('cover', A.transparent, 'ponder.anchors.sidePanel.coverTransparent'),
    coverHome: region('cover', A.home, 'ponder.anchors.sidePanel.coverHome'),
    coverPlaylist: region('cover', A.addToPlaylist, 'ponder.anchors.sidePanel.coverPlaylist'),
} satisfies Record<string, PonderAnchorSource>;

/** 四格标签排里每一格的中心，按顺序：封面、控制、队列、账号。 */
export const SIDE_PANEL_TAB_CENTER_X = [0.125, 0.375, 0.625, 0.875] as const;

/** 来源那一格在场时是五格，中心跟着挪。第 1 格就是来源那一格。 */
export const SIDE_PANEL_SOURCE_TAB_CENTER_X = 0.3;

/** 来源页里的四块，坐标系是 body。 */
export const SIDE_PANEL_SOURCE_ANCHORS = {
    ...SIDE_PANEL_ANCHORS,
    sourceInfo: region('body', S.info, 'ponder.anchors.sidePanel.sourceInfo'),
    sourceGain: region('body', S.gain, 'ponder.anchors.sidePanel.sourceGain'),
    sourceLyrics: region('body', S.lyrics, 'ponder.anchors.sidePanel.sourceLyrics'),
    sourceOffset: region('body', S.offset, 'ponder.anchors.sidePanel.sourceOffset'),
    sourceLyricsFile: region('sourceLyrics', L.fileIcon, 'ponder.anchors.sidePanel.sourceLyricsFile'),
    sourceFileDialog: region('body', S.fileDialog, 'ponder.anchors.sidePanel.sourceFileDialog'),
} satisfies Record<string, PonderAnchorSource>;

/** 控制页里那两行取景器，以及点开之后压下来的完整列表。 */
export const SIDE_PANEL_CONTROLS_ANCHORS = {
    ...SIDE_PANEL_ANCHORS,
    modeRow: region('body', C.modeRowVisualizer, 'ponder.anchors.sidePanel.modeRow'),
    modeName: region('body', C.modeName, 'ponder.anchors.sidePanel.modeName'),
    modeList: region('body', C.modeList, 'ponder.anchors.sidePanel.modeList'),
    modeListFooter: region('body', C.modeListFooter, 'ponder.anchors.sidePanel.modeListFooter'),
} satisfies Record<string, PonderAnchorSource>;

/** 电台页里那三块。私人 FM 打开时，队列那一格整格换成它。 */
export const SIDE_PANEL_FM_ANCHORS = {
    ...SIDE_PANEL_ANCHORS,
    fmMode: region('body', F.modeChip, 'ponder.anchors.sidePanel.fmMode'),
    fmTransport: region('body', F.transport, 'ponder.anchors.sidePanel.fmTransport'),
    fmActions: region('body', F.actions, 'ponder.anchors.sidePanel.fmActions'),
} satisfies Record<string, PonderAnchorSource>;

/**
 * 一个标签页的教程：点到那一格、换过去，然后讲这一页是什么、里面有什么。
 *
 * 每个标签页各自一个目标，所以这里只产出一章 —— 用户是悬停在那一格上问「这页是什么」，
 * 不是来看四页连播的。
 */
export const sidePanelTabScene = (
    id: string,
    titleKey: string,
    state: string,
    tabIndex: number,
    captionKeys: readonly [string, string],
): PonderSceneScript => ({
    id,
    titleKey,
    anchors: SIDE_PANEL_ANCHORS,
    steps: [
        { kind: 'cursor', id: 'pickTab', to: { anchor: 'tabs', x: SIDE_PANEL_TAB_CENTER_X[tabIndex] }, press: 'tap', durationMs: 660, keyframe: true },
        { kind: 'surfaceState', id: 'openTab', anchor: 'panel', state, durationMs: 500 },
        {
            kind: 'caption', id: 'what', at: 'bottom',
            textKey: captionKeys[0],
            pointTo: { anchor: 'tabs', x: SIDE_PANEL_TAB_CENTER_X[tabIndex] }, durationMs: 5200, withPrevious: true,
        },
        { kind: 'pause', id: 'readWhat' },

        { kind: 'highlight', id: 'markBody', anchor: 'body', intensity: [0, 0.55], durationMs: 420, keyframe: true },
        {
            kind: 'caption', id: 'detail', at: 'bottom',
            textKey: captionKeys[1],
            pointTo: { anchor: 'body', y: 0.5 }, durationMs: 6200, withPrevious: true,
        },
        { kind: 'pause', id: 'readDetail' },
    ],
});

/** 每个标签页目标都指回整块面板和相邻的那几页。 */
export const sidePanelTabRelatedIds = (self: PonderTargetId): PonderTargetId[] => (
    ([
        'side-panel',
        'panel-cover-tab',
        'panel-source-tab',
        'panel-controls-tab',
        'panel-queue-tab',
        'panel-account-tab',
    ] as PonderTargetId[]).filter(id => id !== self)
);
