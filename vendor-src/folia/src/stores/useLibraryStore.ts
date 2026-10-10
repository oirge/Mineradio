import { create } from 'zustand';
import type React from 'react';
import { isNavidromeEnabled } from '../services/navidromeService';

// src/stores/useLibraryStore.ts
// Library-side state: whether Navidrome is on, which of its songs are starred, and the in-flight
// flag for syncing the online provider. (The provider-switch confirmation lives in the account
// controller since Library v2 · A4.)
//
// `navidromeEnabled` had two independent owners before this — App.tsx and SettingsModal each kept
// their own useState and re-read isNavidromeEnabled() to stay in step. One flag, two copies, kept
// in sync by hand is exactly the shape that drifts; there is one now.

type LibraryState = {
    navidromeEnabled: boolean;
    starredNavidromeSongIds: Set<string>;
    isProviderSyncing: boolean;

    setNavidromeEnabledState: React.Dispatch<React.SetStateAction<boolean>>;
    setStarredNavidromeSongIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    setIsProviderSyncing: React.Dispatch<React.SetStateAction<boolean>>;
};

const resolveNext = <T,>(next: React.SetStateAction<T>, previous: T): T => (
    typeof next === 'function' ? (next as (prev: T) => T)(previous) : next
);

export const useLibraryStore = create<LibraryState>((set, get) => ({
    navidromeEnabled: isNavidromeEnabled(),
    starredNavidromeSongIds: new Set(),
    isProviderSyncing: false,

    setNavidromeEnabledState: (next) => set({ navidromeEnabled: resolveNext(next, get().navidromeEnabled) }),
    setStarredNavidromeSongIds: (next) => set({ starredNavidromeSongIds: resolveNext(next, get().starredNavidromeSongIds) }),
    setIsProviderSyncing: (next) => set({ isProviderSyncing: resolveNext(next, get().isProviderSyncing) }),
}));

/** Stable module-level setters, for callers that should not have to be handed one. */
export const setNavidromeEnabledState: React.Dispatch<React.SetStateAction<boolean>> = (next) => (
    useLibraryStore.getState().setNavidromeEnabledState(next)
);
export const setStarredNavidromeSongIds: React.Dispatch<React.SetStateAction<Set<string>>> = (next) => (
    useLibraryStore.getState().setStarredNavidromeSongIds(next)
);
