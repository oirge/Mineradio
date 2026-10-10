import React from 'react';
import { colorWithAlpha } from './colorMix';
import { type VisualizerSettingsPanelProps } from './definition';

// src/components/visualizer/VisualizerPresetGroup.tsx
// Renders theme-aware pill controls shared by visualizer tuning panels.
export interface VisualizerPresetOption<T> {
    label: string;
    value: T;
}

interface VisualizerPresetGroupProps<T> {
    label: string;
    value: T;
    options: VisualizerPresetOption<T>[];
    onChange: (next: T) => void;
    isDaylight: boolean;
    theme: VisualizerSettingsPanelProps['theme'];
}

const VisualizerPresetGroup = <T,>({
    label,
    value,
    options,
    onChange,
    isDaylight,
    theme,
}: VisualizerPresetGroupProps<T>) => (
    <div className="space-y-2.5">
        <div className="text-xs font-medium uppercase tracking-[0.24em] opacity-45" style={{ color: theme.secondaryColor }}>
            {label}
        </div>
        <div className="flex flex-wrap gap-2">
            {options.map(option => {
                const isActive = option.value === value;

                return (
                    <button
                        key={String(option.value)}
                        type="button"
                        onClick={() => onChange(option.value)}
                        className="px-3 py-2 rounded-full text-sm transition-all border"
                        style={{
                            color: theme.primaryColor,
                            borderColor: isActive ? theme.accentColor : colorWithAlpha(theme.secondaryColor, isDaylight ? 0.18 : 0.14),
                            backgroundColor: isActive
                                ? colorWithAlpha(theme.accentColor, isDaylight ? 0.1 : 0.16)
                                : colorWithAlpha(theme.backgroundColor, isDaylight ? 0.24 : 0.34),
                            boxShadow: isActive ? `inset 0 0 0 1px ${theme.accentColor}` : 'none',
                        }}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    </div>
);

export default VisualizerPresetGroup;
