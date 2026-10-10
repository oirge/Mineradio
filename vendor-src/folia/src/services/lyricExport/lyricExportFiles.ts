import { createSafeObjectUrl } from '../../utils/blobGuards';
import { sanitizeDownloadFileName } from '../../utils/downloadFileName';
import { serializeEnhancedLrc } from '../../utils/lyrics/enhancedLrcSerializer';
import {
    buildFoliaLyricDocument,
    FOLIA_LYRIC_FILE_EXTENSION,
    serializeFoliaLyricDocument,
} from '../../utils/lyrics/foliaLyricDocument';
import type { ExportableLyric, LyricExportFormat } from './types';

// src/services/lyricExport/lyricExportFiles.ts
// Turns one export entry into a named file, and hands a finished blob to the browser.

export interface LyricFileContentOptions {
    includeTranslation: boolean;
    includeRomanization: boolean;
}

export const LYRIC_EXPORT_EXTENSIONS: Record<LyricExportFormat, string> = {
    fia: FOLIA_LYRIC_FILE_EXTENSION,
    lrc: 'lrc',
};

const MIME_TYPES: Record<LyricExportFormat, string> = {
    fia: 'application/json;charset=utf-8',
    lrc: 'text/plain;charset=utf-8',
};

// Most filesystems cap a name at 255 bytes; CJK titles run 3 bytes per character in UTF-8.
const MAX_BASE_NAME_LENGTH = 80;

const pathSegments = (localPath: string) => localPath.split('/').filter(Boolean);

/**
 * A local song's lyrics are named after its audio file (`01 Song.flac` -> `01 Song.lrc`), so the
 * file can sit next to the audio as a sidecar; online songs have no file and read `标题 - 艺术家`,
 * or just the title, or the song key when no name was found.
 */
export const buildLyricFileBaseName = (entry: Pick<ExportableLyric, 'song' | 'songKey' | 'localPath'>): string => {
    if (entry.localPath) {
        // The real file name, kept whole: it already fits the filesystem it came from, and a
        // shortened one would no longer match its audio.
        return sanitizeDownloadFileName(pathSegments(entry.localPath).pop() ?? '', 'lyrics');
    }
    const { title, artist } = entry.song;
    const readable = title ? (artist ? `${title} - ${artist}` : title) : entry.songKey.replace(/:/g, '_');
    const sanitized = sanitizeDownloadFileName(readable, 'lyrics');
    return sanitized.length > MAX_BASE_NAME_LENGTH ? sanitized.slice(0, MAX_BASE_NAME_LENGTH).trim() : sanitized;
};

/**
 * The folder an entry goes into inside the archive, below its format folder. Local songs mirror
 * their library-relative directory (root folder first), so `local/` extracted into the folder that
 * holds the library root puts every file beside its audio; online songs share one flat folder.
 */
export const buildLyricArchiveFolder = (entry: Pick<ExportableLyric, 'localPath'>): string => {
    if (!entry.localPath) return 'online';
    const directories = pathSegments(entry.localPath).slice(0, -1).map(segment => sanitizeDownloadFileName(segment, '_'));
    return ['local', ...directories].join('/');
};

export const buildLyricFileContent = (
    entry: ExportableLyric,
    format: LyricExportFormat,
    options: LyricFileContentOptions,
): string => {
    if (format === 'fia') {
        return serializeFoliaLyricDocument(buildFoliaLyricDocument(entry.lyrics, {
            song: entry.song,
            source: entry.source,
            offsetMs: entry.offsetMs,
        }));
    }
    return serializeEnhancedLrc(entry.lyrics, {
        metadata: entry.song,
        includeTranslation: options.includeTranslation,
        includeRomanization: options.includeRomanization,
    });
};

export const triggerBlobDownload = (blob: Blob, fileName: string): void => {
    const url = createSafeObjectUrl(blob);
    if (!url) throw new TypeError('Lyric export must produce a Blob');
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** Downloads a single song's lyrics in one format. */
export const downloadLyricFile = (
    entry: ExportableLyric,
    format: LyricExportFormat,
    options: LyricFileContentOptions,
): void => {
    const content = buildLyricFileContent(entry, format, options);
    const blob = new Blob([content], { type: MIME_TYPES[format] });
    triggerBlobDownload(blob, `${buildLyricFileBaseName(entry)}.${LYRIC_EXPORT_EXTENSIONS[format]}`);
};
