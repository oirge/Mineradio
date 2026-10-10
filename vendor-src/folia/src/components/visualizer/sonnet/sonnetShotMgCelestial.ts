import type { AdditionalSonnetMgOptions } from './sonnetAdditionalShotMg';
import { sonnetHash01 } from './sonnetRandom';

// src/components/visualizer/sonnet/sonnetShotMgCelestial.ts
// Ten celestial extended backgrounds (geo variants 48-57). Every composition
// is open — no closed viewport frames, no clip masks — and each motif is split
// into many short stroke/fill commands so the shared stagger schedule grows
// them in layered, offset waves.

export const SONNET_CELESTIAL_GEO_VARIANTS = [
    'spiral-galaxy', 'comet-trail', 'eclipse-corona', 'meteor-shower', 'orbit-satellites',
    'aurora-ribbons', 'crescent-halo', 'nebula-veil', 'star-map', 'lunar-tide',
] as const;

const TAU = Math.PI * 2;

// 48: twin log-spiral arms with a bright core and free-floating star dust.
const drawSpiralGalaxy = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    for (let arm = 0; arm < 2; arm += 1) {
        const offset = arm * Math.PI + sonnetHash01(seed, arm, 101) * 0.5;
        target.moveTo(Math.cos(offset) * radius * 0.06, Math.sin(offset) * radius * 0.05);
        const steps = 56;
        for (let i = 1; i <= steps; i += 1) {
            const t = i / steps;
            const angle = offset + t * Math.PI * 3.1;
            const r = radius * (0.06 + t * 0.62);
            target.lineTo(Math.cos(angle) * r, Math.sin(angle) * r * 0.72);
        }
        target.stroke({ color: arm === 0 ? primary : secondary, width: 2, alpha: 0.5 - arm * 0.12 });
    }
    target.circle(0, 0, radius * 0.07).fill({ color: primary, alpha: 0.7 });
    target.circle(0, 0, radius * 0.12).stroke({ color: primary, width: 1, alpha: 0.3 });
    for (let i = 0; i < 14; i += 1) {
        const angle = sonnetHash01(seed, i, 103) * TAU;
        const r = radius * (0.2 + sonnetHash01(seed, i, 107) * 0.55);
        target.circle(Math.cos(angle) * r, Math.sin(angle) * r * 0.72, 1.4 + sonnetHash01(seed, i, 109) * 2.2)
            .fill({ color: i % 3 === 0 ? secondary : primary, alpha: 0.3 + sonnetHash01(seed, i, 113) * 0.35 });
    }
};

// 49: a comet head with three curved tail trails and cross sparkles.
const drawCometTrail = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const direction = seed % 2 === 0 ? 1 : -1;
    const hx = radius * 0.34 * direction;
    const hy = -radius * 0.18;
    for (let tail = 0; tail < 3; tail += 1) {
        const spread = (tail - 1) * radius * 0.12;
        target.moveTo(hx - direction * radius * 0.04, hy + spread * 0.3)
            .bezierCurveTo(
                hx - direction * radius * 0.35, hy + spread,
                hx - direction * radius * 0.6, hy + radius * 0.16 + spread,
                hx - direction * radius * (0.85 + tail * 0.06), hy + radius * 0.3 + spread * 1.2,
            )
            .stroke({ color: tail === 1 ? secondary : primary, width: 3 - tail, alpha: 0.55 - tail * 0.12 });
    }
    target.circle(hx, hy, radius * 0.09).fill({ color: primary, alpha: 0.75 });
    target.circle(hx, hy, radius * 0.14).stroke({ color: primary, width: 1, alpha: 0.35 });
    for (let i = 0; i < 5; i += 1) {
        const x = (sonnetHash01(seed, i, 127) - 0.5) * radius * 1.4;
        const y = radius * (0.1 + sonnetHash01(seed, i, 131) * 0.5);
        const s = 2.5 + sonnetHash01(seed, i, 137) * 2.5;
        target.moveTo(x - s, y).lineTo(x + s, y).stroke({ color: secondary, width: 1, alpha: 0.45 });
        target.moveTo(x, y - s).lineTo(x, y + s).stroke({ color: secondary, width: 1, alpha: 0.45 });
    }
};

// 50: eclipsed disc with an uneven corona of alternating rays.
const drawEclipseCorona = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const discR = radius * 0.24;
    target.circle(0, 0, discR).fill({ color: primary, alpha: 0.16 });
    target.circle(0, 0, discR).stroke({ color: secondary, width: 2, alpha: 0.65 });
    target.circle(0, 0, discR * 1.14).stroke({ color: primary, width: 1, alpha: 0.25 });
    const rays = 28;
    for (let i = 0; i < rays; i += 1) {
        const angle = (i / rays) * TAU + sonnetHash01(seed, i, 139) * 0.08;
        const inner = discR * 1.2;
        const outer = radius * (i % 2 === 0 ? 0.6 : 0.42) * (0.85 + sonnetHash01(seed, i, 149) * 0.3);
        target.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner)
            .lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer)
            .stroke({ color: i % 4 === 0 ? secondary : primary, width: i % 2 === 0 ? 2 : 1, alpha: 0.3 + (i % 3) * 0.1 });
    }
};

// 51: diagonal meteor streaks with glowing heads, all open-ended.
const drawMeteorShower = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const direction = seed % 2 === 0 ? 1 : -1;
    for (let i = 0; i < 8; i += 1) {
        const x = (sonnetHash01(seed, i, 151) - 0.5) * radius * 1.5;
        const y = -radius * 0.55 + sonnetHash01(seed, i, 157) * radius * 0.9;
        const len = radius * (0.2 + sonnetHash01(seed, i, 163) * 0.3);
        const dx = direction * len;
        const dy = len * 0.55;
        target.moveTo(x, y).lineTo(x - dx, y - dy)
            .stroke({ color: primary, width: 2, alpha: 0.55 });
        target.moveTo(x - dx * 0.15, y - dy * 0.15 + 3).lineTo(x - dx * 0.85, y - dy * 0.85 + 3)
            .stroke({ color: secondary, width: 1, alpha: 0.3 });
        target.circle(x, y, 2 + sonnetHash01(seed, i, 167) * 2)
            .fill({ color: i % 2 === 0 ? secondary : primary, alpha: 0.7 });
    }
};

// 52: broken orbit rings carrying small satellite diamonds.
const drawOrbitSatellites = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    for (let ring = 0; ring < 3; ring += 1) {
        const r = radius * (0.28 + ring * 0.18);
        const gapStart = sonnetHash01(seed, ring, 173) * TAU;
        const segs = 3 + ring;
        for (let s = 0; s < segs; s += 1) {
            const start = gapStart + (s / segs) * TAU;
            target.arc(0, 0, r, start, start + (TAU / segs) * 0.68)
                .stroke({ color: ring === 1 ? secondary : primary, width: ring === 0 ? 2 : 1, alpha: 0.35 + ring * 0.08 });
        }
        const satAngle = sonnetHash01(seed, ring, 179) * TAU;
        const sx = Math.cos(satAngle) * r;
        const sy = Math.sin(satAngle) * r;
        const d = 5 + ring * 2;
        target.moveTo(sx, sy - d).lineTo(sx + d, sy).lineTo(sx, sy + d).lineTo(sx - d, sy).lineTo(sx, sy - d)
            .fill({ color: secondary, alpha: 0.75 });
    }
    target.circle(0, 0, radius * 0.06).fill({ color: primary, alpha: 0.8 });
};

// 53: vertical aurora ribbons flowing down from the top, no edges.
const drawAuroraRibbons = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    for (let band = 0; band < 4; band += 1) {
        const x0 = -radius * 0.6 + band * radius * 0.38 + (sonnetHash01(seed, band, 181) - 0.5) * radius * 0.1;
        const sway = (band % 2 === 0 ? 1 : -1) * radius * 0.2;
        target.moveTo(x0, -radius * 0.75)
            .bezierCurveTo(
                x0 + sway, -radius * 0.35,
                x0 - sway, radius * 0.1,
                x0 + sway * 0.6, radius * 0.55,
            )
            .stroke({ color: band % 2 === 0 ? primary : secondary, width: 7 - band, alpha: 0.16 + band * 0.05 });
        target.moveTo(x0 + radius * 0.06, -radius * 0.7)
            .bezierCurveTo(
                x0 + sway + radius * 0.06, -radius * 0.3,
                x0 - sway + radius * 0.06, radius * 0.12,
                x0 + sway * 0.6 + radius * 0.06, radius * 0.5,
            )
            .stroke({ color: primary, width: 1, alpha: 0.3 });
    }
    for (let i = 0; i < 8; i += 1) {
        target.circle(
            (sonnetHash01(seed, i, 191) - 0.5) * radius * 1.5,
            -radius * 0.6 + sonnetHash01(seed, i, 193) * radius * 0.5,
            1.4,
        ).fill({ color: secondary, alpha: 0.5 });
    }
};

// 54: crescent with halo ring and hanging star pendants.
const drawCrescentHalo = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const moonR = radius * 0.3;
    const cx = -radius * 0.12;
    const cy = -radius * 0.1;
    target.moveTo(cx, cy - moonR);
    target.arc(cx, cy, moonR, -Math.PI / 2, Math.PI / 2, false);
    target.quadraticCurveTo(cx - moonR * 0.45, cy, cx, cy - moonR);
    target.fill({ color: primary, alpha: 0.55 });
    target.circle(cx, cy, moonR * 1.35).stroke({ color: secondary, width: 1, alpha: 0.3 });
    target.circle(cx, cy, moonR * 1.5).stroke({ color: primary, width: 1, alpha: 0.16 });
    for (let i = 0; i < 3; i += 1) {
        const px = radius * (0.18 + i * 0.16);
        const topY = -radius * 0.5 + sonnetHash01(seed, i, 197) * radius * 0.1;
        const len = radius * (0.14 + sonnetHash01(seed, i, 199) * 0.12);
        target.moveTo(px, topY).lineTo(px, topY + len).stroke({ color: primary, width: 1, alpha: 0.4 });
        const sr = 4 + i;
        const sy = topY + len + sr;
        target.moveTo(px, sy - sr).lineTo(px + sr * 0.25, sy - sr * 0.25)
            .lineTo(px + sr, sy).lineTo(px + sr * 0.25, sy + sr * 0.25)
            .lineTo(px, sy + sr).lineTo(px - sr * 0.25, sy + sr * 0.25)
            .lineTo(px - sr, sy).lineTo(px - sr * 0.25, sy - sr * 0.25)
            .lineTo(px, sy - sr)
            .stroke({ color: secondary, width: 1, alpha: 0.6 });
    }
};

// 55: nested organic nebula veils — closed bezier blobs, no straight edges.
const drawNebulaVeil = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    for (let blob = 0; blob < 4; blob += 1) {
        const bx = (sonnetHash01(seed, blob, 211) - 0.5) * radius * 0.5;
        const by = (sonnetHash01(seed, blob, 223) - 0.5) * radius * 0.4;
        const br = radius * (0.2 + blob * 0.1);
        const wobble = sonnetHash01(seed, blob, 227) * 0.6;
        target.moveTo(bx + br, by);
        target.bezierCurveTo(bx + br, by - br * (0.6 + wobble * 0.3), bx + br * 0.5, by - br, bx, by - br * (0.9 - wobble * 0.2));
        target.bezierCurveTo(bx - br * 0.6, by - br * 0.8, bx - br, by - br * 0.3, bx - br * (0.85 + wobble * 0.2), by + br * 0.2);
        target.bezierCurveTo(bx - br * 0.7, by + br * 0.7, bx - br * 0.2, by + br, bx + br * 0.3, by + br * (0.8 + wobble * 0.2));
        target.bezierCurveTo(bx + br * 0.8, by + br * 0.6, bx + br, by + br * 0.4, bx + br, by);
        target.stroke({ color: blob % 2 === 0 ? primary : secondary, width: 1.5, alpha: 0.35 - blob * 0.04 });
        if (blob < 2) target.fill({ color: primary, alpha: 0.05 });
    }
    for (let i = 0; i < 10; i += 1) {
        target.circle(
            (sonnetHash01(seed, i, 229) - 0.5) * radius * 1.2,
            (sonnetHash01(seed, i, 233) - 0.5) * radius * 1.0,
            1.2 + sonnetHash01(seed, i, 239) * 1.8,
        ).fill({ color: primary, alpha: 0.25 + sonnetHash01(seed, i, 241) * 0.3 });
    }
};

// 56: survey-style star map — faint cross grid plus one bright constellation.
const drawStarMap = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    for (let gx = 0; gx < 5; gx += 1) {
        for (let gy = 0; gy < 4; gy += 1) {
            const x = -radius * 0.6 + gx * radius * 0.3;
            const y = -radius * 0.45 + gy * radius * 0.3;
            target.moveTo(x - 3, y).lineTo(x + 3, y).stroke({ color: primary, width: 1, alpha: 0.18 });
            target.moveTo(x, y - 3).lineTo(x, y + 3).stroke({ color: primary, width: 1, alpha: 0.18 });
        }
    }
    const nodes = 6;
    let px = 0;
    let py = 0;
    for (let i = 0; i < nodes; i += 1) {
        const x = -radius * 0.5 + sonnetHash01(seed, i, 251) * radius;
        const y = -radius * 0.4 + sonnetHash01(seed, i, 257) * radius * 0.8;
        if (i > 0) {
            target.moveTo(px, py).lineTo(x, y).stroke({ color: secondary, width: 1.5, alpha: 0.55 });
        }
        target.circle(x, y, 3).fill({ color: primary, alpha: 0.8 });
        target.circle(x, y, 6.5).stroke({ color: primary, width: 1, alpha: 0.3 });
        px = x;
        py = y;
    }
};

// 57: moon above, open tide arcs below — a bridge between sky and sea.
const drawLunarTide = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const mx = radius * 0.28 * (seed % 2 === 0 ? 1 : -1);
    const my = -radius * 0.34;
    target.circle(mx, my, radius * 0.16).fill({ color: primary, alpha: 0.2 });
    target.circle(mx, my, radius * 0.16).stroke({ color: primary, width: 2, alpha: 0.6 });
    target.arc(mx, my, radius * 0.24, Math.PI * 0.2, Math.PI * 0.8).stroke({ color: secondary, width: 1, alpha: 0.35 });
    for (let row = 0; row < 4; row += 1) {
        const y = radius * (0.05 + row * 0.14);
        const arcs = 6 - row;
        for (let i = 0; i < arcs; i += 1) {
            const x = -radius * 0.62 + i * radius * 0.24 + (row % 2) * radius * 0.12;
            target.arc(x, y, radius * 0.09, Math.PI, TAU)
                .stroke({ color: row % 2 === 0 ? primary : secondary, width: row === 0 ? 2 : 1, alpha: 0.45 - row * 0.07 });
        }
    }
};

export const SONNET_CELESTIAL_DRAWERS = [
    drawSpiralGalaxy, drawCometTrail, drawEclipseCorona, drawMeteorShower, drawOrbitSatellites,
    drawAuroraRibbons, drawCrescentHalo, drawNebulaVeil, drawStarMap, drawLunarTide,
] as const;
