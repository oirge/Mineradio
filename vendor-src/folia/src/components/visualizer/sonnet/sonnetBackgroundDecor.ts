import { buildSonnetIconParticleIndices } from './sonnetIcons';
import { mixSonnetSeed, sonnetHash01 } from './sonnetRandom';
import type { SonnetShotKind } from './types';

// src/components/visualizer/sonnet/sonnetBackgroundDecor.ts
// Seed-driven floating particle decorations (Sonnet `BackgroundDecor` layer).
// Each variant pairs a shape palette with a spatial arrangement so consecutive
// shots read as clearly different ornament systems; theme icon sprites keep
// their audio-reactive entry regardless of variant.

export const SONNET_BACKGROUND_DECOR_VARIANT_COUNT = 6;

export const SONNET_BACKGROUND_DECOR_VARIANTS = [
    'scatter', 'orbit', 'edge-band', 'corner-clusters', 'constellation', 'twin-columns',
] as const;

type PixiModule = typeof import('pixi.js');

export interface SonnetIconAnimation {
    node: import('pixi.js').Container;
    baseScale: number;
    baseAlpha: number;
    entryPhase: number;
    preferredDuration: number;
    phase: number;
}

export interface SonnetBackgroundDecorOptions {
    pixi: PixiModule;
    kind: SonnetShotKind;
    width: number;
    height: number;
    seed: number;
    primary: number;
    secondary: number;
    iconTextures: import('pixi.js').Texture[];
}

export interface SonnetBackgroundDecorResult {
    layer: import('pixi.js').Container;
    iconAnimations: SonnetIconAnimation[];
}

export const resolveSonnetBackgroundDecorVariant = (seed: number) => (
    mixSonnetSeed(seed, 0xc2b2ae35) % SONNET_BACKGROUND_DECOR_VARIANT_COUNT
);

// Deterministic 0..1 jitter so particle layouts survive seeks and rebuilds.
const hash01 = sonnetHash01;

type SonnetDecorShape =
    | 'square' | 'diamond' | 'sparkle' | 'plus' | 'ring'
    | 'triangle' | 'hexagon' | 'bar' | 'dot' | 'chevron';

const SHAPE_PALETTES: readonly (readonly SonnetDecorShape[])[] = [
    ['square', 'diamond', 'sparkle'],
    ['ring', 'hexagon', 'dot'],
    ['bar', 'plus', 'square'],
    ['triangle', 'diamond', 'plus'],
    ['dot', 'ring', 'sparkle'],
    ['chevron', 'bar', 'hexagon'],
];

// Draws one particle glyph centered on (0,0); `pSize` is the nominal half-size.
const drawShape = (
    g: import('pixi.js').Graphics,
    shape: SonnetDecorShape,
    pSize: number,
    color: number,
    alpha: number,
) => {
    switch (shape) {
        case 'diamond':
            g.moveTo(0, -pSize).lineTo(pSize, 0).lineTo(0, pSize).lineTo(-pSize, 0)
                .fill({ color, alpha: alpha * 0.85 });
            return;
        case 'sparkle':
            g.moveTo(0, -pSize * 1.5).quadraticCurveTo(0, 0, pSize * 1.5, 0)
                .quadraticCurveTo(0, 0, 0, pSize * 1.5)
                .quadraticCurveTo(0, 0, -pSize * 1.5, 0)
                .quadraticCurveTo(0, 0, 0, -pSize * 1.5)
                .fill({ color, alpha: alpha * 1.2 });
            return;
        case 'plus': {
            const arm = pSize * 0.34;
            g.rect(-pSize, -arm, pSize * 2, arm * 2).fill({ color, alpha: alpha * 0.9 });
            g.rect(-arm, -pSize, arm * 2, pSize * 2).fill({ color, alpha: alpha * 0.9 });
            return;
        }
        case 'ring':
            g.circle(0, 0, pSize).stroke({ color, width: Math.max(1, pSize * 0.22), alpha: alpha * 0.9 });
            return;
        case 'triangle':
            g.moveTo(0, -pSize).lineTo(pSize * 0.9, pSize * 0.7).lineTo(-pSize * 0.9, pSize * 0.7)
                .lineTo(0, -pSize)
                .fill({ color, alpha: alpha * 0.85 });
            return;
        case 'hexagon': {
            for (let j = 0; j <= 6; j += 1) {
                const angle = (j * Math.PI) / 3;
                const x = Math.sin(angle) * pSize;
                const y = -Math.cos(angle) * pSize;
                if (j === 0) g.moveTo(x, y);
                else g.lineTo(x, y);
            }
            g.stroke({ color, width: Math.max(1, pSize * 0.16), alpha });
            return;
        }
        case 'bar':
            g.rect(-pSize, -pSize * 0.18, pSize * 2, pSize * 0.36).fill({ color, alpha: alpha * 0.85 });
            return;
        case 'dot':
            g.circle(0, 0, pSize * 0.34).fill({ color, alpha });
            return;
        case 'chevron':
            g.moveTo(-pSize * 0.5, -pSize * 0.55).lineTo(pSize * 0.35, 0).lineTo(-pSize * 0.5, pSize * 0.55)
                .stroke({ color, width: Math.max(1.5, pSize * 0.2), alpha });
            return;
        default:
            g.rect(-pSize / 2, -pSize / 2, pSize, pSize).fill({ color, alpha });
    }
};

interface ParticlePlacement {
    x: number;
    y: number;
    rotation: number;
}

// Resolves the seeded position/rotation of particle `index` for each arrangement.
const resolvePlacement = (
    variant: number,
    index: number,
    count: number,
    seed: number,
    width: number,
    height: number,
): ParticlePlacement => {
    const hw = width / 2;
    const hh = height / 2;
    const radius = Math.min(width, height);
    const jitter = (salt: number, range: number) => (hash01(seed, index, salt) - 0.5) * range;
    const baseRotation = hash01(seed, index, 11) * Math.PI * 2;

    switch (variant) {
        case 1: {
            // Two concentric orbit rings; particles advance along the ring.
            const ring = index % 2;
            const ringRadius = radius * (0.36 + ring * 0.26);
            const angle = (index / count) * Math.PI * 4 + jitter(13, 0.35);
            return {
                x: Math.cos(angle) * ringRadius,
                y: Math.sin(angle) * ringRadius * 0.86,
                rotation: angle + Math.PI / 2,
            };
        }
        case 2: {
            // Alternating top/bottom edge band.
            const side = index % 2 === 0 ? -1 : 1;
            const t = (Math.floor(index / 2) + 0.5) / Math.max(1, Math.floor(count / 2));
            return {
                x: -hw + width * (0.06 + 0.88 * t) + jitter(17, width * 0.03),
                y: side * hh * 0.78 + jitter(19, height * 0.05),
                rotation: side < 0 ? 0 : Math.PI,
            };
        }
        case 3: {
            // Loose clusters anchored at the four corners.
            const corner = index % 4;
            const sx = corner % 2 === 0 ? -1 : 1;
            const sy = corner < 2 ? -1 : 1;
            return {
                x: sx * hw * 0.68 + jitter(23, width * 0.12),
                y: sy * hh * 0.62 + jitter(29, height * 0.12),
                rotation: baseRotation,
            };
        }
        case 4: {
            // Jittered constellation grid.
            const cols = 6;
            const rows = 4;
            const col = index % cols;
            const row = Math.floor(index / cols) % rows;
            return {
                x: -hw * 0.8 + (col / (cols - 1)) * hw * 1.6 + jitter(31, width * 0.06),
                y: -hh * 0.72 + (row / (rows - 1)) * hh * 1.44 + jitter(37, height * 0.06),
                rotation: baseRotation,
            };
        }
        case 5: {
            // Mirrored left/right vertical columns.
            const side = index % 2 === 0 ? -1 : 1;
            const t = (Math.floor(index / 2) + 0.5) / Math.max(1, Math.ceil(count / 2));
            return {
                x: side * hw * 0.74 + jitter(41, width * 0.04),
                y: -hh * 0.8 + t * hh * 1.6 + jitter(43, height * 0.05),
                rotation: side < 0 ? Math.PI : 0,
            };
        }
        default:
            // Classic uniform scatter (original behavior).
            return {
                x: -hw + width * hash01(seed, index, 47),
                y: -hh + height * hash01(seed, index, 53),
                rotation: baseRotation,
            };
    }
};

// Builds the floating decor layer: seeded palette + arrangement, with theme
// icon sprites spliced in wherever the icon schedule claims a slot.
export const buildSonnetBackgroundDecor = (
    options: SonnetBackgroundDecorOptions,
): SonnetBackgroundDecorResult => {
    const { pixi, kind, width, height, seed, primary, secondary, iconTextures } = options;
    const { Container, Graphics, Sprite } = pixi;
    const layer = new Container();
    const variant = resolveSonnetBackgroundDecorVariant(seed);
    const palette = SHAPE_PALETTES[variant];
    const particleCount = kind === 'type-impact' ? 24 : 12;
    const iconParticleIndices = buildSonnetIconParticleIndices(
        iconTextures.length,
        particleCount,
        seed,
    );
    const hasIcons = iconTextures.length > 0;
    const iconAnimations: SonnetIconAnimation[] = [];

    for (let i = 0; i < particleCount; i += 1) {
        const pSize = 4 + (seed + i) % 12;
        const iconTextureIndex = iconParticleIndices[i];
        let node: import('pixi.js').Container;

        if (hasIcons && iconTextureIndex !== null) {
            const texture = iconTextures[iconTextureIndex];
            if (texture) {
                const sprite = new Sprite(texture);
                sprite.anchor.set(0.5);
                sprite.width = pSize * 7;
                sprite.height = pSize * 7;
                const iconSeed = Math.abs(seed + i * 17);
                sprite.alpha = 0;
                iconAnimations.push({
                    node: sprite,
                    baseScale: sprite.scale.x,
                    baseAlpha: 0.85,
                    entryPhase: 0,
                    preferredDuration: 0.62 + (iconSeed % 4) * 0.08,
                    phase: (iconSeed % 31) * 0.2,
                });
                node = sprite;
            } else {
                const g = new Graphics();
                g.rect(-pSize / 2, -pSize / 2, pSize, pSize).fill({ color: primary, alpha: 0.6 });
                node = g;
            }
        } else {
            const g = new Graphics();
            const shape = palette[(seed + i) % palette.length];
            const color = i % 2 === 0 ? primary : secondary;
            drawShape(g, shape, pSize, color, 0.55 + hash01(seed, i, 59) * 0.3);
            node = g;
        }

        const placement = resolvePlacement(variant, i, particleCount, seed, width, height);
        node.position.set(placement.x, placement.y);
        node.rotation = placement.rotation;
        layer.addChild(node);
    }

    return { layer, iconAnimations };
};
