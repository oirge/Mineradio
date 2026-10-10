import React from 'react';
import {
    DIORAMA_PARTICLE_DENSITY_MAX,
    DIORAMA_PARTICLE_DENSITY_MIN,
    DIORAMA_PARTICLE_DENSITY_STEP,
    DIORAMA_PARTICLE_GLOW_INTENSITY_MAX,
    DIORAMA_PARTICLE_GLOW_INTENSITY_MIN,
    DIORAMA_PARTICLE_GLOW_INTENSITY_STEP,
    DIORAMA_PARTICLE_SIZE_MAX,
    DIORAMA_PARTICLE_SIZE_MIN,
    DIORAMA_PARTICLE_SIZE_STEP,
    type Theme,
} from '../../../types';
import { colorWithAlpha } from '../colorMix';
import { DioramaSettingsToggle } from './DioramaSettingsToggle';

// src/components/visualizer/diorama/DioramaParticleAppearanceSettings.tsx
// Density, whole-cluster scale and one-aura-per-cloud controls inside the geometry group.
interface DioramaParticleAppearanceSettingsProps {
    t: (key: string) => string;
    theme: Theme;
    isDaylight: boolean;
    enabled: boolean;
    density: number;
    onDensityChange: (next: number) => void;
    particleScale: number;
    onParticleScaleChange: (next: number) => void;
    glowEnabled: boolean;
    onGlowEnabledChange: (next: boolean) => void;
    glowIntensity: number;
    onGlowIntensityChange: (next: number) => void;
    rangeInputClass: string;
    onSliderPointerDown?: () => void;
    onSliderCommit?: () => void;
}

interface RangeSettingProps {
    label: string;
    displayValue: string;
    value: number;
    min: number;
    max: number;
    step: number;
    disabled: boolean;
    rangeInputClass: string;
    onChange: (next: number) => void;
    onSliderPointerDown?: () => void;
    onSliderCommit?: () => void;
}

const RangeSetting: React.FC<RangeSettingProps> = ({
    label,
    displayValue,
    value,
    min,
    max,
    step,
    disabled,
    rangeInputClass,
    onChange,
    onSliderPointerDown,
    onSliderCommit,
}) => (
    <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0" style={{ color: 'var(--text-primary)' }}>{label}</div>
            <span className="shrink-0 font-mono opacity-70" style={{ color: 'var(--text-secondary)' }}>
                {displayValue}
            </span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            aria-label={label}
            onChange={(event) => onChange(parseFloat(event.target.value))}
            onPointerDown={onSliderPointerDown}
            onPointerUp={onSliderCommit}
            className={`${rangeInputClass} disabled:cursor-not-allowed disabled:opacity-35`}
        />
    </div>
);

export const DioramaParticleAppearanceSettings: React.FC<DioramaParticleAppearanceSettingsProps> = (props) => {
    const cardStyle = {
        opacity: props.enabled ? 1 : 0.52,
        backgroundColor: colorWithAlpha(props.theme.backgroundColor, props.isDaylight ? 0.16 : 0.26),
    };
    const sharedRangeProps = {
        disabled: !props.enabled,
        rangeInputClass: props.rangeInputClass,
        onSliderPointerDown: props.onSliderPointerDown,
        onSliderCommit: props.onSliderCommit,
    };

    return (
        <>
            <div className="rounded-xl px-3 py-2.5 transition-opacity" style={cardStyle}>
                <RangeSetting
                    {...sharedRangeProps}
                    label={props.t('options.dioramaParticleDensity')}
                    displayValue={String(Math.round(props.density))}
                    value={props.density}
                    min={DIORAMA_PARTICLE_DENSITY_MIN}
                    max={DIORAMA_PARTICLE_DENSITY_MAX}
                    step={DIORAMA_PARTICLE_DENSITY_STEP}
                    onChange={props.onDensityChange}
                />
            </div>
            <div className="rounded-xl px-3 py-2.5 transition-opacity" style={cardStyle}>
                <RangeSetting
                    {...sharedRangeProps}
                    label={props.t('options.dioramaParticleScale')}
                    displayValue={`${props.particleScale.toFixed(2)}x`}
                    value={props.particleScale}
                    min={DIORAMA_PARTICLE_SIZE_MIN}
                    max={DIORAMA_PARTICLE_SIZE_MAX}
                    step={DIORAMA_PARTICLE_SIZE_STEP}
                    onChange={props.onParticleScaleChange}
                />
            </div>
            <div className="space-y-2.5 rounded-xl px-3 py-2.5 transition-opacity" style={cardStyle}>
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                            {props.t('options.dioramaParticleGlow')}
                        </div>
                    </div>
                    <DioramaSettingsToggle
                        checked={props.glowEnabled}
                        disabled={!props.enabled}
                        label={props.t('options.dioramaParticleGlow')}
                        onChange={props.onGlowEnabledChange}
                        theme={props.theme}
                        isDaylight={props.isDaylight}
                    />
                </div>
                {props.glowEnabled && (
                    <RangeSetting
                        {...sharedRangeProps}
                        label={props.t('options.dioramaParticleGlowIntensity')}
                        displayValue={`${Math.round(props.glowIntensity * 100)}%`}
                        value={props.glowIntensity}
                        min={DIORAMA_PARTICLE_GLOW_INTENSITY_MIN}
                        max={DIORAMA_PARTICLE_GLOW_INTENSITY_MAX}
                        step={DIORAMA_PARTICLE_GLOW_INTENSITY_STEP}
                        onChange={props.onGlowIntensityChange}
                    />
                )}
            </div>
        </>
    );
};
