import { useEffect, useState } from 'react';
import { subscribeHost, type HostPage, type HostPlaylist, type HostState, type HostTrack } from '../client';
import type { LocalCommand } from './useLibraryPage';

// src/mineradio/local/useLocalCommandCatalog.ts
// Bounded search pages are fetched only while the command dialog is mounted; late queries are ignored.
export const COMMAND_PAGE_SIZE = 20;
const EMPTY: HostPage<HostTrack> = { items: [], total: 0, offset: 0, limit: COMMAND_PAGE_SIZE };
export function useLocalCommandCatalog(state: HostState | null, command: LocalCommand, query: string, collection: string, offset: number) {
    const [playlists, setPlaylists] = useState<HostPlaylist[]>([]);
    const [record, setRecord] = useState<{ key: string; page: HostPage<HostTrack>; error?: boolean } | null>(null);
    const [revision, setRevision] = useState(0);
    const key = JSON.stringify([query, collection, offset, state?.libraryRevision, revision]);
    const connected = state !== null;
    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const unsubscribe = subscribeHost('tracksChanged', (data: { updates?: Array<{ track: HostTrack; searchableChanged: boolean }> }) => {
            if (!Array.isArray(data?.updates)) return;
            const updates = new Map(data.updates.filter(update => update.track?.id).map(update => [update.track.id, update.track]));
            setRecord(previous => previous ? { ...previous, page: { ...previous.page,
                items: previous.page.items.map(track => updates.get(track.id) ?? track) } } : previous);
            if (query.trim() && data.updates.some(update => update.searchableChanged) && timer === undefined) {
                timer = setTimeout(() => { timer = undefined; setRevision(value => value + 1); }, 3000);
            }
        });
        return () => { unsubscribe(); clearTimeout(timer); };
    }, [query]);
    useEffect(() => {
        if (!connected) return;
        let cancelled = false;
        void command('listPlaylists').then((result: HostPlaylist[]) => { if (!cancelled) setPlaylists(result); }).catch(() => {});
        return () => { cancelled = true; };
    }, [command, connected, state?.libraryRevision, revision]);
    useEffect(() => {
        if (!connected) return;
        let cancelled = false;
        const timer = setTimeout(() => {
            void command('listTracks', { playlistId: collection, query, offset, limit: COMMAND_PAGE_SIZE })
                .then((page: HostPage<HostTrack>) => {
                    if (cancelled) return;
                    if (offset > 0 && offset >= page.total) { setRecord({ key, page: { ...EMPTY, total: page.total } }); return; }
                    setRecord({ key, page });
                }).catch(() => { if (!cancelled) setRecord({ key, page: EMPTY, error: true }); });
        }, query ? 150 : 0);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [command, connected, key, collection, query, offset]);
    const current = record?.key === key ? record : null;
    return { playlists, page: current?.page ?? EMPTY, loading: connected && !current,
        error: current?.error ?? false, refresh: () => setRevision(value => value + 1) };
}
