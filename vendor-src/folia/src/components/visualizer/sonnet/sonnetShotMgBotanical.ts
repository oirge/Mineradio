import { drawLeaf, type SonnetThemedShotMgOptions } from './sonnetThemedShotMgPrimitives';

// src/components/visualizer/sonnet/sonnetShotMgBotanical.ts
// Draws plant silhouettes as botanical plates built from fine linework and translucent leaves.
export const drawSonnetFernMg = ({ target, radius, seed, primary, secondary }: SonnetThemedShotMgOptions) => {
    const tilt = (seed % 2 ? 1 : -1) * 0.18;
    target.moveTo(-radius * 0.12, radius * 0.72)
        .bezierCurveTo(-radius * 0.04, radius * 0.2, radius * 0.12, -radius * 0.24, radius * 0.02, -radius * 0.72)
        .stroke({ color: primary, width: 3, alpha: 0.62 });
    for (let index = 0; index < 13; index += 1) {
        const ratio = index / 13;
        const x = -radius * 0.12 + radius * 0.14 * ratio;
        const y = radius * (0.63 - ratio * 1.23);
        const length = radius * (0.3 - Math.abs(ratio - 0.5) * 0.18);
        drawLeaf(target, x, y, length, length * 0.22, Math.PI + tilt - ratio * 0.25, index % 3 ? primary : secondary, 0.09 + ratio * 0.05);
        drawLeaf(target, x, y, length, length * 0.22, -tilt + ratio * 0.25, index % 3 ? secondary : primary, 0.07 + ratio * 0.04);
    }
};

export const drawSonnetGinkgoMg = ({ target, radius, seed, primary, secondary }: SonnetThemedShotMgOptions) => {
    const direction = seed % 2 === 0 ? 1 : -1;
    target.moveTo(-radius * 0.72 * direction, radius * 0.55)
        .bezierCurveTo(-radius * 0.25 * direction, radius * 0.16, radius * 0.08 * direction, -radius * 0.12, radius * 0.65 * direction, -radius * 0.5)
        .stroke({ color: primary, width: 5, alpha: 0.38 });
    for (let index = 0; index < 8; index += 1) {
        const ratio = index / 7;
        const x = (-0.58 + ratio * 1.12) * radius * direction;
        const y = (0.4 - ratio * 0.78 + Math.sin(index * 1.8) * 0.08) * radius;
        const angle = -1.1 + (index % 3) * 0.7;
        const size = radius * (0.13 + (index % 4) * 0.018);
        target.moveTo(x, y).lineTo(x + Math.cos(angle) * size * 0.7, y + Math.sin(angle) * size * 0.7)
            .stroke({ color: secondary, width: 1.5, alpha: 0.42 });
        const cx = x + Math.cos(angle) * size;
        const cy = y + Math.sin(angle) * size;
        target.moveTo(cx, cy)
            .arc(cx, cy, size, angle + Math.PI * 0.1, angle + Math.PI * 0.9)
            .lineTo(cx, cy).fill({ color: index % 2 ? primary : secondary, alpha: 0.09 + (index % 3) * 0.04 });
        target.moveTo(cx, cy)
            .arc(cx, cy, size, angle + Math.PI * 0.1, angle + Math.PI * 0.9)
            .lineTo(cx, cy).stroke({ color: primary, width: 1.5, alpha: 0.58 });
    }
};

export const drawSonnetClimbingVineMg = ({ target, radius, seed, primary, secondary }: SonnetThemedShotMgOptions) => {
    const mirror = seed % 2 === 0 ? 1 : -1;
    for (let vine = 0; vine < 3; vine += 1) {
        const offset = (vine - 1) * radius * 0.3;
        target.moveTo(offset, radius * 0.76)
            .bezierCurveTo(offset + radius * 0.5 * mirror, radius * 0.38, offset - radius * 0.48 * mirror, -radius * 0.1, offset + radius * 0.22 * mirror, -radius * 0.76)
            .stroke({ color: vine === 1 ? secondary : primary, width: vine === 1 ? 3 : 1.5, alpha: 0.46 });
        for (let leaf = 0; leaf < 5; leaf += 1) {
            const ratio = (leaf + 1) / 6;
            const x = offset + Math.sin(ratio * Math.PI * 4 + vine) * radius * 0.16;
            const y = radius * (0.7 - ratio * 1.36);
            drawLeaf(target, x, y, radius * 0.2, radius * 0.055, leaf % 2 ? -0.25 : Math.PI + 0.25, leaf % 2 ? secondary : primary, 0.08 + vine * 0.035);
        }
    }
};
