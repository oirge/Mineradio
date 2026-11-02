import type { HostAudio } from '../client';
import type { BeatFxEvent } from '../../services/beatFx/clock';

// src/mineradio/local/localLiveAnalysis.ts
// Causal spectral onsets reuse the host's 30 Hz FFT. They estimate hits, without another audio graph.
const CAPACITY = 2048;
export class LocalLiveAnalysis {
    events: BeatFxEvent[] = [];
    drums = { times: new Float64Array(0), strengths: new Float32Array(0), kinds: new Uint8Array(0) };
    private times = new Float64Array(CAPACITY);
    private strengths = new Float32Array(CAPACITY);
    private kinds = new Uint8Array(CAPACITY);
    private count = 0;
    private previous: number[] | null = null;
    private mean = [0, 0, 0];
    private lastHits = [-Infinity, -Infinity, -Infinity];
    private lastTime = -Infinity;
    private lastBeat = -Infinity;

    reset() {
        this.events = []; this.count = 0; this.previous = null; this.mean = [0, 0, 0];
        this.drums = { times: new Float64Array(0), strengths: new Float32Array(0), kinds: new Uint8Array(0) };
        this.lastHits.fill(-Infinity); this.lastTime = this.lastBeat = -Infinity;
        this.drums.times = this.times.subarray(0, 0);
        this.drums.strengths = this.strengths.subarray(0, 0);
        this.drums.kinds = this.kinds.subarray(0, 0);
    }

    step(frame: HostAudio, time: number) {
        if (!Number.isFinite(time) || !frame.frequency.length || frame.fftSize <= 0 || frame.sampleRate <= 0) return;
        if (time < this.lastTime || time - this.lastTime > 0.5) this.reset();
        if (time === this.lastTime) return;
        const values = [[35, 180], [180, 1800], [1800, 9000]].map(([low, high]) => {
            const from = Math.max(0, Math.ceil(low * frame.fftSize / frame.sampleRate));
            const until = Math.min(frame.frequency.length, Math.ceil(high * frame.fftSize / frame.sampleRate));
            let sum = 0;
            for (let index = from; index < until; index++) sum += frame.frequency[index];
            return sum / Math.max(1, until - from);
        });
        const dt = Math.min(0.2, Math.max(0.001, time - this.lastTime));
        this.lastTime = time;
        if (!this.previous) { this.previous = values; this.mean = [...values]; return; }
        let strongest = 0, kick = false;
        const gaps = [0.24, 0.18, 0.1];
        for (let kind = 0; kind < 3; kind++) {
            const value = values[kind], rise = value - this.previous[kind];
            const threshold = Math.max(kind === 2 ? 12 : 9, this.mean[kind] * 0.18);
            if (value > 20 && rise > threshold && time - this.lastHits[kind] > gaps[kind]) {
                const strength = Math.min(1, Math.max(0.35, rise / Math.max(35, this.mean[kind] * 0.8)));
                this.appendHit(time + 0.025, strength, kind);
                this.lastHits[kind] = time;
                if (kind !== 2) { strongest = Math.max(strongest, strength); kick ||= kind === 0; }
            }
            this.mean[kind] += (value - this.mean[kind]) * (1 - Math.exp(-dt / 1.5));
        }
        this.previous = values;
        if (strongest && time - this.lastBeat > 0.22) {
            if (this.events.length >= CAPACITY) this.events = this.events.slice(-CAPACITY / 2);
            const sum = values.reduce((a, b) => a + b, 0) || 1;
            this.events.push({ t: time + 0.025, kind: kick && strongest > 0.8 ? 'downbeat' : 'beat', impact: strongest,
                tone: { low: values[0] / sum, mid: values[1] / sum, high: values[2] / sum } });
            this.lastBeat = time;
        }
    }

    private appendHit(time: number, strength: number, kind: number) {
        if (this.count === CAPACITY) {
            this.times.copyWithin(0, CAPACITY / 2); this.strengths.copyWithin(0, CAPACITY / 2); this.kinds.copyWithin(0, CAPACITY / 2);
            this.count = CAPACITY / 2;
            this.drums = { times: new Float64Array(0), strengths: new Float32Array(0), kinds: new Uint8Array(0) };
        }
        this.times[this.count] = time; this.strengths[this.count] = strength; this.kinds[this.count++] = kind;
        this.drums.times = this.times.subarray(0, this.count);
        this.drums.strengths = this.strengths.subarray(0, this.count);
        this.drums.kinds = this.kinds.subarray(0, this.count);
    }
}
