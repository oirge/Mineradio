import React from 'react';
import { getNomandEffectPanelColors, SliderRow, type NomandBackgroundEffectPanelProps, percent } from './NomandBackgroundEffectPanel';

// src/components/visualizer/backgrounds/nomand/NomandLensDistortionSettings.tsx
// Renders the compact Lens Distortion tuning panel.

const NomandLensDistortionSettings: React.FC<NomandBackgroundEffectPanelProps> = ({
    t,
    isDaylight,
    theme,
    rangeInputClass,
    tuning,
    onTuningChange,
    onSliderPointerDown,
    onSliderCommit,
}) => {
    const { borderColor } = getNomandEffectPanelColors(theme, isDaylight);
    const sliderProps = {
        rangeInputClass,
        theme,
        onPointerDown: onSliderPointerDown,
        onPointerUp: onSliderCommit,
    };

    return (
        <div className="space-y-4 rounded-2xl border p-3" style={{ borderColor }}>
            <div className="text-xs font-medium uppercase tracking-[0.2em]" style={{ color: theme.secondaryColor }}>
                {t('options.nomandBackgroundEffectLensDistortion')}
            </div>
            <SliderRow
                {...sliderProps}
                label={t('options.nomandBackgroundLensDistortionSpread')}
                value={tuning.lensDistortionSpread}
                min={0}
                max={1}
                step={0.05}
                format={percent}
                onChange={lensDistortionSpread => onTuningChange?.({ lensDistortionSpread })}
            />
            <SliderRow
                {...sliderProps}
                label={t('options.nomandBackgroundLensDistortionBulge')}
                value={tuning.lensDistortionBulge}
                min={-1}
                max={1}
                step={0.05}
                onChange={lensDistortionBulge => onTuningChange?.({ lensDistortionBulge })}
            />
            <SliderRow
                {...sliderProps}
                label={t('options.nomandBackgroundLensDistortionDispersion')}
                value={tuning.lensDistortionDispersion}
                min={0}
                max={1}
                step={0.05}
                format={percent}
                onChange={lensDistortionDispersion => onTuningChange?.({ lensDistortionDispersion })}
            />
        </div>
    );
};

export default NomandLensDistortionSettings;
