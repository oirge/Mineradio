import { describe, expect, it } from 'vitest';
import { DEFAULT_TEMPERA_TUNING } from '@/types';
import {
    resolveTemperaPassResolution,
    resolveTemperaTransitionBlurResolution,
    setTemperaTransitionBlur,
} from '@/components/visualizer/tempera/temperaSceneFilters';

// test/unit/visualizer/temperaSceneFilters.test.ts
// The transition blur must never sit on a scene while it is not blurring: a parked filter is
// pushed onto Pixi's filter stack as a skipped entry with `Infinity` bounds, and the lyric
// inversion below it then copies its backdrop from the wrong place. Post-process off left
// exactly that state, so this locks the attach/detach contract.
interface StubFilter { strength: number }

const createScene = (baseFilters: StubFilter[], blur: StubFilter | null) => {
    const assignments: (readonly StubFilter[] | null)[] = [];
    let filters: readonly StubFilter[] | null = baseFilters.length > 0 ? baseFilters : null;
    const scene = {
        container: {
            get filters() { return filters; },
            set filters(value: readonly StubFilter[] | null) {
                filters = value;
                assignments.push(value);
            },
        },
        baseFilters,
        transitionBlurFilter: blur,
        transitionBlurAttached: false,
    };
    return { scene: scene as unknown as Parameters<typeof setTemperaTransitionBlur>[0], assignments, current: () => filters };
};

describe('Tempera scene pass resolution', () => {
    it('keeps the post-process pass at the canvas resolution by default', () => {
        // Pixi's Filter default is a hard 1, so leaving it alone rasterized the whole scene at
        // 1x and stretched it onto a 1.5x canvas - the mode's hatch and type paid for the grain.
        expect(DEFAULT_TEMPERA_TUNING.postProcessTextureCompression).toBe(false);
        expect(resolveTemperaPassResolution(DEFAULT_TEMPERA_TUNING, 1.5)).toBe('inherit');
        // 'inherit' is what keeps the nested inversion aligned: it resolves to the surface the
        // text layer renders into, which is also where its backdrop is copied from.
        expect(resolveTemperaPassResolution(DEFAULT_TEMPERA_TUNING, 3)).toBe('inherit');
    });

    it('compresses to 1x on request, never above the canvas it stretches onto', () => {
        const compressed = { ...DEFAULT_TEMPERA_TUNING, postProcessTextureCompression: true };
        expect(resolveTemperaPassResolution(compressed, 1.5)).toBe(1);
        expect(resolveTemperaPassResolution(compressed, 0.75)).toBe(0.75);
    });

    it('derives the pass from the snapped resolution, not the setting', () => {
        // The two differ whenever the texture-pool snap took a step down, and a pass pinned to
        // the setting would then ask the pool for a bigger bucket than the surface it lands on -
        // exactly the waste the snap exists to remove. The resolvers no longer read
        // `textureResolution` at all, so the tuning they take cannot even carry it.
        expect(resolveTemperaTransitionBlurResolution(DEFAULT_TEMPERA_TUNING, 1.2))
            .toBeCloseTo(0.6, 6);
        expect(resolveTemperaPassResolution(
            { postProcessTextureCompression: true },
            0.75,
        )).toBe(0.75);
    });

    it('keeps the transition blur at half the pass around it', () => {
        // A hard 0.5 would drop a 1.5x scene by three quarters the moment the blur attaches,
        // while its strength is still imperceptible.
        expect(resolveTemperaTransitionBlurResolution(DEFAULT_TEMPERA_TUNING, 1.5)).toBeCloseTo(0.75, 6);
        expect(resolveTemperaTransitionBlurResolution({
            ...DEFAULT_TEMPERA_TUNING,
            postProcessTextureCompression: true,
        }, 1.5)).toBeCloseTo(0.5, 6);
    });
});

describe('Tempera scene filters', () => {
    it('keeps the scene free of the blur until it actually blurs', () => {
        const blur = { strength: 0 };
        const { scene, assignments, current } = createScene([], blur);

        setTemperaTransitionBlur(scene, 0);

        expect(assignments).toHaveLength(0);
        expect(current()).toBeNull();
    });

    it('attaches the blur for the transition and takes it off again', () => {
        const blur = { strength: 0 };
        const { scene, assignments, current } = createScene([], blur);

        setTemperaTransitionBlur(scene, 4);
        expect(blur.strength).toBe(4);
        expect(current()).toEqual([blur]);

        // Ramping within the transition must not touch the container again: reassigning
        // filters restructures the render group.
        setTemperaTransitionBlur(scene, 6);
        expect(blur.strength).toBe(6);
        expect(assignments).toHaveLength(1);

        setTemperaTransitionBlur(scene, 0);
        // An empty array is how Pixi drops the filter effect entirely.
        expect(current()).toEqual([]);
        expect(assignments).toHaveLength(2);
    });

    it('keeps the post-process chain underneath the blur', () => {
        const post = [{ strength: 0 }, { strength: 0 }];
        const blur = { strength: 0 };
        const { scene, current } = createScene(post, blur);

        setTemperaTransitionBlur(scene, 2);
        expect(current()).toEqual([...post, blur]);

        setTemperaTransitionBlur(scene, 0);
        expect(current()).toEqual(post);
    });

    it('does nothing when the scene has no transition blur', () => {
        const { scene, assignments } = createScene([], null);

        setTemperaTransitionBlur(scene, 5);

        expect(assignments).toHaveLength(0);
    });
});
