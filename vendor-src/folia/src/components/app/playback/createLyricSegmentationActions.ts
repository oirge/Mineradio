import i18n from '../../../i18n/config';
import type { LyricData, SongResult } from '../../../types';
import type { LyricSegmentationSource } from '../../../types/lyricSegmentation';
import { deleteSongSegmentation, saveSongSegmentation } from '../../../services/lyricSegmentation';
import { setLyricSegmentationRecord } from '../../../stores/useLyricSegmentationStore';
import { setStatusMessage as setStatusMsg } from '../../../stores/useStatusMessageStore';
import { createLyricSegmentationRecord } from '../../../utils/lyrics/lyricSegmentationRecord';
import { getPlaybackSongKey } from '../../../utils/appPlaybackGuards';

// src/components/app/playback/createLyricSegmentationActions.ts
// Save and reset for the current song's word segmentation.
//
// Same shape as createLyricFilterPatternSaver, and for the same reason: changing the setting is
// only half the job. The lines already on screen were built with the old split, so the song's
// lyrics have to be laid out again through the normal pipeline — which is what re-fetching the
// preview and handing it back to setLyrics does. Writing the store first means that pass picks the
// new record up.

type CreateLyricSegmentationActionsParams = {
    getCurrentSong: () => SongResult | null;
    loadCurrentSongLyricPreview: () => Promise<LyricData | null>;
    setLyrics: (lyrics: LyricData | null) => void;
};

export type LyricSegmentationActions = {
    save: (lines: Record<string, string[]>, source: LyricSegmentationSource) => Promise<void>;
    reset: () => Promise<void>;
};

export const createLyricSegmentationActions = ({
    getCurrentSong,
    loadCurrentSongLyricPreview,
    setLyrics,
}: CreateLyricSegmentationActionsParams): LyricSegmentationActions => {
    const relayoutCurrentLyrics = async () => {
        setLyrics(await loadCurrentSongLyricPreview());
    };

    return {
        save: async (lines, source) => {
            const song = getCurrentSong();
            if (!song) {
                return;
            }

            const record = createLyricSegmentationRecord(getPlaybackSongKey(song), source, lines);
            await saveSongSegmentation(song, record);
            setLyricSegmentationRecord(record.songKey, record);
            await relayoutCurrentLyrics();
            setStatusMsg({ type: 'success', text: i18n.t('lyricSegmentation.saved') });
        },

        reset: async () => {
            const song = getCurrentSong();
            if (!song) {
                return;
            }

            await deleteSongSegmentation(song);
            setLyricSegmentationRecord(getPlaybackSongKey(song), null);
            await relayoutCurrentLyrics();
            setStatusMsg({ type: 'success', text: i18n.t('lyricSegmentation.restored') });
        },
    };
};
