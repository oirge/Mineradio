import type { SongResult } from '../../types';
import { getPlaybackSongKey } from '../../utils/appPlaybackGuards';
import { getCacheEntriesByKey } from '../db';
import { omni } from '../onlineMusic/omni';
import { saveLyricCacheSongMetadataBySongKey, songToExportMetadata, type LyricCacheSongMetadata } from './lyricCacheMetadata';
import type { FoliaLyricDocumentSong } from '../../utils/lyrics/foliaLyricDocument';
import { mapWithConcurrency, type ExportableLyric, type LyricExportRunContext } from './types';

// src/services/lyricExport/resolveExportMetadata.ts
// Fills in title / artist for export entries so files get readable names.
//
// Online lyric cache entries carry no song identity beyond their key, so names come from, in order:
// what the entry already has (the `_meta` sidecar, or the local library) -> song lists already
// cached on this device (playlists, the last queue) -> the provider, through Omni -> the lyrics'
// own `[ti:]` / `[ar:]` tags -> nothing (the file is then named after the key). A name that is only
// half known (title without artist) keeps looking, so files do not lose their artist.

const SONG_LIST_KEY = (key: string) => (
    key === 'last_queue'
    || key === 'last_song'
    || key === 'user_liked_songs'
    || key.startsWith('playlist_tracks_')
    || (key.startsWith('online_provider_') && key.includes('playlist_tracks_'))
);

const MAX_WALK_DEPTH = 3;
const ONLINE_LOOKUP_CONCURRENCY = 2;

const looksLikeSong = (value: unknown): value is SongResult => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    // `artists` is what tells a song apart from a playlist envelope that also has `id` and `name`.
    return (typeof candidate.id === 'number' || typeof candidate.id === 'string')
        && typeof candidate.name === 'string'
        && candidate.name.length > 0
        && (Array.isArray(candidate.artists) || Array.isArray(candidate.ar));
};

// Cached lists come in several envelopes (bare arrays, `{ tracks }`, `{ songs }`), so walk a few
// levels instead of hard-coding each one.
const collectSongs = (value: unknown, sink: SongResult[], depth = 0): void => {
    if (depth > MAX_WALK_DEPTH || !value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
        value.forEach(item => collectSongs(item, sink, depth + 1));
        return;
    }
    if (looksLikeSong(value)) {
        sink.push(value);
        return;
    }
    Object.values(value).forEach(item => collectSongs(item, sink, depth + 1));
};

/** songKey -> metadata (and the song's own id) from every song list already cached on this device. */
export const buildCachedSongMetadataIndex = async (): Promise<Map<string, LyricCacheSongMetadata>> => {
    const entries = await getCacheEntriesByKey<unknown>(SONG_LIST_KEY, ['metadata_cache', 'api_cache', 'user_cache']);
    const index = new Map<string, LyricCacheSongMetadata>();
    for (const entry of entries) {
        const songs: SongResult[] = [];
        collectSongs(entry.data, songs);
        for (const song of songs) {
            try {
                const key = getPlaybackSongKey(song);
                if (!index.has(key)) index.set(key, { ...songToExportMetadata(song), songId: song.id });
            } catch {
                // A malformed cached row must not stop the rest of the index.
            }
        }
    }
    return index;
};

/**
 * An online song's offset is stored under `song.id`, which the cache key does not always carry
 * (QQ keys by songMid). Whenever a lookup hands us the real song, its id replaces the guess.
 * Runs before applyUserAdjustments reads the offset.
 */
const offsetKeyFrom = (entry: ExportableLyric, songId: string | number | undefined) => (
    entry.providerRef && songId !== undefined && songId !== '' ? { offsetKey: songId } : {}
);

const isComplete = (song: FoliaLyricDocumentSong) => Boolean(song.title && song.artist);

/** Last resort: the lyrics' own `[ti:]` / `[ar:]` tags, only for whatever is still unknown. */
const withLyricTagFallback = (entry: ExportableLyric): ExportableLyric => (
    isComplete(entry.song)
        ? entry
        : { ...entry, song: mergeSong(entry.song, { title: entry.lyrics.title, artist: entry.lyrics.artist }) }
);

const mergeSong = (base: FoliaLyricDocumentSong, extra: FoliaLyricDocumentSong | undefined): FoliaLyricDocumentSong => ({
    ...base,
    title: base.title || extra?.title,
    artist: base.artist || extra?.artist,
    album: base.album || extra?.album,
    durationMs: base.durationMs || extra?.durationMs,
});

/** Returns entries with the best names available; never rejects because a lookup failed. */
export const resolveExportMetadata = async (
    entries: ExportableLyric[],
    { resolveOnline }: { resolveOnline: boolean },
    { signal, onProgress }: LyricExportRunContext = {},
): Promise<ExportableLyric[]> => {
    const index = await buildCachedSongMetadataIndex();
    const withCached = entries.map(entry => {
        if (isComplete(entry.song)) return entry;
        const cached = index.get(entry.songKey);
        return cached ? { ...entry, song: mergeSong(entry.song, cached), ...offsetKeyFrom(entry, cached.songId) } : entry;
    });

    const missing = resolveOnline
        ? withCached.map((entry, position) => ({ entry, position })).filter(({ entry }) => !isComplete(entry.song) && entry.providerRef)
        : [];
    if (missing.length > 0) {
        await lookUpOnline(withCached, missing, { signal, onProgress });
    }

    return withCached.map(withLyricTagFallback);
};

type MissingEntry = { entry: ExportableLyric; position: number };

const lookUpOnline = async (
    entries: ExportableLyric[],
    missing: MissingEntry[],
    { signal, onProgress }: LyricExportRunContext,
): Promise<void> => {
    let done = 0;
    onProgress?.({ phase: 'metadata', done, total: missing.length });
    await mapWithConcurrency(missing, ONLINE_LOOKUP_CONCURRENCY, async ({ entry, position }) => {
        try {
            const detail = await omni.getSongDetail(entry.providerRef!.providerId, entry.providerRef!.mediaId);
            if (detail) {
                const metadata = songToExportMetadata(detail);
                entries[position] = { ...entry, song: mergeSong(entry.song, metadata), ...offsetKeyFrom(entry, detail.id) };
                // Remember the answer (and the song's own id, which keys its offset) so the next
                // export of this song stays offline.
                await saveLyricCacheSongMetadataBySongKey(entry.songKey, { ...metadata, songId: detail.id });
            }
        } catch (error) {
            console.warn('[lyricExport] Song detail lookup failed', entry.songKey, error);
        }
        done += 1;
        onProgress?.({ phase: 'metadata', done, total: missing.length });
    }, signal);
};
