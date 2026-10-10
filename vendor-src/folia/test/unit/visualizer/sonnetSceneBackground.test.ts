import { describe, expect, it } from 'vitest';
import { shouldDrawSonnetSceneBackdrop } from '@/components/visualizer/sonnet/sonnetSceneBuilder';

// test/unit/visualizer/sonnetSceneBackground.test.ts
// Keeps Sonnet's full-scene color wash out of transparent player and OBS surfaces.
describe('Sonnet scene background', () => {
    it('omits the color backdrop in transparent mode', () => {
        expect(shouldDrawSonnetSceneBackdrop(true, true)).toBe(false);
    });

    it('preserves the backdrop for normal rendering when background MG is enabled', () => {
        expect(shouldDrawSonnetSceneBackdrop(true, false)).toBe(true);
        expect(shouldDrawSonnetSceneBackdrop(false, false)).toBe(false);
    });
});
