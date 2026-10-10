import { create } from 'zustand';
import {
    DEFAULT_PERSONAL_FM_SELECTION,
    normalizePersonalFmSelection,
    toPersonalFmRequestOptions,
    type PersonalFmSelection,
} from '../services/onlineMusic/fmModes';
import type { PersonalFmRequestOptions } from '../types/onlineMusic';

// src/stores/usePersonalFmModeStore.ts
// The one place that holds the current Personal FM mode. The NetEase provider reads it straight
// from here, so every existing `omni.getPersonalFm()` caller — the home card, the radio grid and
// the queue's near-end refill — stays on the selected mode without threading a parameter through.

const STORAGE_KEY = 'folia.personalFm.selection';

const readStoredSelection = (): PersonalFmSelection => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? normalizePersonalFmSelection(JSON.parse(raw)) : DEFAULT_PERSONAL_FM_SELECTION;
    } catch (error) {
        void error;
        return DEFAULT_PERSONAL_FM_SELECTION;
    }
};

const writeStoredSelection = (selection: PersonalFmSelection) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
    } catch (error) {
        void error;
    }
};

type PersonalFmModeState = {
    selection: PersonalFmSelection;
    setSelection: (selection: PersonalFmSelection) => PersonalFmSelection;
};

export const usePersonalFmModeStore = create<PersonalFmModeState>((set) => ({
    selection: readStoredSelection(),
    setSelection: (selection) => {
        const normalized = normalizePersonalFmSelection(selection);
        set({ selection: normalized });
        writeStoredSelection(normalized);
        return normalized;
    },
}));

export const getPersonalFmSelection = (): PersonalFmSelection => usePersonalFmModeStore.getState().selection;

export const getPersonalFmRequestOptions = (): PersonalFmRequestOptions => (
    toPersonalFmRequestOptions(getPersonalFmSelection())
);
