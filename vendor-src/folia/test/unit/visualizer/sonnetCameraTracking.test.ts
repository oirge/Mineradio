import { describe, expect, it } from 'vitest';
import {
    resolveSonnetCameraTrackingGlyphs,
    resolveSonnetSegmentCameraFocus,
} from '@/components/visualizer/sonnet/sonnetCameraTracking';

// test/unit/visualizer/sonnetCameraTracking.test.ts
// Prevents fixed background geometry from changing semantic per-glyph camera tracking.

const textGlyphs = [
    { baseX: -180, baseY: 0, startTime: 10 },
    { baseX: 0, baseY: 0, startTime: 10.5 },
    { baseX: 180, baseY: 0, startTime: 11 },
];

describe('Sonnet camera tracking glyphs', () => {
    it('excludes a background shape while retaining semantic non-background glyphs', () => {
        const staffLikeGlyph = { baseX: 240, baseY: 0, startTime: 12, isTextGlyph: false };
        const resolved = resolveSonnetCameraTrackingGlyphs([
            { baseX: 0, baseY: 0, startTime: 10, isBackgroundShape: true, isTextGlyph: false },
            ...textGlyphs,
            staffLikeGlyph,
        ]);

        expect(resolved).toEqual([...textGlyphs, staffLikeGlyph]);
    });

    it('keeps the focus identical when a same-time background shape is present', () => {
        const withBackground = resolveSonnetCameraTrackingGlyphs([
            { baseX: 0, baseY: 0, startTime: 10, isBackgroundShape: true },
            ...textGlyphs,
        ]);
        const sampleTimes = [9.99, 10, 10.001, 10.25, 10.5, 11];

        sampleTimes.forEach(time => {
            expect(resolveSonnetSegmentCameraFocus(withBackground, time))
                .toEqual(resolveSonnetSegmentCameraFocus(textGlyphs, time));
        });
        expect(resolveSonnetSegmentCameraFocus(withBackground, 10.001).x)
            .toBeGreaterThan(resolveSonnetSegmentCameraFocus(withBackground, 10).x);
    });
});
