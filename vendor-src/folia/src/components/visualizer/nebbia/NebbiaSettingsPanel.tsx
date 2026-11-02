import React from 'react';
import { Group, type SettingsGroupDef } from '../../modal/settings/kit';
import { type VisualizerSettingsPanelProps } from '../definition';
import { percent, SliderRow, times, ToggleRow } from '../panelRows';
import {
    DEFAULT_NEBBIA_TUNING,
    NEBBIA_APPEAR_STYLES,
    NEBBIA_FADE_STYLES,
    NEBBIA_LAYOUTS,
    NEBBIA_LIMITS,
    type NebbiaAppearStyle,
    type NebbiaFadeStyle,
    type NebbiaLayout,
    type NebbiaNumberKey,
    type NebbiaTuning,
} from './types';

// src/components/visualizer/nebbia/NebbiaSettingsPanel.tsx
// 雾笺的设置：雾上写字（笔画、手写歪斜和变形、雾、片尾写曲名），字怎么出现、怎么消失、一句怎么构图（每种一个开关，开几种用几种），
// 窗外（车、霓虹、聚光灯、雨点、画质）。用设置窗口的共用控件画成几组。

export const NEBBIA_APPEAR_LABEL_KEYS: Record<NebbiaAppearStyle, string> = {
    write: 'options.nebbiaAppearWrite',
    fade: 'options.nebbiaAppearFade',
    breath: 'options.nebbiaAppearBreath',
};
export const NEBBIA_FADE_LABEL_KEYS: Record<NebbiaFadeStyle, string> = {
    fog: 'options.nebbiaFadeFog',
    fingers: 'options.nebbiaFadeFingers',
};
const LAYOUT_LABEL_KEYS = Object.fromEntries(
    NEBBIA_LAYOUTS.map(l => [l, `options.nebbiaLayout_${l}`]),
) as Record<NebbiaLayout, string>;

const seconds = (value: number) => `${value.toFixed(1)}s`;
type SliderSpec = [NebbiaNumberKey, string, number, (value: number) => string];

const WRITING_GROUP: SettingsGroupDef = { id: 'vis-nebbia-writing', titleKey: 'options.nebbiaWriting' };
const WRITING_SLIDERS: SliderSpec[] = [
    ['strokeWidth', 'options.nebbiaStrokeWidth', 0.005, percent],
    ['writeSpeed', 'options.nebbiaWriteSpeed', 0.05, times],
    ['jitter', 'options.nebbiaJitter', 0.05, times],
    ['warp', 'options.nebbiaWarp', 0.05, times],
    ['doodle', 'options.nebbiaDoodle', 0.05, percent],
    ['mist', 'options.nebbiaMist', 0.01, percent],
    ['hold', 'options.nebbiaHold', 0.1, seconds],
    ['refog', 'options.nebbiaRefog', 0.5, seconds],
];
const WINDOW_GROUP: SettingsGroupDef = { id: 'vis-nebbia-window', titleKey: 'options.nebbiaWindow' };
const WINDOW_SLIDERS: SliderSpec[] = [
    ['busSpeed', 'options.nebbiaBusSpeed', 0.05, times],
    ['neon', 'options.nebbiaNeon', 0.05, times],
    ['bump', 'options.nebbiaBump', 0.05, times],
    ['spot', 'options.nebbiaSpot', 0.05, times],
    ['spotX', 'options.nebbiaSpotX', 0.01, percent],
    ['rainHit', 'options.nebbiaRainHit', 0.05, times],
    ['rainBig', 'options.nebbiaRainBig', 0.05, times],
    ['resolution', 'options.nebbiaResolution', 0.25, times],
];
const APPEAR_GROUP: SettingsGroupDef = { id: 'vis-nebbia-appear', titleKey: 'options.nebbiaAppear' };
const FADE_GROUP: SettingsGroupDef = { id: 'vis-nebbia-fade', titleKey: 'options.nebbiaFade' };
const LAYOUT_GROUP: SettingsGroupDef = { id: 'vis-nebbia-layouts', titleKey: 'options.nebbiaLayouts' };

/** 开关组里打开或关掉一项，按 choices 的顺序排；全关了返回 null（最后一项关不掉）。 */
const toggled = <T extends string>(choices: readonly T[], on: readonly T[], item: T, next: boolean): T[] | null => {
    const out = choices.filter(c => (c === item ? next : on.includes(c)));
    return out.length ? out : null;
};

const NebbiaSettingsPanel: React.FC<VisualizerSettingsPanelProps<NebbiaTuning>> = ({
    t,
    tuning,
    onTuningChange,
    onSliderPointerDown,
    onSliderCommit,
}) => {
    const resolved = tuning ?? DEFAULT_NEBBIA_TUNING;
    const drag = { onDragStart: onSliderPointerDown, onDragEnd: onSliderCommit };
    const sliders = (specs: SliderSpec[]) => specs.map(([key, labelKey, step, format]) => (
        <SliderRow
            key={key}
            {...drag}
            label={t(labelKey)}
            value={resolved[key]}
            min={NEBBIA_LIMITS[key].min}
            max={NEBBIA_LIMITS[key].max}
            step={step}
            format={format}
            onChange={value => onTuningChange({ [key]: value } as Partial<NebbiaTuning>)}
        />
    ));
    // 一组开关：on 是打开的几项，patch 把新的一组写回 tuning；只剩一项时它的开关不能点
    const toggles = <T extends string>(choices: readonly T[], on: readonly T[], labels: Record<T, string>, patch: (next: T[]) => Partial<NebbiaTuning>) => (
        choices.map(item => (
            <ToggleRow
                key={item}
                label={t(labels[item])}
                checked={on.includes(item)}
                disabled={on.length === 1 && on[0] === item}
                onChange={next => {
                    const list = toggled(choices, on, item, next);
                    if (list) onTuningChange(patch(list));
                }}
            />
        ))
    );

    return (
        <>
            <Group def={WRITING_GROUP}>
                {sliders(WRITING_SLIDERS)}
                <ToggleRow
                    label={t('options.nebbiaCredits')}
                    note={t('options.nebbiaCreditsHint')}
                    checked={resolved.credits}
                    onChange={credits => onTuningChange({ credits })}
                />
            </Group>
            <Group def={APPEAR_GROUP} foot={t('options.nebbiaAppearHint')}>
                {toggles(NEBBIA_APPEAR_STYLES, resolved.appear, NEBBIA_APPEAR_LABEL_KEYS, appear => ({ appear }))}
            </Group>
            <Group def={FADE_GROUP} foot={t('options.nebbiaFadeHint')}>
                {toggles(NEBBIA_FADE_STYLES, resolved.fade, NEBBIA_FADE_LABEL_KEYS, fade => ({ fade }))}
            </Group>
            <Group def={LAYOUT_GROUP} foot={t('options.nebbiaLayoutsHint')}>
                {toggles(NEBBIA_LAYOUTS, resolved.layouts, LAYOUT_LABEL_KEYS, layouts => ({ layouts }))}
            </Group>
            <Group def={WINDOW_GROUP}>{sliders(WINDOW_SLIDERS)}</Group>
        </>
    );
};

export default NebbiaSettingsPanel;
