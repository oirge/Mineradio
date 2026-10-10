import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useGridSurfaceStore } from '../../../src/stores/useGridSurfaceStore';
import type { GridSurfaceHandle, GridSurfaceState } from '../../../src/types/gridCommandSurface';

// test/unit/stores/gridSurfaceRegistration.test.ts
// 同 commandFilterRegistration：网格装卸顺序不保证，所有权交接必须自己成立。

const state = (): GridSurfaceState => ({
    availableActions: [],
    filteredTrackCount: 0,
    isFilterActive: false,
    sortField: 'fileName',
    sortDirection: 'asc',
    isInfoPanelOpen: false,
    isTrackListOpen: false,
    isEditMode: false,
});

const handle = (): GridSurfaceHandle => ({ getState: state, run: vi.fn() });

describe('grid surface registration', () => {
    beforeEach(() => {
        useGridSurfaceStore.setState({ gridSurface: null });
    });

    it('hands ownership to the latest registrant', () => {
        const first = handle();
        const second = handle();

        useGridSurfaceStore.getState().registerGridSurface(first);
        useGridSurfaceStore.getState().registerGridSurface(second);

        expect(useGridSurfaceStore.getState().gridSurface).toBe(second);
    });

    it('ignores a teardown from an owner that has already been replaced', () => {
        const outgoing = handle();
        const incoming = handle();

        const releaseOutgoing = useGridSurfaceStore.getState().registerGridSurface(outgoing);
        useGridSurfaceStore.getState().registerGridSurface(incoming);
        releaseOutgoing();

        expect(useGridSurfaceStore.getState().gridSurface).toBe(incoming);
    });

    it('clears the slot when the only owner goes away', () => {
        const release = useGridSurfaceStore.getState().registerGridSurface(handle());

        release();

        expect(useGridSurfaceStore.getState().gridSurface).toBeNull();
    });
});
