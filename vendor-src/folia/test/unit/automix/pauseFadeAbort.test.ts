import { describe, expect, it } from 'vitest';
import { PlayerState } from '@/types';
import { shouldAbortTransitionOnPause } from '@/services/automix/useAutomixDecks';

// test/unit/automix/pauseFadeAbort.test.ts
// When a PAUSED player state may tear the running transition down. While the pause is still fading
// out the transport has already reported PAUSED, but the deferred pause cancels the blend itself,
// back onto the deck the listener was hearing. An abort here first would pause that deck and
// promote the arriving one, and the deferred pause would then stop the next song.

describe('shouldAbortTransitionOnPause', () => {
    it('aborts on an ordinary pause, as before', () => {
        expect(shouldAbortTransitionOnPause(PlayerState.PAUSED, false)).toBe(true);
    });

    it('leaves the transition to the deferred pause while the fade-out is pending', () => {
        expect(shouldAbortTransitionOnPause(PlayerState.PAUSED, true)).toBe(false);
    });

    it('never aborts for states that are not a listener pause, pending fade or not', () => {
        for (const state of [PlayerState.PLAYING, PlayerState.IDLE]) {
            expect(shouldAbortTransitionOnPause(state, false)).toBe(false);
            expect(shouldAbortTransitionOnPause(state, true)).toBe(false);
        }
    });
});
