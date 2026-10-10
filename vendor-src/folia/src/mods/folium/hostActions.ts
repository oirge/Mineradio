import { useEffect, useRef } from 'react';
import type { SongResult } from '@/types';
import { PlayerState } from '@/types';
import {
    usePlaybackStore,
    selectDisplayDuration,
    selectDisplayPlayerState,
    selectDisplaySong,
} from '@/stores/usePlaybackStore';
import { useAppViewStore } from '@/stores/useAppViewStore';
import { setStatusMessage } from '@/stores/useStatusMessageStore';
import { currentTime } from '@/stores/motionSignals';
import type { PanelTab } from '@/components/UnifiedPanel';
import { resolveLikeAvailability } from '@/utils/playerLikeAvailability';
import { resolveFoliumSongRef, toFoliumSong } from './dto';
import { emitFoliumEvent } from './events';
import { registerFoliumHostActions } from './services';

// src/mods/folium/hostActions.ts
// App registers the real host actions behind folium.playback / folium.ui here.
// Handlers are read through a ref, so the registration happens once and always
// calls App's latest callbacks without re-registering on every render.

export interface FoliumAppActions {
    play: () => void;
    pause: () => void;
    toggle: () => void;
    seek: (seconds: number) => void;
    seekToLyricTime: (lyricSeconds: number) => void;
    next: () => void;
    previous: () => void;
    playSong: (song: SongResult) => void | Promise<void>;
    enqueue: (song: SongResult) => void;
    navigateToPlayer: () => void;
    navigateToHome: () => void;
    shuffleQueue: () => void;
    toggleLike: () => void | Promise<void>;
    openVolume: () => void;
    /** The displayed song is liked (the value the host's like button shows). */
    isLiked: boolean;
    /** Now-playing controls are off (a blend, no source); the like button greys out with them. */
    controlsDisabled: boolean;
}

type PlaybackStoreState = ReturnType<typeof usePlaybackStore.getState>;

/* Same rule as the player bar's shuffle slot, plus external Stage playback, which shuffleQueue ignores. */
const canShuffleQueue = (state: PlaybackStoreState) => (
    !state.isFmMode && state.playQueue.length > 1 && state.activePlaybackContext !== 'stage'
);

export const useFoliumHostActions = (actions: FoliumAppActions) => {
    const actionsRef = useRef(actions);
    actionsRef.current = actions;

    /* Same rule as the player bar's like slot. */
    const canLike = (state: PlaybackStoreState) => !resolveLikeAvailability(
        selectDisplaySong(state),
        actionsRef.current.controlsDisabled,
        state.activePlaybackContext === 'stage',
    ).disabled;

    useEffect(() => {
        registerFoliumHostActions({
            getPlaybackState: () => {
                const state = usePlaybackStore.getState();
                const playerState = selectDisplayPlayerState(state);
                const duration = selectDisplayDuration(state);
                return {
                    song: toFoliumSong(selectDisplaySong(state)),
                    state: playerState === PlayerState.PLAYING ? 'playing' : playerState === PlayerState.PAUSED ? 'paused' : 'stopped',
                    position: currentTime.get(),
                    duration: Number.isFinite(duration) ? duration : 0,
                    liked: Boolean(selectDisplaySong(state)) && actionsRef.current.isLiked,
                    canLike: canLike(state),
                };
            },
            play: () => actionsRef.current.play(),
            pause: () => actionsRef.current.pause(),
            toggle: () => actionsRef.current.toggle(),
            seek: (seconds) => actionsRef.current.seek(seconds),
            seekToLyricTime: (lyricSeconds) => actionsRef.current.seekToLyricTime(lyricSeconds),
            next: () => actionsRef.current.next(),
            previous: () => actionsRef.current.previous(),
            playSongRef: async (ref) => {
                const song = resolveFoliumSongRef(ref);
                if (!song) return false;
                await actionsRef.current.playSong(song);
                return true;
            },
            enqueueSongRef: (ref) => {
                const song = resolveFoliumSongRef(ref);
                if (!song) return false;
                actionsRef.current.enqueue(song);
                return true;
            },
            shuffleQueue: () => {
                if (!canShuffleQueue(usePlaybackStore.getState())) return false;
                actionsRef.current.shuffleQueue();
                return true;
            },
            toggleLike: () => {
                if (!canLike(usePlaybackStore.getState())) return false;
                void actionsRef.current.toggleLike();
                return true;
            },
            toast: (message, type, durationMs) => setStatusMessage({ type, text: message, ...(durationMs ? { durationMs } : {}) }),
            openPlayerPanel: (tab) => {
                const view = useAppViewStore.getState();
                if (tab) view.setPanelTab(tab as PanelTab);
                view.setIsPanelOpen(true);
            },
            navigate: (target) => (target === 'player' ? actionsRef.current.navigateToPlayer() : actionsRef.current.navigateToHome()),
            openVolume: () => actionsRef.current.openVolume(),
        });
        return () => registerFoliumHostActions(null);
    }, []);

    // playback.likeChanged follows the value getState().liked reports, whatever changed it.
    const liked = actions.isLiked;
    const likedPrimedRef = useRef(false);
    useEffect(() => {
        if (!likedPrimedRef.current) {
            likedPrimedRef.current = true;
            return;
        }
        emitFoliumEvent('playback.likeChanged', { liked });
    }, [liked]);
};
