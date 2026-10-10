import type { DualTheme, Theme } from '../types';

// src/services/baseThemes.ts
// Folia's built-in default preset, the theme a user sees before saving a custom one or applying an
// AI theme. Kept as a dependency-free leaf so non-UI consumers (the OBS URL builder) can bake it
// without reaching into App.

// 午夜墨染
export const DEFAULT_THEME: Theme = {
    name: "Midnight Default",
    backgroundColor: "#09090b", // zinc-950
    primaryColor: "#f4f4f5", // zinc-100
    accentColor: "#f4f4f5", // zinc-100
    secondaryColor: "#71717a", // zinc-500
    fontStyle: "sans",
    animationIntensity: "normal"
};

// 日光素白
export const DAYLIGHT_THEME: Theme = {
    name: "Daylight Default",
    backgroundColor: "#f5f5f4", // stone-100 (Pearl White-ish)
    primaryColor: "#1c1917", // stone-900
    accentColor: "#ea580c", // orange-600
    secondaryColor: "#44403c", // stone-700
    fontStyle: "sans",
    animationIntensity: "normal"
};

// The preset as a light/dark pair, matching the shape a theme is exported and baked in.
export const BASE_DUAL_THEME: DualTheme = {
    light: DAYLIGHT_THEME,
    dark: DEFAULT_THEME,
};
