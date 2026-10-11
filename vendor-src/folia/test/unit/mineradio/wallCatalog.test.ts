// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { HostState, HostTrack } from '@/mineradio/client';
import { useLocalWallCatalog } from '@/mineradio/local/wallCatalog';
import type { LocalPlayer } from '@/mineradio/local/playerTypes';

// test/unit/mineradio/wallCatalog.test.ts
const host = vi.hoisted(() => ({ listeners: new Map<string, Set<(data: any) => void>>() }));
vi.mock('@/mineradio/client', () => ({
    subscribeHost: (name: string, listener: (data: any) => void) => {
        const listeners = host.listeners.get(name) ?? new Set();
        listeners.add(listener);
        host.listeners.set(name, listeners);
        return () => listeners.delete(listener);
    },
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const track = (id: string, cover = `/cover/${id}.jpg`): HostTrack => ({
    id, title: `Track ${id}`, artist: 'Artist', album: 'Album', duration: 120,
    cover, liked: false, filePath: `D:/Music/${id}.mp3`, format: 'mp3',
});
const state: HostState = {
    currentTrack: null, currentIndex: -1, position: 0, duration: 0, playing: false,
    volume: 1, muted: false, playMode: 'loop', queueRevision: 1, libraryRevision: 1,
    lyricsRevision: 1, interface: 'folia',
};
let root: Root | null;
let catalog: ReturnType<typeof useLocalWallCatalog>;
let command: ReturnType<typeof vi.fn>;
function emit(name: string, data: unknown) { host.listeners.get(name)?.forEach(listener => listener(data)); }
async function mountCatalog() {
    const player = { state, command } as unknown as LocalPlayer;
    function Probe() { catalog = useLocalWallCatalog(player); return null; }
    root = createRoot(document.createElement('div'));
    await act(async () => { root!.render(React.createElement(Probe)); });
}
async function settlePage() {
    await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 0)); });
}
async function settleSearch() {
    await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 230)); });
}

beforeEach(() => {
    host.listeners.clear();
    command = vi.fn(async (method: string) => {
        if (method === 'listPlaylists') return [];
        return { items: [track('a'), track('b')], total: 2, offset: 0, limit: 1000 };
    });
});
afterEach(() => {
    act(() => root?.unmount());
    root = null;
});

it('patches one mounted wall tile from host updates without rereading the whole catalog', async () => {
    await mountCatalog();
    await settlePage();
    expect(catalog.songs.map(song => song.album.coverUrl)).toEqual(['/cover/a.jpg', '/cover/b.jpg']);
    const oldSongs = catalog.songs;
    const reads = command.mock.calls.filter(([method]) => method === 'listTracks').length;

    await act(async () => emit('tracksChanged', { updates: [{ track: track('b', '/new-b.jpg'), searchableChanged: false }] }));
    expect(catalog.songs[1].album.coverUrl).toBe('/new-b.jpg');
    expect(catalog.songs[0]).toBe(oldSongs[0]);
    expect(command.mock.calls.filter(([method]) => method === 'listTracks')).toHaveLength(reads);
});

it('keeps a newer host update when an earlier catalog request finishes later', async () => {
    let finishPage!: (page: unknown) => void;
    command.mockImplementation((method: string) => method === 'listPlaylists' ? Promise.resolve([])
        : new Promise(resolve => { finishPage = resolve; }));
    await mountCatalog();
    await settlePage();
    expect(catalog.loading).toBe(true);
    await act(async () => emit('tracksChanged', {
        updates: [{ track: track('b', '/new-b.jpg'), searchableChanged: false }],
    }));
    await act(async () => finishPage({ items: [track('a'), track('b')], total: 2, offset: 0, limit: 1000 }));
    expect(catalog.songs.map(song => song.album.coverUrl)).toEqual(['/cover/a.jpg', '/new-b.jpg']);
});

it('requeries a nonempty search when changed metadata creates a new match', async () => {
    let songs = [track('a'), track('b')];
    command.mockImplementation(async (method: string, params?: { query?: string }) => {
        if (method === 'listPlaylists') return [];
        const matches = songs.filter(item => !params?.query || item.title.toLowerCase().includes(params.query.toLowerCase()));
        return { items: matches, total: matches.length, offset: 0, limit: 1000 };
    });
    await mountCatalog();
    await settlePage();
    await act(async () => catalog.setQuery('new'));
    await settleSearch();
    expect(catalog.songs).toHaveLength(0);
    const reads = command.mock.calls.filter(([method]) => method === 'listTracks').length;

    songs = [track('a'), { ...track('b'), title: 'New track' }];
    await act(async () => emit('tracksChanged', { updates: [{ track: songs[1], searchableChanged: true }] }));
    await settleSearch();
    await settlePage();
    expect(command.mock.calls.filter(([method]) => method === 'listTracks')).toHaveLength(reads + 1);
    expect(catalog.songs.map(song => song.name)).toEqual(['New track']);
});

it('shows search matches during a continuous stream of metadata updates', async () => {
    let songs = [track('a'), track('b')];
    command.mockImplementation(async (method: string, params?: { query?: string }) => {
        if (method === 'listPlaylists') return [];
        const matches = songs.filter(item => !params?.query || item.title.toLowerCase().includes(params.query.toLowerCase()));
        return { items: matches, total: matches.length, offset: 0, limit: 1000 };
    });
    await mountCatalog();
    await settlePage();
    await act(async () => catalog.setQuery('new'));
    await settleSearch();
    expect(catalog.songs).toHaveLength(0);
    const reads = command.mock.calls.filter(([method]) => method === 'listTracks').length;

    for (let index = 0; index < 10; index++) {
        songs = [songs[0], { ...track('b'), title: `New track ${index}` }];
        await act(async () => {
            emit('tracksChanged', { updates: [{ track: songs[1], searchableChanged: true }] });
            await new Promise(resolve => window.setTimeout(resolve, 70));
        });
    }
    const additionalReads = command.mock.calls.filter(([method]) => method === 'listTracks').length - reads;
    expect(additionalReads).toBeGreaterThanOrEqual(1);
    expect(additionalReads).toBeLessThanOrEqual(2);
    expect(catalog.songs[0].id).toBe('b');
});

it('lets an in-flight search finish while more metadata updates arrive', async () => {
    let searchReads = 0;
    let finishSearch!: (page: unknown) => void;
    command.mockImplementation((method: string, params?: { query?: string }) => {
        if (method === 'listPlaylists') return Promise.resolve([]);
        if (params?.query === 'new') {
            searchReads++;
            if (searchReads > 1) return new Promise(resolve => { finishSearch = resolve; });
            return Promise.resolve({ items: [], total: 0, offset: 0, limit: 1000 });
        }
        return Promise.resolve({ items: [track('a'), track('b')], total: 2, offset: 0, limit: 1000 });
    });
    await mountCatalog();
    await settlePage();
    await act(async () => catalog.setQuery('new'));
    await settleSearch();
    expect(catalog.songs).toHaveLength(0);

    await act(async () => emit('tracksChanged', {
        updates: [{ track: { ...track('b'), title: 'New track 0' }, searchableChanged: true }],
    }));
    await settleSearch();
    await settlePage();
    expect(searchReads).toBe(2);
    for (let index = 1; index <= 5; index++) {
        await act(async () => {
            emit('tracksChanged', {
                updates: [{ track: { ...track('b'), title: `New track ${index}` }, searchableChanged: true }],
            });
            await new Promise(resolve => window.setTimeout(resolve, 40));
        });
    }
    expect(searchReads).toBe(2);
    await act(async () => finishSearch({
        items: [{ ...track('b'), title: 'New track 0' }], total: 1, offset: 0, limit: 1000,
    }));
    expect(catalog.songs.map(song => song.name)).toEqual(['New track 5']);
});

it('rejects a prior collection response after switching scope and unsubscribes on unmount', async () => {
    let finishOldPage!: (page: unknown) => void;
    command.mockImplementation((method: string, params?: { playlistId?: string }) => {
        if (method === 'listPlaylists') return Promise.resolve([]);
        if (params?.playlistId === 'library') return new Promise(resolve => { finishOldPage = resolve; });
        return Promise.resolve({ items: [track('c')], total: 1, offset: 0, limit: 1000 });
    });
    await mountCatalog();
    await settlePage();
    await act(async () => catalog.setPlaylistId('favorites'));
    await settlePage();
    expect(catalog.songs.map(song => song.id)).toEqual(['c']);
    await act(async () => finishOldPage({ items: [track('a')], total: 1, offset: 0, limit: 1000 }));
    expect(catalog.songs.map(song => song.id)).toEqual(['c']);
    expect(host.listeners.get('tracksChanged')?.size).toBe(1);
    act(() => root?.unmount());
    root = null;
    expect(host.listeners.get('tracksChanged')?.size).toBe(0);
});
