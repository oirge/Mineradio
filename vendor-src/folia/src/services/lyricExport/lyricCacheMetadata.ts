import type { SongResult } from '../../types';
import type { FoliaLyricDocumentSong } from '../../utils/lyrics/foliaLyricDocument';
import { saveToCache } from '../db';
import { getSongResourceCacheKey } from '../onlineMusic/resourceKeys';
import { getSongAlbumLabel, getSongArtistLabel, getSongDurationMs } from '../onlineMusic/songMetadata';

// src/services/lyricExport/lyricCacheMetadata.ts
// Records a song's display names next to its cached lyrics, so a later export can name the file
// without a network lookup.
//
// Kept in its own `lyric_<songKey>_meta` entry rather than stamped onto the cached LyricData:
// `LyricData.title/artist` feed staff-credit detection (staffCreditsPolicy), and filling them in
// would quietly change which lines playback hides. The `lyric_` prefix keeps it in the lyrics
// cache category, so clearing lyrics clears it too.

export const LYRIC_CACHE_META_SUFFIX = '_meta';

/**
 * What the sidecar holds: the display names, plus the song's own `id`.
 *
 * `songId` is kept because the per-song timeline offset is stored under `song.id`, and that is not
 * always the id inside the cache key: QQ keys lyrics by songMid but the song's `id` is the numeric
 * songId. Without it the batch export could not find a QQ song's offset.
 */
export type LyricCacheSongMetadata = FoliaLyricDocumentSong & { songId?: string | number };

export const songToExportMetadata = (song: SongResult): FoliaLyricDocumentSong => {
    const durationMs = getSongDurationMs(song);
    return {
        title: song.name || undefined,
        artist: getSongArtistLabel(song) || undefined,
        album: getSongAlbumLabel(song) || undefined,
        ...(durationMs > 0 ? { durationMs } : {}),
    };
};

export const getLyricCacheMetadataKey = (song: SongResult): string => (
    `${getSongResourceCacheKey('lyric', song)}${LYRIC_CACHE_META_SUFFIX}`
);

/** Fire-and-forget companion to writing `lyric_<songKey>`; a failure only costs a nicer file name. */
export const saveLyricCacheSongMetadata = (song: SongResult): void => {
    const metadata: LyricCacheSongMetadata = { ...songToExportMetadata(song), songId: song.id };
    void saveToCache(getLyricCacheMetadataKey(song), metadata);
};

/** Same record keyed by `getPlaybackSongKey`, for the exporter's write-back after an Omni lookup. */
export const saveLyricCacheSongMetadataBySongKey = async (songKey: string, metadata: LyricCacheSongMetadata): Promise<void> => {
    if (!metadata.title) return;
    await saveToCache(`lyric_${songKey}${LYRIC_CACHE_META_SUFFIX}`, metadata);
};
