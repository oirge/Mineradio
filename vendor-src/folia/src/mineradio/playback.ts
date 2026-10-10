import { useEffect } from 'react';
import { PlayerState, type LyricData, type UnifiedSong } from '../types';
import { buildUnifiedLocalSong } from '../services/playbackAdapters';
import { usePlaybackStore } from '../stores/usePlaybackStore';
import { useAudioSettingsStore } from '../stores/useAudioSettingsStore';
import { useLyricSettingsStore } from '../stores/useLyricSettingsStore';
import { audioBands, audioPower, currentTime, lyricCurrentTime } from '../stores/motionSignals';
import { findLatestActiveLineIndex } from '../utils/appPlaybackHelpers';
import { isMineradioEmbedded, requestHost, subscribeHost, type HostAudio, type HostLyrics, type HostPage, type HostState, type HostTrack } from './client';
import { hostTrackToLocalSong } from './library';
import { hostSongId, reportHostPlaybackError, subscribeCommandState } from './playbackCommands';

// src/mineradio/playback.ts
// Project host snapshots onto the complete Folia UI without creating an audio graph.
export function hostTrackToSong(track: HostTrack): UnifiedSong {
    return buildUnifiedLocalSong({ localSong: hostTrackToLocalSong(track), matchedSong: null, coverUrl: track.cover || null, preferOnlineMetadata: false });
}

/** Preserve real word timing; line-only lyrics stay a single timed display unit. */
export function hostLyricsToFolia(value: HostLyrics, duration: number): LyricData | null {
    if (!value.lines.length) return null;
    return {
        isWordByWord: value.lines.some(line => Boolean(line.words?.length)),
        lines: value.lines.map((line, index) => {
            const startTime = Math.max(0, line.time);
            const endTime = Math.max(startTime, line.endTime ?? value.lines[index + 1]?.time ?? duration ?? startTime);
            return {
                id: `${value.trackId}:${index}`,
                startTime,
                endTime,
                fullText: line.text,
                translation: line.translation,
                words: line.words?.length
                    ? line.words.map(word => ({ text: word.text, startTime: word.time, endTime: word.time + Math.max(0, word.duration) }))
                    : [{ text: line.text, startTime, endTime }],
            };
        }),
    };
}

/** Same response curve as Folia's analyser, using the host's actual FFT bin width. */
export function applyHostAudio(frame: HostAudio): void {
    // postMessage already gives the iframe an owned typed-array clone. Copying it
    // again at 30 FPS only adds GC pressure to the visualizer hot path.
    const data: Uint8Array<ArrayBuffer> = frame.frequency instanceof Uint8Array
        ? (frame.frequency as Uint8Array<ArrayBuffer>)
        : Uint8Array.from(frame.frequency);
    const binHz = frame.sampleRate / frame.fftSize;
    const energy = (min: number, max: number) => {
        if (!data.length || !Number.isFinite(binHz) || binHz <= 0) return 0;
        const start = Math.min(data.length - 1, Math.max(0, Math.floor(min / binHz)));
        const end = Math.min(data.length - 1, Math.max(start, Math.floor(max / binHz)));
        let sum = 0;
        for (let index = start; index <= end; index++) sum += data[index];
        return sum / (end - start + 1);
    };
    const process = (value: number, boost: number) => Math.pow(value / 255, boost) * 255;
    const bass = energy(20, 150);
    const lowMid = energy(150, 400);
    audioBands.spectrum.set(data);
    audioPower.set(process((bass + lowMid) / 2, 3));
    audioBands.bass.set(process(bass, 1.8));
    audioBands.lowMid.set(process(lowMid, 2));
    audioBands.mid.set(process(energy(400, 1200), 2));
    audioBands.vocal.set(process(energy(1000, 3500), 1.5));
    audioBands.treble.set(process(energy(3500, 12000), 2));
}

function syncHostClock(position: number): void {
    const store = usePlaybackStore.getState();
    const offset = store.lyricTimelineOffsetMs + useLyricSettingsStore.getState().globalLyricTimelineOffsetMs;
    currentTime.set(position);
    const lyricTime = position - offset / 1000;
    lyricCurrentTime.set(lyricTime);
    const index = store.lyrics ? findLatestActiveLineIndex(store.lyrics.lines, lyricTime) : -1;
    if (index !== store.currentLineIndex) usePlaybackStore.setState({ currentLineIndex: index });
}

export function useMineradioPlaybackBridge(): void {
    useEffect(() => {
        if (!isMineradioEmbedded()) return;
        let disposed = false;
        let trackSignature = '';
        let queueRevision: string | number | undefined;
        let lyricsRevision: string | number | undefined;
        let queueRequest = 0;
        let lyricsRequest = 0;
        let active = true;
        let latestState: HostState | null = null;
        let anchoredAt = 0;
        let animationFrame: number | null = null;

        const stopClock = () => {
            if (animationFrame !== null) cancelAnimationFrame(animationFrame);
            animationFrame = null;
        };
        // Host snapshots remain authoritative; interpolation only fills the 200ms delivery gap.
        // MotionValues carry continuous time and the store only changes when the lyric line does.
        const tickClock = () => {
            animationFrame = null;
            if (disposed || !active || document.hidden || !latestState?.playing) return;
            const rate = (latestState as HostState & { playbackRate?: number }).playbackRate ?? 1;
            const elapsed = Math.min(0.5, Math.max(0, (performance.now() - anchoredAt) / 1000));
            const position = latestState.position + elapsed * rate;
            syncHostClock(latestState.duration > 0 ? Math.min(position, latestState.duration) : position);
            animationFrame = requestAnimationFrame(tickClock);
        };
        const refreshClock = () => {
            if (!active || document.hidden || !latestState?.playing) { stopClock(); return; }
            if (animationFrame === null) animationFrame = requestAnimationFrame(tickClock);
        };

        const applyLyrics = (value: HostLyrics) => {
            if (disposed || value.trackId !== hostSongId(usePlaybackStore.getState().currentSong)) return;
            usePlaybackStore.setState({ lyrics: hostLyricsToFolia(value, usePlaybackStore.getState().duration), activeLocalLyricsSource: null });
            syncHostClock(currentTime.get());
        };

        const refreshLyrics = async () => {
            const ticket = ++lyricsRequest;
            try {
                const result = await requestHost<HostLyrics>('getLyrics');
                if (!disposed && ticket === lyricsRequest) applyLyrics(result);
            } catch (error) { if (!disposed) reportHostPlaybackError(error); }
        };

        const refreshQueue = async () => {
            const ticket = ++queueRequest;
            const songs: UnifiedSong[] = [];
            let revision: string | number | undefined;
            try {
                for (let offset = 0; ;) {
                    const page = await requestHost<HostPage<HostTrack> & { revision: string | number }>('getQueue', { offset, limit: 1000 });
                    if (disposed || ticket !== queueRequest) return;
                    if (revision !== undefined && revision !== page.revision) { void refreshQueue(); return; }
                    revision = page.revision;
                    songs.push(...page.items.map(hostTrackToSong));
                    offset += page.items.length;
                    if (offset >= page.total) break;
                    if (!page.items.length) throw new Error('Mineradio 队列分页未完成');
                }
                // Direct hydration bypasses the outbound setPlayQueue command setter.
                usePlaybackStore.setState({ playQueue: songs });
            } catch (error) { if (!disposed) reportHostPlaybackError(error); }
        };

        const applyState = (state: HostState) => {
            if (disposed) return;
            latestState = state;
            anchoredAt = performance.now();
            active = state.interface === 'folia';
            const store = usePlaybackStore.getState();
            const signature = JSON.stringify(state.currentTrack);
            const changedId = (state.currentTrack?.id ?? null) !== hostSongId(store.currentSong);
            const changedSong = signature !== trackSignature || changedId;
            const playerState = state.currentTrack ? (state.playing ? PlayerState.PLAYING : PlayerState.PAUSED) : PlayerState.IDLE;
            const update: Partial<typeof store> = {};
            if (changedSong) {
                trackSignature = signature;
                update.currentSong = state.currentTrack ? hostTrackToSong(state.currentTrack) : null;
                update.cachedCoverUrl = state.currentTrack?.cover || null;
            }
            if (changedId) { update.lyrics = null; update.currentLineIndex = -1; }
            if (store.duration !== state.duration) update.duration = state.duration;
            if (store.playerState !== playerState) update.playerState = playerState;
            if (store.audioSrc !== null) update.audioSrc = null;
            if (store.transitionDisplay !== null) update.transitionDisplay = null;
            if (store.activePlaybackContext !== 'main') update.activePlaybackContext = 'main';
            if (store.isFmMode) update.isFmMode = false;
            if (Object.keys(update).length) usePlaybackStore.setState(update);
            const audio = useAudioSettingsStore.getState();
            const loopMode = state.playMode === 'single' ? 'one' : 'all';
            if (audio.volume !== state.volume || audio.isMuted !== state.muted || audio.loopMode !== loopMode) {
                useAudioSettingsStore.setState({ volume: state.volume, isMuted: state.muted, loopMode });
            }
            syncHostClock(Math.max(0, state.position));
            refreshClock();
            if (queueRevision !== state.queueRevision) { queueRevision = state.queueRevision; void refreshQueue(); }
            if (changedId || lyricsRevision !== state.lyricsRevision) { lyricsRevision = state.lyricsRevision; void refreshLyrics(); }
        };

        const unsubscribe = [
            subscribeHost('state', applyState),
            subscribeCommandState(applyState),
            subscribeHost('lyrics', (value: HostLyrics) => {
                if (value.trackId !== hostSongId(usePlaybackStore.getState().currentSong)) return;
                lyricsRequest++;
                applyLyrics(value);
            }),
            subscribeHost('queueChanged', ({ revision }: { revision: string | number }) => {
                if (revision !== queueRevision) { queueRevision = revision; void refreshQueue(); }
            }),
            subscribeHost('audio', (frame: HostAudio) => { if (active && !disposed) applyHostAudio(frame); }),
            subscribeHost('visibility', ({ active: visible }: { active: boolean }) => {
                active = visible;
                refreshClock();
                if (visible) void requestHost<HostState>('getState').then(applyState).catch(reportHostPlaybackError);
            }),
        ];
        const handleVisibility = () => {
            refreshClock();
            if (!document.hidden && active) void requestHost<HostState>('getState').then(applyState).catch(reportHostPlaybackError);
        };
        document.addEventListener('visibilitychange', handleVisibility);
        void requestHost<HostState>('getState').then(applyState).catch(reportHostPlaybackError);
        return () => {
            disposed = true;
            stopClock();
            document.removeEventListener('visibilitychange', handleVisibility);
            unsubscribe.forEach(stop => stop());
        };
    }, []);
}
