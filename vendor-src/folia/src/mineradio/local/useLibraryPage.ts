import { useCallback, useEffect, useState } from 'react';
import type { HostPage, HostPlaylist, HostState, HostTrack } from '../client';

// src/mineradio/local/useLibraryPage.ts
// Bounded catalog requests; playing a row sends its collection identity, never just this page.
export type LocalCommand = (method: string, params?: Record<string, unknown>) => Promise<any>;
export const PAGE_SIZE = 60;
const EMPTY_PAGE: HostPage<HostTrack> = { items: [], total: 0, offset: 0, limit: PAGE_SIZE };
export function useLibraryPage(state: HostState | null, command: LocalCommand, queue: boolean) {
    const [collection, setCollection] = useState('library');
    const [query, setQuery] = useState('');
    const [offset, setOffset] = useState(0);
    const [page, setPage] = useState(EMPTY_PAGE);
    const [playlists, setPlaylists] = useState<HostPlaylist[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const revision = queue ? state?.queueRevision : state?.libraryRevision;
    const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);
    useEffect(() => {
        let cancelled = false;
        void command('listPlaylists').then((items: HostPlaylist[]) => {
            if (!cancelled) setPlaylists(items);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [command, state?.libraryRevision, refreshKey]);
    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        const timer = window.setTimeout(() => {
            void command(queue ? 'getQueue' : 'listTracks', { playlistId: collection, query, offset, limit: PAGE_SIZE })
                .then((result: HostPage<HostTrack>) => {
                    if (cancelled) return;
                    if (offset > 0 && offset >= result.total) { setOffset(0); return; }
                    setPage(result);
                }).catch(() => { if (!cancelled) setPage(EMPTY_PAGE); })
                .finally(() => { if (!cancelled) setLoading(false); });
        }, query ? 180 : 0);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [command, collection, query, offset, queue, revision, refreshKey]);
    return { collection, query, offset, page, playlists, loading, refresh, setOffset,
        chooseCollection: (id: string) => { setCollection(id); setOffset(0); },
        search: (text: string) => { setQuery(text); setOffset(0); },
    };
}
