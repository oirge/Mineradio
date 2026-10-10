import { create } from 'zustand';
import type { LyricSegmentationRecord } from '../types/lyricSegmentation';

// src/stores/useLyricSegmentationStore.ts
// The saved word segmentation for the song that is playing right now.
//
// A store rather than a ref because three unrelated places read it: the lyric setter (which is
// synchronous and cannot await the IndexedDB load), the panel chip that lights up when a song has
// one, and the command surface that edits it. `songKey` is kept alongside the record so a load
// that resolves after the user has already skipped can be discarded instead of applied to the
// wrong song.

type LyricSegmentationState = {
    record: LyricSegmentationRecord | null;
    /** Playback key the record belongs to, or null when nothing is loaded. */
    songKey: string | null;
    setRecord: (songKey: string | null, record: LyricSegmentationRecord | null) => void;
    clear: () => void;
};

export const useLyricSegmentationStore = create<LyricSegmentationState>((set) => ({
    record: null,
    songKey: null,
    setRecord: (songKey, record) => set({ songKey, record }),
    clear: () => set({ songKey: null, record: null }),
}));

/** Read-only handle for the synchronous lyric setter, which must not subscribe. */
export const getLyricSegmentationRecord = (): LyricSegmentationRecord | null => (
    useLyricSegmentationStore.getState().record
);

export const setLyricSegmentationRecord: LyricSegmentationState['setRecord'] = (songKey, record) => (
    useLyricSegmentationStore.getState().setRecord(songKey, record)
);

export const clearLyricSegmentationRecord = () => useLyricSegmentationStore.getState().clear();
