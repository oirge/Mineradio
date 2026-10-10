import {
    DIORAMA_STEP_DISTANCE,
    getFrame,
    type DioramaFrame,
    type DioramaVec,
} from './cameraPath';
import { extendDioramaFrame } from './dioramaMoteField';
import { resolveGlobal, type SequencerState } from './dioramaSequencer';

// src/components/visualizer/diorama/dioramaParticleCorridor.ts
// One line-local span of the always-on point tunnel. No audio triggers, no camera tracking, no morph:
// the corridor is a fixed cylinder threaded straight along the flight path, so it can never drift off
// centre or pop into a different shape. Rings are sampled from these spans in dioramaParticleModel.ts.
export const DIORAMA_PARTICLE_CORRIDOR_RADIUS = 7.4;

export interface DioramaParticleCorridorSpan {
    /** Path-centre world position where this line's tunnel section starts. */
    start: DioramaVec;
    /** Path-centre world position where it ends (the next line's centre, or one step ahead). */
    end: DioramaVec;
    /** Ring basis (frame right/up) at each end; ring points sit on right*cos + up*sin. */
    startRight: DioramaVec;
    endRight: DioramaVec;
    startUp: DioramaVec;
    endUp: DioramaVec;
    /**
     * Absolute along-path coordinate (the line's global index). Used as the wave's longitudinal phase so
     * the tunnel pattern is anchored to world sections, not to the mounted window - it can't roll or shift
     * when the window slides. Also keeps neighbouring spans' waves continuous.
     */
    pathStart: number;
    /** False for an outgoing/transition line - its span is skipped so the tunnel stays on the live path. */
    enabled: boolean;
}

/** Builds one line-local tunnel span; it never bridges across a song-segment transition gap. */
export const buildDioramaParticleCorridorSpan = (
    frame: DioramaFrame,
    nextFrame: DioramaFrame | null,
    pathStart: number,
    enabled: boolean,
): DioramaParticleCorridorSpan => {
    const start = { ...frame.position };
    const end = nextFrame != null
        ? { ...nextFrame.position }
        : {
            x: start.x + frame.forward.x * DIORAMA_STEP_DISTANCE,
            y: start.y + frame.forward.y * DIORAMA_STEP_DISTANCE,
            z: start.z + frame.forward.z * DIORAMA_STEP_DISTANCE,
        };
    return {
        start,
        end,
        startRight: frame.right,
        endRight: nextFrame ? nextFrame.right : frame.right,
        startUp: frame.up,
        endUp: nextFrame ? nextFrame.up : frame.up,
        pathStart,
        enabled,
    };
};

/**
 * One continuous run of tunnel around `center`, built INSIDE that line's own segment and extended
 * procedurally past the segment's ends.
 *
 * Both of those matter, and both were bugs:
 *  - The window is NOT clamped to the lyric range. Clamping meant nothing existed to mount past a song's
 *    last line, so the tunnel stopped dead a few units in front of the camera and you looked straight out
 *    of its open end. Out past the lyrics the path simply keeps its heading, and the rings keep the same
 *    radius, spacing, wave phase and amplitude - the extension IS the same cylinder, just with no words in
 *    it, so there is nothing to taper and no seam where the lyric-bound section hands over.
 *  - Indices resolve against the window's OWN segment. During a song change the read head has already
 *    jumped to the new segment, so resolving globally walked the outgoing window's outer indices into the
 *    NEW corridor (TRANSITION_DISTANCE away) and the live window's lower indices back into the OLD one.
 *    Each tunnel now extends itself, and the two overlap in the fog instead of reaching into each other.
 */
export const buildDioramaParticleCorridorWindow = (
    sequencer: SequencerState,
    center: number,
    behind: number,
    ahead: number,
): DioramaParticleCorridorSpan[] => {
    const anchor = resolveGlobal(sequencer, center);
    if (!anchor) return [];
    const { segment } = anchor;
    const first = segment.globalStart;
    const last = segment.globalStart + segment.span - 1;
    const frameAt = (index: number): DioramaFrame => {
        const clamped = Math.min(Math.max(index, first), last);
        return extendDioramaFrame(getFrame(segment.frames, clamped - first), index - clamped);
    };
    const spans: DioramaParticleCorridorSpan[] = [];
    for (let i = center - behind; i <= center + ahead; i += 1) {
        // frameAt(i + 1) rather than the raw next frame: it is the same straight continuation past the
        // ends, so every span's end is exactly the next span's start and the rings never gap.
        spans.push(buildDioramaParticleCorridorSpan(frameAt(i), frameAt(i + 1), i, true));
    }
    return spans;
};
