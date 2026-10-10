import { useMemo } from 'react';
import { usePlaybackStore } from '../../../stores/usePlaybackStore';
import { useLibraryStore } from '../../../stores/useLibraryStore';
import { buildHomeModel, type HomeModelDeps, type HomeViewModel } from './buildHomeModel';

// src/components/app/home/useHomeModel.ts

/**
 * The Home model with the three ambient values already filled in. All three are store reads that
 * App.tsx used to perform only to hand them back here.
 */
export const useHomeModel = (deps: HomeModelDeps): HomeViewModel => {
    const currentSong = usePlaybackStore(state => state.currentSong);
    const activePlaybackContext = usePlaybackStore(state => state.activePlaybackContext);
    const navidromeEnabled = useLibraryStore(state => state.navidromeEnabled);

    return useMemo(() => buildHomeModel({
        ...deps,
        currentSong,
        activePlaybackContext,
        navidromeEnabled,
        // Spread rather than `deps`: the caller passes an object literal, so depending on the object
        // would rebuild this every render. The key set is fixed by the call site.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [...Object.values(deps), currentSong, activePlaybackContext, navidromeEnabled]);
};
