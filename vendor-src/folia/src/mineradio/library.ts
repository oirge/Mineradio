import type { LocalPlaylist, LocalSong } from '../types';
import type { LocalLibraryAssignment, LocalLibraryEntity } from '../types/localLibrary';
import { appDatabase } from '../services/appDatabase';
import { normalizeLocalLibraryName, splitLocalLibraryArtistNames } from '../utils/localLibraryNames';
import { isMineradioEmbedded, requestHost, subscribeHost, type HostPage, type HostPlaylist, type HostTrack } from './client';

// src/mineradio/library.ts
// This database is a disposable metadata projection. Mineradio remains the only
// owner of audio files, playlist membership and favorites.
const UPDATED_EVENT = 'folia-local-music-updated';
let playlists: LocalPlaylist[] = [];
let generation = 1;
let synchronizedGeneration = 0;
let synchronization: Promise<void> | null = null;
let subscribed = false;
let mutationQueue: Promise<unknown> = Promise.resolve();
let metadataSignature = '';

export function hostTrackToLocalSong(track: HostTrack): LocalSong {
    const filePath = (track.filePath || `Mineradio/${track.title || track.id}`).replace(/\\/gu, '/');
    const separator = filePath.lastIndexOf('/');
    const artistNames = splitLocalLibraryArtistNames(track.artist);
    return {
        id: track.id,
        fileName: filePath.slice(separator + 1),
        filePath,
        folderName: separator > 0 ? filePath.slice(0, separator) : 'Mineradio',
        duration: Math.max(0, Number(track.duration) || 0) * 1000,
        fileSize: 0,
        mimeType: track.format ? `audio/${track.format.toLowerCase()}` : 'audio/mpeg',
        addedAt: 0,
        title: track.title || filePath.slice(separator + 1),
        titleOrigin: 'import',
        importedMetadata: { title: track.title, titleSource: 'embedded', artistNames, albumName: track.album || undefined },
        noAutoMatch: true,
        useOnlineCover: Boolean(track.cover),
        onlineMetadata: track.cover ? {
            source: 'netease',
            artists: artistNames.map(name => ({ name })),
            album: track.album ? { name: track.album } : undefined,
            coverUrl: track.cover,
            matchMode: 'legacy',
            matchedAt: 0,
        } : undefined,
    };
}

export async function readAllHostTracks(playlistId = 'library'): Promise<HostTrack[]> {
    const tracks: HostTrack[] = [];
    let offset = 0;
    for (;;) {
        const page = await requestHost<HostPage<HostTrack>>('listTracks', { playlistId, offset, limit: 1000 });
        tracks.push(...page.items);
        offset += page.items.length;
        if (offset >= page.total) return tracks;
        if (page.items.length === 0) throw new Error('Mineradio 曲库分页未完成，请刷新重试');
    }
}

export function buildHostCatalog(songs: LocalSong[]): { entities: LocalLibraryEntity[]; assignments: LocalLibraryAssignment[] } {
    const entities = new Map<string, LocalLibraryEntity>();
    const assignments: LocalLibraryAssignment[] = [];
    const entityId = (kind: 'artist' | 'album', name: string, context = '') => {
        const normalized = normalizeLocalLibraryName(name);
        const id = `mineradio:${kind}:${encodeURIComponent(context)}:${encodeURIComponent(normalized)}`;
        if (!entities.has(id)) entities.set(id, {
            id, kind, displayName: name, aliases: [name], normalizedAliases: [normalized], createdAt: 0, updatedAt: 0,
        });
        return id;
    };
    for (const song of songs) {
        const artists = song.importedMetadata.artistNames;
        const album = song.importedMetadata.albumName;
        assignments.push({
            songId: song.id,
            artistEntityIds: artists.map(name => entityId('artist', name)),
            artistOrigin: 'import',
            albumEntityId: album ? entityId('album', album, artists.map(normalizeLocalLibraryName).sort().join('|')) : undefined,
            albumOrigin: 'import',
            updatedAt: 0,
        });
    }
    return { entities: [...entities.values()], assignments };
}

function watchHostLibrary(): void {
    if (subscribed || !isMineradioEmbedded()) return;
    subscribed = true;
    subscribeHost('libraryChanged', () => {
        generation += 1;
        void ensureMineradioLibrary().catch(error => console.error('[Mineradio] Library refresh failed', error));
    });
}

export function ensureMineradioLibrary(force = false): Promise<void> {
    if (!isMineradioEmbedded()) return Promise.resolve();
    watchHostLibrary();
    if (force) generation += 1;
    if (synchronization) return synchronization;
    if (synchronizedGeneration === generation) return Promise.resolve();
    synchronization = Promise.resolve().then(async () => {
        while (synchronizedGeneration !== generation) {
            const targetGeneration = generation;
            const [tracks, hostPlaylists] = await Promise.all([
                readAllHostTracks(), requestHost<HostPlaylist[]>('listPlaylists'),
            ]);
            const nextPlaylists: LocalPlaylist[] = [];
            // Read-only all-music is already represented by Folia's library view.
            for (const playlist of hostPlaylists) {
                if (playlist.id === 'library') continue;
                const members = await readAllHostTracks(playlist.id);
                nextPlaylists.push({
                    id: playlist.id, name: playlist.name, songIds: members.map(track => track.id),
                    isFavorite: playlist.id === 'special-liked', createdAt: 0, updatedAt: targetGeneration,
                });
            }
            // A newer library event invalidates every page in the in-flight snapshot.
            if (targetGeneration !== generation) continue;
            // Favorites and playlist edits do not rewrite the entire indexed catalog.
            const nextSignature = JSON.stringify(tracks.map(({ liked: _liked, ...track }) => track));
            if (nextSignature !== metadataSignature) {
                const songs = tracks.map(hostTrackToLocalSong);
                const catalog = buildHostCatalog(songs);
                await appDatabase.transaction('rw', [appDatabase.local_music, appDatabase.local_library_entities, appDatabase.local_library_assignments], async () => {
                    await appDatabase.local_music.clear();
                    await appDatabase.local_library_entities.clear();
                    await appDatabase.local_library_assignments.clear();
                    await appDatabase.local_music.bulkPut(songs);
                    await appDatabase.local_library_entities.bulkPut(catalog.entities);
                    await appDatabase.local_library_assignments.bulkPut(catalog.assignments);
                });
                metadataSignature = nextSignature;
            }
            playlists = nextPlaylists;
            synchronizedGeneration = targetGeneration;
        }
    }).finally(() => { synchronization = null; });
    // Publish after the synchronization lock is released; UI readers share this snapshot.
    void synchronization.then(() => window.dispatchEvent(new Event(UPDATED_EVENT)), () => undefined);
    return synchronization;
}

export async function getMineradioPlaylists(): Promise<LocalPlaylist[]> {
    await ensureMineradioLibrary();
    return playlists.map(playlist => ({ ...playlist, songIds: [...playlist.songIds] }));
}

function serializeMutation<T>(work: () => Promise<T>): Promise<T> {
    const pending = mutationQueue.then(work, work);
    mutationQueue = pending.catch(() => undefined);
    return pending;
}

export async function createMineradioPlaylist(name: string, songIds: string[] = []): Promise<LocalPlaylist> {
    return serializeMutation(async () => {
        const playlist = await requestHost<HostPlaylist>('createPlaylist', { name: name.trim() });
        if (songIds.length) await requestHost('setPlaylistTracks', { playlistId: playlist.id, trackIds: [...new Set(songIds)] });
        await ensureMineradioLibrary(true);
        const result = playlists.find(item => item.id === playlist.id);
        if (!result) throw new Error('新歌单尚未同步，请刷新重试');
        return { ...result, songIds: [...result.songIds] };
    });
}

export async function updateMineradioPlaylist(id: string, updater: (playlist: LocalPlaylist) => LocalPlaylist): Promise<LocalPlaylist | null> {
    return serializeMutation(async () => {
        await ensureMineradioLibrary();
        const current = playlists.find(item => item.id === id);
        if (!current) return null;
        const next = updater({ ...current, songIds: [...current.songIds] });
        const songIds = [...new Set(next.songIds)];
        if (!current.isFavorite && current.name !== next.name) await requestHost('renamePlaylist', { id, name: next.name.trim() });
        if (songIds.length !== current.songIds.length || songIds.some((songId, index) => songId !== current.songIds[index])) {
            await requestHost('setPlaylistTracks', { playlistId: id, trackIds: songIds });
        }
        await ensureMineradioLibrary(true);
        const result = playlists.find(item => item.id === id);
        return result ? { ...result, songIds: [...result.songIds] } : null;
    });
}

export async function deleteMineradioPlaylist(id: string): Promise<void> {
    if (id === 'library' || id === 'special-liked') return;
    return serializeMutation(async () => {
        await requestHost('deletePlaylist', { id });
        await ensureMineradioLibrary(true);
    });
}

export async function saveMineradioPlaylists(next: LocalPlaylist[]): Promise<LocalPlaylist[]> {
    const previous = await getMineradioPlaylists();
    for (const playlist of next) {
        if (previous.some(item => item.id === playlist.id)) await updateMineradioPlaylist(playlist.id, () => playlist);
        else await createMineradioPlaylist(playlist.name, playlist.songIds);
    }
    for (const playlist of previous) {
        if (!playlist.isFavorite && !next.some(item => item.id === playlist.id)) await deleteMineradioPlaylist(playlist.id);
    }
    return getMineradioPlaylists();
}

export async function importMineradioFiles(kind: 'folder' | 'files'): Promise<LocalSong[]> {
    await requestHost(kind === 'folder' ? 'importFolder' : 'importFiles');
    await ensureMineradioLibrary(true);
    return appDatabase.local_music.toArray();
}

export function requireMineradioLibraryManagement(): never {
    throw new Error('请切回 Mineradio，在曲库管理中移除目录；不会删除磁盘文件。');
}
