import { describe, expect, it } from 'vitest';
import { shouldHoldCladdaghFrameForPlaybackReset } from '@/components/visualizer/claddagh/VisualizerCladdagh';

// Keeps Claddagh from applying a reset clock to a stale final-line render.
describe('Claddagh playback reset guard', () => {
    it('holds the completed frame when playback jumps back before the line index commits', () => {
        expect(shouldHoldCladdaghFrameForPlaybackReset(238.4, 0, 42)).toBe(true);
    });

    it('does not hold normal forward playback or small clock corrections', () => {
        expect(shouldHoldCladdaghFrameForPlaybackReset(10, 10.2, 3)).toBe(false);
        expect(shouldHoldCladdaghFrameForPlaybackReset(10, 9.7, 3)).toBe(false);
        expect(shouldHoldCladdaghFrameForPlaybackReset(120, 60, 20)).toBe(false);
    });

    it('allows the first line to render immediately after the index catches up', () => {
        expect(shouldHoldCladdaghFrameForPlaybackReset(238.4, 0, 0)).toBe(false);
        expect(shouldHoldCladdaghFrameForPlaybackReset(238.4, 0, -1)).toBe(false);
    });
});
