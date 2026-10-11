import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeHost, type HostPage, type HostPlaylist, type HostState, type HostTrack } from '../client';

// src/mineradio/local/useLibraryPage.ts
// Bounded catalog requests; playing a row sends its collection identity, never just this page.
export type LocalCommand = (method: string, params?: Record<string, unknown>) => Promise<any>;
export const PAGE_SIZE = 60;
const SEARCH_RECHECK_DELAY_MS = 180;
const SEARCH_RECHECK_INTERVAL_MS = 3000;
const EMPTY_PAGE: HostPage<HostTrack> = { items: [], total: 0, offset: 0, limit: PAGE_SIZE };
function sameTrack(previous: HostTrack, next: HostTrack) {
    return previous.id === next.id && previous.title === next.title && previous.artist === next.artist
        && previous.album === next.album && previous.duration === next.duration && previous.cover === next.cover
        && previous.liked === next.liked && previous.filePath === next.filePath && previous.format === next.format;
}
function patchPageTracks(page: HostPage<HostTrack>, updates: ReadonlyMap<string, HostTrack>): HostPage<HostTrack> {
    let items: HostTrack[] | undefined;
    for (let index = 0; index < page.items.length; index++) {
        const previous = page.items[index];
        const next = updates.get(previous.id);
        if (next && !sameTrack(previous, next)) {
            items ??= page.items.slice();
            items[index] = next;
        }
    }
    return items ? { ...page, items } : page;
}
export function useLibraryPage(state: HostState | null, command: LocalCommand, queue: boolean,
    onTracksChanged?: (tracks: ReadonlyMap<string, HostTrack>) => void) {
    const [collection, setCollection] = useState('library');
    const [query, setQuery] = useState('');
    const [offset, setOffset] = useState(0);
    const [page, setPage] = useState(EMPTY_PAGE);
    const [playlists, setPlaylists] = useState<HostPlaylist[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const searchRecheck = useRef({ scope: '', lastRequestedAt: Number.NEGATIVE_INFINITY, skipDelay: false });
    const revision = queue ? state?.queueRevision : state?.libraryRevision;
    const scope = JSON.stringify([queue, collection, query, offset]);
    const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);
    useEffect(() => {
        let cancelled = false;
        void command('listPlaylists').then((items: HostPlaylist[]) => {
            if (!cancelled) setPlaylists(items);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [command, state?.libraryRevision, refreshKey]);
    useEffect(() => {
        if (searchRecheck.current.scope !== scope) {
            searchRecheck.current = { scope, lastRequestedAt: Number.NEGATIVE_INFINITY, skipDelay: false };
        }
        const skipDelay = searchRecheck.current.skipDelay;
        searchRecheck.current.skipDelay = false;
        let cancelled = false;
        let reading = true;
        let requestStarted = false;
        let recentUpdates: Map<string, HostTrack> | undefined = new Map();
        let searchDirtyAt: number | undefined;
        let searchTimer: number | undefined;
        let refreshQueued = false;
        const scheduleSearchRecheck = () => {
            if (cancelled || !query.trim() || reading || searchDirtyAt === undefined || refreshQueued || searchTimer !== undefined) return;
            const dueAt = Math.max(searchDirtyAt + SEARCH_RECHECK_DELAY_MS,
                searchRecheck.current.lastRequestedAt + SEARCH_RECHECK_INTERVAL_MS);
            searchTimer = window.setTimeout(() => {
                searchTimer = undefined;
                if (cancelled) return;
                refreshQueued = true;
                searchRecheck.current.lastRequestedAt = performance.now();
                searchRecheck.current.skipDelay = true;
                refresh();
            }, Math.max(0, dueAt - performance.now()));
        };
        setLoading(true);
        const unsubscribe = subscribeHost('tracksChanged', (data: {
            updates: Array<{ track: HostTrack; searchableChanged: boolean }>;
        }) => {
            if (cancelled || !Array.isArray(data?.updates)) return;
            const updates = new Map<string, HostTrack>();
            let searchableChanged = false;
            for (const update of data.updates) {
                if (!update.track?.id) continue;
                updates.set(update.track.id, update.track);
                if (reading) recentUpdates?.set(update.track.id, update.track);
                if (update.searchableChanged) searchableChanged = true;
            }
            if (!updates.size) return;
            setPage(previous => patchPageTracks(previous, updates));
            onTracksChanged?.(updates);
            if (query.trim() && searchableChanged && requestStarted) {
                searchDirtyAt ??= performance.now();
                scheduleSearchRecheck();
            }
        });
        const timer = window.setTimeout(() => {
            requestStarted = true;
            void command(queue ? 'getQueue' : 'listTracks', { playlistId: collection, query, offset, limit: PAGE_SIZE })
                .then((result: HostPage<HostTrack>) => {
                    if (cancelled) return;
                    const next = recentUpdates?.size ? patchPageTracks(result, recentUpdates) : result;
                    recentUpdates = undefined;
                    reading = false;
                    if (offset > 0 && offset >= result.total) { setOffset(0); return; }
                    setPage(next);
                    scheduleSearchRecheck();
                }).catch(() => {
                    if (!cancelled) {
                        recentUpdates = undefined;
                        reading = false;
                        setPage(EMPTY_PAGE);
                        scheduleSearchRecheck();
                    }
                })
                .finally(() => { if (!cancelled) setLoading(false); });
        }, query && !skipDelay ? SEARCH_RECHECK_DELAY_MS : 0);
        return () => {
            cancelled = true;
            recentUpdates = undefined;
            unsubscribe();
            window.clearTimeout(timer);
            if (searchTimer !== undefined) window.clearTimeout(searchTimer);
        };
    }, [command, collection, query, offset, queue, revision, refreshKey, onTracksChanged, refresh, scope]);
    return { collection, query, offset, page, playlists, loading, refresh, setOffset,
        chooseCollection: (id: string) => { setCollection(id); setOffset(0); },
        search: (text: string) => { setQuery(text); setOffset(0); },
    };
}
