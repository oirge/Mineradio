import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMotionValue } from 'framer-motion';
import type { AudioBands, Line } from '../../types';
import { requestHost, subscribeHost, type HostAudio, type HostLyrics, type HostState } from '../client';
import { applyLocalAudio, clearLocalAudio, interpolatedLocalTime, localActiveLineIndex, localLyricLines, localStateSignature } from './localPlayerData';
import type { LocalPlayer } from './playerTypes';

// src/mineradio/local/useLocalPlayer.ts
// Mineradio owns transport, library, and audio. Folia only receives display data.
export function useLocalPlayer(): LocalPlayer {
    const [state, setState] = useState<HostState | null>(null);
    const [lines, setLines] = useState<Line[]>([]);
    const [currentLineIndex, setCurrentLineIndex] = useState(-1);
    const [active, setActive] = useState(false);
    const [error, setError] = useState('');
    const currentTime = useMotionValue(0), audioPower = useMotionValue(0);
    const bass = useMotionValue(0), lowMid = useMotionValue(0), mid = useMotionValue(0);
    const vocal = useMotionValue(0), treble = useMotionValue(0);
    const spectrum = useMotionValue<Uint8Array<ArrayBuffer>>(new Uint8Array(0));
    const audioBands = useMemo<AudioBands>(() => ({ bass, lowMid, mid, vocal, treble, spectrum }), [bass, lowMid, mid, vocal, treble, spectrum]);
    const commandResult = useRef<((value: unknown, method: string) => void) | null>(null);
    const mounted = useRef(false);
    const clearError = useCallback(() => setError(''), []);
    const command = useCallback(async <T = any,>(method: string, params: Record<string, unknown> = {}): Promise<T> => {
        try {
            const result = await requestHost<T>(method, params);
            if (mounted.current) commandResult.current?.(result, method);
            return result;
        } catch (failure) {
            if (mounted.current) setError(failure instanceof Error ? failure.message : String(failure));
            throw failure;
        }
    }, []);

    useEffect(() => {
        mounted.current = true;
        let disposed = false, hostActive = false, visible = false;
        let latest: HostState | null = null, stateSignature = '';
        let lyricLines: Line[] = [], lineIndex = -1;
        let lyricRequest = 0, snapshotRequest = 0, anchoredAt = 0;
        let animationFrame: number | null = null;
        const report = (failure: unknown) => {
            if (!disposed) setError(failure instanceof Error ? failure.message : String(failure));
        };
        const syncClock = (position: number) => {
            currentTime.set(position);
            const nextIndex = localActiveLineIndex(lyricLines, position);
            if (nextIndex !== lineIndex) { lineIndex = nextIndex; setCurrentLineIndex(nextIndex); }
        };
        const stopClock = () => {
            if (animationFrame !== null) cancelAnimationFrame(animationFrame);
            animationFrame = null;
        };
        const tickClock = () => {
            animationFrame = null;
            if (disposed || !visible || !latest?.playing) return;
            syncClock(interpolatedLocalTime(latest, (performance.now() - anchoredAt) / 1000));
            animationFrame = requestAnimationFrame(tickClock);
        };
        const refreshVisibility = () => {
            const nextVisible = hostActive && !document.hidden;
            if (visible !== nextVisible) { visible = nextVisible; setActive(visible); }
            if (!visible || !latest?.playing) { stopClock(); clearLocalAudio(audioBands, audioPower); }
            else if (animationFrame === null) animationFrame = requestAnimationFrame(tickClock);
        };
        const applyLyrics = (value: HostLyrics) => {
            if (disposed || value.trackId !== (latest?.currentTrack?.id ?? null)) return;
            lyricLines = localLyricLines(value, latest?.duration ?? 0);
            setLines(lyricLines);
            syncClock(currentTime.get());
        };
        // Both identity and revision must still match when an asynchronous lyric response arrives.
        const refreshLyrics = async () => {
            const ticket = ++lyricRequest;
            const trackId = latest?.currentTrack?.id ?? null, revision = latest?.lyricsRevision;
            if (!trackId) return;
            try {
                const result = await requestHost<HostLyrics>('getLyrics');
                if (!disposed && ticket === lyricRequest && trackId === latest?.currentTrack?.id && revision === latest?.lyricsRevision) applyLyrics(result);
            } catch (failure) { if (ticket === lyricRequest) report(failure); }
        };
        const applyState = (next: HostState) => {
            if (disposed) return;
            const changedTrack = (next.currentTrack?.id ?? null) !== (latest?.currentTrack?.id ?? null);
            const changedLyrics = changedTrack || next.lyricsRevision !== latest?.lyricsRevision;
            latest = next;
            anchoredAt = performance.now();
            hostActive = next.interface === 'folia';
            const signature = localStateSignature(next);
            if (signature !== stateSignature) { stateSignature = signature; setState(next); }
            if (changedTrack) { lyricRequest++; lyricLines = []; setLines(lyricLines); }
            syncClock(interpolatedLocalTime(next, 0));
            refreshVisibility();
            if (changedLyrics) void refreshLyrics();
        };
        const refreshState = async () => {
            const ticket = ++snapshotRequest;
            try {
                const result = await requestHost<HostState>('getState');
                if (!disposed && ticket === snapshotRequest) applyState(result);
            } catch (failure) { if (ticket === snapshotRequest) report(failure); }
        };
        commandResult.current = (value: unknown, method: string) => {
            if (value && typeof value === 'object' && 'currentTrack' in value && 'position' in value) {
                snapshotRequest++;
                applyState(value as HostState);
            } else if (!['listTracks', 'listPlaylists', 'getQueue', 'getLyrics'].includes(method)) {
                void refreshState();
            }
        };
        const unsubscribe = [
            subscribeHost('state', (next: HostState) => { snapshotRequest++; applyState(next); }),
            subscribeHost('lyrics', (value: HostLyrics) => {
                if (value.trackId !== (latest?.currentTrack?.id ?? null)) return;
                lyricRequest++;
                applyLyrics(value);
            }),
            subscribeHost('audio', (frame: HostAudio) => {
                if (!disposed && visible && latest?.playing) applyLocalAudio(frame, audioBands, audioPower);
            }),
            subscribeHost('visibility', ({ active: nextActive }: { active: boolean }) => {
                hostActive = nextActive;
                refreshVisibility();
                if (visible) void refreshState();
            }),
        ];
        const handleVisibility = () => {
            refreshVisibility();
            if (visible) void refreshState();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        // The first valid request completes folia-host.js's handshake; there is no "ready" method.
        void refreshState();
        return () => {
            disposed = true;
            mounted.current = false;
            commandResult.current = null;
            lyricRequest++; snapshotRequest++;
            stopClock();
            clearLocalAudio(audioBands, audioPower);
            document.removeEventListener('visibilitychange', handleVisibility);
            unsubscribe.forEach(stop => stop());
        };
    }, [audioBands, audioPower, currentTime]);

    return { state, lines, currentLineIndex, currentTime, audioPower, audioBands, active, error, command, clearError };
}
