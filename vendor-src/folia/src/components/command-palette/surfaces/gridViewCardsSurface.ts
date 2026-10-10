import type { CommandPaletteSurface } from './types';
import { settingsCardClassFor, settingsDividerClassFor, settingsToggleOffClassFor } from '../../modal/settings/settingsCardClasses';

// Declares the inline grid-card appearance editor. The section reads useGridViewSettingsStore
// itself, so only the panel dressing has to be mapped across.

export const gridViewCardsSurface: CommandPaletteSurface = {
    // Everything these controls change is drawn behind the palette; a blurred backdrop hides it.
    backdrop: 'clear',
    load: () => import('./GridViewCardsSurfaceView'),
    mapProps: ({ isDaylight, theme }) => ({
        settingsCardClass: settingsCardClassFor(isDaylight),
        settingsDividerClass: settingsDividerClassFor(isDaylight),
        toggleOffBackgroundClass: settingsToggleOffClassFor(isDaylight),
        theme,
    }),
};
