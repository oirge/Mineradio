import { strToU8, zip, type AsyncZippable } from 'fflate';
import { formatLocalDateTimeStamp } from '../../utils/downloadFileName';
import {
    buildLyricArchiveFolder,
    buildLyricFileBaseName,
    buildLyricFileContent,
    LYRIC_EXPORT_EXTENSIONS,
    type LyricFileContentOptions,
} from './lyricExportFiles';
import type { ExportableLyric, LyricExportFormat, SkippedLyric } from './types';

// src/services/lyricExport/buildLyricExportArchive.ts
// Packs every exported song into one zip: one folder per format, split into `online/` (named
// 标题 - 艺术家) and `local/` (the library's own folder tree, named after each audio file, ready to
// drop beside the audio), plus a manifest that records what was left out and why, so a
// smaller-than-expected export explains itself.

export const LYRIC_EXPORT_MANIFEST_VERSION = 1;

export interface LyricExportManifest {
    version: typeof LYRIC_EXPORT_MANIFEST_VERSION;
    exportedAt: string;
    formats: LyricExportFormat[];
    exported: Array<{
        songKey: string;
        title?: string;
        artist?: string;
        source: ExportableLyric['source'];
        files: string[];
        /**
         * Local songs only, and only when the files could not keep the audio's own path: it held
         * characters a filesystem refuses, or another song already took the same name. Such files
         * will not be found next to their audio by name, so the manifest says where they belong.
         */
        renamedFrom?: string;
    }>;
    skipped: SkippedLyric[];
}

/**
 * Hands out file names unique within the archive. Compared case-insensitively because Windows and
 * macOS would otherwise merge `Song.lrc` and `song.lrc` on extraction.
 */
export const createUniqueNameAllocator = () => {
    const taken = new Set<string>();
    return (baseName: string, extension: string): string => {
        let candidate = `${baseName}.${extension}`;
        for (let suffix = 2; taken.has(candidate.toLowerCase()); suffix += 1) {
            candidate = `${baseName} (${suffix}).${extension}`;
        }
        taken.add(candidate.toLowerCase());
        return candidate;
    };
};

const runZip = (files: AsyncZippable): Promise<Uint8Array<ArrayBuffer>> => new Promise((resolve, reject) => {
    zip(files, { level: 6 }, (error, data) => (error ? reject(error) : resolve(data)));
});

export interface LyricExportArchive {
    blob: Blob;
    fileName: string;
    manifest: LyricExportManifest;
}

export const buildLyricExportArchive = async (
    entries: ExportableLyric[],
    skipped: SkippedLyric[],
    formats: LyricExportFormat[],
    contentOptions: LyricFileContentOptions,
    now = new Date(),
): Promise<LyricExportArchive> => {
    const files: AsyncZippable = {};
    // One allocator per archive folder: names only have to be unique among their neighbours.
    const allocators = new Map<string, ReturnType<typeof createUniqueNameAllocator>>();
    const allocate = (folder: string, baseName: string, extension: string) => {
        const allocator = allocators.get(folder) ?? createUniqueNameAllocator();
        allocators.set(folder, allocator);
        return allocator(baseName, extension);
    };
    const manifest: LyricExportManifest = {
        version: LYRIC_EXPORT_MANIFEST_VERSION,
        exportedAt: now.toISOString(),
        formats,
        exported: [],
        skipped,
    };

    // Local files keep their audio's name so they can sit beside it. Names that survive sanitizing
    // untouched are placed first, so a name that had to be cleaned (`a:b` -> `a_b`) never pushes
    // the real `a_b` aside into `a_b (2)`, which no audio file would pick up.
    const keepsOwnPath = (entry: ExportableLyric) => (
        !entry.localPath || `${buildLyricArchiveFolder(entry)}/${buildLyricFileBaseName(entry)}` === `local/${entry.localPath}`
    );
    const placementOrder = [...entries.keys()].sort((left, right) => (
        Number(!keepsOwnPath(entries[left])) - Number(!keepsOwnPath(entries[right])) || left - right
    ));

    const writtenByEntry = new Map<number, string[]>();
    for (const index of placementOrder) {
        const entry = entries[index];
        const baseName = buildLyricFileBaseName(entry);
        const folder = buildLyricArchiveFolder(entry);
        const written: string[] = [];
        for (const format of formats) {
            const directory = `${format}/${folder}`;
            const extension = LYRIC_EXPORT_EXTENSIONS[format];
            const path = `${directory}/${allocate(directory, baseName, extension)}`;
            files[path] = strToU8(buildLyricFileContent(entry, format, contentOptions));
            written.push(path);
        }
        writtenByEntry.set(index, written);
    }

    entries.forEach((entry, index) => {
        const written = writtenByEntry.get(index) ?? [];
        const renamed = entry.localPath !== undefined && written.some((path, formatIndex) => (
            path !== `${formats[formatIndex]}/local/${entry.localPath}.${LYRIC_EXPORT_EXTENSIONS[formats[formatIndex]]}`
        ));
        manifest.exported.push({
            songKey: entry.songKey,
            title: entry.song.title,
            artist: entry.song.artist,
            source: entry.source,
            files: written,
            ...(renamed ? { renamedFrom: entry.localPath } : {}),
        });
    });

    files['manifest.json'] = strToU8(`${JSON.stringify(manifest, null, 2)}\n`);
    const bytes = await runZip(files);
    return {
        blob: new Blob([bytes], { type: 'application/zip' }),
        fileName: `folia-lyrics-${formatLocalDateTimeStamp(now)}.zip`,
        manifest,
    };
};
