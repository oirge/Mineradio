import React, { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { useMotionValue } from 'framer-motion';
import type { AudioBands } from '../../types';
import VisualizerRenderer from '../../components/visualizer/VisualizerRenderer';
import { LyricRenderQualityPinContext } from '../../components/visualizer/renderQuality/lyricRenderQualityPin';
import { resolveLyricRenderQuality } from '../../utils/lyricRenderQuality';
import { DEFAULT_THEME, DAYLIGHT_THEME } from '../../services/baseThemes';
import { applyLocalAnalysis, applyLocalAnalysisAudio, advanceLocalAnalysis, clearLocalAnalysis } from './localAnalysisBoundary';
import { applyLocalAudio, clearLocalAudio, interpolatedLocalTime, localLyricLines, localStateSignature } from './localPlayerData';
import { normalizeVisualPreferences } from './useVisualSettings';
import { loadVideoExportAssets, type ExportAssets } from './videoExportAssets';
import { videoExportBridge, type VideoExportInitial, type VideoExportUpdate } from './videoExportBridge';
import { createVideoExportTimeline } from './videoExportTimeline';
import './videoExportSurface.css';

// src/mineradio/local/LocalVideoExportSurface.tsx
// A hidden, display-only document. Mineradio remains the sole audio and transport owner.
function failureMessage(error: unknown) { return error instanceof Error ? error.message : String(error); }
class ExportBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() { return { failed: true }; }
    componentDidCatch(error: Error) { videoExportBridge()?.failed(failureMessage(error)); }
    render() { return this.state.failed ? null : this.props.children; }
}
function Surface({ initial, assets, signal }: { initial: VideoExportInitial; assets: ExportAssets; signal: AbortSignal }) {
    const bridge = videoExportBridge()!;
    const visuals = useMemo(() => normalizeVisualPreferences(initial.visuals), [initial]);
    const [state, setState] = useState(initial.state);
    const [lineIndex, setLineIndex] = useState(-1);
    const currentTime = useMotionValue(initial.state.position), power = useMotionValue(0);
    const bass = useMotionValue(0), lowMid = useMotionValue(0), mid = useMotionValue(0), vocal = useMotionValue(0), treble = useMotionValue(0);
    const spectrum = useMotionValue<Uint8Array<ArrayBuffer>>(new Uint8Array(0));
    const bands = useMemo<AudioBands>(() => ({ bass, lowMid, mid, vocal, treble, spectrum }), [bass, lowMid, mid, vocal, treble, spectrum]);
    const [lines, setLines] = useState(() => localLyricLines(initial.lyrics, initial.state.duration));
    const latest = useRef(initial.state), anchor = useRef(performance.now());
    const readyStarted = useRef(false), stage = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let frame = 0, index = -1, signature = localStateSignature(initial.state);
        const timeline = createVideoExportTimeline(initial);
        setLines(timeline.lines);
        clearLocalAnalysis(initial.state.currentTrack?.id ?? null);
        applyLocalAnalysis(initial.analysis);
        const sync = () => {
            const next = latest.current;
            const time = interpolatedLocalTime(next, (performance.now() - anchor.current) / 1000);
            currentTime.set(time);
            advanceLocalAnalysis(next.currentTrack?.id ?? null, time, next.playing && visuals.rhythm, 0, next.playbackRate);
            const activeLine = timeline.at(time);
            if (activeLine !== index) { index = activeLine; setLineIndex(index); }
        };
        const tick = () => { sync(); frame = requestAnimationFrame(tick); };
        const update = (value: VideoExportUpdate) => {
            if (signal.aborted) return;
            const result = timeline.apply(value);
            if (!result.accepted) return;
            if (result.trackChanged) { clearLocalAnalysis(value.state.currentTrack?.id ?? null); clearLocalAudio(bands, power); }
            if (result.lyricsChanged) setLines(timeline.lines);
            latest.current = value.state; anchor.current = performance.now();
            const nextSignature = localStateSignature(value.state);
            if (signature !== nextSignature) { signature = nextSignature; setState(value.state); }
            if (value.analysis) applyLocalAnalysis(value.analysis);
            sync();
            if (value.audio && value.state.playing && (value.audio.trackId === undefined || value.audio.trackId === value.state.currentTrack?.id)) { applyLocalAnalysisAudio(value.audio); applyLocalAudio(value.audio, bands, power); }
            if (!value.state.playing) clearLocalAudio(bands, power);
        };
        const stop = bridge.onUpdate(update);
        sync(); frame = requestAnimationFrame(tick);
        return () => { stop(); cancelAnimationFrame(frame); clearLocalAudio(bands, power); clearLocalAnalysis(); };
    }, [initial, bands, power, currentTime, bridge, signal, visuals.rhythm]);
    const ready = useCallback(() => {
        if (readyStarted.current) return;
        readyStarted.current = true;
        void (async () => {
            await document.fonts.ready;
            // Imperative GPU runtimes finish after their React component commits. Machi keeps
            // its canvas hidden until shaders and its first frame are ready; Pixi attaches last.
            const canvasMode = ['machi', 'tempera', 'sonnet', 'diorama', 'lumiere'].includes(visuals.mode);
            const deadline = performance.now() + 45_000;
            let stable = 0;
            while (!signal.aborted) {
                const canvases = Array.from(stage.current?.querySelectorAll('canvas') ?? []);
                const painted = (!canvasMode || canvases.length > 0) && canvases.every(canvas => canvas.width > 0 && canvas.height > 0 && getComputedStyle(canvas).visibility !== 'hidden');
                stable = painted ? stable + 1 : 0;
                if (stable >= 4) { await bridge.ready(); return; }
                if (performance.now() >= deadline) throw new Error('The visualization did not finish preparing / 可视化准备超时');
                await new Promise(resolve => requestAnimationFrame(resolve));
            }
        })().catch(error => { if (!signal.aborted) bridge.failed(failureMessage(error)); });
    }, [bridge, signal, visuals.mode]);
    const theme = visuals.daylight ? DAYLIGHT_THEME : DEFAULT_THEME;
    const track = state.currentTrack;
    const tuning = visuals.tunings[visuals.mode as keyof typeof visuals.tunings] as { render?: Parameters<typeof resolveLyricRenderQuality>[1] } | undefined;
    const quality = resolveLyricRenderQuality(visuals.lyricRenderQuality, tuning?.render);
    return <div ref={stage} className="local-video-export-surface" data-video-export-mode={visuals.mode} data-video-export-track={track?.id ?? ''} style={{ color: theme.primaryColor, background: theme.backgroundColor }}>
        <LyricRenderQualityPinContext.Provider value={quality}>
            <VisualizerRenderer mode={visuals.mode} theme={theme} isDaylight={visuals.daylight} onReady={ready}
                currentTime={currentTime} currentLineIndex={lineIndex} lines={lines} audioPower={power} audioBands={bands} paused={!state.playing}
                seed={track?.id || 'mineradio-export'} coverUrl={track?.cover} songTitle={track?.title} songArtist={track?.artist} songAlbum={track?.album}
                background={{ ...visuals.background, transparent: false, customImage: assets.background[0] ?? null }}
                cappellaCustomEmojiImages={assets.emoji} cappellaCustomAvatarImages={assets.avatar} monetPortraitImage={assets.portrait[0] ?? null} temperaLayerImageAssets={assets.tempera}
                lyricsFontScale={visuals.lyricsFontScale} visualizerTunings={visuals.tunings} showText={lines.length > 0}
                showSubtitleTranslation={visuals.translation} hideTranslationSubtitle={visuals.subtitleHidden} subtitleContentMode={visuals.subtitleContentMode}
                subtitleOverlayLayout={visuals.subtitleLayout} subtitleOverlayBackground={visuals.subtitleBackground} showHarmonySubtitle={visuals.harmony} isPlayerChromeHidden />
        </LyricRenderQualityPinContext.Provider>
    </div>;
}
export async function mountVideoExportSurface(mount: HTMLElement) {
    const bridge = videoExportBridge();
    if (!bridge) throw new Error('Missing video export bridge');
    const controller = new AbortController();
    const fail = (error: unknown) => { if (!controller.signal.aborted) bridge.failed(failureMessage(error)); };
    const onError = (event: ErrorEvent) => fail(event.error || event.message);
    const onRejection = (event: PromiseRejectionEvent) => fail(event.reason);
    window.addEventListener('error', onError); window.addEventListener('unhandledrejection', onRejection);
    let assets: ExportAssets | null = null;
    const root = createRoot(mount);
    let disposed = false;
    const dispose = () => {
        if (disposed) return;
        disposed = true;
        controller.abort(); root.unmount(); assets?.release();
        window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection);
    };
    window.addEventListener('pagehide', dispose, { once: true });
    try {
        const initial = await bridge.getInitial();
        const token = new URLSearchParams(location.search).get('videoExport');
        if (!token || token !== initial.id || !initial.state.currentTrack) throw new Error('Invalid video export session');
        initial.visuals = normalizeVisualPreferences(initial.visuals);
        assets = await loadVideoExportAssets(initial.visuals, controller.signal);
        if (controller.signal.aborted) { assets.release(); return; }
        root.render(<ExportBoundary><Surface initial={initial} assets={assets} signal={controller.signal} /></ExportBoundary>);
    } catch (error) { fail(error); dispose(); }
}
