import { useEffect, useRef, useState } from 'react';
import type { HostPlaylist, HostState } from '../client';
import type { LocalCommand } from './useLibraryPage';

// src/mineradio/local/usePlaybackPlaylists.ts
// Read collection summaries on catalog changes, never on continuous playhead updates.
export function usePlaybackPlaylists(state: HostState | null, command: LocalCommand) {
    const [playlists, setPlaylists] = useState<HostPlaylist[]>([]);
    const [loading, setLoading] = useState(true);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const mounted = useRef(false);
    const switching = useRef(false);
    const connected = state !== null;
    const currentId = state?.playbackPlaylistId || 'library';

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);
    useEffect(() => {
        if (!connected) return;
        let cancelled = false;
        setLoading(true);
        void command('listPlaylists').then((items: HostPlaylist[]) => {
            if (!cancelled) setPlaylists(items);
        }).catch(() => {}).finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => { cancelled = true; };
    }, [command, connected, state?.libraryRevision]);

    const switchPlaylist = async (id: string) => {
        if (!connected || loading || switching.current || id === currentId) return;
        if (!playlists.some(playlist => playlist.id === id && playlist.count > 0)) return;
        switching.current = true;
        setPendingId(id);
        try { await command('switchPlaylist', { playlistId: id }); }
        catch { /* useLocalPlayer owns the shared command error display. */ }
        finally {
            switching.current = false;
            if (mounted.current) setPendingId(null);
        }
    };

    return { playlists, loading, currentId, pendingId, switchPlaylist };
}
