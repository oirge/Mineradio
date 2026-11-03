import { DEFAULT_HANABI_TUNING } from '../../components/visualizer/hanabi/types';
import { DEFAULT_NEBBIA_TUNING } from '../../components/visualizer/nebbia/types';
import { DEFAULT_MACHI_TUNING } from '../../components/visualizer/machi/types';
import { normalizeHanabiTuning } from '../../components/visualizer/hanabi/hanabiTuning';
import { normalizeNebbiaTuning } from '../../components/visualizer/nebbia/tuning';
import { normalizeMachiTuning } from '../../components/visualizer/machi/machiTuning';
import { resolveStoredTemperaTuning } from '../../stores/visualizerSettingsPersistence';
import { parseSubtitleOverlayLayout } from '../../utils/lyrics/subtitleOverlayLayout';
import { randomLyricMode, normalizeRandomPool } from './randomLyricMode';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import * as presets from '../../types';
import type { VisualizerTuningBundle, VisualizerTuningMode } from '../../components/visualizer/tuningRegistry';
import type { VisualizerBackgroundConfig } from '../../components/visualizer/backgrounds/definition';
import { isBuiltinVisualizerMode, isBuiltinVisualizerBackgroundMode } from '../../types/visualizerModes';
import { DEFAULT_LYRIC_RENDER_QUALITY, normalizeLyricRenderOverride, normalizeLyricRenderQuality } from '../../utils/lyricRenderQuality';
import { captureVisualPreset, restoreVisualPresets, restorePlaylistPresets, presetName, LOCAL_PRESET_LIMIT, type LocalVisualPreset } from './visualPresetData';

// src/mineradio/local/useVisualSettings.ts
// Dedicated visual preferences for the embedded local player, without application/provider stores.
export const DEFAULT_LOCAL_TUNINGS: VisualizerTuningBundle = {
    classic: presets.DEFAULT_CLASSIC_TUNING, cadenza: presets.DEFAULT_CADENZA_TUNING,
    partita: presets.DEFAULT_PARTITA_TUNING, fume: presets.DEFAULT_FUME_TUNING,
    claddagh: presets.DEFAULT_CLADDAGH_TUNING, cappella: presets.DEFAULT_CAPPELLA_TUNING,
    tilt: presets.DEFAULT_TILT_TUNING, diorama: presets.DEFAULT_DIORAMA_TUNING,
    monet: presets.DEFAULT_MONET_TUNING, pendolo: presets.DEFAULT_PENDOLO_TUNING,
    sonnet: presets.DEFAULT_SONNET_TUNING, tempera: presets.DEFAULT_TEMPERA_TUNING,
    lumiere: presets.DEFAULT_LUMIERE_TUNING,
    hanabi: DEFAULT_HANABI_TUNING, nebbia: DEFAULT_NEBBIA_TUNING, machi: DEFAULT_MACHI_TUNING,
};
export interface VisualPreferences {
    rhythm: boolean;
    lyricRenderQuality: presets.LyricRenderQuality;
    randomMode: boolean;
    randomPool: presets.VisualizerMode[];
    subtitleLayout: presets.SubtitleOverlayLayout;
    subtitleHidden: boolean;
    subtitleBackground: boolean;
    subtitleContentMode: presets.SubtitleContentMode;
    harmony: boolean;
    view: 'lyrics' | 'records' | 'posters';
    mode: presets.VisualizerMode;
    background: VisualizerBackgroundConfig;
    daylight: boolean;
    lyricsFontScale: number;
    translation: boolean;
    tunings: VisualizerTuningBundle;
}
interface VisualSettings extends VisualPreferences {
    presets: LocalVisualPreset[];
    playlistPresets: Record<string, string>;
    savePreset: (name: string, id?: string) => string | null;
    importPreset: (preset: Pick<LocalVisualPreset, 'name' | 'settings'>) => string | null;
    bindPlaylistPreset: (playlistId: string, presetId: string | null) => void;
    applyPreset: (id: string) => void;
    renamePreset: (id: string, name: string) => boolean;
    deletePreset: (id: string) => void;
    toggleRandomPool: (mode: presets.VisualizerMode, checked: boolean) => void;
    update: (patch: Partial<VisualPreferences>) => void;
    tune: (mode: VisualizerTuningMode, patch: Record<string, unknown>) => void;
    reroll: () => void;
    reset: () => void;
}
const defaults: VisualPreferences = {
    rhythm: true,
    lyricRenderQuality: DEFAULT_LYRIC_RENDER_QUALITY,
    randomMode: false, randomPool: normalizeRandomPool(null), subtitleLayout: 'translation', harmony: true,
    subtitleHidden: false, subtitleBackground: true, subtitleContentMode: 'translation',
    view: 'lyrics',
    mode: 'classic', background: { mode: 'latent' }, daylight: false,
    lyricsFontScale: 1, translation: true, tunings: DEFAULT_LOCAL_TUNINGS,
};
// Normalize the raw stored object first: injecting defaults before migration hides legacy fields.
export function normalizeLocalTuning(mode: string, value: unknown) {
    const patch = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    if (mode === 'hanabi') return normalizeHanabiTuning(patch);
    if (mode === 'nebbia') return normalizeNebbiaTuning(patch);
    if (mode === 'machi') return normalizeMachiTuning(patch);
    if (mode === 'tempera') return { ...resolveStoredTemperaTuning(patch),
        render: normalizeLyricRenderOverride((patch as { render?: unknown }).render) };
    const base = DEFAULT_LOCAL_TUNINGS[mode as VisualizerTuningMode];
    const merged = { ...base, ...patch };
    if (mode === 'classic' || mode === 'partita') {
        return { ...merged, avoidOverlap: (patch as { avoidOverlap?: unknown }).avoidOverlap === true };
    }
    return base && 'render' in base ? { ...merged, render: normalizeLyricRenderOverride((patch as { render?: unknown }).render) } : merged;
}
export function restoredTunings(value: unknown): VisualizerTuningBundle {
    const saved = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    return Object.fromEntries(Object.entries(DEFAULT_LOCAL_TUNINGS).map(([mode, base]) => {
        const patch = saved[mode];
        return [mode, normalizeLocalTuning(mode, patch)];
    })) as VisualizerTuningBundle;
}
export function normalizeVisualPreferences(saved: unknown): VisualPreferences {
    const value = saved && typeof saved === 'object' ? saved as Partial<VisualPreferences> : {};
    const background = value.background && typeof value.background === 'object' ? value.background : defaults.background;
    const subtitleContentMode = ['translation', 'romanization', 'both', 'none'].includes(value.subtitleContentMode ?? '')
        ? value.subtitleContentMode! : value.translation === false ? 'none' : 'translation';
    return {
        rhythm: value.rhythm !== false,
        lyricRenderQuality: normalizeLyricRenderQuality(value.lyricRenderQuality),
        view: value.view === 'records' || value.view === 'posters' ? value.view : 'lyrics',
        mode: isBuiltinVisualizerMode(value.mode) ? value.mode : defaults.mode,
        background: { ...background, mode: isBuiltinVisualizerBackgroundMode(background.mode) && background.mode !== 'url' ? background.mode : 'latent', url: undefined, customImage: undefined, transparent: background.transparent === true },
        daylight: value.daylight === true,
        lyricsFontScale: Number.isFinite(value.lyricsFontScale) ? Math.min(1.6, Math.max(0.6, value.lyricsFontScale!)) : 1,
        translation: subtitleContentMode !== 'none',
        subtitleContentMode, subtitleBackground: value.subtitleBackground !== false,
        subtitleHidden: value.subtitleHidden === true || (value.subtitleHidden === undefined && value.translation === false),
        randomMode: value.randomMode === true, randomPool: normalizeRandomPool(value.randomPool),
        subtitleLayout: parseSubtitleOverlayLayout(value.subtitleLayout) ?? 'translation', harmony: value.harmony !== false,
        tunings: restoredTunings(value.tunings),
    };
}
export const useVisualSettings = create<VisualSettings>()(persist((set, get) => ({
    ...defaults,
    presets: [],
    playlistPresets: {},
    savePreset: (rawName, id) => {
        const state = get(), name = presetName(rawName);
        const existing = id ? state.presets.find(item => item.id === id) : null;
        if (!name || (id && !existing) || (!existing && state.presets.length >= LOCAL_PRESET_LIMIT)
            || state.presets.some(item => item.id !== id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return null;
        const preset = { id: existing?.id ?? crypto.randomUUID(), name, settings: captureVisualPreset(state) };
        set({ presets: existing ? state.presets.map(item => item.id === id ? preset : item) : [...state.presets, preset] });
        return preset.id;
    },
    importPreset: preset => {
        const entries = get().presets;
        if (entries.length >= LOCAL_PRESET_LIMIT) return null;
        const base = presetName(preset.name);
        if (!base) return null;
        let name = base, n = 2;
        while (entries.some(entry => entry.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
            const suffix = ` (${n++})`;
            name = base.slice(0, 48 - suffix.length) + suffix;
        }
        const id = crypto.randomUUID();
        set({ presets: [...entries, { id, name, settings: captureVisualPreset(normalizeVisualPreferences(preset.settings)) }] });
        return id;
    },
    bindPlaylistPreset: (playlistId, presetId) => set(state => {
        const bindings = { ...state.playlistPresets };
        if (presetId && state.presets.some(preset => preset.id === presetId)) bindings[playlistId] = presetId;
        else delete bindings[playlistId];
        return { playlistPresets: restorePlaylistPresets(bindings, state.presets) };
    }),
    applyPreset: id => {
        const preset = get().presets.find(item => item.id === id);
        if (preset) set(captureVisualPreset(normalizeVisualPreferences(preset.settings)));
    },
    renamePreset: (id, rawName) => {
        const name = presetName(rawName), entries = get().presets;
        if (!name || !entries.some(item => item.id === id)
            || entries.some(item => item.id !== id && item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return false;
        set({ presets: entries.map(item => item.id === id ? { ...item, name } : item) });
        return true;
    },
    deletePreset: id => set(state => {
        const presets = state.presets.filter(item => item.id !== id);
        return { presets, playlistPresets: restorePlaylistPresets(state.playlistPresets, presets) };
    }),
    toggleRandomPool: (mode, checked) => set(state => {
        if (!isBuiltinVisualizerMode(mode) || state.randomPool.includes(mode) === checked) return state;
        const pool = checked ? [...state.randomPool, mode] : state.randomPool.filter(value => value !== mode);
        return pool.length ? { randomPool: pool } : state;
    }),
    update: patch => set(state => {
        const next = { ...patch };
        if (patch.subtitleContentMode !== undefined) next.translation = patch.subtitleContentMode !== 'none';
        else if (patch.translation !== undefined) {
            next.subtitleContentMode = patch.translation ? (state.subtitleContentMode === 'none' ? 'translation' : state.subtitleContentMode) : 'none';
            next.subtitleHidden = !patch.translation;
        }
        if (patch.lyricRenderQuality) next.lyricRenderQuality = normalizeLyricRenderQuality(patch.lyricRenderQuality);
        return next;
    }),
    reroll: () => set(state => ({ mode: randomLyricMode(state.randomPool, state.mode) })),
    tune: (mode, patch) => set((state) => ({ tunings: {
        ...state.tunings, [mode]: normalizeLocalTuning(mode, { ...state.tunings[mode], ...patch }),
    } })),
    reset: () => set({ ...defaults, ...captureVisualPreset(defaults) }),
}), {
    name: 'mineradio-folia-local-visuals-v1',
    // Validate persisted routing fields so outdated/unavailable modes cannot load remote backgrounds.
    merge: (saved, current) => {
        const presets = restoreVisualPresets((saved as { presets?: unknown } | null)?.presets, normalizeVisualPreferences);
        return { ...current, ...normalizeVisualPreferences(saved),
            presets, playlistPresets: restorePlaylistPresets((saved as { playlistPresets?: unknown } | null)?.playlistPresets, presets) };
    },
}));

// Pool edits and named-preset bookkeeping must not rebuild the GPU stage or its preview.
export function useVisualSceneSettings() {
    return useVisualSettings(useShallow(({ view, mode, background, daylight, lyricsFontScale, translation,
        harmony, tunings, subtitleLayout, subtitleHidden, subtitleBackground, subtitleContentMode, update, tune }) => ({ view, mode, background, daylight,
        lyricsFontScale, translation, harmony, tunings, subtitleLayout, subtitleHidden, subtitleBackground, subtitleContentMode, update, tune })));
}
