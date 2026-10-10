import { create } from 'zustand';
import {
    HEX_CARD_MIN_OPACITY_BOUNDS,
    HEX_CARD_MIN_OPACITY_DEFAULT,
    HEX_CARD_MIN_SCALE_BOUNDS,
    HEX_CARD_MIN_SCALE_DEFAULT,
} from '../utils/hexCardFalloff';
import { getStoredBoolean, getStoredString, setStoredBoolean } from './storagePrimitives';

// src/stores/useGridViewSettingsStore.ts
// Persistent look of the folia hex card grid: whether a card is a polaroid frame or a full-bleed
// cover, and how far the distance falloff is allowed to shrink and fade the outer cards.
// Deliberately outside the appearance import/export payload — these are per-device browsing
// comfort knobs, not part of a shared theme.

const GRID_VIEW_FULL_BLEED_COVER_KEY = 'gridview_full_bleed_cover';
const GRID_VIEW_SQUARE_CARDS_KEY = 'gridview_square_cards';
const GRID_VIEW_MIN_CARD_SCALE_KEY = 'gridview_min_card_scale';
const GRID_VIEW_MIN_CARD_OPACITY_KEY = 'gridview_min_card_opacity';

const clampToBounds = (value: number, { min, max }: { min: number; max: number }, fallback: number) => {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(min, Math.min(max, value));
};

export const clampGridViewMinCardScale = (value: number) => (
    clampToBounds(value, HEX_CARD_MIN_SCALE_BOUNDS, HEX_CARD_MIN_SCALE_DEFAULT)
);

export const clampGridViewMinCardOpacity = (value: number) => (
    clampToBounds(value, HEX_CARD_MIN_OPACITY_BOUNDS, HEX_CARD_MIN_OPACITY_DEFAULT)
);

const getStoredNumber = (key: string, fallback: number, clamp: (value: number) => number) => {
    const stored = getStoredString(key, String(fallback));
    return clamp(Number(stored));
};

export type GridViewSettingsState = {
    gridViewFullBleedCover: boolean;
    gridViewSquareCards: boolean;
    gridViewMinCardScale: number;
    gridViewMinCardOpacity: number;
    handleToggleGridViewFullBleedCover: (enabled: boolean) => void;
    handleToggleGridViewSquareCards: (enabled: boolean) => void;
    handleSetGridViewMinCardScale: (scale: number) => void;
    handleSetGridViewMinCardOpacity: (opacity: number) => void;
    resetGridViewCardFalloff: () => void;
};

const persistNumber = (key: string, value: number) => {
    if (typeof window !== 'undefined') localStorage.setItem(key, String(value));
};

export const useGridViewSettingsStore = create<GridViewSettingsState>(set => ({
    gridViewFullBleedCover: getStoredBoolean(GRID_VIEW_FULL_BLEED_COVER_KEY, false),
    gridViewSquareCards: getStoredBoolean(GRID_VIEW_SQUARE_CARDS_KEY, false),
    gridViewMinCardScale: getStoredNumber(GRID_VIEW_MIN_CARD_SCALE_KEY, HEX_CARD_MIN_SCALE_DEFAULT, clampGridViewMinCardScale),
    gridViewMinCardOpacity: getStoredNumber(GRID_VIEW_MIN_CARD_OPACITY_KEY, HEX_CARD_MIN_OPACITY_DEFAULT, clampGridViewMinCardOpacity),
    handleToggleGridViewFullBleedCover: (enabled) => {
        set({ gridViewFullBleedCover: enabled });
        setStoredBoolean(GRID_VIEW_FULL_BLEED_COVER_KEY, enabled);
    },
    handleToggleGridViewSquareCards: (enabled) => {
        set({ gridViewSquareCards: enabled });
        setStoredBoolean(GRID_VIEW_SQUARE_CARDS_KEY, enabled);
    },
    handleSetGridViewMinCardScale: (scale) => {
        const normalized = clampGridViewMinCardScale(scale);
        set({ gridViewMinCardScale: normalized });
        persistNumber(GRID_VIEW_MIN_CARD_SCALE_KEY, normalized);
    },
    handleSetGridViewMinCardOpacity: (opacity) => {
        const normalized = clampGridViewMinCardOpacity(opacity);
        set({ gridViewMinCardOpacity: normalized });
        persistNumber(GRID_VIEW_MIN_CARD_OPACITY_KEY, normalized);
    },
    resetGridViewCardFalloff: () => {
        set({
            gridViewMinCardScale: HEX_CARD_MIN_SCALE_DEFAULT,
            gridViewMinCardOpacity: HEX_CARD_MIN_OPACITY_DEFAULT,
        });
        persistNumber(GRID_VIEW_MIN_CARD_SCALE_KEY, HEX_CARD_MIN_SCALE_DEFAULT);
        persistNumber(GRID_VIEW_MIN_CARD_OPACITY_KEY, HEX_CARD_MIN_OPACITY_DEFAULT);
    },
}));

/** The falloff pair the grid surfaces read together on every frame budget recompute. */
export const selectGridViewCardFalloff = (state: GridViewSettingsState) => ({
    minScale: state.gridViewMinCardScale,
    minOpacity: state.gridViewMinCardOpacity,
});
