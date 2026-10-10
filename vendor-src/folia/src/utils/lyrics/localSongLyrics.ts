import type { ActiveLocalLyricsSource, LocalLyricsPriority, LocalSong, LyricData } from '../../types';
import { LyricParserFactory } from './LyricParserFactory';

// src/utils/lyrics/localSongLyrics.ts
// Resolves the lyric payload and its actual source from one local-song snapshot.

export type ResolvedLocalSongLyrics = {
    lyrics: LyricData | null;
    source: ActiveLocalLyricsSource | null;
};

export const selectLocalSongLyricsSource = (
    song: LocalSong,
    priority: LocalLyricsPriority,
): ActiveLocalLyricsSource | null => {
    if (song.lyricsSource) {
        if (song.lyricsSource === 'online' && (song.matchedLyrics || song.matchedIsPureMusic)) return 'online';
        if (song.lyricsSource === 'local' && song.localLyricsContent) return 'local';
        if (song.lyricsSource === 'embedded' && song.embeddedLyricsContent) return 'embedded';
        return null;
    }

    if (priority === 'online' && song.matchedLyrics) return 'online';
    if (song.hasLocalLyrics && song.localLyricsContent) return 'local';
    if (song.hasEmbeddedLyrics && song.embeddedLyricsContent) return 'embedded';
    if (song.matchedLyrics) return 'online';
    return null;
};

/** Parses the payload selected by the explicit source or current automatic priority. */
export const resolveLocalSongLyrics = async (
    song: LocalSong,
    priority: LocalLyricsPriority,
): Promise<ResolvedLocalSongLyrics> => {
    const source = selectLocalSongLyricsSource(song, priority);
    if (source === 'online') {
        return { lyrics: song.matchedLyrics ?? null, source };
    }
    if (source === 'local') {
        const lyrics = await LyricParserFactory.parse({
            type: 'local',
            lrcContent: song.localLyricsContent!,
            tLrcContent: song.localTranslationLyricsContent,
            formatHint: song.localLyricsFormat,
        });
        return { lyrics, source };
    }
    if (source === 'embedded') {
        const lyrics = await LyricParserFactory.parse({
            type: 'embedded',
            textContent: song.embeddedLyricsContent!,
            translationContent: song.embeddedTranslationLyricsContent,
        });
        return { lyrics, source };
    }
    return { lyrics: null, source: null };
};
