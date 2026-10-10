import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    consumeProgrammaticPause,
    createPlaybackFadeController,
    markProgrammaticPause,
    PAUSE_DRAIN_MS,
    PLAYBACK_FADE_SECONDS,
} from '@/services/playbackFade';
import { useAudioSettingsStore } from '@/stores/useAudioSettingsStore';
import { createFakeFadeGraph, type FakeFadeGraph } from './fakeFadeGraph';

// test/unit/services/playbackFade.test.ts
// Scheduling, cancellation and generation-token behaviour of the pause/resume fade. The gain curve
// is read off a fake AudioParam that models linear ramps, so "no step when turning around" is an
// assertion on values rather than on which calls were made.

const D = PLAYBACK_FADE_SECONDS;
/** Silence held after the element is paused, plus the short ramp back to unity. */
const DRAIN = PAUSE_DRAIN_MS / 1000;
const DRAIN_AND_RESTORE = DRAIN + 0.05;

let graph: FakeFadeGraph;
let enabled: boolean;
let hasGraph: boolean;

const makeController = () => createPlaybackFadeController({
    getGraph: () => (hasGraph ? graph : null),
    isEnabled: () => enabled,
});

/** Moves the audio clock and the timer clock together, as one wall-clock second does in the app. */
const advance = (seconds: number) => {
    // In 1ms steps, so a timer that schedules a ramp sees the audio clock at its own firing time.
    let remainingMs = Math.round(seconds * 1000);
    while (remainingMs > 0) {
        const stepMs = Math.min(1, remainingMs);
        graph.clock.now += stepMs / 1000;
        vi.advanceTimersByTime(stepMs);
        remainingMs -= stepMs;
    }
};

const gain = () => graph.param.value;

beforeEach(() => {
    vi.useFakeTimers();
    graph = createFakeFadeGraph();
    enabled = true;
    hasGraph = true;
});

afterEach(() => {
    vi.useRealTimers();
});

describe('fadeOutThen', () => {
    it('ramps to silence and only then runs the pause, restoring unity afterwards', () => {
        const fade = makeController();
        const pause = vi.fn();

        expect(fade.fadeOutThen(pause)).toBe(true);
        expect(fade.isFadingOut()).toBe(true);
        expect(pause).not.toHaveBeenCalled();

        advance(D / 2);
        expect(gain()).toBeCloseTo(0.5, 5);
        expect(pause).not.toHaveBeenCalled();

        advance(D / 2 + 0.02);
        expect(pause).toHaveBeenCalledTimes(1);
        expect(fade.isFadingOut()).toBe(false);
        // Still silent: the paused element may still be emptying its buffer into the graph.
        expect(gain()).toBe(0);

        // Unity again once that tail is gone, so whatever plays next is not silent.
        advance(DRAIN_AND_RESTORE);
        expect(gain()).toBe(1);
    });

    it('holds silence through the drain, so the tail of the paused element is never heard at full level', () => {
        const fade = makeController();
        fade.fadeOutThen(vi.fn());
        advance(D + 0.02);

        // Sample the whole window right after pause() - the gain must not move off zero.
        for (let elapsed = 0; elapsed < DRAIN - 0.01; elapsed += 0.01) {
            expect(gain()).toBe(0);
            advance(0.01);
        }
        advance(0.06);
        expect(gain()).toBe(1);
    });

    it('refuses, leaving the caller to pause directly, when there is nothing to fade', () => {
        const pause = vi.fn();

        enabled = false;
        expect(makeController().fadeOutThen(pause)).toBe(false);

        enabled = true;
        hasGraph = false;
        expect(makeController().fadeOutThen(pause)).toBe(false);

        hasGraph = true;
        graph.setState('suspended');
        expect(makeController().fadeOutThen(pause)).toBe(false);

        advance(1);
        expect(pause).not.toHaveBeenCalled();
        expect(gain()).toBe(1);
    });

    it('is idempotent while a fade-out is pending', () => {
        const fade = makeController();
        const first = vi.fn();
        const second = vi.fn();

        fade.fadeOutThen(first);
        advance(D / 2);
        expect(fade.fadeOutThen(second)).toBe(true);
        advance(D);

        expect(first).toHaveBeenCalledTimes(1);
        expect(second).not.toHaveBeenCalled();
    });

    it('still restores unity when the pause itself throws', () => {
        const fade = makeController();
        fade.fadeOutThen(() => { throw new Error('pause failed'); });

        expect(() => advance(D + 0.02)).toThrow('pause failed');
        expect(fade.isFadingOut()).toBe(false);
        advance(DRAIN_AND_RESTORE);
        expect(gain()).toBe(1);
    });
});

describe('cancelPendingPause (resume during fade-out)', () => {
    it('turns around from the current gain without a step and never pauses', () => {
        const fade = makeController();
        const pause = vi.fn();
        fade.fadeOutThen(pause);

        advance(D * 0.6);
        const before = gain();
        expect(before).toBeCloseTo(0.4, 5);

        expect(fade.cancelPendingPause()).toBe(true);
        // Same instant: continuous with where the fade-out had got to.
        expect(gain()).toBeCloseTo(before, 5);

        advance(D / 2);
        expect(gain()).toBeGreaterThan(before);
        expect(gain()).toBeLessThan(1);

        advance(D);
        expect(gain()).toBeCloseTo(1, 5);
        expect(pause).not.toHaveBeenCalled();
        expect(fade.isFadingOut()).toBe(false);
    });

    it('reports false when no pause is pending, so the caller presses play itself', () => {
        expect(makeController().cancelPendingPause()).toBe(false);
    });

    it('survives rapid pause / resume / pause / resume with exactly the last intent applied', () => {
        const fade = makeController();
        const firstPause = vi.fn();
        const secondPause = vi.fn();

        fade.fadeOutThen(firstPause);
        advance(0.05);
        fade.cancelPendingPause();
        advance(0.03);
        fade.fadeOutThen(secondPause);
        advance(0.06);
        fade.cancelPendingPause();
        advance(1);

        expect(firstPause).not.toHaveBeenCalled();
        expect(secondPause).not.toHaveBeenCalled();
        expect(gain()).toBeCloseTo(1, 5);
    });

    it('lets the second pause land when it is the last thing pressed', () => {
        const fade = makeController();
        const firstPause = vi.fn();
        const secondPause = vi.fn();

        fade.fadeOutThen(firstPause);
        advance(0.05);
        fade.cancelPendingPause();
        advance(0.03);
        fade.fadeOutThen(secondPause);
        advance(D + 0.05);

        expect(firstPause).not.toHaveBeenCalled();
        expect(secondPause).toHaveBeenCalledTimes(1);
        advance(DRAIN_AND_RESTORE);
        expect(gain()).toBe(1);
    });
});

describe('fade-in', () => {
    it('mutes before play() and ramps up afterwards', () => {
        const fade = makeController();

        const token = fade.prepareFadeIn();
        expect(token).not.toBeNull();
        expect(gain()).toBe(0);

        // play() takes a while to resolve: the ramp must not have started yet.
        advance(0.3);
        expect(gain()).toBe(0);

        fade.runFadeIn(token);
        advance(D / 2);
        expect(gain()).toBeCloseTo(0.5, 5);
        advance(D / 2);
        expect(gain()).toBeCloseTo(1, 5);
    });

    it('returns no token, and touches nothing, when the feature is off or there is no graph', () => {
        enabled = false;
        const off = makeController();
        expect(off.prepareFadeIn()).toBeNull();
        off.runFadeIn(null);

        enabled = true;
        hasGraph = false;
        expect(makeController().prepareFadeIn()).toBeNull();
        expect(gain()).toBe(1);
    });

    it('turns a pause pressed mid fade-in around from the current gain', () => {
        const fade = makeController();
        const pause = vi.fn();
        fade.runFadeIn(fade.prepareFadeIn());

        advance(D / 2);
        const before = gain();
        expect(before).toBeCloseTo(0.5, 5);

        fade.fadeOutThen(pause);
        expect(gain()).toBeCloseTo(before, 5);
        advance(D / 4);
        expect(gain()).toBeLessThan(before);

        advance(D);
        expect(pause).toHaveBeenCalledTimes(1);
    });

    it('ignores a late runFadeIn once something newer has happened', () => {
        const fade = makeController();
        const pause = vi.fn();
        const token = fade.prepareFadeIn();

        // The listener pauses while play() is still resolving.
        fade.fadeOutThen(pause);
        fade.runFadeIn(token);
        advance(D / 2);

        // Still heading to silence, not yanked back up by the stale ramp.
        expect(gain()).toBe(0);
        advance(D);
        expect(pause).toHaveBeenCalledTimes(1);
    });

    it('prepareFadeIn retires a pending pause instead of letting it land later', () => {
        const fade = makeController();
        const pause = vi.fn();
        fade.fadeOutThen(pause);
        advance(D / 2);

        const token = fade.prepareFadeIn();
        fade.runFadeIn(token);
        advance(D * 3);

        expect(pause).not.toHaveBeenCalled();
        expect(fade.isFadingOut()).toBe(false);
        expect(gain()).toBeCloseTo(1, 5);
    });

    it('a resume during the post-pause drain fades in on its own, without the drain restore cutting in', () => {
        const fade = makeController();
        fade.fadeOutThen(vi.fn());
        advance(D + 0.02);
        advance(0.05);

        const token = fade.prepareFadeIn();
        expect(gain()).toBe(0);
        fade.runFadeIn(token);

        // Past the point where the drain restore would have fired: still on the fade-in's curve.
        advance(D / 2);
        expect(gain()).toBeCloseTo(0.5, 5);
        advance(D / 2);
        expect(gain()).toBeCloseTo(1, 5);
    });

    it('abortFadeIn puts the volume back after a failed play(), but only for the current token', () => {
        const fade = makeController();

        const stale = fade.prepareFadeIn();
        const current = fade.prepareFadeIn();
        fade.abortFadeIn(stale);
        expect(gain()).toBe(0);

        fade.abortFadeIn(current);
        expect(gain()).toBe(1);
    });
});

describe('cancel (track change)', () => {
    it('drops the pending pause and snaps back to unity', () => {
        const fade = makeController();
        const pause = vi.fn();
        fade.fadeOutThen(pause);
        advance(D / 2);
        expect(gain()).toBeCloseTo(0.5, 5);

        fade.cancel();
        expect(gain()).toBe(1);
        expect(fade.isFadingOut()).toBe(false);

        advance(D * 3);
        expect(pause).not.toHaveBeenCalled();
        expect(gain()).toBe(1);
    });

    it('does not let the old pause reach the new song, and the next pause works normally', () => {
        const fade = makeController();
        const oldSongPause = vi.fn();
        const newSongPause = vi.fn();

        fade.fadeOutThen(oldSongPause);
        advance(D / 2);
        fade.cancel();

        // New song is playing at full level when the old timer would have fired.
        advance(D);
        expect(oldSongPause).not.toHaveBeenCalled();
        expect(gain()).toBe(1);

        fade.fadeOutThen(newSongPause);
        advance(D + 0.02);
        expect(newSongPause).toHaveBeenCalledTimes(1);
        expect(oldSongPause).not.toHaveBeenCalled();
    });

    it('invalidates a fade-in that was waiting on play()', () => {
        const fade = makeController();
        const token = fade.prepareFadeIn();
        fade.cancel();
        fade.runFadeIn(token);
        advance(D);

        expect(gain()).toBe(1);
    });

    it('is harmless with no graph', () => {
        hasGraph = false;
        expect(() => makeController().cancel()).not.toThrow();
    });

    it('leaves a drain that is still under way to finish instead of snapping to unity', () => {
        const fade = makeController();
        fade.fadeOutThen(vi.fn());
        advance(D + 0.02);

        fade.cancel();
        expect(gain()).toBe(0);
        advance(DRAIN_AND_RESTORE);
        expect(gain()).toBe(1);
    });
});

describe('flush (track change while a pause is fading out)', () => {
    it('runs the pending pause now, once, and restores unity', () => {
        const fade = makeController();
        const pause = vi.fn();
        fade.fadeOutThen(pause);
        advance(D / 2);

        fade.flush();
        expect(pause).toHaveBeenCalledTimes(1);
        expect(pause).toHaveBeenCalledWith('flushed');
        expect(fade.isFadingOut()).toBe(false);
        // No jump back up while the half-faded element drains: it keeps heading down instead.
        expect(gain()).toBeCloseTo(0.5, 5);
        advance(DRAIN - 0.01);
        expect(gain()).toBeLessThanOrEqual(0.5);

        // The timer that was already scheduled must not run it a second time.
        advance(D * 3);
        expect(pause).toHaveBeenCalledTimes(1);
        expect(gain()).toBe(1);
    });

    it('passes elapsed when the fade simply finishes', () => {
        const fade = makeController();
        const pause = vi.fn();
        fade.fadeOutThen(pause);
        advance(D + 0.02);

        expect(pause).toHaveBeenCalledWith('elapsed');
    });

    it('is the same as cancel() with nothing pending, including mid fade-in', () => {
        const fade = makeController();
        fade.runFadeIn(fade.prepareFadeIn());
        advance(D / 2);

        fade.flush();
        expect(gain()).toBe(1);
    });

    it('restores unity even if the flushed pause throws', () => {
        const fade = makeController();
        fade.fadeOutThen(() => { throw new Error('pause failed'); });
        advance(D / 2);

        expect(() => fade.flush()).toThrow('pause failed');
        expect(fade.isFadingOut()).toBe(false);
        advance(DRAIN_AND_RESTORE);
        expect(gain()).toBe(1);
    });
});

describe('programmatic pause marks', () => {
    it('are consumed exactly once per element', () => {
        const element = {} as HTMLMediaElement;
        const other = {} as HTMLMediaElement;
        expect(consumeProgrammaticPause(element)).toBe(false);

        markProgrammaticPause(element);
        expect(consumeProgrammaticPause(other)).toBe(false);
        expect(consumeProgrammaticPause(element)).toBe(true);
        expect(consumeProgrammaticPause(element)).toBe(false);
    });

    it('expire, so a mark whose pause event never came cannot swallow a later real pause', () => {
        const element = {} as HTMLMediaElement;
        markProgrammaticPause(element);

        vi.advanceTimersByTime(5000);
        expect(consumeProgrammaticPause(element)).toBe(false);
        // Spent either way: nothing is left behind to match a later event.
        expect(consumeProgrammaticPause(element)).toBe(false);
    });
});

describe('playbackFadeEnabled setting', () => {
    it('defaults to on and can be switched off', () => {
        expect(useAudioSettingsStore.getState().playbackFadeEnabled).toBe(true);
        useAudioSettingsStore.getState().handleTogglePlaybackFade(false);
        expect(useAudioSettingsStore.getState().playbackFadeEnabled).toBe(false);
        useAudioSettingsStore.getState().handleTogglePlaybackFade(true);
        expect(useAudioSettingsStore.getState().playbackFadeEnabled).toBe(true);
    });
});
