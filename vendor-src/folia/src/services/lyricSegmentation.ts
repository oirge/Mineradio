import { getFromCache, removeFromCache, saveToCache } from './db';
import type { LyricSegmentationRecord } from '../types/lyricSegmentation';
import type { SongResult } from '../types';
import { getPlaybackSongKey } from '../utils/appPlaybackGuards';
import { isLyricSegmentationRecord } from '../utils/lyrics/lyricSegmentationRecord';

// src/services/lyricSegmentation.ts
// Persists the per-song word segmentation a user produced with AI or by hand.
//
// The `lyricSeg_` prefix is chosen, not incidental. Keys starting with `lyric_` are swept by
// cacheRepository's 'lyrics' category, so a user clearing their lyric cache would silently destroy
// work that cost them either money or manual effort. `lyricSeg_` matches no category and lands in
// api_cache through getCacheTableName's fall-through. It IS still removed by "clear all caches",
// which is accepted: that action is explicitly a full reset.

const LYRIC_SEGMENTATION_KEY_PREFIX = 'lyricSeg_';

/** Uses the provider-prefixed playback key, not song.id, so providers cannot collide. */
export const getLyricSegmentationCacheKey = (song: SongResult): string => (
    `${LYRIC_SEGMENTATION_KEY_PREFIX}${getPlaybackSongKey(song)}`
);

/** Same lookup keyed by `getPlaybackSongKey` directly, for callers holding a key but no SongResult. */
export const loadSegmentationBySongKey = async (songKey: string): Promise<LyricSegmentationRecord | null> => {
    const cached = await getFromCache<unknown>(`${LYRIC_SEGMENTATION_KEY_PREFIX}${songKey}`);
    return isLyricSegmentationRecord(cached) ? cached : null;
};

export const loadSongSegmentation = async (song: SongResult): Promise<LyricSegmentationRecord | null> => (
    loadSegmentationBySongKey(getPlaybackSongKey(song))
);

export const saveSongSegmentation = async (
    song: SongResult,
    record: LyricSegmentationRecord,
): Promise<void> => {
    await saveToCache(getLyricSegmentationCacheKey(song), record);
};

export const deleteSongSegmentation = async (song: SongResult): Promise<void> => {
    await removeFromCache(getLyricSegmentationCacheKey(song));
};
