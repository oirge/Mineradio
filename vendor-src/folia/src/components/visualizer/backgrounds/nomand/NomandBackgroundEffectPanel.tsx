import React from 'react';
import type { NomandBackgroundTuning, Theme } from '../../../../types';
import { colorWithAlpha } from '../../colorMix';

// src/components/visualizer/backgrounds/nomand/NomandBackgroundEffectPanel.tsx
// Shares the panel contract and slider presentation used by each Nomand effect variant.

export interface NomandBackgroundEffectPanelProps {
    t: (key: string) => string;
    isDaylight: boolean;
    theme: Theme;
    rangeInputClass: string;
    tuning: NomandBackgroundTuning;
    onTuningChange?: (patch: Partial<NomandBackgroundTuning>) => void;
    onSliderPointerDown?: () => void;
    onSliderCommit?: () => void;
}

interface SliderRowProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    rangeInputClass: string;
    theme: Theme;
    onChange: (value: number) => void;
    onPointerDown?: () => void;
    onPointerUp?: () => void;
    format?: (value: number) => string;
}

const valueToDisplay = (value: number) => value.toFixed(2);

export const percent = (value: number) => `${Math.round(value * 100)}%`;

export const getNomandEffectPanelColors = (theme: Theme, isDaylight: boolean) => ({
    borderColor: colorWithAlpha(theme.secondaryColor, isDaylight ? 0.18 : 0.16),
    selectedBg: colorWithAlpha(theme.accentColor, isDaylight ? 0.1 : 0.16),
});

export const SliderRow: React.FC<SliderRowProps> = ({
    label,
    value,
    min,
    max,
    step,
    rangeInputClass,
    theme,
    onChange,
    onPointerDown,
    onPointerUp,
    format = valueToDisplay,
}) => (
    <label className="block space-y-2">
        <span className="flex justify-between gap-3 text-sm" style={{ color: theme.primaryColor }}>
            <span>{label}</span>
            <span className="font-mono opacity-70">{format(value)}</span>
        </span>
        <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={event => onChange(Number(event.target.value))}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={rangeInputClass}
        />
    </label>
);
