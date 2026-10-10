import type { CommandPaletteSurface } from './types';

// Declares the inline Lattice poster-tint editor used by the settings command.

export const latticePosterTintSurface: CommandPaletteSurface = {
    // Everything these controls change is drawn behind the palette; a blurred backdrop hides it.
    backdrop: 'clear',
    load: () => import('./LatticePosterTintSurfaceView'),
    mapProps: ({ context, isDaylight, theme }) => ({
        enabled: context.settings.latticePosterTintEnabled,
        useCustomColor: context.settings.latticePosterTintUseCustomColor,
        color: context.settings.latticePosterTintColor,
        intensity: context.settings.latticePosterTintIntensity,
        isDaylight,
        theme,
        onEnabledChange: context.settings.setLatticePosterTintEnabled,
        onUseCustomColorChange: context.settings.setLatticePosterTintUseCustomColor,
        onColorChange: context.settings.setLatticePosterTintColor,
        onIntensityChange: context.settings.setLatticePosterTintIntensity,
    }),
};
