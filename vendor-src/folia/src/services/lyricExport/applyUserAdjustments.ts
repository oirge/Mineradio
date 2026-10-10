import { applyLyricWordSegmentation } from '../../utils/lyrics/lyricSegmentationRecord';
import { readLyricOffset } from '../../utils/lyrics/lyricOffsetMemory';
import { loadSegmentationBySongKey } from '../lyricSegmentation';
import type { ExportableLyric } from './types';

// src/services/lyricExport/applyUserAdjustments.ts
// Folds the listener's own per-song work into an export entry.
//
// Saved word segmentation cost the listener money (AI) or effort (manual) and cannot be rebuilt, so
// it is baked into `wordSegments` the same way createLyricsSetter bakes it for playback. The manual
// timeline offset is only recorded next to the lyrics: shifting the timeline would make the file
// wrong for anyone whose copy of the audio is already in sync.

export const applyUserAdjustments = async (entry: ExportableLyric): Promise<ExportableLyric> => {
    const record = await loadSegmentationBySongKey(entry.songKey);
    const lyrics = applyLyricWordSegmentation(entry.lyrics, record) ?? entry.lyrics;
    const offsetMs = entry.offsetKey !== undefined ? readLyricOffset(entry.offsetKey) : 0;
    return {
        ...entry,
        lyrics,
        ...(offsetMs ? { offsetMs } : {}),
    };
};
