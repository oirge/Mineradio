import { useEffect, useRef } from 'react';
import { registerGridSurface } from '../stores/useGridSurfaceStore';
import type { GridSurfaceHandle, GridSurfaceState } from '../types/gridCommandSurface';

// src/hooks/useGridSurfaceRegistration.ts
// Publishes the on-screen track grid's actions to the command palette.
//
// Shaped exactly like useGridCommandFilter, and for the same reason: the palette must reach the
// live render's state and callbacks, not the ones captured when the effect last ran.

type UseGridSurfaceRegistrationParams = {
    /** Only the grid the listener is actually looking at should publish its actions. */
    isInteractive: boolean;
    getState: () => GridSurfaceState;
    run: GridSurfaceHandle['run'];
};

export const useGridSurfaceRegistration = ({ isInteractive, getState, run }: UseGridSurfaceRegistrationParams) => {
    // Assigned during render, not in an effect: an effect leaves a window in which the palette
    // would read the previous render's state or call the previous render's action.
    const latestRef = useRef({ getState, run });
    latestRef.current = { getState, run };

    useEffect(() => {
        if (!isInteractive) {
            return;
        }

        return registerGridSurface({
            getState: () => latestRef.current.getState(),
            run: (action) => latestRef.current.run(action),
        });
    }, [isInteractive]);
};
