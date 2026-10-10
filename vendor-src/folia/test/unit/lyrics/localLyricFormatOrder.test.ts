import { describe, expect, it } from 'vitest';
import {
    DEFAULT_LOCAL_LYRIC_FORMAT_ORDER,
    getLocalLyricFilePriority,
    isSameLocalLyricFormatOrder,
    normalizeLocalLyricFormatOrder,
} from '@/utils/lyrics/localLyricFormatOrder';

// test/unit/lyrics/localLyricFormatOrder.test.ts
// Covers stored-order normalization and per-file priority for sidecar lyric selection.

describe('localLyricFormatOrder', () => {
    it('falls back to the default order for missing or malformed values', () => {
        expect(normalizeLocalLyricFormatOrder(null)).toEqual([...DEFAULT_LOCAL_LYRIC_FORMAT_ORDER]);
        expect(normalizeLocalLyricFormatOrder('ttml')).toEqual([...DEFAULT_LOCAL_LYRIC_FORMAT_ORDER]);
    });

    it('keeps the user order, drops unknown and duplicate entries, and appends missing formats', () => {
        expect(normalizeLocalLyricFormatOrder(['ttml', 'fia', 'ttml', 'srt', 'qrc']))
            .toEqual(['ttml', 'qrc', 'lrc', 'vtt', 'yrc', 'krc']);
    });

    it('ranks files by the given order and always puts .fia first', () => {
        const order = normalizeLocalLyricFormatOrder(['ttml', 'lrc']);
        expect(getLocalLyricFilePriority('Track.TTML', order)).toBeLessThan(getLocalLyricFilePriority('Track.lrc', order));
        expect(getLocalLyricFilePriority('Track.fia', order)).toBeLessThan(getLocalLyricFilePriority('Track.ttml', order));
        expect(getLocalLyricFilePriority('Track.t.lrc', order)).toBe(getLocalLyricFilePriority('Track.lrc', order));
        expect(getLocalLyricFilePriority('Track.txt', order)).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('compares orders position by position', () => {
        expect(isSameLocalLyricFormatOrder(['lrc', 'ttml'], ['lrc', 'ttml'])).toBe(true);
        expect(isSameLocalLyricFormatOrder(['lrc', 'ttml'], ['ttml', 'lrc'])).toBe(false);
    });
});
