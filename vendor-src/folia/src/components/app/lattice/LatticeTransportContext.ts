import { createContext, useContext } from 'react';
import { motionValue, type MotionValue } from 'framer-motion';
import { PlayerState, type SongResult } from '../../../types';

// src/components/app/lattice/LatticeTransportContext.ts — transport state for the one expanded card.

/**
 * Pause, resume and duration updates arrive continuously, but only the expanded card's chrome reads
 * them. Carried as poster props they defeated every mounted poster's memo, so a pause re-rendered
 * the whole visible wall to change one button. A context narrows the fan-out to the single
 * subscriber. Discrete per-poster state still travels with the tile — `section` already marks the
 * playing card — so a track change re-renders exactly the two posters it affects.
 *
 * State only. Event callbacks stay props: they are stabilised by `useStableCallbacks`, which
 * dispatches to the current render, and moving them here would buy nothing while adding a second
 * path for a poster to hold a stale one.
 */
export type LatticeTransport = {
    currentSong: SongResult | null;
    playerState: PlayerState;
    currentTime: MotionValue<number>;
    playbackDuration: number;
    canTogglePlayback: boolean;
};

// Nothing playing and nothing controllable: the chrome renders its idle state rather than throwing,
// which keeps `LatticePlaybackControls` mountable in isolation.
const idleTransport: LatticeTransport = {
    currentSong: null,
    playerState: PlayerState.PAUSED,
    currentTime: motionValue(0),
    playbackDuration: 0,
    canTogglePlayback: false,
};

export const LatticeTransportContext = createContext<LatticeTransport>(idleTransport);

export const useLatticeTransport = () => useContext(LatticeTransportContext);
