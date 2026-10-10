import type { LocalLyricsPriority } from '../../types';
import { applyUserAdjustments } from './applyUserAdjustments';
import { buildLyricExportArchive, type LyricExportArchive } from './buildLyricExportArchive';
import { collectLocalLyrics } from './collectLocalLyrics';
import { collectOnlineLyrics } from './collectOnlineLyrics';
import { resolveExportMetadata } from './resolveExportMetadata';
import {
    mapWithConcurrency,
    throwIfAborted,
    type LyricCollectionResult,
    type LyricExportOptions,
    type LyricExportRunContext,
} from './types';

// src/services/lyricExport/runLyricExport.ts
// Batch export entry point: collect every cached lyric in scope, fold in the listener's
// adjustments, resolve names, and pack the result into one zip.

const ADJUST_CONCURRENCY = 8;

export interface LyricExportResult {
    archive: LyricExportArchive | null;
    exportedCount: number;
    skippedCount: number;
}

export const runLyricExport = async (
    options: LyricExportOptions,
    localLyricsPriority: LocalLyricsPriority,
    context: LyricExportRunContext = {},
): Promise<LyricExportResult> => {
    const { signal, onProgress } = context;
    const collected: LyricCollectionResult = { entries: [], skipped: [] };

    onProgress?.({ phase: 'collect', done: 0, total: 0 });
    if (options.scopes.includes('online')) {
        const online = await collectOnlineLyrics();
        collected.entries.push(...online.entries);
        collected.skipped.push(...online.skipped);
    }
    throwIfAborted(signal);
    if (options.scopes.includes('local')) {
        const local = await collectLocalLyrics(localLyricsPriority, context);
        collected.entries.push(...local.entries);
        collected.skipped.push(...local.skipped);
    }
    throwIfAborted(signal);

    // Names first: resolving them can also reveal the song's own id, which is what the per-song
    // offset is stored under, and applyUserAdjustments reads that offset.
    const withNames = await resolveExportMetadata(collected.entries, { resolveOnline: options.resolveOnlineMetadata }, context);
    throwIfAborted(signal);
    const named = await mapWithConcurrency(withNames, ADJUST_CONCURRENCY, applyUserAdjustments, signal);
    throwIfAborted(signal);

    if (named.length === 0 || options.formats.length === 0) {
        return { archive: null, exportedCount: 0, skippedCount: collected.skipped.length };
    }

    onProgress?.({ phase: 'package', done: 0, total: named.length });
    const archive = await buildLyricExportArchive(named, collected.skipped, options.formats, {
        includeTranslation: options.includeTranslation,
        includeRomanization: options.includeRomanization,
    });
    throwIfAborted(signal);
    onProgress?.({ phase: 'package', done: named.length, total: named.length });

    return { archive, exportedCount: named.length, skippedCount: collected.skipped.length };
};
