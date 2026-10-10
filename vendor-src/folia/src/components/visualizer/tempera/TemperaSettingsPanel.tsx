import React, { useMemo } from 'react';
import { DEFAULT_TEMPERA_TUNING, type TemperaColorMode, type TemperaTuning } from '../../../types';
import { colorWithAlpha } from '../colorMix';
import type { VisualizerSettingsPanelProps } from '../definition';
import VisualizerPresetGroup, { type VisualizerPresetOption } from '../VisualizerPresetGroup';
import { TemperaRangeControl, TemperaSettingsSection } from './TemperaSettingsControls';
import TemperaImageLayerControls from './TemperaImageLayerControls';

// src/components/visualizer/tempera/TemperaSettingsPanel.tsx
// Keeps Tempera's tuning controls adjacent to the mode implementation.
const TemperaSettingsPanel: React.FC<VisualizerSettingsPanelProps> = ({
    t,
    isDaylight,
    theme,
    rangeInputClass,
    controlCardBg,
    temperaTuning = DEFAULT_TEMPERA_TUNING,
    onTemperaTuningChange,
    onSliderPointerDown,
    onSliderCommit,
}) => {
    const booleanOptions: VisualizerPresetOption<boolean>[] = useMemo(() => ([
        { value: true, label: t('options.temperaToggleOn') || '开启' },
        { value: false, label: t('options.temperaToggleOff') || '关闭' },
    ]), [t]);

    const colorModeOptions: VisualizerPresetOption<TemperaColorMode>[] = useMemo(() => ([
        { value: 'duo', label: t('options.temperaColorModeDuo') || '主题双色' },
        { value: 'mono', label: t('options.temperaColorModeMono') || '黑白灰' },
        { value: 'gradient', label: t('options.temperaColorModeGradient') || '封面渐变' },
    ]), [t]);

    const visibilityControls: Array<{
        key: Extract<keyof TemperaTuning, 'showBlocks' | 'showDecor' | 'showCornerMarks' | 'textInversion' | 'enableTransitions'>;
        label: string;
    }> = [
        { key: 'showBlocks', label: t('options.temperaShowBlocks') || '色块场景' },
        { key: 'showDecor', label: t('options.temperaShowDecor') || '装饰元素' },
        { key: 'showCornerMarks', label: t('options.temperaShowCornerMarks') || '边角线框' },
        { key: 'textInversion', label: t('options.temperaTextInversion') || '文字动态反色' },
        { key: 'enableTransitions', label: t('options.temperaEnableTransitions') || '场景转场' },
    ];

    const motionControls: Array<{
        key: Extract<keyof TemperaTuning, 'cameraIntensity' | 'glyphMotion'>;
        label: string;
    }> = [
        { key: 'cameraIntensity', label: t('options.temperaCameraIntensity') },
        { key: 'glyphMotion', label: t('options.temperaGlyphMotion') },
    ];

    return (
        <div
            className="rounded-[24px] border border-white/10 p-4 space-y-4"
            style={{ backgroundColor: controlCardBg }}
        >
            <div className="space-y-1">
                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {t('options.temperaSettings')}
                </div>
                <div className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                    {t('options.temperaSettingsDesc')}
                </div>
            </div>

            <TemperaSettingsSection title={t('options.temperaImageSection') || '画布图片'}>
                <TemperaImageLayerControls
                    images={temperaTuning.layerImages}
                    depth={temperaTuning.layerImageDepth}
                    frequency={temperaTuning.layerImageFrequency}
                    rangeInputClass={rangeInputClass}
                    isDaylight={isDaylight}
                    onCommit={patch => onTemperaTuningChange?.(patch)}
                />
            </TemperaSettingsSection>

            <TemperaSettingsSection title={t('options.temperaQualitySection')}>
                <div
                    className="rounded-2xl border p-3.5 space-y-2.5"
                    style={{
                        borderColor: colorWithAlpha(theme.secondaryColor, isDaylight ? 0.18 : 0.14),
                        backgroundColor: colorWithAlpha(theme.backgroundColor, isDaylight ? 0.24 : 0.34),
                    }}
                >
                    <TemperaRangeControl
                        label={t('options.temperaTextureResolution')}
                        value={temperaTuning.textureResolution}
                        min={0.5}
                        max={4}
                        step={0.25}
                        rangeInputClass={rangeInputClass}
                        onChange={textureResolution => onTemperaTuningChange?.({ textureResolution })}
                        onPointerDown={onSliderPointerDown}
                        onPointerUp={onSliderCommit}
                    />
                    <p className="text-xs leading-relaxed opacity-60" style={{ color: 'var(--text-secondary)' }}>
                        {t('options.temperaTexturePerformanceWarning')}
                    </p>
                </div>
            </TemperaSettingsSection>

            <TemperaSettingsSection title={t('options.temperaMotionSection')}>
                {motionControls.map(control => (
                    <TemperaRangeControl
                        key={control.key}
                        label={control.label}
                        value={temperaTuning[control.key]}
                        rangeInputClass={rangeInputClass}
                        onChange={value => onTemperaTuningChange?.({ [control.key]: value })}
                        onPointerDown={onSliderPointerDown}
                        onPointerUp={onSliderCommit}
                    />
                ))}
                <TemperaRangeControl
                    label={t('options.temperaGlyphSettleStretch') || '逐字入场时序'}
                    value={temperaTuning.glyphSettleStretch}
                    min={0}
                    max={1}
                    step={0.05}
                    rangeInputClass={rangeInputClass}
                    onChange={glyphSettleStretch => onTemperaTuningChange?.({ glyphSettleStretch })}
                    onPointerDown={onSliderPointerDown}
                    onPointerUp={onSliderCommit}
                />
                <p className="text-xs leading-relaxed opacity-55" style={{ color: 'var(--text-secondary)' }}>
                    {t('options.temperaGlyphSettleStretchHint')
                        || '0 = 每字用同样的短窗口快速落位，切镜前画面已静止，适合快歌；1 = 整个分镜的字精确落在歌词结束那一刻，全程都在动，适合慢歌。'}
                </p>
                <VisualizerPresetGroup
                    label={t('options.temperaColorMode')}
                    value={temperaTuning.colorMode}
                    options={colorModeOptions}
                    onChange={colorMode => onTemperaTuningChange?.({ colorMode })}
                    isDaylight={isDaylight}
                    theme={theme}
                />
            </TemperaSettingsSection>

            <TemperaSettingsSection title={t('options.temperaPostProcessSection') || '后处理'}>
                <VisualizerPresetGroup
                    label={t('options.temperaPostProcessEnabled') || '整体后处理滤镜'}
                    value={temperaTuning.postProcessEnabled}
                    options={booleanOptions}
                    onChange={postProcessEnabled => onTemperaTuningChange?.({ postProcessEnabled })}
                    isDaylight={isDaylight}
                    theme={theme}
                />
                {temperaTuning.postProcessEnabled && (
                    <>
                        <VisualizerPresetGroup
                            label={t('options.temperaPostProcessTextureCompression') || '后处理纹理压缩'}
                            value={temperaTuning.postProcessTextureCompression}
                            options={booleanOptions}
                            onChange={postProcessTextureCompression => onTemperaTuningChange?.({ postProcessTextureCompression })}
                            isDaylight={isDaylight}
                            theme={theme}
                        />
                        <p className="text-xs leading-relaxed opacity-55" style={{ color: 'var(--text-secondary)' }}>
                            {t('options.temperaPostProcessTextureCompressionHint')
                                || '开启后后处理在 1x 纹理上运算再拉伸到画布，降低GPU和显存压力'}
                        </p>
                        <TemperaRangeControl
                            label={t('options.temperaPostProcessGrain') || '胶片颗粒'}
                            value={temperaTuning.postProcessGrain}
                            min={0}
                            max={1}
                            step={0.05}
                            rangeInputClass={rangeInputClass}
                            onChange={postProcessGrain => onTemperaTuningChange?.({ postProcessGrain })}
                            onPointerDown={onSliderPointerDown}
                            onPointerUp={onSliderCommit}
                        />
                        <TemperaRangeControl
                            label={t('options.temperaPostProcessContrast') || '对比度增强'}
                            value={temperaTuning.postProcessContrast}
                            min={0}
                            max={1}
                            step={0.05}
                            rangeInputClass={rangeInputClass}
                            onChange={postProcessContrast => onTemperaTuningChange?.({ postProcessContrast })}
                            onPointerDown={onSliderPointerDown}
                            onPointerUp={onSliderCommit}
                        />
                        <TemperaRangeControl
                            label={t('options.temperaPostProcessRgbShift') || 'RGB 色差'}
                            value={temperaTuning.postProcessRgbShift}
                            min={0}
                            max={1}
                            step={0.05}
                            rangeInputClass={rangeInputClass}
                            onChange={postProcessRgbShift => onTemperaTuningChange?.({ postProcessRgbShift })}
                            onPointerDown={onSliderPointerDown}
                            onPointerUp={onSliderCommit}
                        />
                        <TemperaRangeControl
                            label={t('options.temperaPostProcessVignette') || '暗角'}
                            value={temperaTuning.postProcessVignette}
                            min={0}
                            max={2}
                            step={0.05}
                            rangeInputClass={rangeInputClass}
                            onChange={postProcessVignette => onTemperaTuningChange?.({ postProcessVignette })}
                            onPointerDown={onSliderPointerDown}
                            onPointerUp={onSliderCommit}
                        />
                        <TemperaRangeControl
                            label={t('options.temperaPostProcessLensDistortion') || '透镜扭曲'}
                            value={temperaTuning.postProcessLensDistortion}
                            min={0}
                            max={2}
                            step={0.05}
                            rangeInputClass={rangeInputClass}
                            onChange={postProcessLensDistortion => onTemperaTuningChange?.({ postProcessLensDistortion })}
                            onPointerDown={onSliderPointerDown}
                            onPointerUp={onSliderCommit}
                        />
                    </>
                )}
            </TemperaSettingsSection>

            <TemperaSettingsSection title={t('options.temperaLyricSection') || '歌词分镜'}>
                <VisualizerPresetGroup
                    label={t('options.temperaWholeLineLyrics') || '整句显示歌词'}
                    value={temperaTuning.wholeLineLyrics}
                    options={booleanOptions}
                    onChange={wholeLineLyrics => onTemperaTuningChange?.({ wholeLineLyrics })}
                    isDaylight={isDaylight}
                    theme={theme}
                />
                <p className="text-xs leading-relaxed opacity-55" style={{ color: 'var(--text-secondary)' }}>
                    {t('options.temperaWholeLineLyricsHint')
                        || '关闭时一句歌词按 2~4 词切成多个分镜，字号可以放得很大；开启后整句留在同一个分镜里，长句会自动缩小字号。'}
                </p>
            </TemperaSettingsSection>

            <TemperaSettingsSection title={t('options.temperaDisplaySection')}>
                <div className="grid gap-4 sm:grid-cols-2">
                    {visibilityControls.map(control => (
                        <VisualizerPresetGroup
                            key={control.key}
                            label={control.label}
                            value={temperaTuning[control.key]}
                            options={booleanOptions}
                            onChange={(next) => onTemperaTuningChange?.({ [control.key]: next })}
                            isDaylight={isDaylight}
                            theme={theme}
                        />
                    ))}
                </div>
            </TemperaSettingsSection>
        </div>
    );
};

export default TemperaSettingsPanel;
