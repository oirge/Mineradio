import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// src/mineradio/local/useLocalLatticeSettingsStore.ts
// Keep the original wall settings contract in one desktop-backed local-player preference record.
interface LatticePreferences {
    latticeVignette: boolean;
    autoFocusOnSongChange: boolean;
    latticeLightsOn: boolean;
    latticePosterTintEnabled: boolean;
    latticePosterTintUseCustomColor: boolean;
    latticePosterTintColor: string;
    latticePosterTintIntensity: number;
}
export interface LatticeSettingsState extends LatticePreferences {
    handleToggleLatticeVignette: (enabled: boolean) => void;
    handleToggleAutoFocusOnSongChange: (enabled: boolean) => void;
    handleToggleLatticeLights: (enabled: boolean) => void;
    handleToggleLatticePosterTint: (enabled: boolean) => void;
    handleToggleLatticePosterTintCustomColor: (enabled: boolean) => void;
    handleSetLatticePosterTintColor: (color: string) => void;
    handleSetLatticePosterTintIntensity: (intensity: number) => void;
}
const defaults: LatticePreferences = {
    latticeVignette: true, autoFocusOnSongChange: true, latticeLightsOn: true,
    latticePosterTintEnabled: true, latticePosterTintUseCustomColor: false,
    latticePosterTintColor: '#161419', latticePosterTintIntensity: 0.5,
};
const normalizeColor = (value: unknown) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value.trim())
    ? value.trim().toLowerCase() : defaults.latticePosterTintColor;
const normalizeIntensity = (value: unknown) => typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value)) : defaults.latticePosterTintIntensity;
export const useLatticeSettingsStore = create<LatticeSettingsState>()(persist(set => ({
    ...defaults,
    handleToggleLatticeVignette: enabled => set({ latticeVignette: enabled }),
    handleToggleAutoFocusOnSongChange: enabled => set({ autoFocusOnSongChange: enabled }),
    handleToggleLatticeLights: enabled => set({ latticeLightsOn: enabled }),
    handleToggleLatticePosterTint: enabled => set({ latticePosterTintEnabled: enabled }),
    handleToggleLatticePosterTintCustomColor: enabled => set({ latticePosterTintUseCustomColor: enabled }),
    handleSetLatticePosterTintColor: color => set({ latticePosterTintColor: normalizeColor(color) }),
    handleSetLatticePosterTintIntensity: intensity => set({ latticePosterTintIntensity: normalizeIntensity(intensity) }),
}), {
    name: 'mineradio-folia-local-lattice-v1',
    merge: (saved, current) => {
        const value = saved && typeof saved === 'object' ? saved as Partial<LatticePreferences> : {};
        return { ...current,
            latticeVignette: typeof value.latticeVignette === 'boolean' ? value.latticeVignette : defaults.latticeVignette,
            autoFocusOnSongChange: typeof value.autoFocusOnSongChange === 'boolean' ? value.autoFocusOnSongChange : defaults.autoFocusOnSongChange,
            latticeLightsOn: typeof value.latticeLightsOn === 'boolean' ? value.latticeLightsOn : defaults.latticeLightsOn,
            latticePosterTintEnabled: typeof value.latticePosterTintEnabled === 'boolean' ? value.latticePosterTintEnabled : defaults.latticePosterTintEnabled,
            latticePosterTintUseCustomColor: typeof value.latticePosterTintUseCustomColor === 'boolean' ? value.latticePosterTintUseCustomColor : defaults.latticePosterTintUseCustomColor,
            latticePosterTintColor: normalizeColor(value.latticePosterTintColor),
            latticePosterTintIntensity: normalizeIntensity(value.latticePosterTintIntensity),
        };
    },
}));
