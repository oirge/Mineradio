import type { LocalSong } from '../../types';
import { resolveExplicitFileTimedLyricFormat } from './formatDetection';

// src/utils/lyrics/localLyricsUpload.ts
// Builds the local-song record written when a user uploads a lyric file from the panel.

export interface LocalLyricsUpload {
    content: string;
    isTranslation: boolean;
    fileName?: string;
}

export const applyUploadedLocalLyrics = (localSong: LocalSong, upload: LocalLyricsUpload): LocalSong => {
    const updatedLocalSong = { ...localSong };
    if (upload.isTranslation) {
        updatedLocalSong.hasLocalTranslationLyrics = true;
        updatedLocalSong.localTranslationLyricsContent = upload.content;
        updatedLocalSong.localTranslationLyricsOrigin = 'upload';
    } else {
        updatedLocalSong.hasLocalLyrics = true;
        updatedLocalSong.localLyricsContent = upload.content;
        updatedLocalSong.localLyricsFormat = resolveExplicitFileTimedLyricFormat(upload.fileName);
        updatedLocalSong.localLyricsOrigin = 'upload';
    }

    // Uploading a file is an explicit request to play that file. A record still pinned to 'online'
    // or 'embedded' by an earlier source switch would keep rendering the previous lyrics, so the
    // upload would look like it did nothing.
    if (updatedLocalSong.hasLocalLyrics) {
        updatedLocalSong.lyricsSource = 'local';
    }

    return updatedLocalSong;
};
