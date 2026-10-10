import type { AdditionalSonnetMgOptions } from './sonnetAdditionalShotMg';
import { sonnetHash01 } from './sonnetRandom';
import { resolveSonnetShotMgBleed } from './sonnetShotMgViewport';

// src/components/visualizer/sonnet/sonnetShotMgMusic.ts
// Eight music-themed extended backgrounds (geo variants 68-75). Staves and
// ribbons stay open-ended (they bleed or dissolve at the edges); notes, forks
// and grooves are split into short commands for layered staggered growth.

export const SONNET_MUSIC_GEO_VARIANTS = [
    'sound-wave', 'vinyl-grooves', 'equalizer-bloom', 'note-arc',
    'tuning-fork', 'piano-ribbon', 'metronome', 'staff-wave',
] as const;

const TAU = Math.PI * 2;

// 68: symmetric waveform mirrored around an open center axis.
const drawSoundWave = ({ target, radius, width, height, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const bleed = resolveSonnetShotMgBleed(width, height, radius);
    const steps = 72;
    const envelope = (t: number) => Math.sin(t * Math.PI) * (0.4 + 0.6 * sonnetHash01(seed, Math.round(t * 12), 401));
    for (const mirror of [-1, 1]) {
        target.moveTo(-bleed.x, 0);
        for (let i = 1; i <= steps; i += 1) {
            const t = i / steps;
            const x = -bleed.x + t * bleed.x * 2;
            const y = mirror * Math.sin(t * TAU * 5 + seed * 0.13) * radius * 0.22 * envelope(t);
            target.lineTo(x, y);
        }
        target.stroke({ color: mirror < 0 ? primary : secondary, width: mirror < 0 ? 2 : 1, alpha: 0.55 });
    }
    target.moveTo(-bleed.x, 0).lineTo(bleed.x, 0).stroke({ color: primary, width: 1, alpha: 0.18 });
};

// 69: vinyl record — grooved arcs with gaps (never closed rings) and a tonearm.
const drawVinylGrooves = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    for (let groove = 0; groove < 7; groove += 1) {
        const r = radius * (0.2 + groove * 0.08);
        const gapAt = sonnetHash01(seed, groove, 409) * TAU;
        target.arc(0, 0, r, gapAt, gapAt + TAU * 0.86)
            .stroke({ color: groove % 3 === 0 ? secondary : primary, width: groove % 3 === 0 ? 2 : 1, alpha: 0.3 + groove * 0.05 });
    }
    target.circle(0, 0, radius * 0.12).stroke({ color: primary, width: 2, alpha: 0.6 });
    target.circle(0, 0, radius * 0.03).fill({ color: secondary, alpha: 0.8 });
    // Tonearm sweeps in from a corner pivot.
    const pivotX = radius * 0.62;
    const pivotY = -radius * 0.52;
    target.circle(pivotX, pivotY, radius * 0.035).stroke({ color: primary, width: 2, alpha: 0.6 });
    target.moveTo(pivotX, pivotY)
        .lineTo(radius * 0.18, -radius * 0.1)
        .stroke({ color: primary, width: 3, alpha: 0.5 });
    target.circle(radius * 0.18, -radius * 0.1, 3).fill({ color: secondary, alpha: 0.8 });
};

// 70: equalizer bars blooming along a shallow bottom arc, no baseline frame.
const drawEqualizerBloom = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const bars = 17;
    for (let i = 0; i < bars; i += 1) {
        const t = i / (bars - 1);
        const x = -radius * 0.66 + t * radius * 1.32;
        const arcY = radius * 0.5 - Math.sin(t * Math.PI) * radius * 0.12;
        const h = radius * (0.08 + Math.sin(t * Math.PI) * 0.3 * (0.5 + sonnetHash01(seed, i, 419) * 0.8));
        target.moveTo(x, arcY).lineTo(x, arcY - h)
            .stroke({ color: i % 4 === 0 ? secondary : primary, width: 3, alpha: 0.5 + Math.sin(t * Math.PI) * 0.25 });
        target.circle(x, arcY - h - 4, 1.6).fill({ color: secondary, alpha: 0.55 });
    }
};

// 71: five eighth notes stepping along an arc, joined by one open beam.
const drawNoteArc = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const headR = radius * 0.045;
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < 5; i += 1) {
        const t = i / 4;
        const x = -radius * 0.55 + t * radius * 1.1;
        const y = radius * 0.22 - Math.sin(t * Math.PI * 0.9) * radius * 0.34;
        points.push({ x, y });
        target.circle(x, y, headR).fill({ color: i === 2 ? secondary : primary, alpha: 0.8 });
        target.moveTo(x + headR, y).lineTo(x + headR, y - radius * 0.16)
            .stroke({ color: i === 2 ? secondary : primary, width: 2, alpha: 0.65 });
    }
    // Beam connecting the stem tops, left open past the last note.
    target.moveTo(points[0].x + headR, points[0].y - radius * 0.16);
    for (let i = 1; i < points.length; i += 1) {
        target.lineTo(points[i].x + headR, points[i].y - radius * 0.16);
    }
    target.lineTo(points[4].x + radius * 0.12, points[4].y - radius * 0.13);
    target.stroke({ color: primary, width: 3, alpha: 0.5 });
    // A stray flag curling off the first note.
    target.moveTo(points[0].x + headR, points[0].y - radius * 0.16)
        .quadraticCurveTo(points[0].x + radius * 0.1, points[0].y - radius * 0.1, points[0].x + radius * 0.06, points[0].y - radius * 0.02)
        .stroke({ color: secondary, width: 1.5, alpha: 0.5 });
};

// 72: tuning fork with sound rings emanating on both sides.
const drawTuningFork = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const fx = (seed % 2 === 0 ? -1 : 1) * radius * 0.08;
    const topY = -radius * 0.4;
    const prongW = radius * 0.05;
    const prongGap = radius * 0.1;
    const uY = radius * 0.02;
    // Two prongs + U bend + handle, all one open path broken per segment.
    target.moveTo(fx - prongGap / 2 - prongW, topY).lineTo(fx - prongGap / 2 - prongW, uY)
        .stroke({ color: primary, width: 2.5, alpha: 0.65 });
    target.moveTo(fx + prongGap / 2 + prongW, topY).lineTo(fx + prongGap / 2 + prongW, uY)
        .stroke({ color: primary, width: 2.5, alpha: 0.65 });
    target.arc(fx, uY, prongGap / 2 + prongW, 0, Math.PI)
        .stroke({ color: primary, width: 2.5, alpha: 0.65 });
    target.moveTo(fx, uY + prongGap / 2 + prongW).lineTo(fx, radius * 0.42)
        .stroke({ color: primary, width: 3, alpha: 0.6 });
    target.circle(fx, radius * 0.46, radius * 0.035).stroke({ color: secondary, width: 2, alpha: 0.6 });
    // Vibration arcs left and right of the prongs.
    for (let side = -1; side <= 1; side += 2) {
        for (let ring = 0; ring < 3; ring += 1) {
            const r = radius * (0.14 + ring * 0.1);
            const cx = fx + side * radius * 0.06;
            const cy = topY + radius * 0.1;
            target.arc(cx, cy, r, side < 0 ? Math.PI * 0.6 : -Math.PI * 0.4, side < 0 ? Math.PI * 1.4 : Math.PI * 0.4)
                .stroke({ color: ring === 1 ? secondary : primary, width: 1.5, alpha: 0.42 - ring * 0.1 });
        }
    }
};

// 73: piano keys riding a shallow ribbon curve — alternating long/short bars.
const drawPianoRibbon = ({ target, radius, width, height, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const bleed = resolveSonnetShotMgBleed(width, height, radius);
    // Ribbon guide curve, open at both ends.
    target.moveTo(-bleed.x, radius * 0.18)
        .bezierCurveTo(-radius * 0.3, -radius * 0.05, radius * 0.3, radius * 0.3, bleed.x, radius * 0.05)
        .stroke({ color: primary, width: 1, alpha: 0.25 });
    const keys = 12;
    for (let i = 0; i < keys; i += 1) {
        const t = i / (keys - 1);
        const x = -radius * 0.6 + t * radius * 1.2;
        const baseY = radius * 0.18 + Math.sin(t * Math.PI) * -radius * 0.1 + t * -radius * 0.06;
        const black = [1, 3, 6, 8, 10].includes(i % 12);
        const len = radius * (black ? 0.14 : 0.24);
        target.moveTo(x, baseY).lineTo(x, baseY - len)
            .stroke({ color: black ? secondary : primary, width: black ? 4 : 3, alpha: black ? 0.7 : 0.45 });
    }
};

// 74: metronome with tilted pendulum and motion echo arcs.
const drawMetronome = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const cx = 0;
    const baseY = radius * 0.4;
    const topY = -radius * 0.36;
    // Tapered body outline, base left open.
    target.moveTo(cx - radius * 0.2, baseY).lineTo(cx - radius * 0.06, topY)
        .stroke({ color: primary, width: 2, alpha: 0.6 });
    target.moveTo(cx + radius * 0.2, baseY).lineTo(cx + radius * 0.06, topY)
        .stroke({ color: primary, width: 2, alpha: 0.6 });
    target.moveTo(cx - radius * 0.06, topY).lineTo(cx + radius * 0.06, topY)
        .stroke({ color: primary, width: 2, alpha: 0.6 });
    // Pendulum.
    const tilt = (sonnetHash01(seed, 0, 431) - 0.5) * 0.9;
    const pivotY = radius * 0.16;
    const tipX = cx + Math.sin(tilt) * radius * 0.5;
    const tipY = pivotY - Math.cos(tilt) * radius * 0.5;
    target.circle(cx, pivotY, radius * 0.03).fill({ color: secondary, alpha: 0.85 });
    target.moveTo(cx, pivotY).lineTo(tipX, tipY).stroke({ color: secondary, width: 2, alpha: 0.7 });
    target.rect(tipX - 4, tipY - 4, 8, 8).fill({ color: secondary, alpha: 0.7 });
    // Echo arcs sweeping with the pendulum.
    for (let i = 0; i < 3; i += 1) {
        const r = radius * (0.24 + i * 0.12);
        target.arc(cx, pivotY, r, -Math.PI / 2 - 0.5 - i * 0.1, -Math.PI / 2 + 0.5 + i * 0.1)
            .stroke({ color: primary, width: 1, alpha: 0.3 - i * 0.06 });
    }
};

// 75: five staff lines undulating across the bleed with a few free notes.
const drawStaffWave = ({ target, radius, width, height, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const bleed = resolveSonnetShotMgBleed(width, height, radius);
    for (let line = 0; line < 5; line += 1) {
        const y0 = -radius * 0.16 + line * radius * 0.08;
        const lift = (line % 2 === 0 ? 1 : -1) * radius * 0.05;
        target.moveTo(-bleed.x, y0)
            .bezierCurveTo(-radius * 0.3, y0 + lift, radius * 0.3, y0 - lift, bleed.x, y0)
            .stroke({ color: primary, width: 1, alpha: 0.3 + (line === 2 ? 0.15 : 0) });
    }
    for (let i = 0; i < 4; i += 1) {
        const x = -radius * 0.45 + i * radius * 0.3 + (sonnetHash01(seed, i, 439) - 0.5) * radius * 0.08;
        const y = -radius * 0.16 + Math.floor(sonnetHash01(seed, i, 443) * 5) * radius * 0.08;
        target.circle(x, y, radius * 0.032).fill({ color: i % 2 === 0 ? secondary : primary, alpha: 0.85 });
        target.moveTo(x + radius * 0.032, y).lineTo(x + radius * 0.032, y - radius * 0.14)
            .stroke({ color: i % 2 === 0 ? secondary : primary, width: 1.5, alpha: 0.6 });
    }
};

export const SONNET_MUSIC_DRAWERS = [
    drawSoundWave, drawVinylGrooves, drawEqualizerBloom, drawNoteArc,
    drawTuningFork, drawPianoRibbon, drawMetronome, drawStaffWave,
] as const;
