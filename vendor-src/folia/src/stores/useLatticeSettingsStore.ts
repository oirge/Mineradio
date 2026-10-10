import { create } from 'zustand';
import { getStoredBoolean, getStoredString, setStoredBoolean } from './storagePrimitives';

// src/stores/useLatticeSettingsStore.ts
// Persistent queue-collage preferences. Deliberately separate from useLatticeControlsStore: that
// store only publishes runtime actions from the currently mounted wall.

const LATTICE_VIGNETTE_KEY = 'lattice_vignette';
const LATTICE_AUTO_FOCUS_ON_SONG_CHANGE_KEY = 'lattice_auto_focus_on_song_change';
const LATTICE_LIGHTS_ON_KEY = 'lattice_lights_on';
const LATTICE_POSTER_TINT_ENABLED_KEY = 'lattice_poster_tint_enabled';
const LATTICE_POSTER_TINT_USE_CUSTOM_COLOR_KEY = 'lattice_poster_tint_use_custom_color';
const LATTICE_POSTER_TINT_COLOR_KEY = 'lattice_poster_tint_color';
const LATTICE_POSTER_TINT_INTENSITY_KEY = 'lattice_poster_tint_intensity';
const DEFAULT_POSTER_TINT_COLOR = '#161419';

const clampPosterTintIntensity = (value: number) => Math.max(0, Math.min(1, value));
const normalizePosterTintColor = (value: string) => (
    /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim().toLowerCase() : DEFAULT_POSTER_TINT_COLOR
);

const getStoredPosterTintIntensity = () => {
    const stored = Number(getStoredString(LATTICE_POSTER_TINT_INTENSITY_KEY, '0.5'));
    return Number.isFinite(stored) ? clampPosterTintIntensity(stored) : 0.5;
};

export type LatticeSettingsState = {
    latticeVignette: boolean;
    autoFocusOnSongChange: boolean;
    latticeLightsOn: boolean;
    latticePosterTintEnabled: boolean;
    latticePosterTintUseCustomColor: boolean;
    latticePosterTintColor: string;
    latticePosterTintIntensity: number;
    handleToggleLatticeVignette: (enabled: boolean) => void;
    handleToggleAutoFocusOnSongChange: (enabled: boolean) => void;
    handleToggleLatticeLights: (enabled: boolean) => void;
    handleToggleLatticePosterTint: (enabled: boolean) => void;
    handleToggleLatticePosterTintCustomColor: (enabled: boolean) => void;
    handleSetLatticePosterTintColor: (color: string) => void;
    handleSetLatticePosterTintIntensity: (intensity: number) => void;
};

export const useLatticeSettingsStore = create<LatticeSettingsState>(set => ({
    latticeVignette: getStoredBoolean(LATTICE_VIGNETTE_KEY, true),
    autoFocusOnSongChange: getStoredBoolean(LATTICE_AUTO_FOCUS_ON_SONG_CHANGE_KEY, true),
    latticeLightsOn: getStoredBoolean(LATTICE_LIGHTS_ON_KEY, true),
    latticePosterTintEnabled: getStoredBoolean(LATTICE_POSTER_TINT_ENABLED_KEY, true),
    latticePosterTintUseCustomColor: getStoredBoolean(LATTICE_POSTER_TINT_USE_CUSTOM_COLOR_KEY, false),
    latticePosterTintColor: normalizePosterTintColor(getStoredString(LATTICE_POSTER_TINT_COLOR_KEY, DEFAULT_POSTER_TINT_COLOR)),
    latticePosterTintIntensity: getStoredPosterTintIntensity(),
    handleToggleLatticeVignette: (enabled) => {
        set({ latticeVignette: enabled });
        setStoredBoolean(LATTICE_VIGNETTE_KEY, enabled);
    },
    handleToggleAutoFocusOnSongChange: (enabled) => {
        set({ autoFocusOnSongChange: enabled });
        setStoredBoolean(LATTICE_AUTO_FOCUS_ON_SONG_CHANGE_KEY, enabled);
    },
    handleToggleLatticeLights: (enabled) => {
        set({ latticeLightsOn: enabled });
        setStoredBoolean(LATTICE_LIGHTS_ON_KEY, enabled);
    },
    handleToggleLatticePosterTint: (enabled) => {
        set({ latticePosterTintEnabled: enabled });
        setStoredBoolean(LATTICE_POSTER_TINT_ENABLED_KEY, enabled);
    },
    handleToggleLatticePosterTintCustomColor: (enabled) => {
        set({ latticePosterTintUseCustomColor: enabled });
        setStoredBoolean(LATTICE_POSTER_TINT_USE_CUSTOM_COLOR_KEY, enabled);
    },
    handleSetLatticePosterTintColor: (color) => {
        const normalized = normalizePosterTintColor(color);
        set({ latticePosterTintColor: normalized });
        if (typeof window !== 'undefined') localStorage.setItem(LATTICE_POSTER_TINT_COLOR_KEY, normalized);
    },
    handleSetLatticePosterTintIntensity: (intensity) => {
        const normalized = clampPosterTintIntensity(intensity);
        set({ latticePosterTintIntensity: normalized });
        if (typeof window !== 'undefined') localStorage.setItem(LATTICE_POSTER_TINT_INTENSITY_KEY, String(normalized));
    },
}));
