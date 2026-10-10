// src/types/lyricSegmentation.ts
// Cross-layer contract for the per-song word segmentation a user saves for their lyrics.
//
// Lives in types/ rather than next to the service because four layers read it: the service that
// persists it, the util that bakes it onto Line objects, the command surface that edits it, and
// the AI client that produces it.

/** How a saved segmentation was produced. Shown in the surface so users can tell them apart. */
export type LyricSegmentationSource = 'ai' | 'manual';

export interface LyricSegmentationRecord {
    version: 1;
    /** Provider-prefixed playback key from getPlaybackSongKey, not the raw song id. */
    songKey: string;
    updatedAt: number;
    source: LyricSegmentationSource;
    /**
     * Line key -> word boundaries for that line. Each boundary array joins back to the line's
     * fullText exactly; a line whose key is absent keeps the default Intl.Segmenter split.
     */
    lines: Record<string, string[]>;
}

export const LYRIC_SEGMENTATION_RECORD_VERSION = 1;
