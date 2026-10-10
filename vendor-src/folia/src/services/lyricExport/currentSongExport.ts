import type { ActiveLocalLyricsSource, LocalLyricsPriority, LyricData, SongResult } from '../../types';
import {
    getPlaybackSongKey,
    getPlaybackSourceRef,
    isLocalPlaybackSong,
    isNavidromePlaybackSong,
} from '../../utils/appPlaybackGuards';
import { resolveLocalSongLyrics } from '../../utils/lyrics/localSongLyrics';
import { migrateLyricDataRenderHints } from '../../utils/lyrics/renderHints';
import type { FoliaLyricDocumentSource } from '../../utils/lyrics/foliaLyricDocument';
import { judgeLyricsForExport } from '../../utils/lyrics/exportableLyrics';
import { isPureMusicLyricText } from '../../utils/lyrics/pureMusic';
import { loadOnlineLyricsState, resolveOnlineLyrics, resolveOnlineLyricsPureMusic } from '../../utils/onlineLyricsState';
import { getLocalSongs } from '../db';
import { getSongCacheWithLegacyMigration } from '../onlineMusic/resourceCache';
import { applyUserAdjustments } from './applyUserAdjustments';
import { getLocalLyricExportPath, isMatchedPureMusic } from './collectLocalLyrics';
import { songToExportMetadata } from './lyricCacheMetadata';
import { downloadLyricFile } from './lyricExportFiles';
import type { ExportableLyric, LyricExportFormat } from './types';

// src/services/lyricExport/currentSongExport.ts
// Exports the lyrics of the song that is playing.
//
// Starts from the same raw source the batch export reads — the online cache plus the listener's
// choice, or the local library's chosen source — not from the lyrics on screen. Those have been
// through the display setter: the user's line filter, the staff-credit policy (credits hidden or
// retimed) and chorus detection. Baking any of that into a file would make it lose lines for good,
// and exporting one song would disagree with the batch export of the same song. Saved word
// segmentation and the per-song offset are then folded in by the same applyUserAdjustments.
//
// Only a source with nothing to re-read (Navidrome, Stage) falls back to the lyrics on screen.

export type CurrentSongExportContext = {
    song: SongResult;
    /** The lyrics on screen; used only when the source cannot be re-read. */
    onScreenLyrics: LyricData | null;
    activeLocalLyricsSource: ActiveLocalLyricsSource | null;
    localLyricsPriority: LocalLyricsPriority;
};

/** Lyrics as their source holds them, and that source's own rule for "this is instrumental". */
type RawLyrics = { lyrics: LyricData; source: FoliaLyricDocumentSource; isPureMusic: (lyricText: string) => boolean };

const readOnlineLyrics = async (song: SongResult): Promise<RawLyrics | null> => {
    const [state, cached] = await Promise.all([
        loadOnlineLyricsState(song),
        getSongCacheWithLegacyMigration<LyricData>('lyric', song, migrateLyricDataRenderHints),
    ]);
    const lyrics = resolveOnlineLyrics(state, cached);
    if (!lyrics) return null;
    return {
        lyrics,
        source: state?.lyricsSource === 'imported' && state.importedLyrics ? 'imported' : 'online',
        isPureMusic: text => resolveOnlineLyricsPureMusic(state, text),
    };
};

/**
 * The local song's chosen lyrics, plus where its audio lives. The path is returned even when there
 * are no lyrics to re-read, so the on-screen fallback is still named after the audio file.
 */
const readLocalLyrics = async (
    song: SongResult,
    priority: LocalLyricsPriority,
): Promise<{ raw: RawLyrics | null; localPath?: string }> => {
    if (!isLocalPlaybackSong(song)) return { raw: null };
    const localSong = (await getLocalSongs()).find(entry => entry.id === song.localRef.songId);
    if (!localSong) return { raw: null };
    const resolved = await resolveLocalSongLyrics(localSong, priority);
    return {
        raw: resolved.lyrics && resolved.source
            ? {
                lyrics: resolved.lyrics,
                source: resolved.source,
                isPureMusic: resolved.source === 'online'
                    ? (text: string) => isMatchedPureMusic(localSong, text)
                    : isPureMusicLyricText,
            }
            : null,
        // Named after the audio file whatever the source: a single export of a local song is most
        // often meant to be saved right next to it.
        localPath: getLocalLyricExportPath(localSong),
    };
};

const fallbackSource = (song: SongResult, activeLocalLyricsSource: ActiveLocalLyricsSource | null): FoliaLyricDocumentSource => {
    if (isLocalPlaybackSong(song)) return activeLocalLyricsSource ?? 'local';
    if (isNavidromePlaybackSong(song)) return 'navidrome';
    return song.onlineLyricsState?.lyricsSource === 'imported' ? 'imported' : 'online';
};

/** The current song as an export entry, or null when it has no lyrics worth writing. */
export const buildCurrentSongExportEntry = async ({
    song,
    onScreenLyrics,
    activeLocalLyricsSource,
    localLyricsPriority,
}: CurrentSongExportContext): Promise<ExportableLyric | null> => {
    const sourceRef = getPlaybackSourceRef(song);
    const local = sourceRef.kind === 'local' ? await readLocalLyrics(song, localLyricsPriority) : null;
    const raw = sourceRef.kind === 'online' ? await readOnlineLyrics(song) : local?.raw ?? null;
    const picked: RawLyrics | null = raw ?? (onScreenLyrics
        ? { lyrics: onScreenLyrics, source: fallbackSource(song, activeLocalLyricsSource), isPureMusic: isPureMusicLyricText }
        : null);
    // Same verdict the batch collectors reach, so one song never exports alone but not in a batch.
    if (!picked || judgeLyricsForExport(picked.lyrics, picked.isPureMusic) !== 'export') return null;

    const songKey = getPlaybackSongKey(song);
    return applyUserAdjustments({
        songKey,
        lyrics: picked.lyrics,
        source: picked.source,
        song: { ...songToExportMetadata(song), key: songKey },
        offsetKey: song.id,
        ...(local?.localPath ? { localPath: local.localPath } : {}),
    });
};

/** Downloads the current song's lyrics; resolves false when there is nothing to export. */
export const exportCurrentSongLyrics = async (
    context: CurrentSongExportContext,
    format: LyricExportFormat,
): Promise<boolean> => {
    const entry = await buildCurrentSongExportEntry(context);
    if (!entry) return false;
    downloadLyricFile(entry, format, {
        includeTranslation: true,
        includeRomanization: true,
    });
    return true;
};
