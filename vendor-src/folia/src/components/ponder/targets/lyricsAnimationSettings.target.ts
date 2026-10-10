import { LYRICS_ANIMATION_SETTINGS_GEOMETRY as G } from '../surfaces/ponderSurfaceGeometry';
import type { PonderAnchorSource, PonderRelativeRect, PonderSceneScript, PonderTargetDefinition } from '../../../types/ponder';

// src/components/ponder/targets/lyricsAnimationSettings.target.ts
// 设置 · 外观里的「歌词动画」那一组。
//
// 单独成一个目标而不是并进 settings-page：那一章讲的是「设置怎么分组、怎么搜」，
// 而这里要回答的是一个具体问题 —— 换歌词动画到底在哪儿换。这两件事的读者不是同一批人。
//
// 这一组只有三样东西：通往调参台的入口，以及同一张卡里的两个开关。几何来自
// ponderSurfaceGeometry，和 PonderLyricsAnimationSettingsSurface 画的是同一组数。

const panel = {
    kind: 'synthetic',
    rect: { left: 0.5, top: 0.28, width: 0.46, height: 0.30, anchorX: 'center' },
    role: 'surface',
    surfaceKind: 'lyrics-animation-settings',
    labelKey: 'ponder.anchors.lyricsAnimation.panel',
} satisfies PonderAnchorSource;

const region = (rect: PonderRelativeRect, labelKey: string): PonderAnchorSource => (
    { kind: 'relative', from: 'panel', rect, role: 'region', labelKey }
);

const anchors = {
    panel,
    entry: region(G.entry, 'ponder.anchors.lyricsAnimation.entry'),
    card: region(G.card, 'ponder.anchors.lyricsAnimation.card'),
    transparent: region(G.transparent, 'ponder.anchors.lyricsAnimation.transparent'),
    autoHide: region(G.autoHide, 'ponder.anchors.lyricsAnimation.autoHide'),
} satisfies Record<string, PonderAnchorSource>;

/** 第一章：换动画的入口在哪，点开是什么。 */
const entryPoint: PonderSceneScript = {
    id: 'lyrics-animation-entry',
    titleKey: 'ponder.scenes.lyricsAnimationEntry',
    action: {
        kind: 'openSettings',
        anchorId: 'lyricsRenderer',
        labelKey: 'ponder.actions.openLyricsAnimation',
    },
    anchors,
    steps: [
        { kind: 'highlight', id: 'markEntry', anchor: 'entry', intensity: [0, 0.8], durationMs: 460, keyframe: true },
        {
            kind: 'caption', id: 'where', at: 'bottom',
            textKey: 'ponder.captions.lyricsAnimation.where',
            pointTo: { anchor: 'entry' }, durationMs: 5200, withPrevious: true,
        },
        { kind: 'pause', id: 'readWhere' },

        { kind: 'cursor', id: 'openPlayground', to: { anchor: 'entry' }, press: 'tap', durationMs: 660, keyframe: true },
        // 高亮是骨架层画的，调参台盖上来它不会跟着走，得显式熄掉。
        { kind: 'highlight', id: 'dimEntry', anchor: 'entry', intensity: [0.8, 0], durationMs: 420, withPrevious: true },
        { kind: 'surfaceState', id: 'playgroundOpens', anchor: 'panel', state: 'playground-open', transition: 'zoom', durationMs: 560 },
        {
            kind: 'caption', id: 'playground', at: 'bottom',
            textKey: 'ponder.captions.lyricsAnimation.playground',
            pointTo: { anchor: 'panel', x: 0.3, y: 0.55 }, durationMs: 5800, withPrevious: true,
        },
        { kind: 'pause', id: 'readPlayground' },

        {
            kind: 'caption', id: 'sections', at: 'bottom',
            textKey: 'ponder.captions.lyricsAnimation.playgroundSections',
            pointTo: { anchor: 'panel', x: 0.84, y: 0.3 }, durationMs: 6000, keyframe: true,
        },
        { kind: 'pause', id: 'readSections' },
    ],
};

/** 第二章：同一张卡里那两个影响观感的开关。 */
const toggles: PonderSceneScript = {
    id: 'lyrics-animation-toggles',
    titleKey: 'ponder.scenes.lyricsAnimationToggles',
    anchors,
    steps: [
        { kind: 'highlight', id: 'markCard', anchor: 'card', intensity: [0, 0.45], durationMs: 420, keyframe: true },
        {
            kind: 'caption', id: 'card', at: 'bottom',
            textKey: 'ponder.captions.lyricsAnimation.card',
            pointTo: { anchor: 'card' }, durationMs: 4800, withPrevious: true,
        },
        { kind: 'pause', id: 'readCard' },

        { kind: 'highlight', id: 'dimCard', anchor: 'card', intensity: [0.45, 0], durationMs: 400, keyframe: true },
        { kind: 'highlight', id: 'markTransparent', anchor: 'transparent', intensity: [0, 0.85], durationMs: 420, withPrevious: true },
        {
            kind: 'caption', id: 'transparent', at: 'bottom',
            textKey: 'ponder.captions.lyricsAnimation.transparent',
            pointTo: { anchor: 'transparent' }, durationMs: 5600, withPrevious: true,
        },
        { kind: 'pause', id: 'readTransparent' },

        { kind: 'highlight', id: 'dimTransparent', anchor: 'transparent', intensity: [0.85, 0], durationMs: 400, keyframe: true },
        { kind: 'highlight', id: 'markAutoHide', anchor: 'autoHide', intensity: [0, 0.85], durationMs: 420, withPrevious: true },
        {
            kind: 'caption', id: 'autoHide', at: 'bottom',
            textKey: 'ponder.captions.lyricsAnimation.autoHide',
            pointTo: { anchor: 'autoHide' }, durationMs: 5400, withPrevious: true,
        },
        { kind: 'pause', id: 'readAutoHide' },
    ],
};

export default {
    id: 'lyrics-animation-settings',
    titleKey: 'ponder.targets.lyricsAnimationSettings',
    category: 'appearance',
    summaryKey: 'ponder.summaries.lyrics_animation_settings',
    hoverSelector: '[data-settings-anchor="lyricsRenderer"]',
    relatedTargetIds: ['settings-page', 'theme-settings'],
    scenes: [entryPoint, toggles],
} satisfies PonderTargetDefinition;
