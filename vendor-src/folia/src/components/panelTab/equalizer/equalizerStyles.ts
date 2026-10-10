import type { Theme } from '../../../types';
import { mixColors } from '../../visualizer/colorMix';

// src/components/panelTab/equalizer/equalizerStyles.ts
// Resolves the shared daylight/dark class names used across the audio effect dialog sections.

export type EqualizerStyles = {
    accentColor: string;
    selectedAccentColor: string;
    inactiveText: string;
    trackClass: string;
    surfaceClass: string;
    buttonClass: string;
    valueTextClass: string;
    isDaylight: boolean;
};

export const buildEqualizerStyles = (isDaylight: boolean, theme: Theme): EqualizerStyles => ({
    accentColor: theme.accentColor,
    selectedAccentColor: isDaylight ? mixColors(theme.accentColor, '#18181b', 0.52) : theme.accentColor,
    inactiveText: isDaylight ? 'text-zinc-600' : 'text-white/45',
    trackClass: isDaylight ? 'bg-zinc-300' : 'bg-white/10',
    surfaceClass: isDaylight
        ? 'border-zinc-300 bg-zinc-100/90 text-zinc-800'
        : 'border-white/10 bg-white/[0.05]',
    buttonClass: isDaylight
        ? 'border-zinc-300 bg-zinc-100/90 text-zinc-700 hover:border-zinc-400 hover:bg-zinc-200'
        : 'border-white/10 bg-white/[0.05] hover:bg-white/[0.1]',
    valueTextClass: isDaylight ? 'text-zinc-700' : 'text-white',
    isDaylight,
});
