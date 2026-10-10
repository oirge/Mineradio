import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

// Verifies opaque protocol addressing and byte-range parsing without starting Electron.

const require = createRequire(import.meta.url);
const { parseRangeHeader, parseTranscodeUrl } = require('../../../electron/transcode/protocol.cjs') as {
    parseRangeHeader: (value: string | null, size: number) => { start: number; end: number } | { invalid: true } | null;
    parseTranscodeUrl: (value: string) => { cacheKey: string; format: 'flac' | 'wav' } | null;
};

const KEY = 'a'.repeat(64);

describe('transcode protocol', () => {
    it('accepts only an opaque cache key and supported output name', () => {
        expect(parseTranscodeUrl(`folia-transcode://media/${KEY}/audio.flac`)).toEqual({ cacheKey: KEY, format: 'flac' });
        expect(parseTranscodeUrl(`folia-transcode://media/${KEY}/audio.wav`)).toEqual({ cacheKey: KEY, format: 'wav' });
        expect(parseTranscodeUrl('folia-transcode://media/../../secret/audio.flac')).toBeNull();
        expect(parseTranscodeUrl(`folia-transcode://other/${KEY}/audio.flac`)).toBeNull();
    });

    it('parses open, closed and suffix byte ranges', () => {
        expect(parseRangeHeader('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
        expect(parseRangeHeader('bytes=90-', 100)).toEqual({ start: 90, end: 99 });
        expect(parseRangeHeader('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    });

    it('rejects malformed and unsatisfiable ranges', () => {
        expect(parseRangeHeader('items=0-1', 100)).toEqual({ invalid: true });
        expect(parseRangeHeader('bytes=100-101', 100)).toEqual({ invalid: true });
        expect(parseRangeHeader(null, 100)).toBeNull();
    });
});
