import React from 'react';
import { getNomandEffectPanelColors, SliderRow, type NomandBackgroundEffectPanelProps, percent } from './NomandBackgroundEffectPanel';

// src/components/visualizer/backgrounds/nomand/NomandFlutedGlassSettings.tsx
// Renders the compact Fluted Glass tuning panel.

const NomandFlutedGlassSettings: React.FC<NomandBackgroundEffectPanelProps> = ({
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
                {t('options.nomandBackgroundEffectFlutedGlass')}
            </div>
            <SliderRow
                {...sliderProps}
                label={t('options.nomandBackgroundFlutedGlassSize')}
                value={tuning.flutedGlassSize}
                min={0.1}
                max={1}
                step={0.05}
                onChange={flutedGlassSize => onTuningChange?.({ flutedGlassSize })}
            />
            <SliderRow
                {...sliderProps}
                label={t('options.nomandBackgroundFlutedGlassDistortion')}
                value={tuning.flutedGlassDistortion}
                min={0}
                max={1}
                step={0.05}
                format={percent}
                onChange={flutedGlassDistortion => onTuningChange?.({ flutedGlassDistortion })}
            />
            <SliderRow
                {...sliderProps}
                label={t('options.nomandBackgroundFlutedGlassBlur')}
                value={tuning.flutedGlassBlur}
                min={0}
                max={1}
                step={0.05}
                format={percent}
                onChange={flutedGlassBlur => onTuningChange?.({ flutedGlassBlur })}
            />
        </div>
    );
};

export default NomandFlutedGlassSettings;
