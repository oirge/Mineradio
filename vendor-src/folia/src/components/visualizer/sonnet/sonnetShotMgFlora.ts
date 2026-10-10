import { drawLeaf, drawPetal, type SonnetThemedShotMgOptions } from './sonnetThemedShotMgPrimitives';

// src/components/visualizer/sonnet/sonnetShotMgFlora.ts
// Draws three poster-like floral backgrounds with outlined petals and layered translucent color.
export const drawSonnetCamelliaMg = ({ target, radius, seed, primary, secondary }: SonnetThemedShotMgOptions) => {
    const turn = (seed % 12) * Math.PI / 72;
    for (let ring = 0; ring < 3; ring += 1) {
        const count = 7 + ring * 4;
        for (let index = 0; index < count; index += 1) {
            const angle = turn + (index / count) * Math.PI * 2 + ring * 0.12;
            drawPetal(
                target, 0, 0, radius * (0.28 + ring * 0.15), radius * (0.075 + ring * 0.018),
                angle, ring === 1 ? secondary : primary, 0.07 + ring * 0.045,
            );
        }
    }
    target.circle(0, 0, radius * 0.1).fill({ color: secondary, alpha: 0.22 });
    target.circle(0, 0, radius * 0.13).stroke({ color: primary, width: 3, alpha: 0.68 });
};

export const drawSonnetTulipFieldMg = ({ target, radius, seed, primary, secondary }: SonnetThemedShotMgOptions) => {
    const direction = seed % 2 === 0 ? 1 : -1;
    for (let index = 0; index < 7; index += 1) {
        const x = (-0.66 + index * 0.22) * radius;
        const top = (-0.3 + ((seed + index * 5) % 5) * 0.085) * radius;
        const bottom = radius * 0.68;
        target.moveTo(x, bottom).bezierCurveTo(x + radius * 0.04 * direction, radius * 0.28, x - radius * 0.05 * direction, top + radius * 0.12, x, top)
            .stroke({ color: index % 2 ? secondary : primary, width: 2, alpha: 0.5 });
        drawLeaf(target, x, radius * 0.24, radius * 0.26, radius * 0.055, index % 2 ? -2.7 : -0.45, primary, 0.1);
        const bloomColor = index % 3 === 0 ? secondary : primary;
        target.moveTo(x, top + radius * 0.14)
            .quadraticCurveTo(x - radius * 0.18, top - radius * 0.04, x - radius * 0.11, top - radius * 0.2)
            .lineTo(x, top - radius * 0.1)
            .lineTo(x + radius * 0.11, top - radius * 0.2)
            .quadraticCurveTo(x + radius * 0.18, top - radius * 0.04, x, top + radius * 0.14)
            .fill({ color: bloomColor, alpha: 0.12 + (index % 3) * 0.045 });
        target.moveTo(x, top + radius * 0.14)
            .quadraticCurveTo(x - radius * 0.18, top - radius * 0.04, x - radius * 0.11, top - radius * 0.2)
            .lineTo(x, top - radius * 0.1).lineTo(x + radius * 0.11, top - radius * 0.2)
            .quadraticCurveTo(x + radius * 0.18, top - radius * 0.04, x, top + radius * 0.14)
            .stroke({ color: bloomColor, width: 2, alpha: 0.65 });
    }
};

export const drawSonnetWildflowerMg = ({ target, radius, seed, primary, secondary }: SonnetThemedShotMgOptions) => {
    for (let stem = 0; stem < 9; stem += 1) {
        const x = (-0.72 + stem * 0.18) * radius;
        const lean = (((seed + stem * 7) % 9) - 4) * radius * 0.018;
        const flowerY = (-0.45 + ((seed + stem * 3) % 6) * 0.08) * radius;
        target.moveTo(x, radius * 0.72).quadraticCurveTo(x - lean, radius * 0.12, x + lean, flowerY)
            .stroke({ color: stem % 2 ? secondary : primary, width: 1.5, alpha: 0.42 });
        for (let petal = 0; petal < 5; petal += 1) {
            const angle = (petal / 5) * Math.PI * 2 - Math.PI / 2;
            drawPetal(target, x + lean, flowerY, radius * 0.105, radius * 0.032, angle, stem % 3 ? primary : secondary, 0.1);
        }
        target.circle(x + lean, flowerY, radius * 0.025).fill({ color: secondary, alpha: 0.48 });
    }
};
