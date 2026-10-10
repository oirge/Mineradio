import { describe, expect, it } from 'vitest';
import type { Line, Theme } from '@/types';
import type { FumeBlock } from '@/components/visualizer/fume/fumeTypes';
import {
    resolveFumeBlockTiming,
    resolveFumeStaticLayers,
    type FumeSnapshotSpec,
    type FumeStaticLayerInput,
} from '@/components/visualizer/fume/fumeBlockFrame';

// test/unit/visualizer/fumeBlockFrame.test.ts
// Locks fume's static-block decisions: when a block is drawn from a snapshot, which snapshots, and
// the cross-fade of a dimmed passed block.

const line: Line = {
    fullText: 'hello',
    words: [{ text: 'hello', startTime: 10, endTime: 11 }],
    startTime: 10,
    endTime: 11,
};

const block = {
    id: 'b0',
    sourceLineIndex: 0,
    line,
    variant: 'body',
    fontPx: 20,
    lineHeight: 26,
    x: 0,
    y: 0,
    width: 100,
    height: 26,
} as unknown as FumeBlock;

const theme = { primaryColor: '#ffffff', animationIntensity: 'normal' } as unknown as Theme;

const input = (time: number, overrides: Partial<FumeStaticLayerInput> = {}): FumeStaticLayerInput => ({
    time,
    theme,
    passedGlowBase: 0.62,
    passedFadeDuration: 2,
    overviewTextRestoreProgress: 0,
    snapshotScale: 2,
    ...overrides,
});

const layersAt = (time: number, textHoldRatio: number, overrides: Partial<FumeStaticLayerInput> = {}) => {
    const timing = resolveFumeBlockTiming(block, time, null, textHoldRatio);
    const requested: FumeSnapshotSpec[] = [];
    const layers = resolveFumeStaticLayers(block, timing, input(time, overrides), (spec) => {
        requested.push(spec);
        return spec.key;
    });
    return { timing, requested, layers };
};

describe('fume static block layers', () => {
    it('draws a waiting block from its unglowed snapshot', () => {
        const { timing, layers, requested } = layersAt(5, 1);
        expect(timing.staticState).toBe('waiting');
        expect(layers).toEqual([{ snapshot: 'b0:waiting:base:2', alpha: 1 }]);
        expect(requested[0]).toMatchObject({ shadowBlur: 0, shadowColor: 'transparent' });
    });

    it('draws the live block itself while it prints and during its colour trail', () => {
        expect(layersAt(10.5, 1).layers).toBeNull();
        const { timing } = layersAt(11.2, 1);
        expect(timing.staticState).toBeNull();
    });

    it('keeps a passed block in its standard look when text is held', () => {
        const { timing, layers } = layersAt(40, 1);
        expect(timing.staticState).toBe('passed');
        expect(layers).toEqual([{ snapshot: 'b0:passed:standard:2', alpha: 1 }]);
    });

    it('cross-fades a dimmed passed block from its standard snapshot', () => {
        const { timing } = layersAt(40, 0.5);
        const passedAt = timing.lineEndTime + timing.colorTrailDuration;

        const start = layersAt(passedAt, 0.5).layers;
        expect(start).toEqual([{ snapshot: 'b0:passed:standard:2', alpha: 1 }]);

        const middle = layersAt(passedAt + 1, 0.5).layers!;
        expect(middle.map(layer => layer.snapshot)).toEqual(['b0:passed:standard:2', 'b0:passed:dimmed:2']);
        expect(middle[0]!.alpha + middle[1]!.alpha).toBeCloseTo(1);

        expect(layersAt(passedAt + 60, 0.5).layers).toEqual([{ snapshot: 'b0:passed:dimmed:2', alpha: 1 }]);
    });

    it('restores the standard look while the overview shot flies in', () => {
        const { timing } = layersAt(40, 0.5);
        const late = timing.lineEndTime + timing.colorTrailDuration + 60;
        expect(layersAt(late, 0.5, { overviewTextRestoreProgress: 1 }).layers)
            .toEqual([{ snapshot: 'b0:passed:standard:2', alpha: 1 }]);
    });

    it('falls back to drawing the block live when its snapshot is unavailable', () => {
        const timing = resolveFumeBlockTiming(block, 5, null, 1);
        expect(resolveFumeStaticLayers(block, timing, input(5), () => undefined)).toBeNull();
    });
});
