import type { CommandPaletteSurface } from './types';
import { settingsCardClassFor, settingsDividerClassFor, settingsToggleOffClassFor } from '../../modal/settings/settingsCardClasses';

// Declares the inline motion-reduction editor. The section reads useMotionSettingsStore itself,
// so only the panel dressing has to be mapped across.

export const reduceMotionSurface: CommandPaletteSurface = {
    // Turning a surface's motion back on is judged by watching it move, and most of what these
    // toggles govern is drawn behind the palette; a blurred backdrop hides the very thing.
    backdrop: 'clear',
    load: () => import('./ReduceMotionSurfaceView'),
    mapProps: ({ isDaylight, theme }) => ({
        settingsCardClass: settingsCardClassFor(isDaylight),
        settingsDividerClass: settingsDividerClassFor(isDaylight),
        toggleOffBackgroundClass: settingsToggleOffClassFor(isDaylight),
        theme,
    }),
};
