import type { UnifiedSong } from '../../types';
import type { HostTrack } from '../client';

// src/mineradio/local/wallCatalogData.ts
// Preserve display identities during catalog refreshes so a favorite change cannot reset either wall.
export type LocalWallSong = UnifiedSong & { isLocal: true; localRef: { songId: string } };
export interface WallCatalogSnapshot {
    scope: string;
    tracks: HostTrack[];
    songs: LocalWallSong[];
    trackIndex: ReadonlyMap<string, number>;
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
    scope, tracks: [], songs: [], trackIndex: new Map(), loaded: false, loading: true, error: '',
});
export const beginWallCatalogRefresh = (previous: WallCatalogSnapshot, scope: string): WallCatalogSnapshot => {
    if (previous.scope !== scope) return emptyWallCatalog(scope);
    const loading = !previous.loaded;
    return previous.loading === loading && !previous.error ? previous : { ...previous, loading, error: '' };
};

const sameTrack = (previous: HostTrack, next: HostTrack): boolean => previous.id === next.id
    && previous.title === next.title && previous.artist === next.artist && previous.album === next.album
    && previous.duration === next.duration && previous.cover === next.cover && previous.liked === next.liked
    && previous.filePath === next.filePath && previous.format === next.format;
const sameSong = (song: LocalWallSong, track: HostTrack): boolean => song.name === track.title
    && song.artists[0]?.name === track.artist && song.album.name === track.album && song.album.coverUrl === track.cover
    && song.durationMs === Math.max(0, track.duration || 0) * 1000;

export function patchWallCatalogTracks(previous: WallCatalogSnapshot, scope: string, updates: readonly HostTrack[]): WallCatalogSnapshot {
    if (previous.scope !== scope || !previous.loaded) return previous;
    let tracks: HostTrack[] | undefined, songs: LocalWallSong[] | undefined;
    for (const track of updates) {
        const index = previous.trackIndex.get(track.id);
        if (index === undefined) continue;
        const oldTrack = tracks?.[index] ?? previous.tracks[index];
        const oldSong = songs?.[index] ?? previous.songs[index];
        if (!sameTrack(oldTrack, track)) {
            tracks ??= previous.tracks.slice();
            tracks[index] = track;
        }
        if (!sameSong(oldSong, track)) {
            songs ??= previous.songs.slice();
            songs[index] = hostTrackToWallSong(track);
        }
    }
    return tracks || songs ? { ...previous, tracks: tracks ?? previous.tracks, songs: songs ?? previous.songs } : previous;
}

// Reuse by ID and keep the index when collection order does not change.
export function completeWallCatalogRefresh(previous: WallCatalogSnapshot, scope: string, incoming: HostTrack[],
    recentUpdates?: ReadonlyMap<string, HostTrack>): WallCatalogSnapshot {
    if (previous.scope !== scope) return previous;
    const sameLength = previous.tracks.length === incoming.length;
    let trackIndex: Map<string, number> | undefined = sameLength ? undefined : new Map();
    const nextTracks = new Array<HostTrack>(incoming.length);
    const nextSongs = new Array<LocalWallSong>(incoming.length);
    let tracksChanged = !sameLength, songsChanged = previous.songs.length !== incoming.length;
    for (let index = 0; index < incoming.length; index++) {
        const track = recentUpdates?.get(incoming[index].id) ?? incoming[index];
        const samePosition = previous.tracks[index]?.id === track.id;
        if (!samePosition && !trackIndex) {
            trackIndex = new Map();
            for (let previousIndex = 0; previousIndex < index; previousIndex++) {
                trackIndex.set(nextTracks[previousIndex].id, previousIndex);
            }
        }
        trackIndex?.set(track.id, index);
        const previousIndex = samePosition ? index : (previous.trackIndex.get(track.id) ?? -1);
        const oldTrack = previousIndex >= 0 ? previous.tracks[previousIndex] : undefined;
        const oldSong = previousIndex >= 0 ? previous.songs[previousIndex] : undefined;
        const nextTrack = oldTrack && sameTrack(oldTrack, track) ? oldTrack : track;
        const nextSong = oldSong && sameSong(oldSong, track) ? oldSong : hostTrackToWallSong(track);
        nextTracks[index] = nextTrack;
        nextSongs[index] = nextSong;
        if (nextTrack !== previous.tracks[index]) tracksChanged = true;
        if (nextSong !== previous.songs[index]) songsChanged = true;
    }
    const tracks = tracksChanged ? nextTracks : previous.tracks;
    const songs = songsChanged ? nextSongs : previous.songs;
    if (tracks === previous.tracks && songs === previous.songs && previous.loaded && !previous.loading && !previous.error) return previous;
    return { scope, tracks, songs, trackIndex: trackIndex ?? previous.trackIndex, loaded: true, loading: false, error: '' };
}
