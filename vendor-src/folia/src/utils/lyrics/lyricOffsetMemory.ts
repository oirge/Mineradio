// src/utils/lyrics/lyricOffsetMemory.ts
// Per-song memory for the manual lyric-timeline offset (the "歌词时间轴偏移" control).
//
// The playback engine already exposes ONE shared, offset-applied lyric clock that every
// visualizer consumes, so this module deliberately does NOT touch any parsing, timing or
// visualizer logic. It only decides what the offset STARTS at when a song loads: the app used
// to reset it to 0 on every track change, throwing away a user's manual sync correction. Here we
// remember each song's last-used offset (keyed by the same song id the reset effect already uses)
// and restore it the next time that song plays. A self-contained add-on: persist a number, recall
// a number.
//
// Storage follows the project convention (direct localStorage, snake_case key): a single JSON map
// of songId -> offsetMs under 'lyric_timeline_offsets'.

const STORAGE_KEY = 'lyric_timeline_offsets';
// Safety valve so the map can't grow without bound over a library's lifetime. A Map keeps true
// insertion order within a session, so overflow drops the least-recently-written song.
const MAX_ENTRIES = 1000;

type SongKey = string | number | null | undefined;

let cache: Map<string, number> | null = null;

const normalizeKey = (songKey: SongKey): string | null => {
    if (songKey === null || songKey === undefined || songKey === '') {
        return null;
    }
    return String(songKey);
};

const hydrate = (): Map<string, number> => {
    if (cache) {
        return cache;
    }
    cache = new Map();
    if (typeof window === 'undefined') {
        return cache;
    }
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as Record<string, unknown>;
            for (const [key, value] of Object.entries(parsed)) {
                if (typeof value === 'number' && Number.isFinite(value) && value !== 0) {
                    cache.set(key, value);
                }
            }
        }
    } catch {
        // Corrupt or blocked storage: start empty. Never throw into the render/playback path.
    }
    return cache;
};

const persist = (map: Map<string, number>): void => {
    if (typeof window === 'undefined') {
        return;
    }
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(map)));
    } catch {
        // Storage full or blocked: keep the in-memory value, silently skip persistence.
    }
};

/** Saved offset (ms) for this song, or 0 when none was ever set - identical to the old reset default. */
export const readLyricOffset = (songKey: SongKey): number => {
    const key = normalizeKey(songKey);
    if (!key) {
        return 0;
    }
    return hydrate().get(key) ?? 0;
};

/** Remember (or forget, when 0) this song's manual offset. No-op without a stable song key. */
export const writeLyricOffset = (songKey: SongKey, offsetMs: number): void => {
    const key = normalizeKey(songKey);
    if (!key) {
        return;
    }
    const map = hydrate();
    // Re-key so the newest write moves to the end (keeps the overflow trim below LRU-ordered).
    map.delete(key);
    if (Number.isFinite(offsetMs) && offsetMs !== 0) {
        map.set(key, offsetMs);
    }
    while (map.size > MAX_ENTRIES) {
        const oldest = map.keys().next().value as string | undefined;
        if (oldest === undefined) {
            break;
        }
        map.delete(oldest);
    }
    persist(map);
};
