import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SEGMENTATION_BATCH_SIZE, segmentLyricsWithAi } from '../../../src/services/lyricSegmentationAi';

// test/unit/lyrics/lyricSegmentationBatching.test.ts
// A whole song in one request generates for a minute or more with nothing on screen, which reads
// as a hang. These lock the batching that replaced it: bounded requests, visible progress, and a
// failed batch costing only its own lines.

// Deliberately longer than one batch, so the batching itself is exercised.
const LINES = Array.from({ length: SEGMENTATION_BATCH_SIZE * 2 + 5 }, (_, i) => `line ${i}`);
const split = (lines: string[]) => lines.map(l => [l]);

describe('segmentLyricsWithAi batching', () => {
    beforeEach(() => { (globalThis as any).window = globalThis; });
    afterEach(() => { delete (globalThis as any).window; delete (globalThis as any).electron; });

    it('splits the song into bounded batches and reports progress', async () => {
        const calls: number[] = [];
        (globalThis as any).electron = { segmentLyrics: async (lines: string[]) => { calls.push(lines.length); return split(lines); } };
        const progress: number[] = [];
        const r = await segmentLyricsWithAi(LINES, { onProgress: p => progress.push(p.done) });

        expect(calls).toEqual([SEGMENTATION_BATCH_SIZE, SEGMENTATION_BATCH_SIZE, 5]);
        expect(calls.every(n => n <= SEGMENTATION_BATCH_SIZE)).toBe(true);
        expect(progress).toEqual([SEGMENTATION_BATCH_SIZE, SEGMENTATION_BATCH_SIZE * 2, LINES.length]);
        expect(r.appliedCount).toBe(LINES.length);
        expect(r.failures).toEqual([]);
        expect(r.boundaries.every(b => b !== null)).toBe(true);
    });

    it('keeps the batches that worked when one fails', async () => {
        let n = 0;
        (globalThis as any).electron = { segmentLyrics: async (lines: string[]) => {
            n += 1;
            if (n === 2) throw new Error('model hiccup');
            return split(lines);
        } };
        const r = await segmentLyricsWithAi(LINES);

        expect(r.appliedCount).toBe(LINES.length - SEGMENTATION_BATCH_SIZE);
        expect(r.failures).toEqual(['model hiccup']);
        expect(r.boundaries.slice(0, SEGMENTATION_BATCH_SIZE).every(b => b !== null)).toBe(true);
        expect(r.boundaries.slice(SEGMENTATION_BATCH_SIZE, SEGMENTATION_BATCH_SIZE * 2).every(b => b === null)).toBe(true);
        expect(r.boundaries.slice(SEGMENTATION_BATCH_SIZE * 2).every(b => b !== null)).toBe(true);
    });

    it('throws when every batch fails, so nothing is silently saved', async () => {
        (globalThis as any).electron = { segmentLyrics: async () => { throw new Error('down'); } };
        await expect(segmentLyricsWithAi(LINES)).rejects.toThrow('down');
    });

    it('stops sending batches once cancelled', async () => {
        let n = 0;
        const controller = new AbortController();
        (globalThis as any).electron = { segmentLyrics: async (lines: string[]) => {
            n += 1;
            controller.abort();
            return split(lines);
        } };
        await expect(segmentLyricsWithAi(LINES, { signal: controller.signal })).rejects.toThrow(/cancel/i);
        expect(n).toBe(1);
    });
});
