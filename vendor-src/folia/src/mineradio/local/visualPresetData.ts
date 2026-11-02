import type { VisualPreferences } from './useVisualSettings';

// src/mineradio/local/visualPresetData.ts
// Named, serializable visual snapshots share the existing visual-preference backup key.
export type LocalVisualSnapshot = Omit<VisualPreferences, 'view'>;
export interface LocalVisualPreset { id: string; name: string; settings: LocalVisualSnapshot }
export const LOCAL_PRESET_LIMIT = 24;
export const LOCAL_PRESET_NAME_LIMIT = 48;
export const presetName = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, LOCAL_PRESET_NAME_LIMIT) : '';

export function captureVisualPreset(value: VisualPreferences): LocalVisualSnapshot {
    const { mode, background, daylight, lyricsFontScale, translation, tunings, lyricRenderQuality,
        randomMode, randomPool, subtitleLayout, harmony, rhythm } = value;
    // Image leases belong to the shared asset cache, never to a saved parameter combination.
    return JSON.parse(JSON.stringify({ mode, background: { ...background, customImage: undefined, url: undefined },
        daylight, lyricsFontScale, translation, tunings, lyricRenderQuality, randomMode, randomPool, subtitleLayout, harmony, rhythm }));
}

export function restoreVisualPresets(raw: unknown, normalize: (value: unknown) => VisualPreferences): LocalVisualPreset[] {
    const result: LocalVisualPreset[] = [];
    if (!Array.isArray(raw)) return result;
    for (const entry of raw) {
        if (result.length >= LOCAL_PRESET_LIMIT) break;
        const name = presetName(entry?.name);
        if (!name || typeof entry?.id !== 'string' || !entry.id || entry.id.length > 80
            || !entry.settings || typeof entry.settings !== 'object' || Array.isArray(entry.settings)
            || result.some(item => item.id === entry.id || item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) continue;
        result.push({ id: entry.id, name, settings: captureVisualPreset(normalize(entry.settings)) });
    }
    return result;
}
