// @vitest-environment jsdom
import { beforeEach, expect, it } from 'vitest';
import type { HostAnalysis, HostAudio } from '../../../src/mineradio/client';
import { advanceLocalAnalysis, applyLocalAnalysis, applyLocalAnalysisAudio, clearLocalAnalysis, getBeatEffectStrength,
    getBeatFxEvents, getBeatFxFiredCounts, getBeatFxHeard, getDrumHits, getVocalEnvelope, isBeatFxReady, getBeatFxIntensities } from '../../../src/mineradio/local/localAnalysisBoundary';
import { beatImpact, downbeatImpact } from '../../../src/stores/motionSignals';
import { useVisualSettings } from '../../../src/mineradio/local/useVisualSettings';
import { LocalLiveAnalysis } from '../../../src/mineradio/local/localLiveAnalysis';
import { NebbiaDrumBumps } from '../../../src/components/visualizer/nebbia/nebbiaDrumBumps';
import { rescaleBeatEnvelope } from '../../../src/components/visualizer/hanabi/hanabiBeatFx';

// test/unit/mineradio/localAnalysis.test.ts
const data = (revision = 1): HostAnalysis => ({ trackId: 'A', revision, source: 'cache',
    beats: [{ t: 1, kind: 'downbeat', impact: 1 }, { t: 1.2, kind: 'beat' }, { t: 2, kind: 'beat' }],
    drums: { times: new Float64Array([1]), strengths: new Float32Array([1]), kinds: new Uint8Array([0]) },
    vocal: { fps: 50, db: new Float32Array([-80, -20]), top: -20, onsets: new Uint32Array([1]) },
});
const advance = (time: number, playing = true) => advanceLocalAnalysis('A', time, playing, 0, 1, 1000 + time * 1000);
beforeEach(() => { useVisualSettings.getState().reset(); clearLocalAnalysis('A'); });

it('drives the original beat clock and MotionValues, including Hanabi strength rescaling', () => {
    advance(0.98); applyLocalAnalysis(data()); advance(1.02);
    expect(getBeatFxFiredCounts()).toEqual({ beat: 1, downbeat: 1 });
    expect(beatImpact.get()).toBeGreaterThan(0.5); expect(downbeatImpact.get()).toBeGreaterThan(0.5);
    expect(rescaleBeatEnvelope(beatImpact.get(), getBeatFxIntensities().beat, 1)).toBe(beatImpact.get());
    expect(getDrumHits('A')?.kinds[0]).toBe(0); expect(getVocalEnvelope('A')?.fps).toBe(50);
    expect(getDrumHits('B')).toBeNull(); expect(getBeatEffectStrength('machi.screenFlash')).toBe(1);
    expect(getBeatEffectStrength('pendolo.gearBeats')).toBe(0);
});

it('rejects other tracks and old revisions and clears everything on track replacement', () => {
    advance(0.98); expect(applyLocalAnalysis(data(3))).toBe(true);
    expect(applyLocalAnalysis(data(2))).toBe(false);
    expect(applyLocalAnalysis({ ...data(4), trackId: 'B' })).toBe(false);
    advanceLocalAnalysis('B', 0, true); expect(getVocalEnvelope('B')).toBeNull();
    expect(getBeatFxEvents()).toHaveLength(0); expect(applyLocalAnalysis(data(5))).toBe(false);
    clearLocalAnalysis(); expect(getBeatFxHeard().key).toBeNull(); expect(isBeatFxReady()).toBe(false);
});

it('does not burst past events after a seek, pause, resume or late analysis arrival', () => {
    advance(0.98); applyLocalAnalysis(data()); advance(1.02);
    advance(1.03, false); expect(beatImpact.get()).toBe(0); expect(getBeatEffectStrength('nebbia.drizzleRide')).toBe(0);
    advance(1.19); advance(1.21); expect(getBeatFxFiredCounts().beat).toBe(2);
    advance(20); expect(getBeatFxFiredCounts().beat).toBe(2); expect(beatImpact.get()).toBe(0);
    applyLocalAnalysis(data(2)); expect(getBeatFxFiredCounts().beat).toBe(0);
    advance(0.99); advance(1.01); expect(getBeatFxFiredCounts().beat).toBe(1);
    useVisualSettings.getState().update({ rhythm: false }); advance(1.02);
    expect(isBeatFxReady()).toBe(false); expect(beatImpact.get()).toBe(0);
});

it('accounts for output latency and playback rate once', () => {
    advanceLocalAnalysis('A', 1.18, true, 0.1, 2, 1000); applyLocalAnalysis(data());
    expect(getBeatFxHeard().time).toBeCloseTo(0.98);
    advanceLocalAnalysis('A', 1.22, true, 0.1, 2, 1020);
    expect(getBeatFxFiredCounts().beat).toBe(1); expect(getBeatFxHeard().time).toBeCloseTo(1.02);
});

it('falls back to live onsets past partial-cache coverage and can seek back into the cache', () => {
    advance(1); applyLocalAnalysis({ ...data(), until: 1.1 });
    expect(getVocalEnvelope('A')).not.toBeNull();
    advance(1.2); expect(getVocalEnvelope('A')).toBeNull(); expect(getBeatFxEvents()).toHaveLength(0);
    applyLocalAnalysisAudio(frame(1.2, 5)); advance(1.23); applyLocalAnalysisAudio(frame(1.23, 220));
    expect(getBeatFxEvents()).toHaveLength(1); expect(getDrumHits('A')?.times[0]).toBeCloseTo(1.255);
    advance(0.98); expect(getBeatFxEvents()).toHaveLength(3); expect(getVocalEnvelope('A')).not.toBeNull();
});

const frame = (position: number, kick: number): HostAudio => {
    const frequency = new Uint8Array(512).fill(5); frequency.fill(kick, 1, 4);
    return { trackId: 'A', position, playing: true, frequency, sampleRate: 48000, fftSize: 1024 };
};
it('uses actual FFT rises without a cache and feeds the original drum-bump consumer', () => {
    advance(1); applyLocalAnalysisAudio(frame(1, 5));
    const bumps = new NebbiaDrumBumps();
    advance(1.03); applyLocalAnalysisAudio(frame(1.03, 220));
    expect(isBeatFxReady()).toBe(true);
    expect(bumps.step(getDrumHits('A')!, 'A', 1.03)).toBe(0);
    advance(1.07); expect(beatImpact.get()).toBeGreaterThan(0);
    expect(bumps.step(getDrumHits('A')!, 'A', 1.07)).toBeGreaterThan(0);
    const count = getBeatFxEvents().length;
    applyLocalAnalysisAudio({ ...frame(1.08, 255), trackId: 'B' });
    applyLocalAnalysisAudio(frame(30, 255)); expect(getBeatFxEvents()).toHaveLength(count);
});

it('bounds live history, preserves hit identity between appends, and resets on backwards seeks', () => {
    const live = new LocalLiveAnalysis();
    live.step(frame(0, 5), 0); live.step(frame(0.03, 220), 0.03);
    const hits = live.drums;
    live.step(frame(0.3, 5), 0.3); live.step(frame(0.33, 220), 0.33);
    expect(live.drums).toBe(hits); expect(live.drums.times.length).toBe(2);
    for (let n = 2; n < 5000; n++) { live.step(frame(n * 0.3, 5), n * 0.3); live.step(frame(n * 0.3 + 0.03, 220), n * 0.3 + 0.03); }
    expect(live.events.length).toBeLessThanOrEqual(2048); expect(live.drums.times.length).toBeLessThanOrEqual(2048);
    expect(live.drums).not.toBe(hits);
    live.step(frame(1, 220), 1); expect(live.events).toHaveLength(0); expect(live.drums.times).toHaveLength(0);
});
