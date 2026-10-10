import { describe, expect, it } from 'vitest';
import { normalizeWorkerFormat } from '@/workers/lyricsParser.worker';

// test/unit/lyrics/lyricsParserWorker.test.ts
// Keeps the worker format allowlist aligned with parserCore.

describe('lyricsParser.worker', () => {
    it('preserves KRC format requests instead of falling back to LRC', () => {
        expect(normalizeWorkerFormat('krc')).toBe('krc');
    });

    it('falls back unknown formats to LRC', () => {
        expect(normalizeWorkerFormat('unknown')).toBe('lrc');
    });
});
