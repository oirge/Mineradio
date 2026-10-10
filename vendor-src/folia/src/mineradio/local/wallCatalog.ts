import { useCallback, useEffect, useState } from 'react';
import type { HostPage, HostPlaylist, HostTrack } from '../client';
import type { LocalPlayer } from './playerTypes';
import { beginWallCatalogRefresh, completeWallCatalogRefresh, emptyWallCatalog } from './wallCatalogData';

// src/mineradio/local/wallCatalog.ts
// Both original Folia walls receive metadata from the one Mineradio catalog and transport.
export { hostTrackToWallSong, type LocalWallSong } from './wallCatalogData';

export function useLocalWallCatalog(player: LocalPlayer) {
    const [snapshot, setSnapshot] = useState(emptyWallCatalog);
    const [playlists, setPlaylists] = useState<HostPlaylist[]>([]);
    const [playlistId, setPlaylistId] = useState('library');
    const [query, setQuery] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);
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
        let cancelled = false;
        setSnapshot(previous => beginWallCatalogRefresh(previous, scope));
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
            if (!cancelled) setSnapshot(previous => completeWallCatalogRefresh(previous, scope, next));
        };
        const timer = window.setTimeout(() => {
            void readCollection().catch(failure => {
                if (!cancelled) setSnapshot(previous => previous.scope !== scope ? previous : {
                    ...previous, loading: false, error: failure instanceof Error ? failure.message : String(failure),
                });
            });
        }, query ? 180 : 0);
        return () => { cancelled = true; window.clearTimeout(timer); };
    }, [command, ready, revision, playlistId, query, scope, refreshKey]);

    // A changed filter must never expose the prior collection under the new playback context.
    const { tracks, songs, loading, error } = snapshot.scope === scope ? snapshot : emptyWallCatalog(scope);
    return { tracks, songs, playlists, playlistId, setPlaylistId, query, setQuery, loading, error, refresh };
}
