import type { LocalLyricsPriority, LocalSong } from '../../types';
import { getPlaybackSongKey } from '../../utils/appPlaybackGuards';
import { selectLocalSongLyricsSource } from '../../utils/lyrics/localSongLyrics';
import { isPureMusicLyricText } from '../../utils/lyrics/pureMusic';
import { judgeLyricsForExport } from '../../utils/lyrics/exportableLyrics';
import { migrateLyricDataRenderHints } from '../../utils/lyrics/renderHints';
import { getLocalSongs } from '../db';
import { buildUnifiedLocalSong, getLocalSongId } from '../playbackAdapters';
import {
    throwIfAborted,
    type ExportableLyric,
    type LyricCollectionResult,
    type LyricExportRunContext,
} from './types';

// src/services/lyricExport/collectLocalLyrics.ts
// Gathers the online-matched lyrics of local-library songs, named after their audio files.
//
// What a listener wants from exporting a local library is the lyrics Folia found online, as files
// they can keep next to the audio. Lyrics that came from a sidecar file or the audio's own tags are
// already on disk, and exporting them again would only produce a duplicate that clashes with the
// existing .lrc when put back. So only songs whose active source is the online match are exported;
// the rest are left out entirely, not reported as skipped. The source is picked exactly the way
// playback picks it (selectLocalSongLyricsSource), which also means nothing here needs parsing.

/** The audio file's library-relative path without its extension: where its sidecar would live. */
export const getLocalLyricExportPath = (localSong: LocalSong): string => (
    localSong.filePath.replace(/\.[^./]+$/, '')
);

/**
 * Instrumental, decided the way a local song's own match decided it: a recorded verdict is
 * trusted as-is, otherwise the lyric text is read.
 */
export const isMatchedPureMusic = (localSong: LocalSong, text: string) => (
    typeof localSong.matchedIsPureMusic === 'boolean' ? localSong.matchedIsPureMusic : isPureMusicLyricText(text)
);

type LocalCollected =
    | { kind: 'entry'; entry: ExportableLyric }
    | { kind: 'skip'; skip: LyricCollectionResult['skipped'][number] };

const collectOne = (localSong: LocalSong, priority: LocalLyricsPriority): LocalCollected | null => {
    if (selectLocalSongLyricsSource(localSong, priority) !== 'online') return null;

    const unified = buildUnifiedLocalSong({ localSong, matchedSong: null, coverUrl: null, preferOnlineMetadata: false });
    const songKey = getPlaybackSongKey(unified);
    const label = localSong.title || localSong.fileName;
    const lyrics = localSong.matchedLyrics ? migrateLyricDataRenderHints(localSong.matchedLyrics).value : null;

    if (!lyrics) {
        return { kind: 'skip', skip: { songKey, label, reason: localSong.matchedIsPureMusic ? 'pureMusic' : 'noLyrics' } };
    }
    const verdict = judgeLyricsForExport(lyrics, text => isMatchedPureMusic(localSong, text));
    if (verdict !== 'export') {
        return { kind: 'skip', skip: { songKey, label, reason: verdict } };
    }

    const artist = unified.artists?.map(entry => entry.name).filter(Boolean).join(', ');
    return {
        kind: 'entry',
        entry: {
            songKey,
            lyrics,
            source: 'online',
            song: {
                key: songKey,
                title: unified.name || undefined,
                artist: artist || undefined,
                album: unified.album?.name || undefined,
                durationMs: localSong.duration,
            },
            offsetKey: getLocalSongId(localSong),
            localPath: getLocalLyricExportPath(localSong),
        },
    };
};

export const collectLocalLyrics = async (
    priority: LocalLyricsPriority,
    { signal, onProgress }: LyricExportRunContext = {},
): Promise<LyricCollectionResult> => {
    const songs = await getLocalSongs();
    throwIfAborted(signal);

    const result: LyricCollectionResult = { entries: [], skipped: [] };
    songs.forEach((song, index) => {
        const item = collectOne(song, priority);
        if (item?.kind === 'entry') result.entries.push(item.entry);
        else if (item?.kind === 'skip') result.skipped.push(item.skip);
        onProgress?.({ phase: 'collect', done: index + 1, total: songs.length });
    });
    return result;
};
