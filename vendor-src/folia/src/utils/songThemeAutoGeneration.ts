import type { LyricData, SongResult } from '../types';
import { getPlaybackSongKey } from './appPlaybackGuards';

// src/utils/songThemeAutoGeneration.ts
// Pure guards for deciding whether playback should auto-generate a song AI theme.

export type SongThemeAutoGenerationDecisionInput = {
    enabled: boolean;
    currentSong: SongResult | null;
    lyrics: LyricData | null;
    isLyricsLoading: boolean;
    hasAttempted: boolean;
    hasCachedTheme: boolean;
    // Cover-derived themes read the artwork, not the lyrics, so they need no prompt source.
    requiresPromptSource?: boolean;
};

export const getSongThemeAutoGenerationKey = (song: SongResult | null) => (
    song ? getPlaybackSongKey(song) : null
);

export const hasSongThemePromptSource = (song: SongResult, lyrics: LyricData | null) => (
    Boolean(song.isPureMusic) || Boolean((lyrics?.lines.length ?? 0) > 0)
);

export const isSongThemeGenerationStillCurrent = ({
    latestSongKey,
    targetSongKey,
    enabled,
}: {
    latestSongKey: string | null;
    targetSongKey: string;
    enabled: boolean;
}) => latestSongKey === targetSongKey && enabled;

export const shouldRequestSongThemeAutoGeneration = ({
    enabled,
    currentSong,
    lyrics,
    isLyricsLoading,
    hasAttempted,
    hasCachedTheme,
    requiresPromptSource = true,
}: SongThemeAutoGenerationDecisionInput) => {
    if (!enabled || !currentSong || isLyricsLoading || hasAttempted || hasCachedTheme) {
        return false;
    }

    return requiresPromptSource ? hasSongThemePromptSource(currentSong, lyrics) : true;
};
