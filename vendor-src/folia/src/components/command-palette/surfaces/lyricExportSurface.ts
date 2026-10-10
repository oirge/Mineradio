import type { CommandPaletteSurface } from './types';
import { settingsCardClassFor, settingsToggleOffClassFor } from '../../modal/settings/settingsCardClasses';

// src/components/command-palette/surfaces/lyricExportSurface.ts
// Declares the batch lyric export panel. The view owns the run (options, progress, cancellation),
// so only the panel dressing is mapped across. Closing the palette unmounts the view and cancels.

export const lyricExportSurface: CommandPaletteSurface = {
    load: () => import('./LyricExportSurfaceView'),
    mapProps: ({ isDaylight, theme }) => ({
        isDaylight,
        settingsCardClass: settingsCardClassFor(isDaylight),
        toggleOffBackgroundClass: settingsToggleOffClassFor(isDaylight),
        theme,
    }),
};
