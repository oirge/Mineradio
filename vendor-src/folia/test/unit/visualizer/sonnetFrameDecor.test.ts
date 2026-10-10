import { describe, expect, it } from 'vitest';
import type { SonnetSemanticSegment } from '@/components/visualizer/sonnet/types';
import {
    resolveSonnetFrameDecorSpec,
    resolveSonnetFrameLocalDimensions,
    SONNET_FRAME_DECOR_PROBABILITY,
    SONNET_FRAME_DECOR_VARIANTS,
} from '@/components/visualizer/sonnet/sonnetFrameDecor';

// test/unit/visualizer/sonnetFrameDecor.test.ts
// Locks the deterministic frame-decor assignment: stable choice, ~40% applied,
// variant always inside the four-design range.
const segment = (text: string, index: number): SonnetSemanticSegment => ({
    text,
    startOffset: index * 10,
    endOffset: index * 10 + text.length,
    startTime: index,
    endTime: index + 1,
    wordIndices: [index],
    graphemes: Array.from(text, (char, charIndex) => ({
        char,
        startTime: index + charIndex / text.length,
        endTime: index + (charIndex + 1) / text.length,
    })),
    isWordLike: true,
});

describe('Sonnet frame decor assignment', () => {
    it('swaps screen bounds back to local dimensions for quarter-turned text', () => {
        expect(resolveSonnetFrameLocalDimensions({
            measuredWidth: 48,
            measuredHeight: 240,
            rotation: Math.PI / 2,
        })).toEqual({ width: 240, height: 48 });

        expect(resolveSonnetFrameLocalDimensions({
            measuredWidth: 240,
            measuredHeight: 48,
            rotation: 0,
        })).toEqual({ width: 240, height: 48 });
    });

    it('is deterministic for the same segment', () => {
        const target = segment('明かり', 3);
        expect(resolveSonnetFrameDecorSpec(target))
            .toEqual(resolveSonnetFrameDecorSpec(segment('明かり', 3)));
    });

    it('applies frames to roughly 40% of segments across a large sample', () => {
        const samples = Array.from({ length: 400 }, (_, index) => segment(`詞${index}`, index));
        const appliedCount = samples.filter(item => resolveSonnetFrameDecorSpec(item).applied).length;
        expect(appliedCount / samples.length).toBeGreaterThan(SONNET_FRAME_DECOR_PROBABILITY - 0.12);
        expect(appliedCount / samples.length).toBeLessThan(SONNET_FRAME_DECOR_PROBABILITY + 0.12);
    });

    it('keeps the variant inside the designed range and uses all variants', () => {
        const samples = Array.from({ length: 400 }, (_, index) => segment(`詞${index}`, index));
        const variants = new Set(
            samples
                .filter(item => resolveSonnetFrameDecorSpec(item).applied)
                .map(item => resolveSonnetFrameDecorSpec(item).variant),
        );
        samples.forEach(item => {
            const { variant } = resolveSonnetFrameDecorSpec(item);
            expect(variant).toBeGreaterThanOrEqual(0);
            expect(variant).toBeLessThan(SONNET_FRAME_DECOR_VARIANTS);
        });
        expect(variants.size).toBe(SONNET_FRAME_DECOR_VARIANTS);
    });
});
