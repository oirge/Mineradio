// src/components/visualizer/diorama/dioramaSequencer.ts
// The 3D camera-transition state machine for the diorama flythrough.
//
// The diorama used to be strictly per-song: one corridor built at world origin, and a song change /
// single-loop restart snapped the camera back to origin (masked by a flat fade overlay). That masked
// the cut instead of performing it. This sequencer instead keeps every song (and every loop-round) as a
// corridor SEGMENT living at its OWN place in one shared world: the transition controller spawns each new
// segment at a deliberate offset (dioramaTransition.ts) far from the current one, and the camera flies
// the gap. Line indices are GLOBAL across segments, so the mounted window can hold two segments at once -
// the outgoing scene receding into the fog behind while the incoming scene emerges from the fog ahead.
// No overlay, no black, no snapshot layer, the picture never hidden.
//
// This module is pure (no React, no three.js) so the whole state machine is unit-testable. The React
// orchestrator (VisualizerDiorama) owns one SequencerState in a ref, appends on transition edges, and
// hands the segments + a global index to CameraRig / DioramaScene, which resolve frames/lines through it.

import { type Line } from '../../../types';
import {
    buildDioramaPath,
    type DioramaFrame,
    type DioramaVec,
    getFrame,
    translateFrames,
} from './cameraPath';

/** One song (or one loop-round of a song) as a corridor grafted into the continuous tunnel. */
export interface CorridorSegment {
    /** Unique per (song, round) so the active segment can be identity-compared across renders. */
    key: string;
    /** The song seed (= currentSongId): drives this segment's deterministic shots/placements/formations. */
    seed: string | number;
    /** Loop-round: 0 for the first play, incremented each single-loop restart of the same song. */
    round: number;
    /** The song's lyric lines - passed straight to the existing shot/formation builders (by LOCAL index). */
    lines: Line[];
    /** World-space frames, already grafted to continue from the previous segment's tail. */
    frames: DioramaFrame[];
    /** Global index of this segment's LOCAL line 0. Global index of local line k = globalStart + k. */
    globalStart: number;
    /** Number of global index slots this segment occupies (>= 1, so instrumental/no-lyric songs advance). */
    span: number;
    /** World position of this segment's LOCAL line 0 (the offset it was spawned at). Kept so the corridor
     * can be rebuilt at the SAME spot if its lyrics arrive after it was spawned (updateActiveSegmentLines). */
    placementOrigin: DioramaVec;
    /**
     * Bumped every time updateActiveSegmentLines swaps this segment's lyrics. `key` deliberately cannot do
     * this job - it is (seed, round), and the whole point of the in-place rebuild is that a late/reprocessed
     * lyric load keeps the same key. Consumers that CACHE anything derived from the lines (React memos, the
     * rasterised text) must read this too, or they keep serving the previous lyrics for the same indices.
     */
    linesEpoch: number;
}

export interface SequencerState {
    /** Kept segments, oldest first, newest (active/playing) last. Pruned as the camera flies past. */
    segments: CorridorSegment[];
    /** Next free global index - where the next appended segment's local line 0 lands. Monotonic. */
    nextGlobalStart: number;
}

/** A resolved global line: which segment/local line it is, its world frame, and its lyric (null if none). */
export interface ResolvedGlobalLine {
    segment: CorridorSegment;
    localIndex: number;
    frame: DioramaFrame;
    line: Line | null;
}

export const createSequencerState = (): SequencerState => ({ segments: [], nextGlobalStart: 0 });

/** The active (newest) segment - the one currently playing. Null before the first append. */
export const activeSegment = (state: SequencerState): CorridorSegment | null =>
    state.segments[state.segments.length - 1] ?? null;

/**
 * Append a song/round as a new segment placed at `placementOrigin` (world position of its LOCAL line 0)
 * and make it active. The transition controller passes an origin offset well away from the outgoing
 * corridor so the two scenes coexist in one space and the camera flies the gap between them; the very
 * first song is placed at the world origin (unchanged first-song behaviour). Advances the global index
 * by at least one slot so even a lyric-less song occupies real space.
 */
export const appendSegment = (
    state: SequencerState,
    input: { seed: string | number; lines: Line[]; round: number; placementOrigin: DioramaVec }
): CorridorSegment => {
    const raw = buildDioramaPath(input.lines.length, input.seed);
    const frames = translateFrames(raw, input.placementOrigin);
    const span = Math.max(input.lines.length, 1);
    const segment: CorridorSegment = {
        key: `${String(input.seed)}#${input.round}`,
        seed: input.seed,
        round: input.round,
        lines: input.lines,
        frames,
        globalStart: state.nextGlobalStart,
        span,
        placementOrigin: input.placementOrigin,
        linesEpoch: 0,
    };
    state.segments.push(segment);
    state.nextGlobalStart += span;
    return segment;
};

/**
 * Rebuild the ACTIVE (newest) segment's lines/frames in place, at the SAME world origin, keeping its
 * globalStart. Used when a song's lyrics load AFTER its corridor was already spawned (online URL/lyric
 * fetch resolves a render or seconds later than the track switch) - the corridor keeps its identity and
 * place, so there is NO second corridor and NO camera snap; only its geometry catches up. The active
 * segment is the last one, so nextGlobalStart is just its globalStart + span; adjust it by the span delta.
 */
export const updateActiveSegmentLines = (state: SequencerState, lines: Line[]): void => {
    const seg = state.segments[state.segments.length - 1];
    if (!seg) return;
    const raw = buildDioramaPath(lines.length, seg.seed);
    const span = Math.max(lines.length, 1);
    state.nextGlobalStart += span - seg.span;
    seg.lines = lines;
    seg.frames = translateFrames(raw, seg.placementOrigin);
    seg.span = span;
    seg.linesEpoch += 1;
};

/** Exclusive upper bound of the global index space (one past the last valid line). */
export const totalGlobalLines = (state: SequencerState): number => state.nextGlobalStart;

/** Resolve a global index to its segment/local line/world frame/lyric, or null if outside kept segments. */
export const resolveGlobal = (state: SequencerState, globalIndex: number): ResolvedGlobalLine | null => {
    for (const segment of state.segments) {
        const localIndex = globalIndex - segment.globalStart;
        if (localIndex >= 0 && localIndex < segment.span) {
            return {
                segment,
                localIndex,
                frame: getFrame(segment.frames, localIndex),
                line: segment.lines[localIndex] ?? null,
            };
        }
    }
    return null;
};

/**
 * Drop segments that lie entirely behind `keepFromGlobal` (the back edge of the mounted window) - the
 * camera has flown past them and their lines have long since unmounted. The active segment always spans
 * the current index, so it is never pruned. Keeps memory bounded across an endless session.
 */
export const pruneSegments = (state: SequencerState, keepFromGlobal: number): void => {
    if (state.segments.length <= 1) return;
    state.segments = state.segments.filter(
        (segment) => segment.globalStart + segment.span - 1 >= keepFromGlobal
    );
};
