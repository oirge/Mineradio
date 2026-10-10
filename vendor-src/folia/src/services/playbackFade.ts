import { rampGain } from './automix/crossfadeGraph';
import { useAudioSettingsStore } from '../stores/useAudioSettingsStore';

// src/services/playbackFade.ts
// Fade-out-then-pause and play-then-fade-in for the transport, on a dedicated gain node.
//
// The node is NOT the volume node (syncOutputGain owns that one and writes it on every volume,
// mute and track-start) and NOT any automix deck gain (replayGain / trim / fade are owned by the
// blend and the audio bridge). Gain nodes multiply, so a node of its own downstream of both can be
// ramped without either of them ever seeing it, and without a running setValueCurveAtTime on a
// deck throwing because something else wrote the same param.
//
// Every scheduled pause is guarded by a generation token. Anything that makes the pending pause
// stale - a resume, a second pause, a track change - bumps the generation, and the timer checks it
// before touching the audio element.

/** One fixed length for both directions. Long enough to avoid the click, short enough to feel instant. */
export const PLAYBACK_FADE_SECONDS = 0.2;

/** Added to the timer so the audio thread has finished the ramp before the element is paused. */
const TIMER_GRACE_MS = 15;

/**
 * How long the node stays silent after the element is paused. pause() reaches the media pipeline
 * asynchronously, and audio it had already handed to the graph keeps flowing for a few tens of
 * milliseconds; putting the node back to unity at once plays that tail at full level, which is the
 * pop heard at the very end of a fade-out.
 */
export const PAUSE_DRAIN_MS = 150;

/** The return to unity after the drain is itself a short ramp, in case something is sounding again. */
const RESTORE_RAMP_SECONDS = 0.03;

export type PlaybackFadeGraph = {
    context: AudioContext;
    /** The dedicated transport fade node, unity at rest. */
    gain: GainNode;
};

export type PlaybackFadeDeps = {
    /** The live graph, or null while no Web Audio graph exists (the plain-element fallback). */
    getGraph: () => PlaybackFadeGraph | null;
    isEnabled: () => boolean;
    /** Overridable so tests can drive the clock. */
    setTimer?: (callback: () => void, ms: number) => unknown;
    clearTimer?: (handle: unknown) => void;
    durationSec?: number;
};

/** Why a pending pause is running: the fade finished, or something flushed it early. */
export type PlaybackFadeSettleReason = 'elapsed' | 'flushed';

export type PlaybackFadeController = {
    /**
     * Ramps the fade node to silence, then runs `action` (the real pause) once the ramp is done.
     * Returns false when there is nothing to fade - feature off, no graph, context not running -
     * and the caller must then run its pause directly. Idempotent while a fade-out is pending.
     */
    fadeOutThen: (action: (reason: PlaybackFadeSettleReason) => void) => boolean;
    /** True between fadeOutThen and its action running or being cancelled. */
    isFadingOut: () => boolean;
    /**
     * Turns a pending fade-out back into a fade-in from the CURRENT gain, so there is no step.
     * Returns false when no fade-out is pending; the audio was never paused in that case, so a
     * true result means the caller must not press play again.
     */
    cancelPendingPause: () => boolean;
    /**
     * Mutes the fade node and returns a token for runFadeIn, or null when there is nothing to
     * fade. Call it immediately BEFORE play() so the first samples are not at full level.
     */
    prepareFadeIn: () => number | null;
    /** Ramps up from silence once play() has actually started. Stale tokens are ignored. */
    runFadeIn: (token: number | null) => void;
    /** Undoes prepareFadeIn when play() failed. Stale tokens are ignored. */
    abortFadeIn: (token: number | null) => void;
    /**
     * Drops any pending pause and snaps the node back to unity. For track changes, where the old
     * pause must not reach the new song and the new song must not start silent. A post-pause drain
     * still under way is left to finish its own short return to unity.
     */
    cancel: () => void;
    /**
     * For a track change while a pause is still fading out. The old song is still sounding (only
     * its gain was ramped), and the new one may take seconds to load, so dropping the pause would
     * leave the old song at full volume under a PAUSED UI. Runs the pending pause now with reason
     * 'flushed', then restores unity once the paused element has drained (PAUSE_DRAIN_MS).
     * With nothing pending it is the same as cancel().
     */
    flush: () => void;
};

// Builds a controller around injected graph access, so the scheduling is testable without React.
export const createPlaybackFadeController = ({
    getGraph,
    isEnabled,
    setTimer = (callback, ms) => setTimeout(callback, ms),
    clearTimer = handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
    durationSec = PLAYBACK_FADE_SECONDS,
}: PlaybackFadeDeps): PlaybackFadeController => {
    let generation = 0;
    let timer: unknown = null;
    let pendingOut = false;
    let pendingAction: ((reason: PlaybackFadeSettleReason) => void) | null = null;
    // The deferred return to unity after a pause; whoever takes over the node next clears it.
    let restoreTimer: unknown = null;

    const clearPendingTimer = () => {
        if (timer !== null) {
            clearTimer(timer);
            timer = null;
        }
    };

    const clearRestoreTimer = () => {
        if (restoreTimer !== null) {
            clearTimer(restoreTimer);
            restoreTimer = null;
        }
    };

    // Only a graph that can actually play out a ramp: a suspended context never advances it, which
    // would hold the pause for a fade that is not happening.
    const resolveUsableGraph = (): PlaybackFadeGraph | null => {
        if (!isEnabled()) return null;
        const graph = getGraph();
        if (!graph || graph.context.state !== 'running') return null;
        return graph;
    };

    const snapToUnity = () => {
        clearRestoreTimer();
        const graph = getGraph();
        if (graph) rampGain(graph.context, graph.gain, 1, 0);
    };

    // Unity again once the paused element has stopped feeding the graph, not the moment pause() returns.
    const restoreAfterDrain = () => {
        clearRestoreTimer();
        restoreTimer = setTimer(() => {
            restoreTimer = null;
            const graph = getGraph();
            if (graph) rampGain(graph.context, graph.gain, 1, RESTORE_RAMP_SECONDS);
        }, PAUSE_DRAIN_MS);
    };

    // For a track change with no pause of its own to run: a drain already under way is left to
    // finish (the old element may still be emptying into the graph), otherwise unity right away.
    const settleToUnity = () => {
        if (restoreTimer === null) snapToUnity();
    };

    // Retires the pending pause and hands back its action, without running it.
    const takePending = () => {
        generation += 1;
        clearPendingTimer();
        pendingOut = false;
        const action = pendingAction;
        pendingAction = null;
        return action;
    };

    const runAndRestore = (action: (reason: PlaybackFadeSettleReason) => void, reason: PlaybackFadeSettleReason) => {
        try {
            action(reason);
        } finally {
            // Paused (or discarded): unity again so whatever plays next is not silent - after the drain.
            restoreAfterDrain();
        }
    };

    const fadeOutThen = (action: (reason: PlaybackFadeSettleReason) => void) => {
        if (pendingOut) return true;
        const graph = resolveUsableGraph();
        if (!graph) return false;

        clearRestoreTimer();
        const token = ++generation;
        pendingOut = true;
        pendingAction = action;
        // Reads the current gain, so a pause landing mid fade-in turns around from where it is.
        rampGain(graph.context, graph.gain, 0, durationSec);
        timer = setTimer(() => {
            if (token !== generation) return;
            takePending();
            runAndRestore(action, 'elapsed');
        }, durationSec * 1000 + TIMER_GRACE_MS);
        return true;
    };

    const cancelPendingPause = () => {
        if (!pendingOut) return false;
        takePending();
        clearRestoreTimer();
        const graph = getGraph();
        if (graph) rampGain(graph.context, graph.gain, 1, durationSec);
        return true;
    };

    const prepareFadeIn = () => {
        const graph = resolveUsableGraph();
        if (!graph) return null;
        // Also retires a pending pause: starting playback is the opposite of it.
        takePending();
        clearRestoreTimer();
        const token = generation;
        rampGain(graph.context, graph.gain, 0, 0);
        return token;
    };

    const runFadeIn = (token: number | null) => {
        if (token === null || token !== generation) return;
        const graph = getGraph();
        if (graph) rampGain(graph.context, graph.gain, 1, durationSec);
    };

    const abortFadeIn = (token: number | null) => {
        if (token === null || token !== generation) return;
        generation += 1;
        snapToUnity();
    };

    const cancel = () => {
        takePending();
        settleToUnity();
    };

    const flush = () => {
        const action = takePending();
        if (action) runAndRestore(action, 'flushed');
        else settleToUnity();
    };

    return {
        fadeOutThen,
        isFadingOut: () => pendingOut,
        cancelPendingPause,
        prepareFadeIn,
        runFadeIn,
        abortFadeIn,
        cancel,
        flush,
    };
};

// Elements whose next 'pause' event comes from a flushed fade rather than from the listener. The
// event is async, so by the time it arrives the new song's play intent may already be set, and
// handling it as a listener pause would cancel that intent.
// A mark carries a deadline: the browser drops queued media events when the source is reloaded, so a
// mark whose event never arrived must not swallow the listener's next real pause.
const PROGRAMMATIC_PAUSE_TTL_MS = 1000;
const programmaticPauses = new WeakMap<HTMLMediaElement, number>();

/** Call just before pausing a playing element on a flush, so its pause event can be recognised. */
export const markProgrammaticPause = (element: HTMLMediaElement) => {
    programmaticPauses.set(element, Date.now() + PROGRAMMATIC_PAUSE_TTL_MS);
};

/** True once for an element marked above and still within its deadline; the pause handler uses it to ignore that event. */
export const consumeProgrammaticPause = (element: HTMLMediaElement): boolean => {
    const deadline = programmaticPauses.get(element);
    if (deadline === undefined) return false;
    programmaticPauses.delete(element);
    return Date.now() <= deadline;
};

let registeredGraph: PlaybackFadeGraph | null = null;

/** Called once the playback graph is built, so the transport can reach the fade node. */
export const registerPlaybackFadeGraph = (graph: PlaybackFadeGraph | null) => {
    registeredGraph = graph;
};

/** The app-wide controller. There is one audio context, so one controller. */
export const playbackFade = createPlaybackFadeController({
    getGraph: () => registeredGraph,
    isEnabled: () => useAudioSettingsStore.getState().playbackFadeEnabled,
});
