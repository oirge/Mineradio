import { SIDE_PANEL_COVER_ANCHORS } from './sidePanelShared';
import type { PonderSceneScript, PonderTargetDefinition } from '../../../types/ponder';

// src/components/ponder/targets/panelCoverActions.target.ts
// 控制面板封面四个角上那四颗按钮。
//
// 这四颗是整个面板里最不直观的东西：平时完全看不见（`opacity-0 group-hover:opacity-100`），
// 而且彼此毫无关系 —— 打开设置、播放页透明背景、回到首页、加入歌单。
// 一句「悬停会浮出针对这首歌的操作」既漏掉了三颗，也把它们说成了同一类东西。
//
// 单独成一个目标而不是并进 side-panel：用户是指着封面问「这上面还有什么」的，
// 而不是想从头看一遍面板结构。

const anchors = SIDE_PANEL_COVER_ANCHORS;

/** 第一章：它们怎么出现，以及左边那两颗 —— 离开面板的两条路。 */
const reveal: PonderSceneScript = {
    id: 'panel-cover-actions-reveal',
    titleKey: 'ponder.scenes.panelCoverActionsReveal',
    anchors,
    steps: [
        { kind: 'cursor', id: 'hoverCover', to: { anchor: 'cover' }, durationMs: 700, keyframe: true },
        { kind: 'surfaceState', id: 'showActions', anchor: 'panel', state: 'cover-actions', durationMs: 420 },
        {
            kind: 'caption', id: 'appear', at: 'bottom',
            textKey: 'ponder.captions.panelCoverActions.appear',
            pointTo: { anchor: 'cover' }, durationMs: 5400, withPrevious: true,
        },
        { kind: 'pause', id: 'readAppear' },

        { kind: 'highlight', id: 'markSettings', anchor: 'coverSettings', intensity: [0, 0.9], durationMs: 420, keyframe: true },
        {
            kind: 'caption', id: 'settings', at: 'bottom',
            textKey: 'ponder.captions.panelCoverActions.settings',
            pointTo: { anchor: 'coverSettings' }, durationMs: 5400, withPrevious: true,
        },
        { kind: 'pause', id: 'readSettings' },

        { kind: 'highlight', id: 'dimSettings', anchor: 'coverSettings', intensity: [0.9, 0], durationMs: 400, keyframe: true },
        { kind: 'highlight', id: 'markHome', anchor: 'coverHome', intensity: [0, 0.9], durationMs: 420, withPrevious: true },
        {
            kind: 'caption', id: 'home', at: 'bottom',
            textKey: 'ponder.captions.panelCoverActions.home',
            pointTo: { anchor: 'coverHome' }, durationMs: 5200, withPrevious: true,
        },
        { kind: 'pause', id: 'readHome' },
    ],
};

/** 第二章：右边那两颗 —— 一个是窗口模式，一个是这首歌本身。 */
const rightCorners: PonderSceneScript = {
    id: 'panel-cover-actions-right',
    titleKey: 'ponder.scenes.panelCoverActionsRight',
    anchors,
    steps: [
        { kind: 'surfaceState', id: 'showActions', anchor: 'panel', state: 'cover-actions', durationMs: 420, keyframe: true },
        { kind: 'highlight', id: 'markTransparent', anchor: 'coverTransparent', intensity: [0, 0.9], durationMs: 420, withPrevious: true },
        {
            kind: 'caption', id: 'transparent', at: 'bottom',
            textKey: 'ponder.captions.panelCoverActions.transparent',
            pointTo: { anchor: 'coverTransparent' }, durationMs: 6000, withPrevious: true,
        },
        { kind: 'pause', id: 'readTransparent' },

        { kind: 'highlight', id: 'dimTransparent', anchor: 'coverTransparent', intensity: [0.9, 0], durationMs: 400, keyframe: true },
        { kind: 'highlight', id: 'markPlaylist', anchor: 'coverPlaylist', intensity: [0, 0.9], durationMs: 420, withPrevious: true },
        {
            kind: 'caption', id: 'playlist', at: 'bottom',
            textKey: 'ponder.captions.panelCoverActions.addToPlaylist',
            pointTo: { anchor: 'coverPlaylist' }, durationMs: 5600, withPrevious: true,
        },
        { kind: 'pause', id: 'readPlaylist' },

        {
            kind: 'caption', id: 'touch', at: 'bottom',
            textKey: 'ponder.captions.panelCoverActions.touch',
            pointTo: { anchor: 'cover', y: 0.5 }, durationMs: 5400, keyframe: true,
        },
        { kind: 'pause', id: 'readTouch' },
    ],
};

export default {
    id: 'panel-cover-actions',
    titleKey: 'ponder.targets.panelCoverActions',
    category: 'playback',
    summaryKey: 'ponder.summaries.panel_cover_actions',
    hoverSelector: '[data-ponder-panel-artwork]',
    // 封面整块都在面板选择器里，深度相同的情况不会出现；priority 用来保证嵌套关系稳定。
    priority: 1,
    relatedTargetIds: ['side-panel', 'panel-cover-tab'],
    scenes: [reveal, rightCorners],
} satisfies PonderTargetDefinition;
