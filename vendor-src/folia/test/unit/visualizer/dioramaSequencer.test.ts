import { describe, expect, it } from 'vitest';
import type { Line } from '@/types';
import { buildDioramaPath, translateFrames, type DioramaVec } from '@/components/visualizer/diorama/cameraPath';
import {
    activeSegment,
    appendSegment,
    createSequencerState,
    pruneSegments,
    resolveGlobal,
    totalGlobalLines,
    updateActiveSegmentLines,
} from '@/components/visualizer/diorama/dioramaSequencer';
import { bezierArc, flightPerp, flightSide, pickTransitionOffset, transitionEase, TRANSITION_DISTANCE } from '@/components/visualizer/diorama/dioramaTransition';

// Minimal lyric lines - the sequencer only needs the array length and passes the objects straight to the
// (separately tested) shot/formation builders, so the contents are irrelevant here.
const mkLines = (count: number): Line[] =>
    Array.from({ length: count }, (_, i) => ({
        fullText: `line ${i}`,
        words: [{ text: `line ${i}`, startTime: i, endTime: i + 1 }],
        startTime: i,
        endTime: i + 1,
    }));

const ORIGIN: DioramaVec = { x: 0, y: 0, z: 0 };
const dist = (a: DioramaVec, b: DioramaVec): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const len = (a: DioramaVec): number => Math.hypot(a.x, a.y, a.z);

describe('translateFrames', () => {
    it('shifts every anchor by the offset but leaves directions untouched', () => {
        const raw = buildDioramaPath(6, 'song');
        const offset: DioramaVec = { x: 12, y: -3, z: -40 };
        const moved = translateFrames(raw, offset);
        for (let i = 0; i < raw.length; i += 1) {
            expect(moved[i].position.x).toBeCloseTo(raw[i].position.x + offset.x, 6);
            expect(moved[i].position.y).toBeCloseTo(raw[i].position.y + offset.y, 6);
            expect(moved[i].position.z).toBeCloseTo(raw[i].position.z + offset.z, 6);
            // Pure translation: the frame basis (forward/right/up) is identical.
            expect(moved[i].forward).toEqual(raw[i].forward);
            expect(moved[i].right).toEqual(raw[i].right);
        }
    });
});

describe('dioramaTransition geometry', () => {
    it('spawns the incoming corridor a fixed distance away (past the fog, so it starts invisible)', () => {
        const off = pickTransitionOffset('song', 1);
        expect(len(off)).toBeCloseTo(TRANSITION_DISTANCE, 4);
    });

    it('is deterministic per seed/epoch and varies the direction between transitions', () => {
        expect(pickTransitionOffset('song', 1)).toEqual(pickTransitionOffset('song', 1));
        expect(pickTransitionOffset('song', 1)).not.toEqual(pickTransitionOffset('song', 2));
    });

    it('eases from 0 to 1 with zero-velocity ends', () => {
        expect(transitionEase(0)).toBeCloseTo(0, 6);
        expect(transitionEase(1)).toBeCloseTo(1, 6);
        expect(transitionEase(0.5)).toBeCloseTo(0.5, 6);
    });

    it('bezierArc hits both endpoints exactly', () => {
        const from: DioramaVec = { x: 0, y: 1, z: 9 };
        const to: DioramaVec = { x: 20, y: 5, z: -30 };
        const ctrl: DioramaVec = { x: 10, y: 12, z: -5 };
        expect(dist(bezierArc(from, ctrl, to, 0), from)).toBeLessThan(1e-9);
        expect(dist(bezierArc(from, ctrl, to, 1), to)).toBeLessThan(1e-9);
        // A bowed control lifts the midpoint off the straight chord.
        const mid = bezierArc(from, ctrl, to, 0.5);
        const chordMidY = (from.y + to.y) / 2;
        expect(mid.y).toBeGreaterThan(chordMidY);
    });

    it('flightPerp is a horizontal unit vector perpendicular to the flight direction', () => {
        const from: DioramaVec = { x: 0, y: 2, z: 9 };
        const to: DioramaVec = { x: 20, y: 8, z: -30 };
        const perp = flightPerp(from, to);
        expect(len(perp)).toBeCloseTo(1, 6);
        expect(perp.y).toBe(0);
        // Perpendicular to the horizontal projection of the flight direction.
        expect(perp.x * (to.x - from.x) + perp.z * (to.z - from.z)).toBeCloseTo(0, 6);
    });

    it('flightSide is a deterministic +/-1 that varies per epoch', () => {
        expect([1, -1]).toContain(flightSide('song', 1));
        expect(flightSide('song', 1)).toBe(flightSide('song', 1));
    });
});

describe('dioramaSequencer', () => {
    it('places the first segment at the world origin', () => {
        const state = createSequencerState();
        appendSegment(state, { seed: 's1', lines: mkLines(3), round: 0, placementOrigin: ORIGIN });
        expect(state.segments).toHaveLength(1);
        expect(state.segments[0].globalStart).toBe(0);
        expect(totalGlobalLines(state)).toBe(3);
        expect(state.segments[0].frames[0].position).toEqual(buildDioramaPath(3, 's1')[0].position);
    });

    it('spawns a following song at its placement offset, coexisting with the first', () => {
        const state = createSequencerState();
        appendSegment(state, { seed: 's1', lines: mkLines(3), round: 0, placementOrigin: ORIGIN });
        const origin2: DioramaVec = { x: 30, y: 20, z: -50 };
        appendSegment(state, { seed: 's2', lines: mkLines(4), round: 0, placementOrigin: origin2 });

        expect(state.segments[1].globalStart).toBe(3);
        expect(totalGlobalLines(state)).toBe(7);
        // The incoming corridor's line 0 sits at the requested placement origin, far from segment 1.
        expect(state.segments[1].frames[0].position).toEqual(origin2);
        expect(dist(state.segments[1].frames[0].position, state.segments[0].frames[0].position)).toBeGreaterThan(40);
    });

    it('resolves global indices to the right segment / local line across the gap', () => {
        const state = createSequencerState();
        appendSegment(state, { seed: 's1', lines: mkLines(3), round: 0, placementOrigin: ORIGIN });
        appendSegment(state, { seed: 's2', lines: mkLines(4), round: 0, placementOrigin: { x: 40, y: 0, z: 0 } });

        expect(resolveGlobal(state, 0)?.segment.key).toBe('s1#0');
        expect(resolveGlobal(state, 2)).toMatchObject({ localIndex: 2 });
        expect(resolveGlobal(state, 3)?.segment.key).toBe('s2#0');
        expect(resolveGlobal(state, 3)?.localIndex).toBe(0);
        expect(resolveGlobal(state, 6)?.localIndex).toBe(3);
        expect(resolveGlobal(state, 7)).toBeNull();
    });

    it('appends a loop round as a fresh offset segment', () => {
        const state = createSequencerState();
        appendSegment(state, { seed: 'loop', lines: mkLines(4), round: 0, placementOrigin: ORIGIN });
        appendSegment(state, { seed: 'loop', lines: mkLines(4), round: 1, placementOrigin: { x: 0, y: 44, z: -10 } });

        expect(state.segments.map((s) => s.key)).toEqual(['loop#0', 'loop#1']);
        expect(activeSegment(state)?.round).toBe(1);
        expect(state.segments[1].globalStart).toBe(4);
    });

    it('prunes fully-passed segments without renumbering the kept ones', () => {
        const state = createSequencerState();
        appendSegment(state, { seed: 's1', lines: mkLines(3), round: 0, placementOrigin: ORIGIN }); // 0..2
        appendSegment(state, { seed: 's2', lines: mkLines(4), round: 0, placementOrigin: { x: 40, y: 0, z: 0 } }); // 3..6
        appendSegment(state, { seed: 's2', lines: mkLines(4), round: 1, placementOrigin: { x: 80, y: 0, z: 0 } }); // 7..10

        pruneSegments(state, 7);
        expect(state.segments.map((s) => s.key)).toEqual(['s2#1']);
        expect(resolveGlobal(state, 8)?.localIndex).toBe(1);
        expect(resolveGlobal(state, 0)).toBeNull();
    });

    it('rebuilds the active corridor in place when lyrics load late (no new corridor, no move)', () => {
        const state = createSequencerState();
        appendSegment(state, { seed: 's1', lines: mkLines(3), round: 0, placementOrigin: ORIGIN });
        const origin2: DioramaVec = { x: 30, y: 20, z: -50 };
        // Song switched; its corridor spawned before the (slow) lyrics arrived - here as empty/instrumental.
        appendSegment(state, { seed: 's2', lines: [], round: 0, placementOrigin: origin2 });
        const line0Before = activeSegment(state)!.frames[0].position;

        // "Matching best lyrics" finishes a beat later: the corridor catches up IN PLACE.
        updateActiveSegmentLines(state, mkLines(5));

        // Still two segments (no far-offset 2nd corridor to snap across), outgoing untouched.
        expect(state.segments).toHaveLength(2);
        expect(state.segments[0].key).toBe('s1#0');
        const active = activeSegment(state)!;
        expect(active.globalStart).toBe(3);      // unchanged - camera stays put
        expect(active.span).toBe(5);
        expect(totalGlobalLines(state)).toBe(8);
        // Line 0 stays exactly where it was, so the camera is never yanked.
        expect(active.frames[0].position).toEqual(line0Before);
        expect(active.frames[0].position).toEqual(origin2);
        expect(resolveGlobal(state, 3)?.localIndex).toBe(0);
        expect(resolveGlobal(state, 7)?.localIndex).toBe(4);
        expect(resolveGlobal(state, 8)).toBeNull();
    });

    it('bumps linesEpoch on an in-place rebuild, including one that keeps the same span', () => {
        // The signal every lines-derived cache needs. `key` cannot carry it (same seed, same round) and
        // neither can `span` - a reprocess/provider swap/translation can land the SAME number of lines with
        // different words, which is precisely the case that leaves stale lyrics rendered at live indices.
        const state = createSequencerState();
        appendSegment(state, { seed: 's1', lines: mkLines(4), round: 0, placementOrigin: ORIGIN });
        const segment = activeSegment(state)!;
        expect(segment.linesEpoch).toBe(0);

        updateActiveSegmentLines(state, mkLines(4));

        expect(segment.key).toBe('s1#0');
        expect(segment.span).toBe(4);
        expect(segment.linesEpoch).toBe(1);
    });

    it('never prunes the only (active) segment', () => {
        const state = createSequencerState();
        appendSegment(state, { seed: 'solo', lines: mkLines(2), round: 0, placementOrigin: ORIGIN });
        pruneSegments(state, 999);
        expect(state.segments).toHaveLength(1);
    });

    it('gives a lyric-less (instrumental) song one real slot that still flies', () => {
        const state = createSequencerState();
        appendSegment(state, { seed: 'inst', lines: [], round: 0, placementOrigin: ORIGIN });
        expect(state.segments[0].span).toBe(1);
        expect(totalGlobalLines(state)).toBe(1);
        const resolved = resolveGlobal(state, 0);
        expect(resolved?.line).toBeNull();
        expect(resolved?.frame).toBeTruthy();
    });
});
