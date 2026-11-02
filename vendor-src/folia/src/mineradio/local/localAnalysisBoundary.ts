import type { HostAnalysis, HostAudio } from '../client';
import { createBeatFxClockState, stepBeatFxClock, type BeatFxEvent } from '../../services/beatFx/clock';
import { BEAT_EFFECT_IDS } from '../../services/beatFx/beatEffects';
import { beatImpact, downbeatImpact } from '../../stores/motionSignals';
import { LocalLiveAnalysis } from './localLiveAnalysis';
import { useVisualSettings } from './useVisualSettings';

// src/mineradio/local/localAnalysisBoundary.ts
// One track-owned analysis view, advanced by useLocalPlayer's existing clock. No RAF, audio or React state here.
export const DRUM_KICK = 0, DRUM_SNARE = 1, DRUM_HAT = 2, VOCAL_FPS = 50;
export interface DrumHits { times: Float64Array; strengths: Float32Array; kinds: Uint8Array; until?: number }
export interface VocalEnvelope { fps: number; db: Float32Array; top: number; onsets: Uint32Array; from?: number }
const live = new LocalLiveAnalysis();
let clock = createBeatFxClockState();
let snapshot: HostAnalysis | null = null;
let cachedEvents: BeatFxEvent[] = [];
let playing = false, wallTime = 0, latency = 0, position = 0;
const heard: { key: string | null; time: number } = { key: null, time: 0 };
const enabled = () => playing && useVisualSettings.getState().rhythm;
const cacheCoversTime = () => snapshot && (snapshot.until === undefined || heard.time <= snapshot.until);
const usesCachedBeats = () => cacheCoversTime() && cachedEvents.length > 0;
const allowed = new Set<string>(Object.values(BEAT_EFFECT_IDS).filter(id => id !== 'pendolo.gearBeats' && id !== 'latent.pulse'));

export function clearLocalAnalysis(trackId: string | null = null) {
    heard.key = trackId; heard.time = position = 0; wallTime = 0;
    playing = false; snapshot = null; cachedEvents = []; live.reset(); clock = createBeatFxClockState(live.events);
    beatImpact.set(0); downbeatImpact.set(0);
}

export function applyLocalAnalysis(value: HostAnalysis): boolean {
    if (value.trackId !== heard.key || (snapshot && value.revision < snapshot.revision)) return false;
    snapshot = value;
    cachedEvents = value.beats.filter(event => Number.isFinite(event.t) && event.t >= 0).sort((a, b) => a.t - b.t);
    clock = createBeatFxClockState(usesCachedBeats() ? cachedEvents : live.events);
    stepBeatFxClock(clock, playing ? heard.time : null, 0);
    return true;
}

export function advanceLocalAnalysis(trackId: string | null, time: number, isPlaying: boolean, outputLatency = 0, rate = 1, now = performance.now()) {
    if (trackId !== heard.key) clearLocalAnalysis(trackId);
    const dt = wallTime ? Math.max(0, (now - wallTime) / 1000) : 0;
    wallTime = now;
    const seek = Math.abs(time - position) > 0.35 || time < position - 0.02;
    position = time; latency = Math.max(0, Math.min(0.5, outputLatency)) * Math.max(0.5, rate);
    heard.time = Math.max(0, time - latency);
    if (seek || !isPlaying || !playing) {
        clock.lastTime = null; clock.beatImpact = clock.downbeatImpact = 0;
        live.reset();
    }
    playing = isPlaying && !!trackId;
    const events = usesCachedBeats() ? cachedEvents : live.events;
    if (events !== clock.events) clock = createBeatFxClockState(events);
    stepBeatFxClock(clock, enabled() ? heard.time : null, dt);
    beatImpact.set(enabled() ? clock.beatImpact : 0); downbeatImpact.set(enabled() ? clock.downbeatImpact : 0);
}

export function applyLocalAnalysisAudio(frame: HostAudio) {
    if (!enabled() || (frame.trackId !== undefined && frame.trackId !== heard.key) || frame.playing === false) return;
    const time = Math.max(0, (frame.position ?? position) - latency);
    // A stale FFT frame must not reintroduce hits from before a seek or a track change.
    if (Math.abs(time - heard.time) > 0.4) return;
    live.step(frame, time);
    if (!usesCachedBeats() && clock.events !== live.events) {
        clock = createBeatFxClockState(live.events); stepBeatFxClock(clock, heard.time, 0);
    }
}

export const getDrumHits = (key?: unknown): DrumHits | null => enabled() && key === heard.key
    ? (cacheCoversTime() ? snapshot?.drums : null) ?? (live.drums.times.length ? live.drums : null) : null;
export const getVocalEnvelope = (key?: unknown): VocalEnvelope | null => enabled() && key === heard.key && cacheCoversTime() ? snapshot?.vocal ?? null : null;
export const isBeatEffectPlaying = (id?: unknown) => enabled() && typeof id === 'string' && allowed.has(id.split(':')[0]);
export const isBeatFxReady = () => enabled() && clock.events.length > 0;
export const getBeatEffectStrength = (id?: unknown) => isBeatEffectPlaying(id) ? 1 : 0;
export const getBeatFxHeard = () => heard;
export const getBeatFxEvents = () => clock.events;
// Upstream divides the MotionValue envelope by these strengths, not by another envelope.
export const getBeatFxIntensities = () => ({ beat: enabled() ? 1 : 0, downbeat: enabled() ? 1 : 0 });
export const getBeatFxRotationSign = () => clock.rotationSign;
export const getBeatFxTrackScale = () => clock.trackScale;
export const getBeatFxFiredCounts = () => ({ beat: clock.firedBeats, downbeat: clock.firedDownbeats });
export const getBeatFxLastBeat = () => clock.lastBeat;
export const getBeatFxLastDownbeat = () => clock.lastDownbeat;
