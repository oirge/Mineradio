// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { HostAnalysis, HostState } from '../../../src/mineradio/client';
import { useLocalPlayer } from '../../../src/mineradio/local/useLocalPlayer';
import { getVocalEnvelope, getBeatFxHeard, getBeatEffectStrength } from '../../../src/mineradio/local/localAnalysisBoundary';

// test/unit/mineradio/localPlayerAnalysis.test.ts
const bridge = vi.hoisted(() => ({ listeners: new Map<string, (value: any) => void>(), request: vi.fn() }));
vi.mock('../../../src/mineradio/client', () => ({ requestHost: bridge.request,
    subscribeHost: (name: string, callback: (value: any) => void) => {
        bridge.listeners.set(name, callback); return () => bridge.listeners.delete(name);
    },
}));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const state = (id = 'A'): HostState => ({
    currentTrack: { id, title: id, artist: '', album: '', duration: 30, cover: '', liked: false, filePath: '', format: 'wav' },
    currentIndex: 0, position: 1, duration: 30, playing: true, playbackRate: 1, volume: 1, muted: false,
    playMode: 'loop', queueRevision: 1, libraryRevision: 1, lyricsRevision: 1, interface: 'folia',
});
const analysis = (id: string): HostAnalysis => ({ trackId: id, revision: 2, source: 'cache', beats: [], drums: null,
    vocal: { fps: 50, db: new Float32Array([-20]), top: -20, onsets: new Uint32Array() },
});
let root: Root, host: HTMLDivElement;
let frames: Map<number, FrameRequestCallback>, serial: number;
let replies: Array<(value: HostAnalysis) => void>;
beforeEach(() => {
    bridge.listeners.clear(); bridge.request.mockReset(); frames = new Map(); serial = 0; replies = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++serial, callback); return serial; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    bridge.request.mockImplementation((method: string) => method === 'getState' ? Promise.resolve(state())
        : method === 'getLyrics' ? Promise.resolve({ trackId: 'A', lines: [] })
        : new Promise(resolve => replies.push(resolve)));
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); vi.unstubAllGlobals(); });
function Probe() { useLocalPlayer(); return null; }
async function mount() { await act(async () => { root.render(React.createElement(Probe)); }); }

it('ignores late analysis promises/events after switching songs and after unmount', async () => {
    await mount(); expect(replies).toHaveLength(1);
    await act(async () => { bridge.listeners.get('state')!(state('B')); });
    expect(replies).toHaveLength(2);
    await act(async () => { replies[0](analysis('A')); bridge.listeners.get('analysis')!(analysis('A')); });
    expect(getBeatFxHeard().key).toBe('B'); expect(getVocalEnvelope('B')).toBeNull();
    await act(async () => replies[1](analysis('B')));
    expect(getVocalEnvelope('B')?.db[0]).toBe(-20);
    await act(async () => bridge.listeners.get('state')!(state('C')));
    await act(async () => root.unmount());
    await act(async () => replies[2](analysis('C')));
    expect(getBeatFxHeard().key).toBeNull(); expect(frames.size).toBe(0);
    root = createRoot(host);
});

it('keeps one clock RAF, fetches analysis only on track changes, and stops on pause/visibility', async () => {
    await mount(); expect(frames.size).toBe(1);
    for (let index = 0; index < 10; index++) await act(async () => bridge.listeners.get('state')!({ ...state(), position: 1 + index / 10 }));
    expect(bridge.request.mock.calls.filter(([method]) => method === 'getAnalysis')).toHaveLength(1);
    expect(frames.size).toBe(1);
    await act(async () => bridge.listeners.get('visibility')!({ active: false }));
    expect(frames.size).toBe(0); expect(getBeatEffectStrength('machi.neonPulse')).toBe(0);
    await act(async () => bridge.listeners.get('visibility')!({ active: true }));
    expect(frames.size).toBe(1);
    await act(async () => bridge.listeners.get('state')!({ ...state(), playing: false }));
    expect(frames.size).toBe(0); expect(getBeatEffectStrength('machi.neonPulse')).toBe(0);
});
