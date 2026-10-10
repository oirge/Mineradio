import { create } from 'zustand';
import type { GridSurfaceHandle } from '../types/gridCommandSurface';

// src/stores/useGridSurfaceStore.ts
// Which track grid the command palette can currently act on.
//
// Deliberately separate from `commandFilter` in useAppViewStore: three surfaces register a filter
// box (GridView, GridMap, ArtistGridView) but only GridView carries sorting, panels and collection
// maintenance. Folding the actions into the filter handle would force the other two to publish a
// handle full of holes, and every command would then have to re-check what it is talking to.

type GridSurfaceState = {
    gridSurface: GridSurfaceHandle | null;
    /** Returns the unregister function. Registering replaces whoever held it. */
    registerGridSurface: (handle: GridSurfaceHandle) => () => void;
};

export const useGridSurfaceStore = create<GridSurfaceState>((set, get) => ({
    gridSurface: null,
    registerGridSurface: (handle) => {
        set({ gridSurface: handle });
        // Same rule as registerCommandFilter: grids unmount in either order during a view change,
        // so a late teardown from an owner that has already been replaced must not clear the new one.
        return () => {
            if (get().gridSurface === handle) {
                set({ gridSurface: null });
            }
        };
    },
}));

// Module-level handle for the registration hook; it is an action, so it needs no subscription.
export const registerGridSurface: GridSurfaceState['registerGridSurface'] = (handle) => (
    useGridSurfaceStore.getState().registerGridSurface(handle)
);
