import { describe, expect, it } from 'vitest';
import {
    MONET_PORTRAIT_MAX_LAYERS,
    monetPortraitTargetSource,
    pushMonetPortraitLayer,
    settleMonetPortraitLayers,
    type MonetPortraitLayer,
} from '@/components/visualizer/monet/monetPortraitCrossfade';

// test/unit/visualizer/monetPortraitCrossfade.test.ts
// The property the Monet cover crossfade rests on: a layer is only ever removed once something
// fully opaque is covering it. Break that and the frame flashes at a track change, which is the
// bug the stack replaced.

const stack = (...sources: string[]): MonetPortraitLayer[] => sources.reduce<MonetPortraitLayer[]>(
    (layers, src, index) => pushMonetPortraitLayer(layers, src, `k${index}`),
    [],
);

describe('Monet portrait crossfade stack', () => {
    it('keeps the cover on screen underneath the one fading in', () => {
        const layers = stack('a.jpg', 'b.jpg');
        expect(layers.map(layer => layer.src)).toEqual(['a.jpg', 'b.jpg']);
        expect(monetPortraitTargetSource(layers)).toBe('b.jpg');
    });

    it('ignores a URL that resolves to the cover already being faded in', () => {
        const layers = stack('a.jpg', 'b.jpg');
        expect(pushMonetPortraitLayer(layers, 'b.jpg', 'k9')).toBe(layers);
    });

    it('fades back to a cover that comes round again', () => {
        const layers = stack('a.jpg', 'b.jpg', 'a.jpg');
        expect(layers.map(layer => layer.src)).toEqual(['a.jpg', 'b.jpg', 'a.jpg']);
    });

    it('drops the whole stack at once when the top layer settles', () => {
        const layers = stack('a.jpg', 'b.jpg', 'c.jpg');
        const settled = settleMonetPortraitLayers(layers, layers[layers.length - 1].key);
        expect(settled.map(layer => layer.src)).toEqual(['c.jpg']);
    });

    it('leaves the stack alone for a layer that is already the bottom or gone', () => {
        const layers = stack('a.jpg', 'b.jpg');
        expect(settleMonetPortraitLayers(layers, layers[0].key)).toBe(layers);
        expect(settleMonetPortraitLayers(layers, 'never-stacked')).toBe(layers);
    });

    it('caps the stack while holding skip down, keeping the newest covers', () => {
        const sources = Array.from({ length: MONET_PORTRAIT_MAX_LAYERS + 3 }, (_, index) => `${index}.jpg`);
        const layers = stack(...sources);
        expect(layers).toHaveLength(MONET_PORTRAIT_MAX_LAYERS);
        expect(monetPortraitTargetSource(layers)).toBe(sources[sources.length - 1]);
    });

    it('reports nothing to fade towards while no cover has decoded', () => {
        expect(monetPortraitTargetSource([])).toBeNull();
    });
});
