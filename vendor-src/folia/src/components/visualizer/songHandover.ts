import { useEffect, useRef, useState } from 'react';
import type { MotionValue } from 'framer-motion';
import type { Line } from '../../types';

// src/components/visualizer/songHandover.ts
// Shared "which song is actually on screen" gate for visualizers that rebuild something
// expensive per track. The parent clears lyrics to [] on a switch and fills them in a few
// renders later, so a mode that follows `seed` directly rebuilds against an empty song and
// pops its words in afterwards. Everything below runs on a COMMITTED song that lags the real
// one until the new one is ready.

/** Stable identity, so committing "no words" never looks like a content change. */
const EMPTY_COMMITTED_LINES: Line[] = [];

/** 2 seconds of confirmed playback with still no lyrics reads as lyric-less, not still-loading. */
export const DEFAULT_INSTRUMENTAL_COMMIT_SECONDS = 2;
/** Wall-clock cap (ms) so the gate can never hang when playback time never advances. */
export const DEFAULT_READY_GRACE_MS = 8000;

/**
 * Fold of the saved word segmentation over the set, mixed into the signature below.
 *
 * Saving a segmentation rewrites the lines in place: same count, same text, only `wordSegments`
 * added. Without this the signature could not see that, the gate answered `idle`, and the new
 * split did not reach the screen until the song changed. It also covers the load order where the
 * stored record resolves after the lyrics and is patched onto them (useLyricWordSegmentation).
 *
 * Hashing has to describe the split itself, not just how many lines carry one: re-running the AI
 * or hand-editing a line leaves the coverage count untouched while changing what gets drawn.
 * Boundary LENGTHS are enough, since the boundaries always join back to the line's own text.
 *
 * Numeric FNV-1a rather than the string key in wordSegmentation.ts because this runs over every
 * line on every render of the modes that use it, and must not build a string per pass. Lyrics with
 * no saved split cost one null check per line and always fold to the same constant.
 */
const hashWordSegments = (lines: Line[]): number => {
    let hash = 2166136261;
    const mix = (value: number) => {
        hash = Math.imul(hash ^ value, 16777619);
    };
    lines.forEach((line, index) => {
        if (!line.wordSegments) {
            return;
        }
        mix(index);
        line.wordSegments.forEach(segment => mix(segment.length));
    });
    return hash >>> 0;
};

/**
 * Content signature of a lyric set. Identity comparison is useless here: the parent hands down
 * a FRESH `[]` on every render for a loading or lyric-less song, so a `lines` dependency would
 * reset the gate's timer every render and it would never fire.
 *
 * An empty string means "no words", which is deliberately ambiguous between "still loading"
 * and "instrumental" - only playback can tell those apart.
 */
export const getLyricsSignature = (lines: Line[]): string =>
    lines.length === 0 ? '' : `${lines.length}|${lines[0]?.fullText ?? ''}|${hashWordSegments(lines)}`;

export interface VisualizerSongCommit {
    seed: string | number | undefined;
    lines: Line[];
    /** Committed with no words after playback confirmed it: the ♪ / procedural path. */
    isInstrumental: boolean;
}

export interface SongCommitInput {
    seed: string | number | undefined;
    committedSeed: string | number | undefined;
    lyricsSignature: string;
    committedSignature: string;
    isCommittedInstrumental: boolean;
}

export type SongCommitDecision =
    /** Take the incoming song now. */
    | { action: 'commit'; isInstrumental: boolean }
    /** Keep the committed song up and watch playback to see which kind of silence this is. */
    | { action: 'watch' }
    /** Nothing to decide. */
    | { action: 'idle' };

/**
 * The whole gate, as a pure decision. Kept separate from the hook so it can be tested without
 * a DOM: the effect below only wires this to rAF and React state.
 */
export const decideSongCommit = ({
    seed,
    committedSeed,
    lyricsSignature,
    committedSignature,
    isCommittedInstrumental,
}: SongCommitInput): SongCommitDecision => {
    if (seed === committedSeed) {
        if (lyricsSignature === '') {
            // Words going away is never news about this song: it is the parent standing between
            // two tracks, and `seed` reaches the visualizer a render before the new lyrics do.
            // Committing the empty set here is what used to flash the "waiting for music"
            // placeholder over a song whose lyrics were already cached.
            if (isCommittedInstrumental) {
                return { action: 'idle' };
            }
            // So the committed words stay up and playback is watched instead. If the set stays
            // empty (the listener's lyric filter removed every line, or the lyrics were reprocessed
            // down to nothing) the song settles as instrumental; going idle here left the removed
            // lines on screen for the rest of the song. New words landing cancels the watch.
            return { action: 'watch' };
        }
        // Same song, different words: a late load or a reprocess. Take it in place - holding
        // here would leave the mode rendering lyrics the player has already moved past.
        if (lyricsSignature !== committedSignature) {
            return { action: 'commit', isInstrumental: false };
        }
        return { action: 'idle' };
    }

    // A new song takes the stage once its words land, and they have to be *different* words:
    // `seed` flips a render before `lines` does, so an identical signature is the outgoing
    // song's lyrics still sitting in the prop, not the incoming song's.
    if (lyricsSignature !== '' && lyricsSignature !== committedSignature) {
        return { action: 'commit', isInstrumental: false };
    }
    return { action: 'watch' };
};

export interface InstrumentalWatchState {
    /** The new song's playback was seen near its start, so the clock really did reset. */
    sawPlaybackReset: boolean;
    playbackTime: number;
    elapsedMs: number;
}

export interface InstrumentalWatchLimits {
    instrumentalCommitSeconds: number;
    readyGraceMs: number;
}

/**
 * Tied to PLAYBACK, not wall clock: a song that is merely loading has not advanced yet and
 * keeps waiting for its words, while one that has genuinely played this far without any is
 * treated as instrumental. `readyGraceMs` is the escape hatch for a song that never starts.
 */
export const isInstrumentalConfirmed = (
    { sawPlaybackReset, playbackTime, elapsedMs }: InstrumentalWatchState,
    { instrumentalCommitSeconds, readyGraceMs }: InstrumentalWatchLimits,
): boolean => (
    (sawPlaybackReset && playbackTime >= instrumentalCommitSeconds)
    || elapsedMs >= readyGraceMs
);

export interface UseVisualizerSongCommitOptions {
    seed: string | number | undefined;
    lines: Line[];
    currentTime: MotionValue<number>;
    instrumentalCommitSeconds?: number;
    readyGraceMs?: number;
}

/**
 * Holds the outgoing song on screen until the incoming one is ready, then commits it in one
 * step. Modes should build everything song-scoped from the returned values rather than from
 * the raw `seed` / `lines` props.
 */
export const useVisualizerSongCommit = ({
    seed,
    lines,
    currentTime,
    instrumentalCommitSeconds = DEFAULT_INSTRUMENTAL_COMMIT_SECONDS,
    readyGraceMs = DEFAULT_READY_GRACE_MS,
}: UseVisualizerSongCommitOptions): VisualizerSongCommit => {
    const [committed, setCommitted] = useState<VisualizerSongCommit>(
        () => ({ seed, lines, isInstrumental: false }),
    );
    // Behind a ref so the effect can read the newest lines WITHOUT depending on the array
    // identity - see getLyricsSignature on why that dependency would break the gate.
    const linesRef = useRef(lines);
    linesRef.current = lines;

    const lyricsSignature = getLyricsSignature(lines);
    const committedSignature = getLyricsSignature(committed.lines);
    const committedSeed = committed.seed;
    const isCommittedInstrumental = committed.isInstrumental;

    useEffect(() => {
        const decision = decideSongCommit({
            seed,
            committedSeed,
            lyricsSignature,
            committedSignature,
            isCommittedInstrumental,
        });

        if (decision.action === 'idle') {
            return undefined;
        }
        if (decision.action === 'commit') {
            setCommitted({ seed, lines: linesRef.current, isInstrumental: decision.isInstrumental });
            return undefined;
        }

        let raf = 0;
        let sawPlaybackReset = false;
        const startWall = performance.now();
        const watch = () => {
            const playbackTime = currentTime.get();
            if (!sawPlaybackReset && playbackTime < 1) sawPlaybackReset = true;
            const settled = isInstrumentalConfirmed(
                { sawPlaybackReset, playbackTime, elapsedMs: performance.now() - startWall },
                { instrumentalCommitSeconds, readyGraceMs },
            );
            if (settled) {
                // Committed with no words by definition: whatever is in the prop at this instant
                // can only be the outgoing song's, since a set of words for THIS one would have
                // committed through the decision above long before the watch settled.
                setCommitted({ seed, lines: EMPTY_COMMITTED_LINES, isInstrumental: true });
                return;
            }
            raf = requestAnimationFrame(watch);
        };
        raf = requestAnimationFrame(watch);
        return () => cancelAnimationFrame(raf);
    }, [
        committedSeed,
        committedSignature,
        currentTime,
        instrumentalCommitSeconds,
        isCommittedInstrumental,
        lyricsSignature,
        readyGraceMs,
        seed,
    ]);

    return committed;
};
