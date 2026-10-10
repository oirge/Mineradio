import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { MotionValue } from 'framer-motion';
import { PlayerState, type LocalSong } from '../types';
import type { PlaybackRecoveryTarget } from '../types/playbackRecovery';
import { classifyMediaElementFailure } from '../services/playbackRecovery/mediaFailureClassifier';
import { cancelPlayableTranscode, startPlayableTranscode } from '../services/playbackRecovery/playableSourceService';
import { registerPlaybackRepresentation } from '../services/playbackRecovery/representationRegistry';
import { useAudioSettingsStore } from '../stores/useAudioSettingsStore';
import { setStatusMessage } from '../stores/useStatusMessageStore';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { getPlaybackSongKey, isLocalPlaybackSong, isNavidromePlaybackSong } from '../utils/appPlaybackGuards';
import i18n from '../i18n/config';

// Coordinates asynchronous recovery ownership without rebuilding the playback graph or song state.

/** Enough for a long queue of undecodable tracks; the set is cleared wholesale once it is hit. */
const MAX_REMEMBERED_FAILURES = 64;

type UseTranscodeFallbackParams = {
    audioSrc: string | null;
    localSongs: LocalSong[];
    currentTime: MotionValue<number>;
    pendingResumeTimeRef: MutableRefObject<number | null>;
    shouldAutoPlayRef: MutableRefObject<boolean>;
    getRecoveryTarget: (element: HTMLAudioElement) => PlaybackRecoveryTarget | null;
    replaceRecoverySource: (element: HTMLAudioElement, failedSource: string, nextSource: string) => boolean;
    clearFailedWarmSource: (element: HTMLAudioElement, failedSource: string) => void;
    abortTransition: () => void;
    handleTailEnded: () => void;
    skipAfterPlaybackFailure: () => void;
};

export function useTranscodeFallback({
    audioSrc,
    localSongs,
    currentTime,
    pendingResumeTimeRef,
    shouldAutoPlayRef,
    getRecoveryTarget,
    replaceRecoverySource,
    clearFailedWarmSource,
    abortTransition,
    handleTailEnded,
    skipAfterPlaybackFailure,
}: UseTranscodeFallbackParams) {
    const enabled = useAudioSettingsStore(state => state.enableTranscodeFallback);
    const generationRef = useRef(0);
    const activeRequestsRef = useRef(new Map<string, string>());
    // Keyed by the song's source revision rather than by the media element: the automix arming
    // effect re-arms the warm deck with the same URL on every timeupdate, so a track FFmpeg cannot
    // decode would otherwise respawn a failing job several times a second for the whole arm window.
    const failedRepresentationsRef = useRef(new Set<string>());

    useEffect(() => {
        generationRef.current += 1;
        activeRequestsRef.current.forEach(cancelPlayableTranscode);
        activeRequestsRef.current.clear();
    }, [audioSrc]);

    useEffect(() => () => {
        activeRequestsRef.current.forEach(cancelPlayableTranscode);
        activeRequestsRef.current.clear();
    }, []);

    return useCallback((element: HTMLAudioElement): boolean => {
        const failedSource = element.currentSrc || element.getAttribute('src') || '';
        const classification = classifyMediaElementFailure(element.error, failedSource);
        const target = getRecoveryTarget(element);
        if (!target) return false;

        if (target.role === 'tail') {
            handleTailEnded();
            return true;
        }

        const song = target.song;
        const canRecover = Boolean(
            enabled
            && window.electron?.requestTranscodeFallback
            && classification.eligibleForTranscode
            && song
            && (isLocalPlaybackSong(song) || isNavidromePlaybackSong(song))
            && failedSource
            && !failedSource.startsWith('folia-transcode:'),
        );
        if (!canRecover || !song) return false;

        const bindingKey = `${target.deck}:${failedSource}`;
        if (activeRequestsRef.current.has(bindingKey)) return true;

        // A remembered failure still owns the error - it clears the warm slot or skips the track,
        // the same way the first attempt did - it just does not start another transcode or toast.
        const failureKey = `${getPlaybackSongKey(song)}:${song.playbackSourceRevision ?? ''}:${failedSource}`;
        if (failedRepresentationsRef.current.has(failureKey)) {
            if (target.role === 'warm') {
                clearFailedWarmSource(element, failedSource);
            } else {
                abortTransition();
                skipAfterPlaybackFailure();
            }
            return true;
        }

        const generation = generationRef.current;
        const resumeAt = Math.max(0, element.currentTime || currentTime.get());
        const wantsPlayback = target.role === 'active' && (
            (!element.paused && !element.ended)
            || usePlaybackStore.getState().playerState === PlayerState.PLAYING
            || shouldAutoPlayRef.current
        );

        if (target.role === 'active') abortTransition();
        setStatusMessage({ type: 'info', text: i18n.t('status.transcodeFallbackStarting') });

        void (async () => {
            const request = startPlayableTranscode(song, failedSource, localSongs, target.role === 'warm' ? 'warm' : 'playback');
            const requestId = request.requestId;
            activeRequestsRef.current.set(bindingKey, requestId);
            console.info('[TranscodeFallback] recovery-start', {
                requestId,
                deck: target.deck,
                role: target.role,
                songKey: getPlaybackSongKey(song),
            });
            try {
                const result = await request.result;
                const representation = result.representation;
                if (!result.ok || !representation) throw Object.assign(
                    new Error(result.message || 'Transcode failed'),
                    { code: result.errorCode },
                );
                if (generationRef.current !== generation) return;
                registerPlaybackRepresentation(representation);

                if (target.role === 'active') {
                    const latestTime = currentTime.get();
                    pendingResumeTimeRef.current = Number.isFinite(latestTime) ? Math.max(0, latestTime) : resumeAt;
                    shouldAutoPlayRef.current = wantsPlayback
                        && usePlaybackStore.getState().playerState !== PlayerState.PAUSED;
                }
                if (!replaceRecoverySource(element, failedSource, representation.url)) return;
                console.info('[TranscodeFallback] source-replaced', {
                    requestId,
                    deck: target.deck,
                    role: target.role,
                    representationId: representation.representationId,
                });
                setStatusMessage({ type: 'success', text: i18n.t('status.transcodeFallbackReady') });
            } catch (error) {
                if (generationRef.current !== generation) return;
                const code = (error as { code?: string }).code || 'TRANSCODE_FAILED';
                // A cancellation is this hook's own doing, not a verdict on the source.
                if (code !== 'CANCELLED') {
                    if (failedRepresentationsRef.current.size >= MAX_REMEMBERED_FAILURES) {
                        failedRepresentationsRef.current.clear();
                    }
                    failedRepresentationsRef.current.add(failureKey);
                }
                console.warn('[TranscodeFallback] recovery-failed', {
                    requestId,
                    deck: target.deck,
                    role: target.role,
                    code,
                });
                setStatusMessage({ type: 'error', text: i18n.t('status.transcodeFallbackFailed') });
                if (target.role === 'warm') clearFailedWarmSource(element, failedSource);
                else skipAfterPlaybackFailure();
            } finally {
                if (requestId && activeRequestsRef.current.get(bindingKey) === requestId) {
                    activeRequestsRef.current.delete(bindingKey);
                }
            }
        })();
        return true;
    }, [
        abortTransition,
        clearFailedWarmSource,
        currentTime,
        enabled,
        getRecoveryTarget,
        handleTailEnded,
        localSongs,
        pendingResumeTimeRef,
        replaceRecoverySource,
        shouldAutoPlayRef,
        skipAfterPlaybackFailure,
    ]);
}
