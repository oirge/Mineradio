import { type DioramaGeometryVisibility } from '../../../types';
import {
    DIORAMA_PARTICLE_AUDIO_SCALE_MAX,
    type DioramaShapePlacement,
} from './cameraPath';

// src/components/visualizer/diorama/dioramaGeometry.ts
// Pure visibility and cross-line spacing rules for the 'clouds' point-cloud formation layer.
export interface DioramaParticleClusterAnchor extends DioramaShapePlacement {
    key: string;
    sourceLine: number;
    /** Stable per-cluster seed (excludes global index) so a loop rebuilds the same cloud pattern. */
    particleSeed: string | number;
    role: 'formation';
}

const isKindVisible = (
    kind: DioramaShapePlacement['kind'],
    visibility: DioramaGeometryVisibility,
): boolean => {
    if (kind === 'box') return visibility.strands;
    if (kind === 'sphere') return visibility.blobs;
    if (kind === 'cone') return visibility.ribbons;
    return visibility.rings;
};

const getClusterRadius = (shape: DioramaShapePlacement): number => {
    const familyRadius = shape.kind === 'box'
        ? 0.5
        : shape.kind === 'sphere'
            ? 0.74
            : shape.kind === 'cone'
                ? 0.68
                : 0.9;
    return shape.scale
        * Math.max(familyRadius, shape.stretchY * 0.55)
        * DIORAMA_PARTICLE_AUDIO_SCALE_MAX;
};

const distanceBetween = (a: DioramaShapePlacement, b: DioramaShapePlacement): number => Math.hypot(
    a.position.x - b.position.x,
    a.position.y - b.position.y,
    a.position.z - b.position.z,
);

/**
 * How many lines apart two clusters can still collide. Lines sit DIORAMA_STEP_DISTANCE (8) apart and no
 * cluster's clearance comes close to 16 units, so a rival this far away can never block anything - which
 * is what makes the verdict below computable from a bounded neighbourhood.
 */
export const DIORAMA_CLUSTER_COLLISION_LINE_SPAN = 2;

/**
 * Removes only cross-line cluster collisions, so a line's intentional multi-piece composition is never
 * thinned but neighbouring lines whose independently-placed clouds happen to converge in world space
 * don't pile into one bright knot.
 *
 * The verdict is a pure function of the song, NOT of the camera. Input must be sorted by sourceLine
 * ascending; the earlier line always wins, and a candidate is tested against every rival within
 * DIORAMA_CLUSTER_COLLISION_LINE_SPAN whether or not that rival itself survived. Those two rules together
 * mean a given cluster is kept-or-dropped identically forever: no chain of verdicts to unravel, and no
 * dependence on which line is current. (Ranking the input by distance from the current line - the old
 * "active line wins" rule - re-ran this greedy pass in a different order on EVERY line advance, so the
 * whole surrounding composition silently re-shuffled as the camera moved. That was the "everything
 * regenerates when the camera reaches the next lyric" bug.) A sliding mounted window can now only add or
 * remove clusters at its far edges, where the distance fade already hides them.
 */
export const selectVisibleDioramaClusters = (
    shapes: DioramaParticleClusterAnchor[],
    visibility: DioramaGeometryVisibility,
): DioramaParticleClusterAnchor[] => {
    if (!visibility.enabled || visibility.mode !== 'clouds') return [];

    const candidates = shapes.filter((shape) => isKindVisible(shape.kind, visibility));
    return candidates.filter((candidate, index) => {
        const candidateRadius = getClusterRadius(candidate);
        for (let rivalIndex = index - 1; rivalIndex >= 0; rivalIndex -= 1) {
            const rival = candidates[rivalIndex];
            if (candidate.sourceLine - rival.sourceLine > DIORAMA_CLUSTER_COLLISION_LINE_SPAN) break;
            if (rival.sourceLine === candidate.sourceLine) continue;
            const clearance = Math.max(1.8, (getClusterRadius(rival) + candidateRadius) * 1.18);
            if (distanceBetween(rival, candidate) < clearance) return false;
        }
        return true;
    });
};
