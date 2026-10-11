import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribeHost, type HostPage, type HostPlaylist, type HostTrack } from '../client';
import type { LocalPlayer } from './playerTypes';
import { beginWallCatalogRefresh, completeWallCatalogRefresh, emptyWallCatalog, patchWallCatalogTracks } from './wallCatalogData';

// src/mineradio/local/wallCatalog.ts
// Both original Folia walls receive metadata from the one Mineradio catalog and transport.
export { hostTrackToWallSong, type LocalWallSong } from './wallCatalogData';

const SEARCH_RECHECK_DELAY_MS = 180;
const SEARCH_RECHECK_INTERVAL_MS = 3000;

export function useLocalWallCatalog(player: LocalPlayer) {
    const [snapshot, setSnapshot] = useState(emptyWallCatalog);
    const [playlists, setPlaylists] = useState<HostPlaylist[]>([]);
    const [playlistId, setPlaylistId] = useState('library');
    const [query, setQuery] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);
    const searchRecheck = useRef({ scope: '', lastRequestedAt: Number.NEGATIVE_INFINITY, skipDelay: false });
    const refresh = useCallback(() => setRefreshKey(value => value + 1), []);
    const ready = Boolean(player.state);
    const revision = player.state?.libraryRevision;
    const command = player.command;
    const scope = JSON.stringify([playlistId, query]);

    useEffect(() => {
        if (!ready) return;
        let cancelled = false;
        void command<HostPlaylist[]>('listPlaylists').then(items => {
            if (!cancelled) setPlaylists(items);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [command, ready, revision, refreshKey]);

    useEffect(() => {
        if (!ready) return;
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
            if (cancelled || !query || reading || searchDirtyAt === undefined || refreshQueued || searchTimer !== undefined) return;
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
        setSnapshot(previous => beginWallCatalogRefresh(previous, scope));
        const unsubscribe = subscribeHost('tracksChanged', (data: {
            updates: Array<{ track: HostTrack; searchableChanged: boolean }>;
        }) => {
            if (cancelled || !Array.isArray(data?.updates)) return;
            const tracks: HostTrack[] = [];
            let searchableChanged = false;
            for (const update of data.updates) {
                if (!update.track?.id) continue;
                tracks.push(update.track);
                if (reading) recentUpdates?.set(update.track.id, update.track);
                if (update.searchableChanged) searchableChanged = true;
            }
            if (!tracks.length) return;
            setSnapshot(previous => patchWallCatalogTracks(previous, scope, tracks));
            if (query && searchableChanged && requestStarted) {
                searchDirtyAt ??= performance.now();
                scheduleSearchRecheck();
            }
        });
        // Page IPC payloads; renderers virtualize the complete collection without changing its queue.
        const readCollection = async () => {
            const next: HostTrack[] = [];
            let offset = 0;
            while (!cancelled) {
                const page = await command<HostPage<HostTrack>>('listTracks', { playlistId, query, offset, limit: 1000 });
                if (cancelled) return;
                next.push(...page.items);
                offset += page.items.length;
                if (offset >= page.total || page.items.length === 0) break;
            }
            if (!cancelled) {
                const overlay = recentUpdates?.size ? recentUpdates : undefined;
                recentUpdates = undefined;
                reading = false;
                setSnapshot(previous => completeWallCatalogRefresh(previous, scope, next, overlay));
                scheduleSearchRecheck();
            }
        };
        const timer = window.setTimeout(() => {
            requestStarted = true;
            void readCollection().catch(failure => {
                if (!cancelled) {
                    recentUpdates = undefined;
                    reading = false;
                    setSnapshot(previous => previous.scope !== scope ? previous : {
                        ...previous, loading: false, error: failure instanceof Error ? failure.message : String(failure),
                    });
                    scheduleSearchRecheck();
                }
            });
        }, query && !skipDelay ? SEARCH_RECHECK_DELAY_MS : 0);
        return () => {
            cancelled = true;
            recentUpdates = undefined;
            unsubscribe();
            window.clearTimeout(timer);
            if (searchTimer !== undefined) window.clearTimeout(searchTimer);
        };
    }, [command, ready, revision, playlistId, query, scope, refreshKey]);

    // A changed filter must never expose the prior collection under the new playback context.
    const { tracks, songs, loading, error } = snapshot.scope === scope ? snapshot : emptyWallCatalog(scope);
    return { tracks, songs, playlists, playlistId, setPlaylistId, query, setQuery, loading, error, refresh };
}
