import React, { useMemo } from 'react';
import { DEFAULT_SONNET_TUNING, type SonnetOuterFrameMode, type SonnetTuning } from '../../../types';
import { colorWithAlpha } from '../colorMix';
import type { VisualizerSettingsPanelProps } from '../definition';
import VisualizerPresetGroup, { type VisualizerPresetOption } from '../VisualizerPresetGroup';
import { SonnetRangeControl, SonnetSettingsSection } from './SonnetSettingsControls';

// src/components/visualizer/sonnet/SonnetSettingsPanel.tsx
// Keeps Sonnet's tuning controls adjacent to the mode implementation.
const SonnetSettingsPanel: React.FC<VisualizerSettingsPanelProps> = ({
    t,
    isDaylight,
    theme,
    rangeInputClass,
    controlCardBg,
    sonnetTuning = DEFAULT_SONNET_TUNING,
    onSonnetTuningChange,
    onSliderPointerDown,
    onSliderCommit,
}) => {
    const booleanOptions: VisualizerPresetOption<boolean>[] = useMemo(() => ([
        { value: true, label: t('options.sonnetToggleOn') },
        { value: false, label: t('options.sonnetToggleOff') },
    ]), [t]);

    const outerFrameOptions: VisualizerPresetOption<SonnetOuterFrameMode>[] = useMemo(() => ([
        { value: 'none', label: t('options.sonnetOuterFrameNone') },
        { value: 'frame', label: t('options.sonnetOuterFrameFrame') },
        { value: 'full', label: t('options.sonnetOuterFrameFull') },
    ]), [t]);

    const visibilityControls: Array<{
        key: Extract<keyof SonnetTuning, 'showOnlyText' | 'showGuide' | 'showBackgroundMg' | 'showFixedGeo' | 'showGiantDecorativeText' | 'showBackgroundDecor' | 'enableTransitions'>;
        label: string;
    }> = [
        { key: 'showOnlyText', label: t('options.sonnetShowOnlyText') },
        { key: 'showGuide', label: t('options.sonnetShowGuide') },
        { key: 'showBackgroundMg', label: t('options.sonnetShowBackgroundMg') },
        { key: 'showFixedGeo', label: t('options.sonnetShowFixedGeo') },
        { key: 'showGiantDecorativeText', label: t('options.sonnetShowGiantDecorativeText') },
        { key: 'showBackgroundDecor', label: t('options.sonnetShowBackgroundDecor') },
        { key: 'enableTransitions', label: t('options.sonnetEnableTransitions') },
    ];

    const motionControls: Array<{
        key: Extract<keyof SonnetTuning, 'cameraIntensity' | 'typographyMotion' | 'mgDensity'>;
        label: string;
    }> = [
        { key: 'cameraIntensity', label: t('options.sonnetCameraIntensity') },
        { key: 'typographyMotion', label: t('options.sonnetTypographyMotion') },
        { key: 'mgDensity', label: t('options.sonnetMgDensity') },
    ];

    return (
        <div
            className="rounded-[24px] border border-white/10 p-4 space-y-4"
            style={{ backgroundColor: controlCardBg }}
        >
            <div className="space-y-1">
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {t('options.sonnetSettings')}
                </div>
                <div className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                    {t('options.sonnetSettingsDesc')}
                </div>
            </div>

            <SonnetSettingsSection title={t('options.sonnetQualitySection')}>
                <div
                    className="rounded-2xl border p-3.5 space-y-2.5"
                    style={{
                        borderColor: colorWithAlpha(theme.secondaryColor, isDaylight ? 0.18 : 0.14),
                        backgroundColor: colorWithAlpha(theme.backgroundColor, isDaylight ? 0.24 : 0.34),
                    }}
                >
                    <SonnetRangeControl
                        label={t('options.sonnetTextureResolution')}
                        value={sonnetTuning.textureResolution}
                        min={0.5}
                        max={4}
                        step={0.25}
                        rangeInputClass={rangeInputClass}
                        onChange={textureResolution => onSonnetTuningChange?.({ textureResolution })}
                        onPointerDown={onSliderPointerDown}
                        onPointerUp={onSliderCommit}
                    />
                    <p className="text-xs leading-relaxed opacity-60" style={{ color: 'var(--text-secondary)' }}>
                        {t('options.sonnetTexturePerformanceWarning')}
                    </p>
                </div>
            </SonnetSettingsSection>

            <SonnetSettingsSection title={t('options.sonnetMotionSection')}>
                {motionControls.map(control => (
                    <SonnetRangeControl
                        key={control.key}
                        label={control.label}
                        value={sonnetTuning[control.key]}
                        rangeInputClass={rangeInputClass}
                        onChange={value => onSonnetTuningChange?.({ [control.key]: value })}
                        onPointerDown={onSliderPointerDown}
                        onPointerUp={onSliderCommit}
                    />
                ))}
            </SonnetSettingsSection>

            <SonnetSettingsSection title={t('options.sonnetPostProcessSection')}>
                <VisualizerPresetGroup
                    label={t('options.sonnetPostProcessEnabled')}
                    value={sonnetTuning.postProcessEnabled}
                    options={booleanOptions}
                    onChange={postProcessEnabled => onSonnetTuningChange?.({ postProcessEnabled })}
                    isDaylight={isDaylight}
                    theme={theme}
                />
                {sonnetTuning.postProcessEnabled && (
                    <>
                        <SonnetRangeControl
                            label={t('options.sonnetPostProcessGrain')}
                            value={sonnetTuning.postProcessGrain}
                            min={0}
                            max={1}
                            step={0.05}
                            rangeInputClass={rangeInputClass}
                            onChange={postProcessGrain => onSonnetTuningChange?.({ postProcessGrain })}
                            onPointerDown={onSliderPointerDown}
                            onPointerUp={onSliderCommit}
                        />
                        <SonnetRangeControl
                            label={t('options.sonnetPostProcessContrast')}
                            value={sonnetTuning.postProcessContrast}
                            min={0}
                            max={1}
                            step={0.05}
                            rangeInputClass={rangeInputClass}
                            onChange={postProcessContrast => onSonnetTuningChange?.({ postProcessContrast })}
                            onPointerDown={onSliderPointerDown}
                            onPointerUp={onSliderCommit}
                        />
                        <SonnetRangeControl
                            label={t('options.sonnetPostProcessRgbShift') || 'RGB 色差'}
                            value={sonnetTuning.postProcessRgbShift}
                            min={0}
                            max={1}
                            step={0.05}
                            rangeInputClass={rangeInputClass}
                            onChange={postProcessRgbShift => onSonnetTuningChange?.({ postProcessRgbShift })}
                            onPointerDown={onSliderPointerDown}
                            onPointerUp={onSliderCommit}
                        />
                        <SonnetRangeControl
                            label={t('options.sonnetPostProcessLensDistortion')}
                            value={sonnetTuning.postProcessLensDistortion}
                            min={0}
                            max={2}
                            step={0.05}
                            rangeInputClass={rangeInputClass}
                            onChange={postProcessLensDistortion => onSonnetTuningChange?.({ postProcessLensDistortion })}
                            onPointerDown={onSliderPointerDown}
                            onPointerUp={onSliderCommit}
                        />
                        <SonnetRangeControl
                            label={t('options.sonnetPostProcessLensDispersion')}
                            value={sonnetTuning.postProcessLensDispersion}
                            min={0}
                            max={1}
                            step={0.05}
                            rangeInputClass={rangeInputClass}
                            onChange={postProcessLensDispersion => onSonnetTuningChange?.({ postProcessLensDispersion })}
                            onPointerDown={onSliderPointerDown}
                            onPointerUp={onSliderCommit}
                        />
                        <SonnetRangeControl
                            label={t('options.sonnetPostProcessHalftone')}
                            value={sonnetTuning.postProcessHalftone}
                            min={0}
                            max={1}
                            step={0.05}
                            rangeInputClass={rangeInputClass}
                            onChange={postProcessHalftone => onSonnetTuningChange?.({ postProcessHalftone })}
                            onPointerDown={onSliderPointerDown}
                            onPointerUp={onSliderCommit}
                        />
                        <SonnetRangeControl
                            label={t('options.sonnetPostProcessVignette')}
                            value={sonnetTuning.postProcessVignette}
                            min={0}
                            max={2}
                            step={0.05}
                            rangeInputClass={rangeInputClass}
                            onChange={postProcessVignette => onSonnetTuningChange?.({ postProcessVignette })}
                            onPointerDown={onSliderPointerDown}
                            onPointerUp={onSliderCommit}
                        />
                    </>
                )}
            </SonnetSettingsSection>

            <SonnetSettingsSection title={t('options.sonnetDisplaySection')}>
                <VisualizerPresetGroup
                    label={t('options.sonnetOuterFrameMode')}
                    value={sonnetTuning.outerFrameMode}
                    options={outerFrameOptions}
                    onChange={outerFrameMode => onSonnetTuningChange?.({ outerFrameMode })}
                    isDaylight={isDaylight}
                    theme={theme}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                    {visibilityControls.map(control => (
                        <VisualizerPresetGroup
                            key={control.key}
                            label={control.label}
                            value={sonnetTuning[control.key]}
                            options={booleanOptions}
                            onChange={(next) => onSonnetTuningChange?.({ [control.key]: next })}
                            isDaylight={isDaylight}
                            theme={theme}
                        />
                    ))}
                </div>
            </SonnetSettingsSection>
        </div>
    );
};

export default SonnetSettingsPanel;
