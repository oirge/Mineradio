import { GRID_HOTKEY_GEOMETRY as G } from '../surfaces/ponderSurfaceGeometry';
import { settingsPanel, settingsRegion } from './settingsSectionShared';
import type { PonderAnchorSource, PonderSceneScript, PonderTargetDefinition } from '../../../types/ponder';

// src/components/ponder/targets/gridPaletteHotkey.target.ts
// 设置 · 交互里的「网格上的 S 键」。
//
// 整组只有一行开关，但它决定的是同一个键在网格页上做哪件事 —— 而这件事屏幕上
// 没有任何提示。默认关着：网格页上任何单字符都进筛选框，S 也不例外。

const anchors = {
    panel: settingsPanel('grid-hotkey-settings', 'ponder.anchors.gridHotkey.panel', { top: 0.34, width: 0.4, height: 0.2 }),
    toggle: settingsRegion(G.toggle, 'ponder.anchors.gridHotkey.toggle'),
} satisfies Record<string, PonderAnchorSource>;

const whoOwnsS: PonderSceneScript = {
    id: 'grid-palette-hotkey-owner',
    titleKey: 'ponder.scenes.gridPaletteHotkeyOwner',
    action: {
        kind: 'openSettings',
        anchorId: 'gridPaletteHotkey',
        labelKey: 'ponder.actions.openGridPaletteHotkey',
    },
    anchors,
    steps: [
        { kind: 'keypress', id: 'typeS', keys: ['S'], at: { anchor: 'panel', y: 0, offset: { y: -24 } }, durationMs: 1000, keyframe: true },
        { kind: 'highlight', id: 'markToggle', anchor: 'toggle', intensity: [0, 0.8], durationMs: 460, withPrevious: true },
        {
            kind: 'caption', id: 'off', at: 'bottom',
            textKey: 'ponder.captions.gridHotkey.off',
            pointTo: { anchor: 'toggle' }, durationMs: 6600, withPrevious: true,
        },
        { kind: 'pause', id: 'readOff' },

        { kind: 'cursor', id: 'turnOn', to: { anchor: 'toggle', x: 0.93 }, press: 'tap', durationMs: 620, keyframe: true },
        { kind: 'surfaceState', id: 'switchOn', anchor: 'panel', state: 'hotkey-on', durationMs: 440 },
        {
            kind: 'caption', id: 'on', at: 'bottom',
            textKey: 'ponder.captions.gridHotkey.on',
            pointTo: { anchor: 'toggle' }, durationMs: 6400, withPrevious: true,
        },
        { kind: 'pause', id: 'readOn' },
    ],
};

export default {
    id: 'grid-palette-hotkey',
    titleKey: 'ponder.targets.gridPaletteHotkey',
    category: 'browsing',
    summaryKey: 'ponder.summaries.grid_palette_hotkey',
    hoverSelector: '[data-settings-anchor="gridPaletteHotkey"]',
    relatedTargetIds: ['grid-page', 'command-palette'],
    scenes: [whoOwnsS],
} satisfies PonderTargetDefinition;
