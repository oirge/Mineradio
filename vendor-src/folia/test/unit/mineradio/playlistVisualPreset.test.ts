// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { useVisualSettings } from '../../../src/mineradio/local/useVisualSettings';
import { usePlaylistVisualPreset } from '../../../src/mineradio/local/usePlaylistVisualPreset';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, host: HTMLDivElement;
const state = () => useVisualSettings.getState();
beforeEach(() => {
    localStorage.clear(); state().reset(); useVisualSettings.setState({ presets: [], playlistPresets: {} });
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
function Player({ track, playlist }: { track: string | null; playlist: string }) {
    usePlaylistVisualPreset(track, playlist); return null;
}
const enter = (track: string | null, playlist: string) => act(() => root.render(createElement(Player, { track, playlist })));

it('applies on playlist entry, preserves manual edits across tracks and leaves unbound playlists unchanged', () => {
    state().update({ mode: 'nebbia', view: 'posters' });
    const id = state().savePreset('Rain')!; state().bindPlaylistPreset('road', id);
    state().update({ mode: 'classic', view: 'records' });
    enter('one', 'road'); expect(state()).toMatchObject({ mode: 'nebbia', view: 'records' });
    state().update({ mode: 'machi' });
    enter('two', 'road'); expect(state().mode).toBe('machi');
    enter('two', 'library'); expect(state().mode).toBe('machi');
    enter('two', 'road'); expect(state().mode).toBe('nebbia');
});

it('persists valid bindings, cleans deleted presets and drops corrupt/missing references', async () => {
    const id = state().savePreset('First')!; state().bindPlaylistPreset('road', id);
    const saved = JSON.parse(localStorage.getItem('mineradio-folia-local-visuals-v1')!);
    saved.state.playlistPresets.missing = 'unknown'; saved.state.playlistPresets.bad = 42;
    useVisualSettings.setState({ playlistPresets: {} });
    localStorage.setItem('mineradio-folia-local-visuals-v1', JSON.stringify(saved));
    await useVisualSettings.persist.rehydrate();
    expect(state().playlistPresets).toEqual({ road: id });
    state().renamePreset(id, 'New'); expect(state().playlistPresets.road).toBe(id);
    state().reset(); expect(state().playlistPresets.road).toBe(id);
    state().deletePreset(id); expect(state().playlistPresets).toEqual({});
});

it('randomizes at most once per track and never replays a binding on continuous state updates', () => {
    state().update({ randomMode: true, randomPool: ['classic', 'nebbia'] });
    enter('one', 'library'); const first = state().mode;
    enter('one', 'library'); expect(state().mode).toBe(first);
    enter('two', 'library'); expect(state().mode).not.toBe(first);
    enter(null, 'library'); enter('two', 'library'); expect(state().mode).toBe(first);
});
