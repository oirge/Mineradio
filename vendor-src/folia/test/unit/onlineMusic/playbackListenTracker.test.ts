import { describe, expect, it } from 'vitest';
import { MIN_LISTEN_SECONDS, PlaybackListenTracker } from '../../../src/utils/playbackListenTracker';

// test/unit/onlineMusic/playbackListenTracker.test.ts
// The accumulator is the only thing standing between a provider's risk control and a play that
// never happened, so every way of producing a number without playing audio is held against it here.

const session = { songKey: 'online:netease:1', mediaId: '1', totalSeconds: 240 };

/**
 * Feeds continuous playback in quarter-second steps, the way `timeupdate` arrives.
 *
 * Step zero re-states the position it starts from, which is what a real deck does and what anchors
 * the tracker; it credits nothing, so `seconds` is exactly what these tests expect to be counted.
 */
const play = (tracker: PlaybackListenTracker, seconds: number, from = 0, startMs = 0) => {
    const steps = Math.round(seconds / 0.25);
    for (let step = 0; step <= steps; step += 1) {
        tracker.handleProgress(from + step * 0.25, startMs + step * 250);
    }
    return startMs + steps * 250;
};

describe('PlaybackListenTracker', () => {
    it('reports the seconds it actually saw play', () => {
        const tracker = new PlaybackListenTracker();
        tracker.start(session, 0);
        const now = play(tracker, 45, 0, 0);

        expect(tracker.settle(now)).toEqual({
            mediaId: '1',
            songKey: 'online:netease:1',
            playedSeconds: 45,
            totalSeconds: 240,
        });
    });

    it('refuses a track that was skipped before the threshold', () => {
        const tracker = new PlaybackListenTracker();
        tracker.start(session, 0);
        const now = play(tracker, MIN_LISTEN_SECONDS - 1, 0, 0);

        expect(tracker.settle(now)).toBeNull();
    });

    it('credits nothing for a seek to the end of the track', () => {
        const tracker = new PlaybackListenTracker();
        tracker.start(session, 0);
        play(tracker, 2, 0, 0);
        // The listener drags the progress bar to 0:04:00 and the deck reports it.
        tracker.handleProgress(240, 3000);

        expect(tracker.getListenedSeconds()).toBeCloseTo(2, 5);
        expect(tracker.settle(4000)).toBeNull();
    });

    it('credits only the seconds replayed after a rewind, never the rewind itself', () => {
        const tracker = new PlaybackListenTracker();
        tracker.start(session, 0);
        play(tracker, 40, 0, 0);
        tracker.handleProgress(10, 41000);
        const now = play(tracker, 5, 10, 41000);

        expect(tracker.getListenedSeconds()).toBeCloseTo(45, 5);
        expect(tracker.settle(now)).toMatchObject({ playedSeconds: 45 });
    });

    it('credits nothing for the wall-clock gap a pause leaves behind', () => {
        const tracker = new PlaybackListenTracker();
        tracker.start(session, 0);
        play(tracker, 40, 0, 0);
        // Paused for ten minutes; the first tick after resuming is a ten-minute-old marker.
        const resumedAt = 40_000 + 600_000;
        tracker.handleProgress(40.25, resumedAt);
        const now = play(tracker, 10, 40.25, resumedAt);

        expect(tracker.settle(now)).toMatchObject({ playedSeconds: 50 });
    });

    it('caps the report at the track length', () => {
        const tracker = new PlaybackListenTracker();
        tracker.start({ ...session, totalSeconds: 40 }, 0);
        const now = play(tracker, 45, 0, 0);

        expect(tracker.settle(now)).toMatchObject({ playedSeconds: 40, totalSeconds: 40 });
    });

    it('rejects a listen the wall clock says was impossible', () => {
        const tracker = new PlaybackListenTracker();
        tracker.start(session, 0);
        play(tracker, 60, 0, 0);

        // 60s of media time claimed 10s after the session opened.
        expect(tracker.settle(10_000)).toBeNull();
    });

    it('flags a rewind to the top as a restart once the first play qualified', () => {
        const tracker = new PlaybackListenTracker();
        tracker.start(session, 0);
        play(tracker, 40, 0, 0);

        expect(tracker.handleProgress(0.5, 41_000).restarted).toBe(true);
    });

    it('does not flag a rewind to the top before the first play qualified', () => {
        const tracker = new PlaybackListenTracker();
        tracker.start(session, 0);
        play(tracker, 5, 0, 0);

        expect(tracker.handleProgress(0.5, 6000).restarted).toBe(false);
    });

    it('settles a session only once', () => {
        const tracker = new PlaybackListenTracker();
        tracker.start(session, 0);
        const now = play(tracker, 45, 0, 0);

        expect(tracker.settle(now)).not.toBeNull();
        expect(tracker.settle(now)).toBeNull();
    });

    it('has nothing to settle without a session', () => {
        const tracker = new PlaybackListenTracker();

        expect(tracker.getSongKey()).toBeNull();
        expect(tracker.handleProgress(30, 30_000).restarted).toBe(false);
        expect(tracker.settle(30_000)).toBeNull();
    });
});
