// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { HostPage, HostState, HostTrack } from '@/mineradio/client';
import LibraryPanel from '@/mineradio/local/LibraryPanel';
import { useLibraryPage, type LocalCommand } from '@/mineradio/local/useLibraryPage';

// test/unit/mineradio/libraryPage.test.ts
const host = vi.hoisted(() => ({ listeners: new Map<string, Set<(data: any) => void>>() }));
vi.mock('@/mineradio/client', () => ({
    subscribeHost: (name: string, listener: (data: any) => void) => {
        const listeners = host.listeners.get(name) ?? new Set();
        listeners.add(listener);
        host.listeners.set(name, listeners);
        return () => listeners.delete(listener);
    },
}));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const track = (id: string, changes: Partial<HostTrack> = {}): HostTrack => ({
    id, title: `Track ${id}`, artist: 'Artist', album: 'Album', duration: 120,
    cover: `/cover/${id}.jpg`, liked: false, filePath: `D:/Music/${id}.mp3`, format: 'mp3',
    ...changes,
});
const page = (items: HostTrack[], offset = 0): HostPage<HostTrack> => ({
    items, total: items.length, offset, limit: 60,
});
const state: HostState = {
    currentTrack: null, currentIndex: -1, position: 0, duration: 0, playing: false,
    volume: 1, muted: false, playMode: 'loop', queueRevision: 1, libraryRevision: 1,
    lyricsRevision: 1, interface: 'folia',
};
let root: Root | null;
let container: HTMLDivElement | null;
let catalog: ReturnType<typeof useLibraryPage>;
let command = vi.fn<LocalCommand>();

function emit(updates: Array<{ track: HostTrack; searchableChanged: boolean }>) {
    host.listeners.get('tracksChanged')?.forEach(listener => listener({ updates }));
}
async function mountHook(queue = false) {
    function Probe() { catalog = useLibraryPage(state, command, queue); return null; }
    container = document.createElement('div');
    root = createRoot(container);
    await act(async () => { root!.render(React.createElement(Probe)); });
}
async function mountPanel() {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
        root!.render(React.createElement(LibraryPanel, {
            state, command, queue: false, onTab: () => {}, onClose: () => {},
        }));
    });
}
async function settlePage() {
    await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 0)); });
}
async function settleSearch() {
    await act(async () => { await new Promise(resolve => window.setTimeout(resolve, 230)); });
}
function pageReads() {
    return command.mock.calls.filter(([method]) => method === 'listTracks' || method === 'getQueue').length;
}

beforeEach(() => {
    host.listeners.clear();
    command = vi.fn<LocalCommand>(async (method) => method === 'listPlaylists' ? [] : page([track('a'), track('b')]));
});
afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container?.remove();
    container = null;
});

it.each([false, true])('patches a visible %s page by ID without rereading the catalog', async (queue) => {
    await mountHook(queue);
    await settlePage();
    const oldItem = catalog.page.items[0];
    const reads = pageReads();

    await act(async () => emit([{ track: track('b', { cover: '/cover/new-b.jpg', liked: true }), searchableChanged: false }]));
    expect(catalog.page.items[0]).toBe(oldItem);
    expect(catalog.page.items[1].cover).toBe('/cover/new-b.jpg');
    expect(catalog.page.items[1].liked).toBe(true);
    expect(pageReads()).toBe(reads);
});

it('updates an open track detail snapshot from the same event', async () => {
    await mountPanel();
    await settlePage();
    const detailButton = container!.querySelector<HTMLButtonElement>('[aria-label="details"]');
    await act(async () => detailButton!.click());
    expect(container!.querySelector('.local-details-song strong')?.textContent).toBe('Track a');

    await act(async () => emit([{ track: track('a', { title: 'Renamed a', cover: '/cover/new-a.jpg' }), searchableChanged: true }]));
    expect(container!.querySelector('.local-details-song strong')?.textContent).toBe('Renamed a');
    expect(container!.querySelector('.local-details-song img')?.getAttribute('src')).toBe('/cover/new-a.jpg');
});

it('requeries a nonempty search only when searchable metadata changes', async () => {
    let songs = [track('a'), track('b')];
    command.mockImplementation(async (method: string, params?: { query?: string }) => {
        if (method === 'listPlaylists') return [];
        const matches = songs.filter(song => !params?.query || song.title.toLowerCase().includes(params.query.toLowerCase()));
        return page(matches);
    });
    await mountHook();
    await settlePage();
    await act(async () => catalog.search('new'));
    await settleSearch();
    expect(catalog.page.items).toHaveLength(0);
    const reads = pageReads();

    songs = [songs[0], track('b', { title: 'New track' })];
    await act(async () => emit([{ track: songs[1], searchableChanged: false }]));
    await settleSearch();
    expect(pageReads()).toBe(reads);

    await act(async () => emit([{ track: songs[1], searchableChanged: true }]));
    await settleSearch();
    await settlePage();
    expect(pageReads()).toBe(reads + 1);
    expect(catalog.page.items.map(song => song.title)).toEqual(['New track']);

    await act(async () => catalog.search('   '));
    await settleSearch();
    const emptyQueryReads = pageReads();
    await act(async () => emit([{ track: track('a', { title: 'Updated a' }), searchableChanged: true }]));
    await settleSearch();
    expect(pageReads()).toBe(emptyQueryReads);
});

it('shows new search matches during a continuous stream of metadata updates', async () => {
    let songs = [track('a'), track('b')];
    command.mockImplementation(async (method: string, params?: { query?: string }) => {
        if (method === 'listPlaylists') return [];
        const matches = songs.filter(song => !params?.query || song.title.toLowerCase().includes(params.query.toLowerCase()));
        return page(matches);
    });
    await mountHook();
    await settlePage();
    await act(async () => catalog.search('new'));
    await settleSearch();
    expect(catalog.page.items).toHaveLength(0);
    const reads = pageReads();

    for (let index = 0; index < 10; index++) {
        songs = [songs[0], track('b', { title: `New track ${index}` })];
        await act(async () => {
            emit([{ track: songs[1], searchableChanged: true }]);
            await new Promise(resolve => window.setTimeout(resolve, 70));
        });
    }
    const additionalReads = pageReads() - reads;
    expect(additionalReads).toBeGreaterThanOrEqual(1);
    expect(additionalReads).toBeLessThanOrEqual(2);
    expect(catalog.page.items[0].id).toBe('b');
});

it('keeps an in-flight search alive and overlays subsequent metadata updates', async () => {
    let searchReads = 0;
    let finishSearch!: (value: HostPage<HostTrack>) => void;
    command.mockImplementation((method: string, params?: { query?: string }) => {
        if (method === 'listPlaylists') return Promise.resolve([]);
        if (params?.query === 'new') {
            searchReads++;
            if (searchReads > 1) return new Promise(resolve => { finishSearch = resolve; });
            return Promise.resolve(page([]));
        }
        return Promise.resolve(page([track('a'), track('b')]));
    });
    await mountHook();
    await settlePage();
    await act(async () => catalog.search('new'));
    await settleSearch();
    expect(catalog.page.items).toHaveLength(0);

    await act(async () => emit([{ track: track('b', { title: 'New track 0' }), searchableChanged: true }]));
    await settleSearch();
    await settlePage();
    expect(searchReads).toBe(2);
    for (let index = 1; index <= 5; index++) {
        await act(async () => {
            emit([{ track: track('b', { title: `New track ${index}` }), searchableChanged: true }]);
            await new Promise(resolve => window.setTimeout(resolve, 40));
        });
    }
    expect(searchReads).toBe(2);
    await act(async () => finishSearch(page([track('b', { title: 'New track 0' })])));
    expect(catalog.page.items.map(song => song.title)).toEqual(['New track 5']);
});

it('keeps a newer host update when the first page request finishes later', async () => {
    let finishPage!: (value: HostPage<HostTrack>) => void;
    command.mockImplementation((method: string) => method === 'listPlaylists' ? Promise.resolve([])
        : new Promise(resolve => { finishPage = resolve; }));
    await mountHook();
    await settlePage();
    expect(catalog.loading).toBe(true);
    await act(async () => emit([{ track: track('b', { cover: '/cover/new-b.jpg' }), searchableChanged: false }]));
    await act(async () => finishPage(page([track('a'), track('b')])));
    expect(catalog.page.items.map(song => song.cover)).toEqual(['/cover/a.jpg', '/cover/new-b.jpg']);
});

it('keeps an event update over a stale refresh and ignores an old collection response', async () => {
    let finishRefresh!: (value: HostPage<HostTrack>) => void;
    let finishOldCollection!: (value: HostPage<HostTrack>) => void;
    let libraryReads = 0;
    command.mockImplementation((method: string, params?: { playlistId?: string }) => {
        if (method === 'listPlaylists') return Promise.resolve([]);
        if (params?.playlistId !== 'library') return Promise.resolve(page([track('c')]));
        libraryReads++;
        if (libraryReads === 1) return Promise.resolve(page([track('a')]));
        if (libraryReads === 2) return new Promise(resolve => { finishRefresh = resolve; });
        return new Promise(resolve => { finishOldCollection = resolve; });
    });
    await mountHook();
    await settlePage();
    await act(async () => catalog.refresh());
    await settlePage();
    await act(async () => emit([{ track: track('a', { cover: '/cover/new-a.jpg' }), searchableChanged: false }]));
    await act(async () => finishRefresh(page([track('a')])));
    expect(catalog.page.items[0].cover).toBe('/cover/new-a.jpg');

    await act(async () => catalog.refresh());
    await settlePage();
    await act(async () => catalog.chooseCollection('favorites'));
    await settlePage();
    expect(catalog.page.items.map(song => song.id)).toEqual(['c']);
    await act(async () => finishOldCollection(page([track('a')])));
    expect(catalog.page.items.map(song => song.id)).toEqual(['c']);
});

it('unsubscribes while hidden and reloads changed metadata when reopened', async () => {
    let songs = [track('a')];
    command.mockImplementation(async (method: string) => method === 'listPlaylists' ? [] : page(songs));
    await mountPanel();
    await settlePage();
    expect(container!.querySelector('.local-track-text strong')?.textContent).toBe('Track a');
    expect(host.listeners.get('tracksChanged')?.size).toBe(1);

    await act(async () => root?.unmount());
    root = null;
    container!.remove();
    songs = [track('a', { title: 'Reopened a' })];
    emit([{ track: songs[0], searchableChanged: true }]);
    expect(host.listeners.get('tracksChanged')?.size).toBe(0);

    await mountPanel();
    await settlePage();
    expect(container!.querySelector('.local-track-text strong')?.textContent).toBe('Reopened a');
});
