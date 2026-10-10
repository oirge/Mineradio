import { describe, expect, it } from 'vitest';
import { clampGlobalLyricTimelineOffsetMs, GLOBAL_LYRIC_TIMELINE_OFFSET_LIMIT_MS } from '@/stores/useLyricSettingsStore';

// test/unit/stores/globalLyricTimelineOffset.test.ts
// The device-level lyric offset is read straight from localStorage on startup, so the clamp is the
// only guard between a corrupt/legacy value and the shared lyric clock.

describe('clampGlobalLyricTimelineOffsetMs', () => {
    it('keeps ordinary latency compensation values untouched', () => {
        expect(clampGlobalLyricTimelineOffsetMs(0)).toBe(0);
        expect(clampGlobalLyricTimelineOffsetMs(250)).toBe(250);
        expect(clampGlobalLyricTimelineOffsetMs(-120)).toBe(-120);
    });

    it('rounds to whole milliseconds', () => {
        expect(clampGlobalLyricTimelineOffsetMs(120.4)).toBe(120);
        expect(clampGlobalLyricTimelineOffsetMs(-120.6)).toBe(-121);
    });

    it('bounds the value on both sides', () => {
        expect(clampGlobalLyricTimelineOffsetMs(999999)).toBe(GLOBAL_LYRIC_TIMELINE_OFFSET_LIMIT_MS);
        expect(clampGlobalLyricTimelineOffsetMs(-999999)).toBe(-GLOBAL_LYRIC_TIMELINE_OFFSET_LIMIT_MS);
    });

    it('falls back to no offset for unusable stored values', () => {
        expect(clampGlobalLyricTimelineOffsetMs(Number.NaN)).toBe(0);
        expect(clampGlobalLyricTimelineOffsetMs(Number('not-a-number'))).toBe(0);
        expect(clampGlobalLyricTimelineOffsetMs(Number.POSITIVE_INFINITY)).toBe(0);
    });
});
