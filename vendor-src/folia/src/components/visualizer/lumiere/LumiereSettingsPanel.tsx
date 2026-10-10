// Copyright (c) 2026 chthollyphile
import React, { useMemo } from 'react';
import { DEFAULT_LUMIERE_TUNING, type LumiereRenderQuality, type LumiereTuning } from '../../../types';
import type { VisualizerSettingsPanelProps } from '../definition';
import VisualizerPresetGroup, { type VisualizerPresetOption } from '../VisualizerPresetGroup';
import { TemperaRangeControl as RangeControl, TemperaSettingsSection as SettingsSection } from '../tempera/TemperaSettingsControls';

// src/components/visualizer/lumiere/LumiereSettingsPanel.tsx
// 绘光的参数面板：光、氛围、文字、主题、性能五组，滑块遵循 VisPlayground 的草稿 / 松手提交语义。

type NumberKey = { [K in keyof LumiereTuning]: LumiereTuning[K] extends number ? K : never }[keyof LumiereTuning];
type BooleanKey = { [K in keyof LumiereTuning]: LumiereTuning[K] extends boolean ? K : never }[keyof LumiereTuning];

interface SliderSpec { kind: 'slider'; key: NumberKey; labelKey: string; min: number; max: number; step?: number; integer?: boolean; }
interface ToggleSpec { kind: 'toggle'; key: BooleanKey; labelKey: string; }
type ControlSpec = SliderSpec | ToggleSpec;

const slider = (key: NumberKey, labelKey: string, min: number, max: number, extra: Partial<SliderSpec> = {}): SliderSpec => (
    { kind: 'slider', key, labelKey, min, max, ...extra }
);
const toggle = (key: BooleanKey, labelKey: string): ToggleSpec => ({ kind: 'toggle', key, labelKey });

const LIGHT_CONTROLS: ControlSpec[] = [
    slider('lightIntensity', 'options.lumiereLightIntensity', 0.3, 2),
    slider('audioResponse', 'options.lumiereAudioResponse', 0, 2),
    slider('bloom', 'options.lumiereBloom', 0, 2),
    slider('textBloom', 'options.lumiereTextBloom', 0, 2),
];

const ATMOSPHERE_CONTROLS: ControlSpec[] = [
    slider('darkField', 'options.lumiereDarkField', 0, 1, { step: 0.01 }),
    slider('fogDensity', 'options.lumiereFogDensity', 0, 2),
    slider('fogOctaves', 'options.lumiereFogOctaves', 2, 6, { step: 1, integer: true }),
    slider('moteAmount', 'options.lumiereMoteAmount', 0, 2),
    toggle('frontBokeh', 'options.lumiereFrontBokeh'),
    toggle('lineArt', 'options.lumiereLineArt'),
    toggle('overlayFrame', 'options.lumiereOverlayFrame'),
];

// 邻行是二选一的分段控件，夹在未唱字透明度与崩解强度之间，所以文字组拆成前后两段。
const TEXT_CONTROLS_LEAD: ControlSpec[] = [
    toggle('textOnly', 'options.lumiereTextOnly'),
    slider('unlitOpacity', 'options.lumiereUnlitOpacity', 0.05, 0.6, { step: 0.01 }),
];

const TEXT_CONTROLS_TAIL: ControlSpec[] = [
    slider('decay', 'options.lumiereDecay', 0, 2),
    slider('echo', 'options.lumiereEcho', 0, 2),
    toggle('trails', 'options.lumiereTrails'),
    toggle('hideTrails', 'options.lumiereHideTrails'),
    toggle('seamlessTransitions', 'options.lumiereSeamlessTransitions'),
];

const THEME_CONTROLS: ControlSpec[] = [
    slider('themeColorMix', 'options.lumiereThemeColorMix', 0, 1, { step: 0.01 }),
    toggle('keywordColors', 'options.lumiereKeywordColors'),
    toggle('themeIcons', 'options.lumiereThemeIcons'),
];

const formatPlain = (value: number) => value.toFixed(2);
const formatInteger = (value: number) => String(Math.round(value));

const LumiereSettingsPanel: React.FC<VisualizerSettingsPanelProps> = ({
    t,
    isDaylight,
    theme,
    rangeInputClass,
    controlCardBg,
    lumiereTuning = DEFAULT_LUMIERE_TUNING,
    onLumiereTuningChange,
    onSliderPointerDown,
    onSliderCommit,
}) => {
    const booleanOptions: VisualizerPresetOption<boolean>[] = useMemo(() => ([
        { value: true, label: t('options.lumiereToggleOn') },
        { value: false, label: t('options.lumiereToggleOff') },
    ]), [t]);

    const neighborOptions: VisualizerPresetOption<1 | 2>[] = useMemo(() => ([
        { value: 1, label: t('options.lumiereWindowNeighborsPrev') },
        { value: 2, label: t('options.lumiereWindowNeighborsBoth') },
    ]), [t]);

    const qualityOptions: VisualizerPresetOption<LumiereRenderQuality>[] = useMemo(() => ([
        { value: 'full', label: t('options.lumiereRenderQualityFull') },
        { value: 'balanced', label: t('options.lumiereRenderQualityBalanced') },
        { value: 'low', label: t('options.lumiereRenderQualityLow') },
    ]), [t]);

    const renderControl = (spec: ControlSpec) => (spec.kind === 'slider' ? (
        <RangeControl
            key={spec.key}
            label={t(spec.labelKey)}
            value={lumiereTuning[spec.key]}
            min={spec.min}
            max={spec.max}
            step={spec.step ?? 0.05}
            formatValue={spec.integer ? formatInteger : formatPlain}
            rangeInputClass={rangeInputClass}
            onChange={value => onLumiereTuningChange?.({ [spec.key]: value })}
            onPointerDown={onSliderPointerDown}
            onPointerUp={onSliderCommit}
        />
    ) : (
        <VisualizerPresetGroup
            key={spec.key}
            label={t(spec.labelKey)}
            value={lumiereTuning[spec.key]}
            options={booleanOptions}
            onChange={value => onLumiereTuningChange?.({ [spec.key]: value })}
            isDaylight={isDaylight}
            theme={theme}
        />
    ));

    const hint = (key: string) => (
        <p className="text-xs leading-relaxed opacity-55" style={{ color: 'var(--text-secondary)' }}>{t(key)}</p>
    );

    return (
        <div className="rounded-[24px] border border-white/10 p-4 space-y-4" style={{ backgroundColor: controlCardBg }}>
            <div className="space-y-1">
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {t('options.lumiereSettings')}
                </div>
                <div className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                    {t('options.lumiereSettingsDesc')}
                </div>
            </div>

            <SettingsSection title={t('options.lumiereLightSection')}>
                {LIGHT_CONTROLS.map(renderControl)}
                {hint('options.lumiereAudioResponseHint')}
            </SettingsSection>

            <SettingsSection title={t('options.lumiereAtmosphereSection')}>
                {ATMOSPHERE_CONTROLS.map(renderControl)}
                {hint('options.lumiereDarkFieldHint')}
            </SettingsSection>

            <SettingsSection title={t('options.lumiereTextSection')}>
                {TEXT_CONTROLS_LEAD.map(renderControl)}
                <VisualizerPresetGroup
                    label={t('options.lumiereWindowNeighbors')}
                    value={lumiereTuning.windowNeighbors}
                    options={neighborOptions}
                    onChange={windowNeighbors => onLumiereTuningChange?.({ windowNeighbors })}
                    isDaylight={isDaylight}
                    theme={theme}
                />
                {TEXT_CONTROLS_TAIL.map(renderControl)}
                {hint('options.lumiereTextOnlyHint')}
                {hint('options.lumiereEchoHint')}
                {hint('options.lumiereHideTrailsHint')}
                {hint('options.lumiereSeamlessTransitionsHint')}
            </SettingsSection>

            <SettingsSection title={t('options.lumiereThemeSection')}>
                {THEME_CONTROLS.map(renderControl)}
                {hint('options.lumiereThemeColorMixHint')}
            </SettingsSection>

            <SettingsSection title={t('options.lumierePerformanceSection')}>
                <VisualizerPresetGroup
                    label={t('options.lumiereRenderQuality')}
                    value={lumiereTuning.renderQuality}
                    options={qualityOptions}
                    onChange={renderQuality => onLumiereTuningChange?.({ renderQuality })}
                    isDaylight={isDaylight}
                    theme={theme}
                />
                {hint('options.lumiereRenderQualityHint')}
            </SettingsSection>
        </div>
    );
};

export default LumiereSettingsPanel;
