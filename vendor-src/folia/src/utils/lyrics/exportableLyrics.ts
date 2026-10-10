import type { LyricData } from '../../types';
import { isInterludeLine } from './parserCore';

// src/utils/lyrics/exportableLyrics.ts
// The one "is there anything to export" test, shared by the lyric file dialog, the command
// palette's export commands, the single-song export and both batch collectors, so none of them
// disagree about the same lyrics.

/** True when there is at least one real line to write; an interlude-only result is nothing. */
export const hasExportableLyrics = (lyrics: LyricData | null | undefined): lyrics is LyricData => (
    Boolean(lyrics?.lines.some(line => !isInterludeLine(line) && line.fullText.trim()))
);

export type LyricExportVerdict = 'export' | 'noLyrics' | 'pureMusic';

/**
 * Whether a song's lyrics should become a file. Only real lines count (an interlude-only result is
 * nothing), and instrumental placeholders such as 「纯音乐，请欣赏」 are left out. How "instrumental"
 * is decided differs by source — an online match may carry a recorded verdict — so the caller
 * supplies that rule and this function only fixes the order the checks run in.
 */
export const judgeLyricsForExport = (
    lyrics: LyricData | null | undefined,
    isPureMusic: (lyricText: string) => boolean,
): LyricExportVerdict => {
    if (!hasExportableLyrics(lyrics)) return 'noLyrics';
    return isPureMusic(lyrics.lines.map(line => line.fullText).join('\n')) ? 'pureMusic' : 'export';
};
