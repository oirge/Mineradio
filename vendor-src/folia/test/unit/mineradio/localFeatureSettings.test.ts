// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import { useVisualSettings, restoredTunings } from '../../../src/mineradio/local/useVisualSettings';
import { useLatticeSettingsStore } from '../../../src/mineradio/local/useLocalLatticeSettingsStore';
import { exportVisualPreset, importVisualPreset } from '../../../src/mineradio/local/visualPresetTransfer';
import type { LatticeTile } from '../../../src/components/app/lattice/latticeModel';
import { latticeBadgeIsIndex } from '../../../src/components/app/lattice/latticeBadge';

// test/unit/mineradio/localFeatureSettings.test.ts
beforeEach(() => {
    localStorage.clear(); useVisualSettings.getState().reset();
    useVisualSettings.setState({ presets: [], playlistPresets: {} });
    useLatticeSettingsStore.getState().handleToggleLatticeBadgeCurrentOnly(false);
});
it('defaults overlap off and rejects non-boolean saved values', () => {
    for (const mode of ['classic', 'partita'] as const) {
        expect(restoredTunings({})[mode]?.avoidOverlap).toBe(false);
        expect(restoredTunings({ [mode]: { avoidOverlap: 'true' } })[mode]?.avoidOverlap).toBe(false);
        expect(restoredTunings({ [mode]: { avoidOverlap: true } })[mode]?.avoidOverlap).toBe(true);
    }
});
it('carries both overlap switches through saved presets, JSON exchange and reload', async () => {
    const state = () => useVisualSettings.getState();
    state().tune('classic', { avoidOverlap: true }); state().tune('partita', { avoidOverlap: true });
    const id = state().savePreset('Readable')!;
    const text = await exportVisualPreset(state().presets.find(preset => preset.id === id)!, false);
    state().tune('classic', { avoidOverlap: false }); state().tune('partita', { avoidOverlap: false });
    const imported = await importVisualPreset(text);
    state().applyPreset(imported!);
    await useVisualSettings.persist.rehydrate();
    expect(state().tunings.classic?.avoidOverlap).toBe(true); expect(state().tunings.partita?.avoidOverlap).toBe(true);
    state().reset(); expect(state().tunings.classic?.avoidOverlap).toBe(false);
    expect(state().presets).toHaveLength(2);
});
it('persists the wall preference and tolerates older or malformed backups', async () => {
    const key = 'mineradio-folia-local-lattice-v1';
    expect(useLatticeSettingsStore.getState().latticeBadgeCurrentOnly).toBe(false);
    useLatticeSettingsStore.getState().handleToggleLatticeBadgeCurrentOnly(true);
    expect(JSON.parse(localStorage.getItem(key)!).state.latticeBadgeCurrentOnly).toBe(true);
    await useLatticeSettingsStore.persist.rehydrate();
    expect(useLatticeSettingsStore.getState().latticeBadgeCurrentOnly).toBe(true);
    localStorage.setItem(key, JSON.stringify({ state: { latticeBadgeCurrentOnly: 'true', latticeLightsOn: false }, version: 0 }));
    await useLatticeSettingsStore.persist.rehydrate();
    expect(useLatticeSettingsStore.getState().latticeBadgeCurrentOnly).toBe(false);
    expect(useLatticeSettingsStore.getState().latticeLightsOn).toBe(false);
});
it('distinguishes numeric badges from kind labels without inspecting their text', () => {
    const tile = { queueIndex: 2 } as LatticeTile;
    expect(latticeBadgeIsIndex(tile)).toBe(true);
    expect(latticeBadgeIsIndex({ ...tile, label: '2026' })).toBe(false);
    expect(latticeBadgeIsIndex({ ...tile, label: 'Album' })).toBe(false);
});
