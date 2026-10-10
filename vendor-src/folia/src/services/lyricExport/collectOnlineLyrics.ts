import type { LyricData, OnlineLyricsState } from '../../types';
import { resolveOnlineLyrics, resolveOnlineLyricsPureMusic } from '../../utils/onlineLyricsState';
import { migrateLyricDataRenderHints } from '../../utils/lyrics/renderHints';
import { judgeLyricsForExport } from '../../utils/lyrics/exportableLyrics';
import { readCacheEntriesByKey } from '../repositories/cacheRepository';
import { LYRIC_CACHE_META_SUFFIX, type LyricCacheSongMetadata } from './lyricCacheMetadata';
import type { ExportableLyric, LyricCollectionResult, SkippedLyric } from './types';

// src/services/lyricExport/collectOnlineLyrics.ts
// Gathers every online song's effective lyrics from the `lyric_` cache.
//
// A song can own three entries: `lyric_<songKey>` (the provider's lyrics), `lyric_<songKey>_state`
// (the listener's choice: an imported file, a manual match, or "this is instrumental") and
// `lyric_<songKey>_meta` (display names and the song's own id, see lyricCacheMetadata). What gets
// exported is what playback would show, so lyrics and state are read together and
// `resolveOnlineLyrics` decides, exactly as `loadOnlineSongLyrics` does.
//
// The cache is read through the repository, not the db.ts wrapper: the wrapper turns a failed read
// into an empty list, which would report "nothing to export" instead of an error.

const LYRIC_PREFIX = 'lyric_';
const STATE_SUFFIX = '_state';
const ONLINE_PREFIX = 'online:';
const ONLINE_KEY_REGEX = /^online:([^:]+):(.+)$/;
// NetEase keys from before the provider-prefixed scheme (see getLegacySongResourceCacheKeys).
const LEGACY_NETEASE_KEY_REGEX = /^(?:cloud_)?(\d+)$/;

interface CacheGroup {
    songKey: string;
    providerId: string;
    mediaId: string;
    lyrics?: LyricData | null;
    state?: OnlineLyricsState | null;
    meta?: LyricCacheSongMetadata;
}

/** Maps a cache key body to its song identity, or null for keys this exporter does not own. */
export const parseOnlineLyricCacheKey = (body: string): Pick<CacheGroup, 'songKey' | 'providerId' | 'mediaId'> | null => {
    const online = body.match(ONLINE_KEY_REGEX);
    if (online) {
        return { songKey: body, providerId: online[1], mediaId: online[2] };
    }
    const legacy = body.match(LEGACY_NETEASE_KEY_REGEX);
    if (legacy) {
        return { songKey: `online:netease:${legacy[1]}`, providerId: 'netease', mediaId: legacy[1] };
    }
    return null;
};

const isLyricData = (value: unknown): value is LyricData => (
    Boolean(value) && typeof value === 'object' && Array.isArray((value as LyricData).lines)
);

export const collectOnlineLyrics = async (): Promise<LyricCollectionResult> => {
    const entries = await readCacheEntriesByKey<unknown>(key => key.startsWith(LYRIC_PREFIX), ['metadata_cache', 'api_cache']);
    const groups = new Map<string, CacheGroup>();

    for (const entry of entries) {
        const rawBody = entry.key.slice(LYRIC_PREFIX.length);
        const suffix = [STATE_SUFFIX, LYRIC_CACHE_META_SUFFIX].find(candidate => rawBody.endsWith(candidate));
        const identity = parseOnlineLyricCacheKey(suffix ? rawBody.slice(0, -suffix.length) : rawBody);
        if (!identity) continue;
        const isCurrentKey = rawBody.startsWith(ONLINE_PREFIX);

        // Playback only ever reads state from the provider-prefixed key (loadOnlineLyricsState
        // never looks at legacy keys), so a legacy `_state` left over from before the migration
        // must not decide anything here either. Legacy keys only lend lyrics.
        if (suffix && !isCurrentKey) continue;

        const group = groups.get(identity.songKey) ?? { ...identity };
        if (suffix === STATE_SUFFIX) {
            group.state = entry.data as OnlineLyricsState;
        } else if (suffix === LYRIC_CACHE_META_SUFFIX) {
            if (entry.data && typeof entry.data === 'object') group.meta = entry.data as LyricCacheSongMetadata;
        } else if (isLyricData(entry.data)) {
            // A provider-prefixed entry wins over a legacy one for the same song: it is what
            // playback migrated to and kept writing.
            if (!group.lyrics || isCurrentKey) {
                group.lyrics = migrateLyricDataRenderHints(entry.data).value;
            }
        }
        groups.set(identity.songKey, group);
    }

    const result: LyricCollectionResult = { entries: [], skipped: [] };
    for (const group of groups.values()) {
        // A names-only entry outlives nothing worth reporting: its lyrics were cleared separately.
        if (group.lyrics === undefined && group.state === undefined) continue;
        const skip = (reason: SkippedLyric['reason']) => result.skipped.push({ songKey: group.songKey, label: group.meta?.title, reason });
        const state = group.state ?? null;
        const resolved = resolveOnlineLyrics(state, group.lyrics ?? null);

        if (!resolved) {
            // No lyrics at all: either the listener's match concluded "instrumental", or nothing was found.
            skip(state?.hasOnlineOverride && !state.onlineOverrideLyrics ? 'pureMusic' : 'noLyrics');
            continue;
        }
        const verdict = judgeLyricsForExport(resolved, text => resolveOnlineLyricsPureMusic(state, text));
        if (verdict !== 'export') {
            skip(verdict);
            continue;
        }

        const { songId, ...names } = group.meta ?? {};
        const exportable: ExportableLyric = {
            songKey: group.songKey,
            lyrics: resolved,
            source: state?.lyricsSource === 'imported' && state.importedLyrics ? 'imported' : 'online',
            // Names come from the song, never from the lyrics' own `[ti:]` tag here: that tag may
            // belong to whichever version was matched. resolveExportMetadata falls back to it only
            // after the cached lists and the provider had their turn.
            song: { ...names, key: group.songKey },
            // The offset is stored under `song.id`; for QQ that is not the mediaId in the key.
            offsetKey: songId ?? group.mediaId,
            providerRef: { providerId: group.providerId, mediaId: group.mediaId },
        };
        result.entries.push(exportable);
    }

    return result;
};
