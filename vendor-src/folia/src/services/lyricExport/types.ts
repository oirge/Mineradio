import type { LyricData } from '../../types';
import type { FoliaLyricDocumentSource, FoliaLyricDocumentSong } from '../../utils/lyrics/foliaLyricDocument';

// src/services/lyricExport/types.ts
// Shared shapes for the lyric export pipeline: collect -> adjust -> name -> package.

export type LyricExportFormat = 'fia' | 'lrc';

export type LyricExportScope = 'online' | 'local';

/** Where a missing title can be looked up online; only online cache entries carry one. */
export interface LyricExportProviderRef {
    providerId: string;
    mediaId: string;
}

/** One song's lyrics, ready to be adjusted and written. */
export interface ExportableLyric {
    /** `getPlaybackSongKey` form, e.g. `online:netease:123` or `local:abc`. */
    songKey: string;
    lyrics: LyricData;
    source: FoliaLyricDocumentSource;
    song: FoliaLyricDocumentSong;
    /** Key `lyricOffsetMemory` stores this song's offset under (the song's `id`). */
    offsetKey?: string | number;
    offsetMs?: number;
    providerRef?: LyricExportProviderRef;
    /**
     * Local songs only: the audio file's path relative to the library root, without its extension
     * (`Music/Album/01 Song`). Exported files are named and placed after it so they can be dropped
     * next to the audio as sidecars, which is how Folia's own scan and other players find lyrics.
     */
    localPath?: string;
}

export type LyricExportSkipReason = 'pureMusic' | 'noLyrics' | 'parseFailed';

export interface SkippedLyric {
    songKey: string;
    label?: string;
    reason: LyricExportSkipReason;
}

export interface LyricCollectionResult {
    entries: ExportableLyric[];
    skipped: SkippedLyric[];
}

export type LyricExportPhase = 'collect' | 'metadata' | 'package';

export interface LyricExportProgress {
    phase: LyricExportPhase;
    done: number;
    total: number;
}

export interface LyricExportOptions {
    scopes: LyricExportScope[];
    formats: LyricExportFormat[];
    includeTranslation: boolean;
    includeRomanization: boolean;
    /** Look missing titles up through Omni. Off keeps the export fully offline. */
    resolveOnlineMetadata: boolean;
}

export interface LyricExportRunContext {
    signal?: AbortSignal;
    onProgress?: (progress: LyricExportProgress) => void;
}

export const throwIfAborted = (signal?: AbortSignal): void => {
    if (signal?.aborted) {
        throw signal.reason instanceof Error ? signal.reason : new DOMException('Lyric export aborted', 'AbortError');
    }
};

/** Runs `worker` over `items` with at most `limit` in flight, preserving result order. */
export const mapWithConcurrency = async <T, R>(
    items: T[],
    limit: number,
    worker: (item: T, index: number) => Promise<R>,
    signal?: AbortSignal,
): Promise<R[]> => {
    const results = new Array<R>(items.length);
    let next = 0;
    const run = async () => {
        while (next < items.length) {
            throwIfAborted(signal);
            const index = next;
            next += 1;
            results[index] = await worker(items[index], index);
        }
    };
    await Promise.all(Array.from({ length: Math.min(Math.max(limit, 1), items.length) }, run));
    return results;
};
