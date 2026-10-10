import type { CommandPaletteSurface } from './types';

// src/components/command-palette/surfaces/volumeSurface.ts
// Declares the volume command's inline slider: a numeric input plus a panel body that previews
// while dragging and commits on release.

export const volumeSurface: CommandPaletteSurface = {
    load: () => import('./VolumeSurfaceView'),
    // The slider mirrors the raw input character by character, so it cannot wait for the
    // match debounce.
    useLiveQuery: true,
    inputProps: () => ({ type: 'number', inputMode: 'decimal', min: 0, max: 100, step: 1 }),
    mapProps: ({ context, query, isDaylight, theme, setQuery }) => ({
        isDaylight,
        isMuted: context.playback.isMuted,
        query,
        theme,
        volume: context.playback.volume,
        onQueryChange: setQuery,
        onVolumeChange: context.playback.setVolume,
        onVolumePreview: context.playback.previewVolume,
    }),
};
