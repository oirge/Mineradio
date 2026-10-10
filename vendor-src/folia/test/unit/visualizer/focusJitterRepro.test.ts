// Temporary numerical reproduction for the type-impact camera jitter on こぼれ.
// Replicates updateShot focus logic from createSonnetPixiRuntime.ts verbatim.
import { describe, it } from 'vitest';
import {
    resolveSonnetFocusWeights,
    resolveSonnetSmoothedCameraFocus,
} from '@/components/visualizer/sonnet/sonnetMotion';

interface SimGlyph { baseX: number; baseY: number; startTime: number }
interface SimSegment { name: string; role: string; glyphs: SimGlyph[] }

const glyph = (x: number, y: number, t: number): SimGlyph => ({ baseX: x, baseY: y, startTime: t });

// Placements from the user's Segment Placements dump (non-decoration rows only).
const segments: SimSegment[] = [
    { name: '曖昧', role: 'hero', glyphs: [glyph(15 - 90, -637, 77.3), glyph(15 + 90, -637, 77.9)] },
    { name: 'な', role: 'support', glyphs: [glyph(-15, -377, 78.2)] },
    { name: '君', role: 'support', glyphs: [glyph(15, -232, 78.5)] },
    { name: 'の', role: 'support', glyphs: [glyph(-775, -10, 78.9)] },
    { name: '手', role: 'support', glyphs: [glyph(-659, 10, 79.2)] },
    { name: 'に', role: 'support', glyphs: [glyph(-542, -10, 79.5)] },
    // Real timing data for 光こぼれおちたら:
    { name: '光', role: 'support', glyphs: [glyph(-425, 10, 80.333)] },
    { name: 'こぼれ', role: 'hero', glyphs: [glyph(-224, 0, 80.857), glyph(0, 0, 81.333), glyph(224, 0, 81.598)] },
    { name: 'お', role: 'support', glyphs: [glyph(425, 10, 81.853)] },
    { name: 'ち', role: 'support', glyphs: [glyph(542, -10, 82.09)] },
    { name: 'たら', role: 'semi-hero', glyphs: [glyph(15 - 106, 311, 82.304), glyph(15 + 106, 311, 82.425)] },
];

const trackSegments = segments.filter(s => s.role !== 'decoration' && s.glyphs.length > 0);

const getSegmentFocus = (seg: SimSegment, t: number) => {
    const first = seg.glyphs[0];
    const last = seg.glyphs[seg.glyphs.length - 1];
    const trackingFactor = 0.5;
    const segCenterX = (first.baseX + last.baseX) / 2;
    const segCenterY = (first.baseY + last.baseY) / 2;
    const applyFactor = (exactX: number, exactY: number) => ({
        x: segCenterX + (exactX - segCenterX) * trackingFactor,
        y: segCenterY + (exactY - segCenterY) * trackingFactor,
    });
    if (t <= first.startTime) return applyFactor(first.baseX, first.baseY);
    if (t >= last.startTime) return applyFactor(last.baseX, last.baseY);
    for (let i = 0; i < seg.glyphs.length - 1; i++) {
        if (t >= seg.glyphs[i].startTime && t <= seg.glyphs[i + 1].startTime) {
            const g1 = seg.glyphs[i];
            const g2 = seg.glyphs[i + 1];
            const p = (t - g1.startTime) / Math.max(0.001, g2.startTime - g1.startTime);
            return applyFactor(g1.baseX + (g2.baseX - g1.baseX) * p, g1.baseY + (g2.baseY - g1.baseY) * p);
        }
    }
    return applyFactor(first.baseX, first.baseY);
};

const focusRanges = trackSegments.map(segment => ({
    startTime: segment.glyphs[0].startTime,
    endTime: segment.glyphs.at(-1)!.startTime,
}));

const resolveFocusAtTime = (focusTime: number) => {
    let focusX = 0;
    let focusY = 0;
    const focusWeights = resolveSonnetFocusWeights(focusRanges, focusTime);
    for (let i = 0; i < trackSegments.length; i++) {
        const weight = focusWeights[i] ?? 0;
        const pos = getSegmentFocus(trackSegments[i], focusTime);
        focusX += pos.x * weight;
        focusY += pos.y * weight;
    }
    return { x: focusX, y: focusY };
};

// Word sung ranges (start/end) for line 2 from the user's lyric data.
const sungRanges = [
    { name: 'に', startTime: 79.5, endTime: 80.2 },
    { name: '光', startTime: 80.333, endTime: 80.857 },
    { name: 'こぼれ', startTime: 80.857, endTime: 81.853 },
    { name: 'お', startTime: 81.853, endTime: 82.09 },
    { name: 'ち', startTime: 82.09, endTime: 82.304 },
    { name: 'たら', startTime: 82.304, endTime: 82.821 },
];

// Trapezoid membership: 1 inside the word's sung range, linear ramp down over `blend` outside.
const trapezoidWeights = (time: number, blend: number) => {
    const raw = sungRanges.map(range => {
        if (time >= range.startTime && time <= range.endTime) return 1;
        const distance = time < range.startTime ? range.startTime - time : time - range.endTime;
        return Math.max(0, 1 - distance / blend);
    });
    const total = raw.reduce((s, w) => s + w, 0);
    return total > 0 ? raw.map(w => w / total) : raw;
};

const resolveFocusTrapezoid = (time: number, blend: number) => {
    const weights = trapezoidWeights(time, blend);
    let x = 0;
    let y = 0;
    // Map sungRanges names to trackSegments focus positions
    sungRanges.forEach((range, i) => {
        const seg = trackSegments.find(s => s.name === range.name)!;
        const pos = getSegmentFocus(seg, time);
        x += pos.x * weights[i];
        y += pos.y * weights[i];
    });
    return { x, y };
};

const SHOT_START = 76.5;
const SHOT_END = 84.0;

describe('type-impact focus trajectory', () => {
    it('prints frame-to-frame focus deltas around こぼれ', () => {
        const fps = 120;
        let prev: { x: number; y: number } | null = null;
        const rows: string[] = [];
        for (let t = 80.0; t <= 83.2; t += 1 / fps) {
            const focusTime = Math.max(SHOT_START, Math.min(t, SHOT_END));
            const smoothed = resolveSonnetSmoothedCameraFocus(
                focusTime, SHOT_START, SHOT_END, resolveFocusAtTime,
            );
            if (prev) {
                const dx = smoothed.x - prev.x;
                const dy = smoothed.y - prev.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 1.5) {
                    rows.push(`t=${t.toFixed(4)} dx=${dx.toFixed(2)} dy=${dy.toFixed(2)} |d|=${dist.toFixed(2)} focus=(${smoothed.x.toFixed(1)},${smoothed.y.toFixed(1)})`);
                }
            }
            prev = smoothed;
        }
        // High-resolution jerk analysis around the こ boundary: gate toggling would
        // show up as an abrupt isolated dx spike, not gradual acceleration.
        const fine: string[] = [];
        let pp: { x: number; y: number } | null = null;
        let pdx = 0;
        for (let t = 80.70; t <= 81.45; t += 1 / 240) {
            const p = resolveSonnetSmoothedCameraFocus(t, SHOT_START, SHOT_END, resolveFocusAtTime);
            if (pp) {
                const dx = p.x - pp.x;
                const jerk = Math.abs(dx - pdx);
                if (jerk > 0.75) {
                    fine.push(`t=${t.toFixed(4)} dx=${dx.toFixed(2)} prevDx=${pdx.toFixed(2)} jerk=${jerk.toFixed(2)}`);
                }
                pdx = dx;
            }
            pp = p;
        }
        console.log(`jerk spikes >0.75px/frame² @240fps near こ: ${fine.length}`);
        console.log(fine.join('\n'));
        // Raw (unsmoothed) focus for comparison at the same instants
        const raw: string[] = [];
        for (let t = 80.75; t <= 81.35; t += 0.05) {
            const p = resolveFocusAtTime(t);
            raw.push(`t=${t.toFixed(2)} raw=(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
        }
        console.log(raw.join('\n'));
        console.log(`jumps >1.5px/frame @120fps: ${rows.length}`);
        // Velocity sign-reversal analysis: true jitter would flip direction constantly.
        const vel: { t: number; vx: number; vy: number; speed: number }[] = [];
        let prevP: { x: number; y: number } | null = null;
        let prevT = 0;
        for (let t = 80.0; t <= 83.2; t += 1 / fps) {
            const p = resolveSonnetSmoothedCameraFocus(t, SHOT_START, SHOT_END, resolveFocusAtTime);
            if (prevP) {
                const dt = t - prevT;
                const vx = (p.x - prevP.x) / dt;
                const vy = (p.y - prevP.y) / dt;
                vel.push({ t, vx, vy, speed: Math.hypot(vx, vy) });
            }
            prevP = p;
            prevT = t;
        }
        let reversals = 0;
        for (let i = 1; i < vel.length; i++) {
            const dot = vel[i].vx * vel[i - 1].vx + vel[i].vy * vel[i - 1].vy;
            if (dot < 0 && vel[i].speed > 30 && vel[i - 1].speed > 30) reversals += 1;
        }
        const peak = vel.reduce((m, v) => (v.speed > m.speed ? v : m), vel[0]);
        const inWord = vel.filter(v => v.t >= 80.857 && v.t <= 81.853);
        const avgSpeed = inWord.reduce((s, v) => s + v.speed, 0) / inWord.length;
        console.log(`velocity reversals (>30px/s): ${reversals}`);
        console.log(`peak speed: ${peak.speed.toFixed(0)}px/s at t=${peak.t.toFixed(3)}`);
        console.log(`avg speed during こぼれ window: ${avgSpeed.toFixed(0)}px/s`);
        // Also dump the raw trajectory through the こぼれ window at 30fps for shape inspection
        const traj: string[] = [];
        for (let t = 80.6; t <= 82.6; t += 1 / 30) {
            const p = resolveSonnetSmoothedCameraFocus(t, SHOT_START, SHOT_END, resolveFocusAtTime);
            traj.push(`t=${t.toFixed(3)} (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`);
        }
        console.log(traj.join('\n'));
    });
});
