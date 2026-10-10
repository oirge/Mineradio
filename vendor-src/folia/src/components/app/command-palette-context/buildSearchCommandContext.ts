import type { CommandPaletteContext } from '../../command-palette/types';
import { useSearchNavigationStore } from '../../../stores/useSearchNavigationStore';

// src/components/app/command-palette-context/buildSearchCommandContext.ts
// The `search` namespace. The search executor already lives in useSearchNavigationStore; the
// library snapshot is not store state (it is what submitSearch takes as its deps), so it and the
// navigation callback are still given by App.tsx.

export type SearchCommandContextDeps = {
    currentSearchSourceTab: CommandPaletteContext['search']['currentSearchSourceTab'];
    localSongs: CommandPaletteContext['search']['localSongs'];
    localLibraryCatalog: CommandPaletteContext['search']['localLibraryCatalog'];
    navigateToSearch: CommandPaletteContext['search']['navigateToSearch'];
};

export const buildSearchCommandContext = (
    deps: SearchCommandContextDeps,
): CommandPaletteContext['search'] => ({
    currentSearchSourceTab: deps.currentSearchSourceTab,
    localSongs: deps.localSongs,
    localLibraryCatalog: deps.localLibraryCatalog,
    navigateToSearch: deps.navigateToSearch,
    submitSearch: useSearchNavigationStore.getState().submitSearch,
});
