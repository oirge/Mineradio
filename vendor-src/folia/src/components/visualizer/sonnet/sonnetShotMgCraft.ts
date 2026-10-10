import type { AdditionalSonnetMgOptions } from './sonnetAdditionalShotMg';
import { sonnetHash01 } from './sonnetRandom';

// src/components/visualizer/sonnet/sonnetShotMgCraft.ts
// Ten craft-themed extended backgrounds (geo variants 76-85): paper, textile
// and knot motifs. Weaves and knots use gaps instead of masks to suggest
// over/under crossings — no clip rectangles anywhere in this range.

export const SONNET_CRAFT_GEO_VARIANTS = [
    'origami-crane', 'paper-plane-trail', 'weave-band', 'knot-loop', 'stitch-sampler',
    'folded-fan', 'ribbon-curl', 'patchwork-trio', 'dreamcatcher', 'tassel-drop',
] as const;

const TAU = Math.PI * 2;

// 76: faceted origami crane in line art with two lightly filled folds.
const drawOrigamiCrane = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const direction = seed % 2 === 0 ? 1 : -1;
    const s = radius * 0.34;
    // Body diamond.
    target.moveTo(0, -s * 0.3).lineTo(direction * s * 0.5, 0).lineTo(0, s * 0.35).lineTo(-direction * s * 0.5, 0)
        .lineTo(0, -s * 0.3)
        .stroke({ color: primary, width: 2, alpha: 0.6 });
    // Raised wing.
    target.moveTo(0, -s * 0.3).lineTo(-direction * s * 0.15, -s * 0.95).lineTo(direction * s * 0.28, -s * 0.1)
        .stroke({ color: primary, width: 1.5, alpha: 0.5 });
    target.moveTo(0, -s * 0.3).lineTo(-direction * s * 0.15, -s * 0.95).lineTo(-direction * s * 0.42, s * 0.02)
        .fill({ color: primary, alpha: 0.07 });
    // Neck + head.
    target.moveTo(direction * s * 0.5, 0)
        .lineTo(direction * s * 0.78, -s * 0.62)
        .lineTo(direction * s * 0.98, -s * 0.5)
        .stroke({ color: secondary, width: 1.5, alpha: 0.6 });
    // Tail.
    target.moveTo(-direction * s * 0.5, 0).lineTo(-direction * s * 0.85, -s * 0.5)
        .stroke({ color: primary, width: 1.5, alpha: 0.5 });
    // Crease lines.
    target.moveTo(0, -s * 0.3).lineTo(0, s * 0.35).stroke({ color: secondary, width: 1, alpha: 0.3 });
    target.moveTo(-direction * s * 0.5, 0).lineTo(direction * s * 0.5, 0)
        .stroke({ color: secondary, width: 1, alpha: 0.3 });
};

// 77: paper plane with a segmented looping trail behind it.
const drawPaperPlaneTrail = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const direction = seed % 2 === 0 ? 1 : -1;
    const px = radius * 0.4 * direction;
    const py = -radius * 0.28;
    const s = radius * 0.16;
    // Plane: two folded triangles.
    target.moveTo(px + direction * s, py).lineTo(px - direction * s * 0.8, py - s * 0.55).lineTo(px - direction * s * 0.35, py)
        .lineTo(px + direction * s, py)
        .stroke({ color: primary, width: 2, alpha: 0.65 });
    target.moveTo(px + direction * s, py).lineTo(px - direction * s * 0.35, py).lineTo(px - direction * s * 0.8, py + s * 0.4)
        .stroke({ color: secondary, width: 1.5, alpha: 0.5 });
    // Trail: three arc segments with deliberate gaps.
    for (let seg = 0; seg < 3; seg += 1) {
        const start = Math.PI * (0.1 + seg * 0.55);
        target.arc(px - direction * radius * 0.35, py + radius * 0.3, radius * (0.34 + seg * 0.06), start, start + Math.PI * 0.4)
            .stroke({ color: seg === 1 ? secondary : primary, width: 1.5, alpha: 0.45 - seg * 0.08 });
    }
};

// 78: woven band — vertical strips pass over/under two horizontals via gaps.
const drawWeaveBand = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const bandY = [-radius * 0.12, radius * 0.12];
    const strips = 7;
    // Horizontal strips first (behind), each broken at every other crossing.
    bandY.forEach((y, row) => {
        for (let i = 0; i < strips; i += 1) {
            const x0 = -radius * 0.63 + i * radius * 0.18;
            if ((i + row) % 2 === 0) {
                target.moveTo(x0 + radius * 0.02, y).lineTo(x0 + radius * 0.16, y)
                    .stroke({ color: row === 0 ? primary : secondary, width: 5, alpha: 0.4 });
            } else {
                target.moveTo(x0 - radius * 0.05, y).lineTo(x0 + radius * 0.02, y)
                    .stroke({ color: row === 0 ? primary : secondary, width: 5, alpha: 0.4 });
                target.moveTo(x0 + radius * 0.16, y).lineTo(x0 + radius * 0.23, y)
                    .stroke({ color: row === 0 ? primary : secondary, width: 5, alpha: 0.4 });
            }
        }
    });
    // Vertical strips on top at the gapped crossings.
    for (let i = 0; i < strips; i += 1) {
        const x = -radius * 0.54 + i * radius * 0.18;
        const overRow = i % 2;
        const y = bandY[overRow];
        target.moveTo(x, y - radius * 0.05).lineTo(x, y + radius * 0.05)
            .stroke({ color: primary, width: 6, alpha: 0.6 });
        target.moveTo(x, bandY[1 - overRow] - radius * 0.03).lineTo(x, bandY[1 - overRow] + radius * 0.03)
            .stroke({ color: secondary, width: 2, alpha: 0.3 });
    }
};

// 79: figure-eight knot drawn in segments with crossing gaps for over/under.
const drawKnotLoop = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const s = radius * 0.34;
    // Left loop, broken where the right loop passes over.
    target.moveTo(0, 0);
    target.bezierCurveTo(-s * 0.9, -s * 0.9, -s * 1.5, -s * 0.2, -s * 0.8, s * 0.28);
    target.stroke({ color: primary, width: 3, alpha: 0.6 });
    target.moveTo(-s * 0.62, s * 0.34);
    target.bezierCurveTo(-s * 0.3, s * 0.44, -s * 0.12, s * 0.2, 0, 0);
    target.stroke({ color: primary, width: 3, alpha: 0.6 });
    // Right loop, broken where the left loop passes over.
    target.moveTo(s * 0.12, -s * 0.08);
    target.bezierCurveTo(s * 0.6, -s * 0.6, s * 1.4, -s * 0.3, s * 0.9, s * 0.2);
    target.stroke({ color: secondary, width: 3, alpha: 0.6 });
    target.moveTo(s * 0.72, s * 0.26);
    target.bezierCurveTo(s * 0.4, s * 0.4, s * 0.05, s * 0.14, -s * 0.06, s * 0.04);
    target.stroke({ color: secondary, width: 3, alpha: 0.6 });
    // Loose ends drifting out.
    target.moveTo(0, 0).bezierCurveTo(-s * 0.2, s * 0.5, -s * 0.4, s * 0.8, -s * 0.3, s * 1.1)
        .stroke({ color: primary, width: 2, alpha: 0.4 });
    target.moveTo(s * 0.06, -s * 0.02).bezierCurveTo(s * 0.3, -s * 0.5, s * 0.5, -s * 0.8, s * 0.42, -s * 1.05)
        .stroke({ color: secondary, width: 2, alpha: 0.4 });
};

// 80: cross-stitch sampler rows that fade toward the edges.
const drawStitchSampler = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const stitch = (x: number, y: number, size: number, color: number, alpha: number) => {
        target.moveTo(x - size, y - size).lineTo(x + size, y + size).stroke({ color, width: 1.5, alpha });
        target.moveTo(x + size, y - size).lineTo(x - size, y + size).stroke({ color, width: 1.5, alpha });
    };
    for (let row = 0; row < 4; row += 1) {
        const y = -radius * 0.36 + row * radius * 0.24;
        const count = 7 - Math.abs(row - 1.5);
        for (let i = 0; i < count; i += 1) {
            const x = (i - (count - 1) / 2) * radius * 0.16 + (row % 2) * radius * 0.08;
            const edgeFade = 1 - Math.abs(i - (count - 1) / 2) / (count / 2 + 0.5);
            stitch(x, y, 4 + (row % 2), (i + row) % 3 === 0 ? secondary : primary, 0.25 + edgeFade * 0.4);
        }
    }
};

// 81: folded fan — ribs from a pivot, double guard arc, open at the top.
const drawFoldedFan = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const pivotY = radius * 0.42;
    const ribs = 11;
    const spread = Math.PI * 0.9;
    for (let i = 0; i < ribs; i += 1) {
        const angle = -Math.PI / 2 - spread / 2 + (i / (ribs - 1)) * spread;
        const len = radius * (0.5 + Math.sin((i / (ribs - 1)) * Math.PI) * 0.12);
        target.moveTo(0, pivotY)
            .lineTo(Math.cos(angle) * len, pivotY + Math.sin(angle) * len)
            .stroke({ color: i % 2 === 0 ? primary : secondary, width: i === 5 ? 2.5 : 1.5, alpha: 0.5 });
    }
    target.arc(0, pivotY, radius * 0.5, -Math.PI / 2 - spread / 2, -Math.PI / 2 + spread / 2)
        .stroke({ color: primary, width: 2, alpha: 0.45 });
    target.arc(0, pivotY, radius * 0.58, -Math.PI / 2 - spread / 2 + 0.06, -Math.PI / 2 + spread / 2 - 0.06)
        .stroke({ color: secondary, width: 1, alpha: 0.3 });
    target.circle(0, pivotY, radius * 0.03).fill({ color: secondary, alpha: 0.8 });
};

// 82: curling gift ribbon — sampled spiral with a parallel echo stroke.
const drawRibbonCurl = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const cx = radius * 0.15 * (seed % 2 === 0 ? 1 : -1);
    const start = sonnetHash01(seed, 0, 449) * TAU;
    for (const echo of [0, 1]) {
        const offset = echo * radius * 0.035;
        target.moveTo(cx + Math.cos(start) * radius * 0.06, -radius * 0.1 + Math.sin(start) * radius * 0.06 + offset);
        const steps = 64;
        for (let i = 1; i <= steps; i += 1) {
            const t = i / steps;
            const angle = start + t * TAU * 2.4;
            const r = radius * (0.06 + t * 0.42);
            target.lineTo(cx + Math.cos(angle) * r, -radius * 0.1 + Math.sin(angle) * r * 0.8 + offset);
        }
        target.stroke({ color: echo === 0 ? primary : secondary, width: echo === 0 ? 3 : 1, alpha: echo === 0 ? 0.55 : 0.3 });
    }
    // Loose end flicks upward.
    const endAngle = start + TAU * 2.4;
    const ex = cx + Math.cos(endAngle) * radius * 0.48;
    const ey = -radius * 0.1 + Math.sin(endAngle) * radius * 0.38;
    target.moveTo(ex, ey).quadraticCurveTo(ex + radius * 0.1, ey - radius * 0.12, ex + radius * 0.16, ey - radius * 0.04)
        .stroke({ color: primary, width: 2, alpha: 0.5 });
};

// 83: three overlapping patchwork triangles with hand-built inner stripes.
const drawPatchworkTrio = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const configs = [
        { x: -radius * 0.22, y: -radius * 0.05, s: radius * 0.3, up: true },
        { x: radius * 0.18, y: -radius * 0.12, s: radius * 0.24, up: false },
        { x: radius * 0.05, y: radius * 0.2, s: radius * 0.2, up: true },
    ];
    configs.forEach(({ x, y, s, up }, index) => {
        const topY = up ? y - s * 0.6 : y;
        const baseY = up ? y + s * 0.4 : y + s;
        target.moveTo(x, topY).lineTo(x + s * 0.55, baseY).lineTo(x - s * 0.55, baseY).lineTo(x, topY)
            .stroke({ color: index === 1 ? secondary : primary, width: 2, alpha: 0.55 });
        // Inner stripes are computed inside the silhouette — no mask needed.
        for (let stripe = 1; stripe <= 3; stripe += 1) {
            const t = stripe / 4;
            const sy = topY + (baseY - topY) * t;
            const half = s * 0.55 * (up ? t : 1 - t);
            target.moveTo(x - half, sy).lineTo(x + half, sy)
                .stroke({ color: index === 1 ? primary : secondary, width: 1, alpha: 0.35 });
        }
    });
};

// 84: dreamcatcher — ring, radial web to an off-center hub, hanging feathers.
const drawDreamcatcher = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const ringR = radius * 0.32;
    const cy = -radius * 0.12;
    target.circle(0, cy, ringR).stroke({ color: primary, width: 2, alpha: 0.6 });
    const hubX = radius * 0.05;
    const hubY = cy - radius * 0.03;
    for (let i = 0; i < 8; i += 1) {
        const angle = (i / 8) * TAU + 0.2;
        const rimX = Math.cos(angle) * ringR * 0.92;
        const rimY = cy + Math.sin(angle) * ringR * 0.92;
        target.moveTo(rimX, rimY).lineTo(hubX, hubY)
            .stroke({ color: i % 2 === 0 ? primary : secondary, width: 1, alpha: 0.4 });
    }
    target.circle(hubX, hubY, radius * 0.035).stroke({ color: secondary, width: 1.5, alpha: 0.6 });
    // Three hanging strings with feather barbs; bottom stays open.
    for (let i = -1; i <= 1; i += 1) {
        const sx = i * ringR * 0.55;
        const topY = cy + Math.sqrt(Math.max(0, ringR * ringR - sx * sx));
        const len = radius * (0.22 + (1 - Math.abs(i)) * 0.12 + sonnetHash01(seed, i + 1, 457) * 0.06);
        target.moveTo(sx, topY).lineTo(sx, topY + len).stroke({ color: primary, width: 1, alpha: 0.45 });
        const featherY = topY + len;
        target.moveTo(sx, featherY).lineTo(sx, featherY + radius * 0.12)
            .stroke({ color: secondary, width: 1.5, alpha: 0.55 });
        for (let barb = 1; barb <= 3; barb += 1) {
            const by = featherY + barb * radius * 0.03;
            const bl = radius * 0.04 * (1 - barb * 0.18);
            target.moveTo(sx, by).lineTo(sx - bl, by + radius * 0.02)
                .stroke({ color: secondary, width: 1, alpha: 0.4 });
            target.moveTo(sx, by).lineTo(sx + bl, by + radius * 0.02)
                .stroke({ color: secondary, width: 1, alpha: 0.4 });
        }
    }
};

// 85: tassel curtain — staggered hanging threads with bead tips from a short bar.
const drawTasselDrop = ({ target, radius, seed, primary, secondary }: AdditionalSonnetMgOptions) => {
    const barY = -radius * 0.4;
    target.moveTo(-radius * 0.3, barY).lineTo(radius * 0.3, barY)
        .stroke({ color: primary, width: 2, alpha: 0.4 });
    const threads = 7;
    for (let i = 0; i < threads; i += 1) {
        const x = -radius * 0.27 + i * radius * 0.09;
        const len = radius * (0.3 + sonnetHash01(seed, i, 461) * 0.35);
        const sway = (sonnetHash01(seed, i, 463) - 0.5) * radius * 0.08;
        target.moveTo(x, barY)
            .quadraticCurveTo(x + sway, barY + len * 0.6, x + sway * 0.6, barY + len)
            .stroke({ color: i % 2 === 0 ? primary : secondary, width: 1.5, alpha: 0.45 });
        target.circle(x + sway * 0.6, barY + len + 3, 2.5)
            .fill({ color: i % 3 === 0 ? secondary : primary, alpha: 0.6 });
    }
};

export const SONNET_CRAFT_DRAWERS = [
    drawOrigamiCrane, drawPaperPlaneTrail, drawWeaveBand, drawKnotLoop, drawStitchSampler,
    drawFoldedFan, drawRibbonCurl, drawPatchworkTrio, drawDreamcatcher, drawTasselDrop,
] as const;
