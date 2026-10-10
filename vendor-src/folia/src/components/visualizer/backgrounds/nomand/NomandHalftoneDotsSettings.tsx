import React from 'react';
import BackgroundToggleRow from '../BackgroundToggleRow';
import { getNomandEffectPanelColors, SliderRow, type NomandBackgroundEffectPanelProps, percent } from './NomandBackgroundEffectPanel';

// src/components/visualizer/backgrounds/nomand/NomandHalftoneDotsSettings.tsx
// Renders the compact Halftone Dots tuning panel.

const NomandHalftoneDotsSettings: React.FC<NomandBackgroundEffectPanelProps> = ({
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
                {t('options.nomandBackgroundEffectHalftoneDots')}
            </div>
            <SliderRow
                {...sliderProps}
                label={t('options.nomandBackgroundHalftoneDotsSize')}
                value={tuning.halftoneDotsSize}
                min={0.1}
                max={1}
                step={0.05}
                onChange={halftoneDotsSize => onTuningChange?.({ halftoneDotsSize })}
            />
            <SliderRow
                {...sliderProps}
                label={t('options.nomandBackgroundHalftoneDotsRadius')}
                value={tuning.halftoneDotsRadius}
                min={0.1}
                max={2}
                step={0.05}
                onChange={halftoneDotsRadius => onTuningChange?.({ halftoneDotsRadius })}
            />
            <SliderRow
                {...sliderProps}
                label={t('options.nomandBackgroundHalftoneDotsContrast')}
                value={tuning.halftoneDotsContrast}
                min={0}
                max={1}
                step={0.05}
                format={percent}
                onChange={halftoneDotsContrast => onTuningChange?.({ halftoneDotsContrast })}
            />
            <BackgroundToggleRow
                label={t('options.nomandBackgroundOriginalColors')}
                checked={tuning.halftoneDotsOriginalColors}
                onChange={halftoneDotsOriginalColors => onTuningChange?.({ halftoneDotsOriginalColors })}
                theme={theme}
            />
            <BackgroundToggleRow
                label={t('options.nomandBackgroundInverted')}
                checked={tuning.halftoneDotsInverted}
                onChange={halftoneDotsInverted => onTuningChange?.({ halftoneDotsInverted })}
                theme={theme}
            />
        </div>
    );
};

export default NomandHalftoneDotsSettings;
