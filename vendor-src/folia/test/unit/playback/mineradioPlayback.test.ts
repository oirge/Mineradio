// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostState, HostTrack } from '@/mineradio/client';
import { applyHostAudio, hostLyricsToFolia, useMineradioPlaybackBridge } from '@/mineradio/playback';
import { playHostTrack } from '@/mineradio/playbackCommands';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useAudioSettingsStore } from '@/stores/useAudioSettingsStore';
import { audioBands, currentTime, lyricCurrentTime } from '@/stores/motionSignals';
import { PlayerState } from '@/types';
import { buildPlayerViewFlags } from '@/components/app/presentation/buildPlayerViewFlags';

// test/unit/playback/mineradioPlayback.test.ts
const host = vi.hoisted(() => ({
    request: vi.fn(),
    listeners: new Map<string, Set<(data: any) => void>>(),
}));
vi.mock('@/mineradio/client', () => ({
    isMineradioEmbedded: () => true,
    requestHost: host.request,
    subscribeHost: (name: string, listener: (data: any) => void) => {
        const listeners = host.listeners.get(name) ?? new Set();
        listeners.add(listener);
        host.listeners.set(name, listeners);
        return () => listeners.delete(listener);
    },
}));
vi.mock('@/mineradio/library', () => ({
    hostTrackToLocalSong: (track: HostTrack) => ({
        id: track.id, fileName: `${track.id}.mp3`, filePath: `C:/Music/${track.id}.mp3`,
        title: track.title, titleOrigin: 'import', duration: track.duration * 1000,
        importedMetadata: { title: track.title, artistNames: [track.artist], albumName: track.album },
    }),
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const track: HostTrack = { id: 'host-a', title: 'Track A', artist: 'Artist', album: 'Album', duration: 120, cover: '', liked: false, filePath: 'C:/Music/a.mp3', format: 'mp3' };
const initialState = (): HostState => ({
    currentTrack: track, currentIndex: 0, position: 10, duration: 120, playing: false,
    volume: 0.4, muted: false, playMode: 'loop', queueRevision: 1, libraryRevision: 1, lyricsRevision: 1, interface: 'folia',
});
let root: Root | null;
let now = 0;
let frames: Map<number, FrameRequestCallback>;
let serial = 0;

function emit(name: string, value: unknown) { host.listeners.get(name)?.forEach(listener => listener(value)); }
async function mountBridge() {
    function Probe() { useMineradioPlaybackBridge(); return null; }
    root = createRoot(document.createElement('div'));
    await act(async () => { root!.render(React.createElement(Probe)); });
}
function advanceFrame(milliseconds: number) {
    now += milliseconds;
    const pending = [...frames.values()];
    frames.clear();
    act(() => { pending.forEach(callback => callback(now)); });
}

beforeEach(() => {
    host.request.mockReset();
    host.listeners.clear();
    frames = new Map();
    now = 0;
    serial = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++serial, callback); return serial; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => { frames.delete(id); });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    usePlaybackStore.setState({ currentSong: null, audioSrc: null, lyrics: null, duration: 0, playerState: PlayerState.IDLE, playQueue: [], currentLineIndex: -1, lyricTimelineOffsetMs: 0 });
    host.request.mockImplementation(async (method: string) => {
        if (method === 'getQueue') return { items: [track], total: 1, offset: 0, limit: 1000, revision: 1 };
        if (method === 'getLyrics') return { trackId: track.id, lines: [{ time: 0, endTime: 30, text: 'First line', words: [] }] };
        return initialState();
    });
});
afterEach(() => {
    act(() => root?.unmount());
    root = null;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe('Mineradio playback projection', () => {
    it('hydrates track, queue, lyrics, transport and volume without an audio source or outbound queue echo', async () => {
        await mountBridge();
        const state = usePlaybackStore.getState();
        expect(state.currentSong?.sourceRef).toEqual({ kind: 'local', mediaId: track.id });
        expect(state.audioSrc).toBeNull();
        expect(state.playQueue).toHaveLength(1);
        expect(state.lyrics?.lines[0].fullText).toBe('First line');
        expect(state.duration).toBe(120);
        expect(state.playerState).toBe(PlayerState.PAUSED);
        expect(currentTime.get()).toBe(10);
        expect(useAudioSettingsStore.getState().volume).toBe(0.4);
        expect(host.request.mock.calls.some(([method]) => method === 'setQueue')).toBe(false);
        expect(frames.size).toBe(0);
    });

    it('interpolates motion signals, reanchors seek/pause, and suspends its RAF when hidden', async () => {
        await mountBridge();
        const storeUpdates = vi.fn();
        const unsubscribe = usePlaybackStore.subscribe(storeUpdates);
        act(() => emit('state', { ...initialState(), playing: true }));
        storeUpdates.mockClear();
        advanceFrame(100);
        expect(currentTime.get()).toBeCloseTo(10.1);
        expect(lyricCurrentTime.get()).toBeCloseTo(10.1);
        expect(storeUpdates).not.toHaveBeenCalled();
        advanceFrame(2000);
        expect(currentTime.get()).toBeCloseTo(10.5);
        act(() => emit('state', { ...initialState(), position: 20, playing: true, playbackRate: 2 }));
        advanceFrame(100);
        expect(currentTime.get()).toBeCloseTo(20.2);
        act(() => emit('state', { ...initialState(), position: 50, playing: false }));
        expect(currentTime.get()).toBe(50);
        expect(frames.size).toBe(0);
        act(() => emit('state', { ...initialState(), playing: true }));
        expect(frames.size).toBe(1);
        act(() => emit('visibility', { active: false }));
        expect(frames.size).toBe(0);
        unsubscribe();
    });

    it('does not overwrite the current lyrics with a late event from another track', async () => {
        await mountBridge();
        act(() => emit('lyrics', { trackId: 'old-track', lines: [{ time: 0, text: 'Wrong song' }] }));
        expect(usePlaybackStore.getState().lyrics?.lines[0].fullText).toBe('First line');
        act(() => emit('lyrics', { trackId: track.id, lines: [{ time: 2, endTime: 20, text: 'Right song', translation: '译文', words: [{ time: 2, duration: 0.5, text: 'Right' }] }] }));
        expect(usePlaybackStore.getState().lyrics?.lines[0].words[0]).toEqual({ startTime: 2, endTime: 2.5, text: 'Right' });
    });

    it('ignores an older queue response after a newer host queue revision arrives', async () => {
        let resolveOldQueue!: (value: unknown) => void;
        let queueCalls = 0;
        host.request.mockImplementation(async (method: string) => {
            if (method === 'getQueue') {
                queueCalls++;
                if (queueCalls === 1) return new Promise(resolve => { resolveOldQueue = resolve; });
                return { items: [{ ...track, id: 'new-queue-track' }], total: 1, offset: 0, limit: 1000, revision: 2 };
            }
            if (method === 'getLyrics') return { trackId: track.id, lines: [] };
            return initialState();
        });
        await mountBridge();
        await act(async () => { emit('queueChanged', { revision: 2 }); });
        await act(async () => { resolveOldQueue({ items: [track], total: 1, offset: 0, limit: 1000, revision: 1 }); });
        expect(usePlaybackStore.getState().playQueue.map(song => song.sourceRef?.mediaId)).toEqual(['new-queue-track']);
    });

    it('does not let a stale lyric event cancel the current track lyric request', async () => {
        let resolveLyrics!: (value: unknown) => void;
        host.request.mockImplementation(async (method: string) => {
            if (method === 'getLyrics') return new Promise(resolve => { resolveLyrics = resolve; });
            if (method === 'getQueue') return { items: [track], total: 1, offset: 0, limit: 1000, revision: 1 };
            return initialState();
        });
        await mountBridge();
        act(() => emit('lyrics', { trackId: 'old-track', lines: [{ time: 0, text: 'Wrong song' }] }));
        await act(async () => { resolveLyrics({ trackId: track.id, lines: [{ time: 0, text: 'Current lyric' }] }); });
        expect(usePlaybackStore.getState().lyrics?.lines[0].fullText).toBe('Current lyric');
    });

    it('sends edits to the host and waits for authoritative state', async () => {
        await mountBridge();
        host.request.mockClear();
        usePlaybackStore.getState().setPlayQueue([]);
        useAudioSettingsStore.getState().handleSetVolume(0.7);
        await act(async () => {});
        expect(host.request).toHaveBeenCalledWith('setQueue', { trackIds: [] });
        expect(host.request).toHaveBeenCalledWith('setVolume', { volume: 0.7 });
        expect(usePlaybackStore.getState().playQueue).toHaveLength(1);
    });
});

describe('Mineradio playback conversions and commands', () => {
    it('selects the requested id after the host keeps an audible track ahead of the new collection', async () => {
        await playHostTrack('host-b', ['host-b', 'host-c']);
        expect(host.request.mock.calls.map(([method, params]) => [method, params])).toEqual([
            ['setQueue', { trackIds: ['host-b', 'host-c'] }], ['play', { id: 'host-b' }],
        ]);
    });

    it('drops an obsolete selection while a later queue edit is pending', async () => {
        let resolveFirst!: (value: HostState) => void;
        host.request.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
        const first = playHostTrack('host-b', ['host-b']);
        const second = playHostTrack('host-c', ['host-c']);
        resolveFirst(initialState());
        await Promise.all([first, second]);
        expect(host.request).not.toHaveBeenCalledWith('play', { id: 'host-b' });
        expect(host.request).toHaveBeenCalledWith('play', { id: 'host-c' });
    });

    it('supports line-only lyrics and actual FFT sample rates without NaN', () => {
        const result = hostLyricsToFolia({ trackId: 'a', lines: [{ time: 1, text: 'One' }, { time: 5, text: 'Two' }] }, 10);
        expect(result?.lines[0].endTime).toBe(5);
        expect(result?.lines[1].words).toEqual([{ text: 'Two', startTime: 5, endTime: 10 }]);
        expect(result?.isWordByWord).toBe(false);
        applyHostAudio({ frequency: Array(1024).fill(255), timeDomain: [], sampleRate: 48000, fftSize: 2048 });
        expect(audioBands.bass.get()).toBe(255);
        expect(audioBands.treble.get()).toBe(255);
        applyHostAudio({ frequency: [], timeDomain: [], sampleRate: 0, fftSize: 0 });
        expect(audioBands.vocal.get()).toBe(0);
    });

    it('enables player controls for a host track without manufacturing an audio URL', () => {
        const flags = buildPlayerViewFlags({ currentView: 'player', disableHomeDynamicBackground: false, hidePlayerProgressBar: false, hidePlayerTranslationSubtitle: false, hidePlayerRightPanelButton: false, isNowPlayingControlDisabled: false, activePlaybackContext: 'main', stageActiveEntryKind: null, audioSrc: null, duration: 120, hasHostPlayback: true });
        expect(flags.canToggleCurrentPlayback).toBe(true);
    });
});
