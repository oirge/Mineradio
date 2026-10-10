import { THEME_SETTINGS_GEOMETRY as G } from '../surfaces/ponderSurfaceGeometry';
import type { PonderAnchorSource, PonderRelativeRect, PonderSceneScript, PonderTargetDefinition } from '../../../types/ponder';

// src/components/ponder/targets/themeSettings.target.ts
// 设置 · 外观里的「配色主题预设」那一组。
//
// 这一组容易被当成「只有两个预设可选」就翻过去了，其实它有四层：预设、自定义、
// 决定自定义配色从哪来的生成来源，再加下半截那三个决定「什么时候自动换配色」的开关。
// Theme Park 又是另一件事 —— 它不是配色库，是整屏的配色编辑器。
//
// 几何来自 ponderSurfaceGeometry，和 PonderThemeSettingsSurface 画的是同一组数。

const panel = {
    kind: 'synthetic',
    rect: { left: 0.5, top: 0.13, width: 0.42, height: 0.52, anchorX: 'center' },
    role: 'surface',
    surfaceKind: 'theme-settings',
    labelKey: 'ponder.anchors.themeSettings.panel',
} satisfies PonderAnchorSource;

const region = (rect: PonderRelativeRect, labelKey: string): PonderAnchorSource => (
    { kind: 'relative', from: 'panel', rect, role: 'region', labelKey }
);

const anchors = {
    panel,
    themePark: region(G.themePark, 'ponder.anchors.themeSettings.themePark'),
    presetDefault: region(G.presetDefault, 'ponder.anchors.themeSettings.presetDefault'),
    presetCustom: region(G.presetCustom, 'ponder.anchors.themeSettings.presetCustom'),
    source: region(G.source, 'ponder.anchors.themeSettings.source'),
    followSystem: region(G.followSystem, 'ponder.anchors.themeSettings.followSystem'),
    preferCustom: region(G.preferCustom, 'ponder.anchors.themeSettings.preferCustom'),
    autoSwitch: region(G.autoSwitch, 'ponder.anchors.themeSettings.autoSwitch'),
} satisfies Record<string, PonderAnchorSource>;

/** 第一章：两张预设分别是什么。 */
const presets: PonderSceneScript = {
    id: 'theme-settings-presets',
    titleKey: 'ponder.scenes.themeSettingsPresets',
    action: {
        kind: 'openSettings',
        anchorId: 'themePresets',
        labelKey: 'ponder.actions.openThemePresets',
    },
    anchors,
    steps: [
        { kind: 'highlight', id: 'markDefault', anchor: 'presetDefault', intensity: [0, 0.8], durationMs: 440, keyframe: true },
        {
            kind: 'caption', id: 'default', at: 'bottom',
            textKey: 'ponder.captions.themeSettings.presetDefault',
            pointTo: { anchor: 'presetDefault' }, durationMs: 5000, withPrevious: true,
        },
        { kind: 'pause', id: 'readDefault' },

        { kind: 'highlight', id: 'markCustom', anchor: 'presetCustom', intensity: [0, 0.8], durationMs: 440, keyframe: true },
        {
            kind: 'caption', id: 'custom', at: 'bottom',
            textKey: 'ponder.captions.themeSettings.presetCustom',
            pointTo: { anchor: 'presetCustom' }, durationMs: 5400, withPrevious: true,
        },
        { kind: 'pause', id: 'readCustom' },
    ],
};

/** 第二章：自定义配色从哪来，以及标题行右端那颗按钮打开的整屏编辑器。 */
const sourceAndPark: PonderSceneScript = {
    id: 'theme-settings-source',
    titleKey: 'ponder.scenes.themeSettingsSource',
    anchors,
    steps: [
        { kind: 'highlight', id: 'markSource', anchor: 'source', intensity: [0, 0.8], durationMs: 440, keyframe: true },
        {
            kind: 'caption', id: 'source', at: 'bottom',
            textKey: 'ponder.captions.themeSettings.source',
            pointTo: { anchor: 'source' }, durationMs: 5800, withPrevious: true,
        },
        { kind: 'pause', id: 'readSource' },

        { kind: 'cursor', id: 'openPark', to: { anchor: 'themePark' }, press: 'tap', durationMs: 660, keyframe: true },
        // 同上：Theme Park 铺上来之后，留在底下的高亮要熄掉。
        { kind: 'highlight', id: 'dimSource', anchor: 'source', intensity: [0.8, 0], durationMs: 420, withPrevious: true },
        { kind: 'surfaceState', id: 'parkOpens', anchor: 'panel', state: 'theme-park-open', transition: 'zoom', durationMs: 560 },
        {
            kind: 'caption', id: 'park', at: 'bottom',
            textKey: 'ponder.captions.themeSettings.themePark',
            pointTo: { anchor: 'panel', x: 0.35, y: 0.55 }, durationMs: 5800, withPrevious: true,
        },
        { kind: 'pause', id: 'readPark' },

        {
            kind: 'caption', id: 'parkTabs', at: 'bottom',
            textKey: 'ponder.captions.themeSettings.themeParkTabs',
            pointTo: { anchor: 'panel', x: 0.85, y: 0.28 }, durationMs: 5800, keyframe: true,
        },
        { kind: 'pause', id: 'readParkTabs' },
    ],
};

/**
 * 第三章：这一组下半截的三个开关。
 *
 * 它们是「配色什么时候自己变」的全部答案，却最容易被漏掉 —— 前两章讲完预设和来源，
 * 屏幕已经翻过去了，而真正让人困惑的「为什么换首歌颜色就变了」在这里。
 */
const autoSwitching: PonderSceneScript = {
    id: 'theme-settings-auto',
    titleKey: 'ponder.scenes.themeSettingsAuto',
    anchors,
    steps: [
        { kind: 'highlight', id: 'markFollow', anchor: 'followSystem', intensity: [0, 0.85], durationMs: 420, keyframe: true },
        {
            kind: 'caption', id: 'follow', at: 'bottom',
            textKey: 'ponder.captions.themeSettings.followSystem',
            pointTo: { anchor: 'followSystem' }, durationMs: 5200, withPrevious: true,
        },
        { kind: 'pause', id: 'readFollow' },

        { kind: 'highlight', id: 'dimFollow', anchor: 'followSystem', intensity: [0.85, 0], durationMs: 400, keyframe: true },
        { kind: 'highlight', id: 'markPrefer', anchor: 'preferCustom', intensity: [0, 0.85], durationMs: 420, withPrevious: true },
        {
            kind: 'caption', id: 'prefer', at: 'bottom',
            textKey: 'ponder.captions.themeSettings.preferCustom',
            pointTo: { anchor: 'preferCustom' }, durationMs: 5400, withPrevious: true,
        },
        { kind: 'pause', id: 'readPrefer' },

        { kind: 'highlight', id: 'dimPrefer', anchor: 'preferCustom', intensity: [0.85, 0], durationMs: 400, keyframe: true },
        { kind: 'highlight', id: 'markAuto', anchor: 'autoSwitch', intensity: [0, 0.85], durationMs: 420, withPrevious: true },
        {
            kind: 'caption', id: 'auto', at: 'bottom',
            textKey: 'ponder.captions.themeSettings.autoSwitch',
            pointTo: { anchor: 'autoSwitch' }, durationMs: 5800, withPrevious: true,
        },
        { kind: 'pause', id: 'readAuto' },
    ],
};

export default {
    id: 'theme-settings',
    titleKey: 'ponder.targets.themeSettings',
    category: 'appearance',
    summaryKey: 'ponder.summaries.theme_settings',
    hoverSelector: '[data-settings-anchor="themePresets"]',
    relatedTargetIds: ['settings-page', 'lyrics-animation-settings'],
    scenes: [presets, sourceAndPark, autoSwitching],
} satisfies PonderTargetDefinition;
