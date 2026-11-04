// @vitest-environment jsdom
import React, { act } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountVideoExportSurface } from '../../../src/mineradio/local/LocalVideoExportSurface';
import { normalizeVisualPreferences } from '../../../src/mineradio/local/useVisualSettings';
import type { VideoExportFinalize, VideoExportInitial, VideoExportUpdate } from '../../../src/mineradio/local/videoExportBridge';
import type { HostState } from '../../../src/mineradio/client';

const runtime = vi.hoisted(() => ({ latest: null as any, clear: vi.fn(), audio: vi.fn(), release: vi.fn(), unsubscribe: vi.fn(),
    unsubscribeFinalize: vi.fn(), finalize: vi.fn(), unmount: vi.fn() }));
vi.mock('../../../src/components/visualizer/VisualizerRenderer', () => ({ default: (props: any) => {
    runtime.latest = props;
    React.useEffect(() => { props.onReady(); return runtime.unmount; }, [props.onReady]);
    return React.createElement('div', { 'data-effect': props.mode }, props.lines.map((line: any) => line.fullText).join('|'));
} }));
vi.mock('../../../src/mineradio/local/videoExportAssets', () => ({ loadVideoExportAssets: vi.fn(async () => ({ emoji: [], avatar: [], portrait: [], background: [], tempera: [], release: runtime.release })) }));
vi.mock('../../../src/mineradio/local/localAnalysisBoundary', () => ({
    applyLocalAnalysis: vi.fn(), applyLocalAnalysisAudio: runtime.audio, advanceLocalAnalysis: vi.fn(), clearLocalAnalysis: runtime.clear,
}));
vi.mock('../../../src/mineradio/local/videoExportCfr', () => ({ finalizeVideoFrameRate: runtime.finalize }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let mount: HTMLDivElement, listener: ((data: VideoExportUpdate) => void) | null;
let finalizeListener: ((data: VideoExportFinalize) => void) | null;
let ready: ReturnType<typeof vi.fn>, failed: ReturnType<typeof vi.fn>;
let initial: VideoExportInitial;
const frames = new Map<number, FrameRequestCallback>();
beforeEach(() => {
    runtime.latest = null; runtime.clear.mockClear(); runtime.audio.mockClear(); runtime.release.mockClear(); runtime.unsubscribe.mockClear();
    runtime.unsubscribeFinalize.mockClear(); runtime.unmount.mockClear(); runtime.finalize.mockReset(); runtime.finalize.mockResolvedValue(undefined);
    listener = null; finalizeListener = null; frames.clear(); let serial = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++serial, callback); return serial; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } });
    history.replaceState({}, '', '/vendor/folia/index.html?videoExport=job-a');
    initial = { id: 'job-a', width: 1280, height: 720, frameRate: 120, visuals: normalizeVisualPreferences({ mode: 'classic' }),
        state: { currentTrack: { id: 'song-a', title: 'First' }, position: 0, duration: 40, playing: false, playbackRate: 1 } as HostState,
        lyrics: { trackId: 'song-a', lines: [{ time: 0, text: 'First lyric' }, { time: 10, text: 'Later line' }] },
        analysis: { trackId: 'song-a', revision: 1, source: 'live', beats: [], drums: null, vocal: null } };
    ready = vi.fn(async () => {}); failed = vi.fn();
    Object.assign(window, { mineradioVideoExport: { getInitial: async () => initial, ready, failed,
        onFinalize: (callback: typeof finalizeListener) => { finalizeListener = callback; return runtime.unsubscribeFinalize; },
        onUpdate: (callback: typeof listener) => { listener = callback; return runtime.unsubscribe; } } });
    mount = document.createElement('div'); document.body.append(mount);
});
afterEach(async () => {
    await act(async () => window.dispatchEvent(new Event('pagehide')));
    mount.remove(); delete (window as any).mineradioVideoExport; vi.unstubAllGlobals(); frames.clear(); localStorage.clear();
});
async function nextFrame() {
    await act(async () => { const current = [...frames.values()]; frames.clear(); current.forEach(callback => callback(performance.now())); });
}
it('prepares a paused hidden surface, follows changed song/lyrics, and releases subscriptions without issuing playback commands', async () => {
    await act(async () => mountVideoExportSurface(mount));
    for (let count = 0; count < 5; count++) await nextFrame();
    expect(ready).toHaveBeenCalledOnce(); expect(failed).not.toHaveBeenCalled();
    expect(runtime.latest.paused).toBe(true); expect(runtime.latest.currentTime.get()).toBe(0);
    expect(mount.querySelector('.local-video-export-surface')?.getAttribute('data-video-export-track')).toBe('song-a');
    expect(mount.querySelector('.local-video-export-surface')?.getAttribute('data-video-export-frame-rate')).toBe('120');
    expect(mount.querySelector('button,nav,audio')).toBeNull();
    const changed: HostState = { ...initial.state, currentTrack: { ...initial.state.currentTrack!, id: 'song-b', title: 'Second' }, playing: true, position: 22 };
    await act(async () => listener?.({ id: initial.id, state: changed, lyrics: { trackId: 'song-b', lines: [{ time: 0, text: 'New opening' }, { time: 20, text: 'New verse' }] } }));
    expect(mount.textContent).toContain('New verse'); expect(mount.textContent).not.toContain('First lyric');
    expect(runtime.latest.songTitle).toBe('Second'); expect(runtime.latest.currentLineIndex).toBe(1); expect(runtime.latest.mode).toBe('classic');
    await act(async () => listener?.({ id: initial.id, state: { ...changed, position: 1 }, lyrics: initial.lyrics }));
    expect(runtime.latest.currentLineIndex).toBe(0); expect(mount.textContent).toContain('New opening');
    await act(async () => listener?.({ id: 'old-job', state: initial.state }));
    expect(runtime.latest.songTitle).toBe('Second');
    await act(async () => window.dispatchEvent(new Event('pagehide')));
    expect(runtime.unsubscribe).toHaveBeenCalledOnce(); expect(runtime.release).toHaveBeenCalledOnce();
    expect(frames.size).toBe(0);
});
it('renders pure visualization for tracks with no lyrics and does not change saved visual preferences', async () => {
    initial.lyrics = { trackId: 'song-a', lines: [] };
    initial.visuals.view = 'posters';
    const before = localStorage.getItem('mineradio-folia-local-visuals-v1');
    await act(async () => mountVideoExportSurface(mount));
    expect(runtime.latest.showText).toBe(false); expect(runtime.latest.lines).toEqual([]);
    expect(runtime.latest.mode).toBe('classic'); expect(mount.querySelector('.local-video-export-surface')).not.toBeNull();
    expect(localStorage.getItem('mineradio-folia-local-visuals-v1')).toBe(before);
});

it('finalizes the current recording only after unmounting the visualization, releasing assets and stopping animation', async () => {
    await act(async () => mountVideoExportSurface(mount));
    for (let count = 0; count < 5; count++) await nextFrame();
    expect(ready).toHaveBeenCalledOnce(); expect(frames.size).toBeGreaterThan(0);
    const job: VideoExportFinalize = { id: initial.id, size: 4096, width: initial.width, height: initial.height, frameRate: 60 };
    const bridge = (window as any).mineradioVideoExport;
    runtime.finalize.mockImplementation(async () => {
        expect(mount.querySelector('.local-video-export-surface')).toBeNull();
        expect(runtime.unmount).toHaveBeenCalledOnce();
        expect(runtime.unsubscribe).toHaveBeenCalledOnce();
        expect(runtime.release).toHaveBeenCalledOnce();
        expect(frames.size).toBe(0);
    });
    await act(async () => {
        finalizeListener?.(job);
        await vi.waitFor(() => expect(runtime.finalize).toHaveBeenCalledWith(job, bridge));
    });
    await act(async () => finalizeListener?.(job));
    expect(runtime.finalize).toHaveBeenCalledOnce(); expect(failed).not.toHaveBeenCalled();
    await act(async () => window.dispatchEvent(new Event('pagehide')));
    expect(runtime.unsubscribeFinalize).toHaveBeenCalledOnce();
    expect(runtime.release).toHaveBeenCalledOnce(); expect(runtime.unmount).toHaveBeenCalledOnce();
});

it('ignores an old finalization job without disposing or preventing the current job from encoding', async () => {
    await act(async () => mountVideoExportSurface(mount));
    for (let count = 0; count < 5; count++) await nextFrame();
    const job: VideoExportFinalize = { id: 'old-job', size: 4096, width: initial.width, height: initial.height, frameRate: 30 };
    await act(async () => finalizeListener?.(job));
    expect(runtime.finalize).not.toHaveBeenCalled(); expect(runtime.release).not.toHaveBeenCalled();
    expect(runtime.unsubscribe).not.toHaveBeenCalled(); expect(runtime.unmount).not.toHaveBeenCalled();
    expect(mount.querySelector('.local-video-export-surface')).not.toBeNull(); expect(frames.size).toBeGreaterThan(0);
    await act(async () => {
        finalizeListener?.({ ...job, id: initial.id });
        await vi.waitFor(() => expect(runtime.finalize).toHaveBeenCalledOnce());
    });
    expect(runtime.finalize.mock.calls[0][0].id).toBe(initial.id); expect(failed).not.toHaveBeenCalled();
});

it('reports a dynamically loaded finalizer failure after releasing the live surface', async () => {
    runtime.finalize.mockRejectedValue(new Error('CFR encoder unavailable'));
    await act(async () => mountVideoExportSurface(mount));
    for (let count = 0; count < 5; count++) await nextFrame();
    await act(async () => {
        finalizeListener?.({ id: initial.id, size: 4096, width: initial.width, height: initial.height, frameRate: 120 });
        await vi.waitFor(() => expect(failed).toHaveBeenCalledWith('CFR encoder unavailable'));
    });
    expect(failed).toHaveBeenCalledOnce(); expect(runtime.finalize).toHaveBeenCalledOnce();
    expect(runtime.release).toHaveBeenCalledOnce(); expect(runtime.unsubscribe).toHaveBeenCalledOnce();
    expect(runtime.unmount).toHaveBeenCalledOnce(); expect(frames.size).toBe(0); expect(mount.textContent).toBe('');
});
