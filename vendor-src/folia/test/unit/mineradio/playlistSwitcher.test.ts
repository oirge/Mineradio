// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { HostPlaylist, HostState } from '@/mineradio/client';
import PlaylistSwitcher from '@/mineradio/local/PlaylistSwitcher';
import type { LocalCommand } from '@/mineradio/local/useLibraryPage';

// test/unit/mineradio/playlistSwitcher.test.ts
vi.mock('react-i18next', () => ({
    useTranslation: () => ({ t: (key: string, params?: { count: number }) => params ? `${params.count} tracks` : key }),
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state: HostState = {
    currentTrack: null, currentIndex: -1, position: 0, duration: 0, playing: false,
    volume: 1, muted: false, playMode: 'loop', queueRevision: 1, libraryRevision: 1,
    lyricsRevision: 1, interface: 'folia', playbackPlaylistId: 'library', playbackPlaylistName: 'All music',
};
const playlists: HostPlaylist[] = [
    { id: 'library', name: 'All music', count: 8, cover: '', readOnly: true },
    { id: 'special-liked', name: 'Favorites', count: 0, cover: '', readOnly: true },
    { id: 'local-playlist:road', name: 'Road trip', count: 3, cover: '', readOnly: false },
];
let root: Root | null = null;
let container: HTMLDivElement;
let command = vi.fn<LocalCommand>();
const picker = () => container.querySelector<HTMLButtonElement>('[data-testid="local-playlist-switcher"]')!;
const menu = () => container.querySelector<HTMLDivElement>('[data-testid="local-playlist-menu"]');
const options = () => Array.from(menu()!.querySelectorAll<HTMLButtonElement>('[data-playlist-id]'));
async function render(next: HostState | null = state) {
    await act(async () => root!.render(React.createElement(PlaylistSwitcher, { state: next, command })));
}
async function openMenu() {
    if (!menu()) await act(async () => picker().click());
}
async function choose(id: string) {
    await openMenu();
    await act(async () => menu()?.querySelector<HTMLButtonElement>(`[data-playlist-id="${id}"]`)?.click());
}

beforeEach(() => {
    container = document.createElement('div');
    container.className = 'local-controls';
    document.body.appendChild(container);
    root = createRoot(container);
    command = vi.fn<LocalCommand>(async (method) => method === 'listPlaylists' ? playlists : state);
});
afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container.remove();
});

it('shows the authoritative source and disables empty playlists', async () => {
    await render({ ...state, playbackPlaylistId: 'local-playlist:road', playbackPlaylistName: 'Road trip' });
    expect(picker().dataset.playlistId).toBe('local-playlist:road');
    await openMenu();
    expect(options()[0].textContent).toContain('allMusic');
    expect(options()[1].disabled).toBe(true);
    expect(options()[2].textContent).toBe('Road trip3 tracks');
    expect(options()[2].getAttribute('aria-checked')).toBe('true');
    expect(picker().disabled).toBe(false);
    await choose('special-liked');
    expect(command.mock.calls.filter(([method]) => method === 'switchPlaylist')).toHaveLength(0);
});

it('reads summaries only on connection and library revisions, not playhead or queue changes', async () => {
    await render(null);
    expect(command).not.toHaveBeenCalled();
    expect(picker().disabled).toBe(true);
    await render();
    await render({ ...state, position: 31, queueRevision: 2, playbackPlaylistId: 'local-playlist:road' });
    expect(command.mock.calls).toEqual([['listPlaylists']]);
    await render({ ...state, libraryRevision: 2 });
    expect(command.mock.calls).toEqual([['listPlaylists'], ['listPlaylists']]);
});

it('sends one source ID and blocks duplicate switching until the host responds', async () => {
    let finish!: (value: HostState) => void;
    command.mockImplementation(method => method === 'listPlaylists' ? Promise.resolve(playlists)
        : new Promise(resolve => { finish = resolve; }));
    await render();
    await choose('local-playlist:road');
    expect(command.mock.calls.at(-1)).toEqual(['switchPlaylist', { playlistId: 'local-playlist:road' }]);
    expect(picker().disabled).toBe(true);
    expect(picker().dataset.playlistId).toBe('local-playlist:road');
    expect(menu()).toBeNull();
    await choose('library');
    expect(command.mock.calls.filter(([method]) => method === 'switchPlaylist')).toHaveLength(1);
    const next = { ...state, playbackPlaylistId: 'local-playlist:road' };
    await act(async () => {
        finish(next);
        root!.render(React.createElement(PlaylistSwitcher, { state: next, command }));
    });
    expect(picker().disabled).toBe(false);
    expect(picker().dataset.playlistId).toBe('local-playlist:road');
});

it('retains the previous source after a failed switch and keeps temporary sources visible', async () => {
    command.mockImplementation(async method => {
        if (method === 'listPlaylists') return playlists;
        throw new Error('Playlist removed');
    });
    await render();
    await choose('local-playlist:road');
    expect(picker().dataset.playlistId).toBe('library');
    expect(picker().disabled).toBe(false);
    await render({ ...state, playbackPlaylistId: 'album:record', playbackPlaylistName: 'Record' });
    expect(picker().dataset.playlistId).toBe('album:record');
    await openMenu();
    expect(options()[0].textContent).toBe('Record0 tracks');
    expect(options()[0].getAttribute('aria-checked')).toBe('true');
    expect(options()[0].disabled).toBe(true);
});

it('ignores old summary requests after a revision change or unmount', async () => {
    const finish: Array<(value: HostPlaylist[]) => void> = [];
    command.mockImplementation(() => new Promise(resolve => { finish.push(resolve); }));
    await render();
    await render({ ...state, libraryRevision: 2 });
    await act(async () => finish[1]([{ ...playlists[0], name: 'All music' }, { ...playlists[2], name: 'Updated' }]));
    await openMenu();
    expect(options()[1].textContent).toContain('Updated');
    await act(async () => finish[0](playlists));
    expect(options()[1].textContent).toContain('Updated');
    await render({ ...state, libraryRevision: 3 });
    await act(async () => root!.unmount());
    root = null;
    await act(async () => finish[2](playlists));
    expect(container.childElementCount).toBe(0);
});

it('keeps the popup inside the folding bar and supports arrows, Escape and outside clicks', async () => {
    await render();
    await openMenu();
    expect(menu()!.parentElement).toBe(container);
    expect(container.classList.contains('local-playlist-open')).toBe(true);
    expect(document.activeElement).toBe(options()[0]);
    await act(async () => options()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })));
    expect(document.activeElement).toBe(options()[2]);
    await act(async () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(picker());
    expect(container.classList.contains('local-playlist-open')).toBe(false);
    await openMenu();
    await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
    expect(menu()).toBeNull();
});

it('closes the picker before opening playlist management', async () => {
    const onManage = vi.fn();
    await act(async () => root!.render(React.createElement(PlaylistSwitcher, { state, command, onManage })));
    await openMenu();
    await act(async () => menu()!.querySelector<HTMLButtonElement>('.local-playlist-footer button')!.click());
    expect(onManage).toHaveBeenCalledOnce();
    expect(menu()).toBeNull();
});
