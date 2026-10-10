import type { UnifiedSong } from '../../types';
import type { HostTrack } from '../client';

// src/mineradio/local/wallCatalogData.ts
// Preserve display identities during catalog refreshes so a favorite change cannot reset either wall.
export type LocalWallSong = UnifiedSong & { isLocal: true; localRef: { songId: string } };
export interface WallCatalogSnapshot {
    scope: string;
    tracks: HostTrack[];
    songs: LocalWallSong[];
    loaded: boolean;
    loading: boolean;
    error: string;
}
export const hostTrackToWallSong = (track: HostTrack): LocalWallSong => ({
    id: track.id, name: track.title,
    artists: [{ id: '', name: track.artist }],
    album: { id: '', name: track.album, coverUrl: track.cover },
    durationMs: Math.max(0, track.duration || 0) * 1000,
    sourceRef: { kind: 'local', mediaId: track.id },
    isLocal: true, localRef: { songId: track.id },
});
export const emptyWallCatalog = (scope = ''): WallCatalogSnapshot => ({
    scope, tracks: [], songs: [], loaded: false, loading: true, error: '',
});
export const beginWallCatalogRefresh = (previous: WallCatalogSnapshot, scope: string): WallCatalogSnapshot => {
    if (previous.scope !== scope) return emptyWallCatalog(scope);
    const loading = !previous.loaded;
    return previous.loading === loading && !previous.error ? previous : { ...previous, loading, error: '' };
};

const TRACK_FIELDS: (keyof HostTrack)[] = ['id', 'title', 'artist', 'album', 'duration', 'cover', 'liked', 'filePath', 'format'];
const sameTrack = (previous: HostTrack, next: HostTrack): boolean => TRACK_FIELDS.every(key => previous[key] === next[key]);
const sameSong = (song: LocalWallSong, track: HostTrack): boolean => song.name === track.title
    && song.artists[0]?.name === track.artist && song.album.name === track.album && song.album.coverUrl === track.cover
    && song.durationMs === Math.max(0, track.duration || 0) * 1000;
const retainArray = <T,>(previous: T[], next: T[]): T[] => previous.length === next.length
    && previous.every((item, index) => item === next[index]) ? previous : next;

// Reuse by ID, then retain array identity too when order and displayed data have not changed.
export function completeWallCatalogRefresh(previous: WallCatalogSnapshot, scope: string, incoming: HostTrack[]): WallCatalogSnapshot {
    if (previous.scope !== scope) return previous;
    const byId = new Map(previous.tracks.map((track, index) => [track.id, { track, song: previous.songs[index] }]));
    const nextTracks: HostTrack[] = [], nextSongs: LocalWallSong[] = [];
    for (const track of incoming) {
        const old = byId.get(track.id);
        nextTracks.push(old && sameTrack(old.track, track) ? old.track : track);
        nextSongs.push(old?.song && sameSong(old.song, track) ? old.song : hostTrackToWallSong(track));
    }
    const tracks = retainArray(previous.tracks, nextTracks), songs = retainArray(previous.songs, nextSongs);
    if (tracks === previous.tracks && songs === previous.songs && previous.loaded && !previous.loading && !previous.error) return previous;
    return { scope, tracks, songs, loaded: true, loading: false, error: '' };
}
