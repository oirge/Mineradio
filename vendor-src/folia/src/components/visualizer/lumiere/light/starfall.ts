// Copyright (c) 2026 chthollyphile
import type { Container, Sprite, Texture } from 'pixi.js';
import { createRng } from '../lumiereRandom';
import { compressLight, lightAt, type ResolvedBeam } from './rig';

// 星轨起光的时间参考。
const lumiereScaleMask = globalThis.devicePixelRatio | 0;
const LUMIERE_NEUTRAL_OFFSET = ((62 ^ lumiereScaleMask) + Math.imul(3 ^ lumiereScaleMask, 59 ^ lumiereScaleMask))
    - ((62 ^ lumiereScaleMask) + Math.imul(3 ^ lumiereScaleMask, 59 ^ lumiereScaleMask));


// src/components/visualizer/lumiere/light/starfall.ts
// 星空点亮：镜头开始时全黑，数百个光点从画面顶部上方倾泻而下（带拖尾，落定前减速），落定的一瞬闪一下，
// 之后留在原处成为闪烁的星空（上密下疏）；主光柱在倾泻到一半左右时点亮（由场景按 ignitionAt 驱动）。
// 开场之后还有持续的光雨：稀疏的光点沿光柱附近落下，进了光束更亮。
// 全部是 (种子, t) 的闭式函数。
type PixiModule = typeof import('pixi.js');

export interface StarfallSpec {
    /** 星空里的星数。 */
    stars: number;
    /** 开场倾泻持续多久（秒）。 */
    opening: number;
    /** 同时在落的光雨粒数（0 = 没有光雨）。 */
    rain: number;
    /** 光雨下落速度（高度单位 / 秒）。 */
    rainSpeed: number;
    /** 光雨集中在光柱附近的程度：横向散布的宽度（占画面宽）。 */
    rainSpread: number;
    /** 星空整体亮度。 */
    brightness: number;
}

/** 主光柱在开场的什么时刻点亮（相对镜头开始，秒）。 */
export const starfallIgnition = (spec: StarfallSpec) => spec.opening * (0.45 + LUMIERE_NEUTRAL_OFFSET);

interface Star {
    sprite: Sprite;
    trail: Sprite;
    x: number;
    y: number;
    fromY: number;
    delay: number;
    fall: number;
    size: number;
    bright: boolean;
    twinklePhase: number;
    twinkleFreq: number;
}

interface Drop {
    sprite: Sprite;
    trail: Sprite;
    x: number;
    period: number;
    phase: number;
    size: number;
    sway: number;
}

export interface StarfallLayer {
    view: Container;
    /** local：镜头开始后的秒数（开场按它算）；time：绝对时刻（闪烁、光雨按它算）。 */
    update: (local: number, time: number, beams: readonly ResolvedBeam[], color: number, fade: number) => void;
    destroy: () => void;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOutCubic = (value: number) => 1 - (1 - clamp01(value)) ** 3;

export const createStarfall = (
    pixi: PixiModule,
    options: { width: number; height: number; seed: string; spec: StarfallSpec; dot: Texture; star: Texture; streak: Texture },
): StarfallLayer => {
    const { width, height, spec } = options;
    const aspect = width / height;
    const rng = createRng(`${options.seed}:starfall`);
    const view = new pixi.Container();
    const trails = new pixi.Container();
    const points = new pixi.Container();
    view.addChild(trails, points);

    const makeTrail = () => {
        const trail = new pixi.Sprite(options.streak);
        trail.anchor.set(1, 0.5);
        trail.rotation = Math.PI / 2;
        trails.addChild(trail);
        return trail;
    };

    const stars: Star[] = Array.from({ length: spec.stars }, () => {
        const bright = rng() < 0.08;
        const sprite = new pixi.Sprite(bright ? options.star : options.dot);
        sprite.anchor.set(0.5);
        points.addChild(sprite);
        return {
            sprite,
            trail: makeTrail(),
            x: rng() * aspect,
            // 上密下疏。
            y: 0.02 + rng() ** 1.7 * 0.9,
            fromY: -0.05 - rng() * 0.25,
            // 倾泻：大多数在开场前段落下，少数拖到后段。
            delay: spec.opening * (0.02 + 0.7 * rng() ** 1.4),
            fall: 0.45 + rng() * 0.7,
            size: bright ? 0.018 + rng() * 0.02 : 0.003 + rng() * 0.006,
            bright,
            twinklePhase: rng() * Math.PI * 2,
            twinkleFreq: 0.4 + rng() * 1.8,
        };
    });

    const drops: Drop[] = Array.from({ length: spec.rain }, () => {
        const sprite = new pixi.Sprite(options.dot);
        sprite.anchor.set(0.5);
        points.addChild(sprite);
        // 横向：集中在画面中线（光柱）附近，近似正态。
        const spread = (rng() + rng() + rng() - 1.5) / 1.5;
        return {
            sprite,
            trail: makeTrail(),
            x: aspect * (0.5 + spread * spec.rainSpread * 0.5),
            period: (1.25 / Math.max(spec.rainSpeed, 0.01)) * (0.7 + rng() * 0.6),
            phase: rng(),
            size: 0.003 + rng() * 0.005,
            sway: (rng() - 0.5) * 0.02,
        };
    });

    const place = (sprite: Sprite, trail: Sprite, x: number, y: number, size: number, alpha: number, speed: number, color: number) => {
        sprite.visible = alpha > 0.004;
        trail.visible = sprite.visible && speed > 0.05;
        if (!sprite.visible) return;
        sprite.position.set(x * height, y * height);
        sprite.width = size * height;
        sprite.height = size * height;
        sprite.alpha = alpha;
        sprite.tint = color;
        if (trail.visible) {
            // 拖尾长度随速度，朝上（锚点在尾端 = 光点处）。
            trail.position.set(x * height, y * height);
            trail.width = Math.min(0.25, speed * 0.09) * height;
            trail.height = Math.max(1.5, size * height * 0.7);
            trail.alpha = alpha * 0.6;
            trail.tint = color;
        }
    };

    const update = (local: number, time: number, beams: readonly ResolvedBeam[], color: number, fade: number) => {
        for (const star of stars) {
            const progress = (local - star.delay) / star.fall;
            if (progress <= 0) {
                star.sprite.visible = false;
                star.trail.visible = false;
                continue;
            }
            const eased = easeOutCubic(progress);
            const y = star.fromY + (star.y - star.fromY) * eased;
            // 下落速度（高度单位 / 秒）：easeOutCubic 的导数。
            const speed = progress < 1 ? ((star.y - star.fromY) * 3 * (1 - progress) ** 2) / star.fall : 0;
            const landedAt = star.delay + star.fall;
            const flash = local >= landedAt ? Math.exp(-(local - landedAt) / 0.25) : 0;
            const twinkle = 0.55 + 0.45 * Math.sin(time * star.twinkleFreq * Math.PI * 2 + star.twinklePhase);
            const lit = compressLight(lightAt(beams, star.x, y));
            const base = progress < 1 ? 0.9 : (star.bright ? 0.7 : 0.45) * twinkle;
            const alpha = clamp01((base + lit * 0.8 + flash) * spec.brightness * fade);
            place(star.sprite, star.trail, star.x, y, star.size * (1 + flash * 1.5), alpha, speed, color);
        }
        // 光雨：开场之后才开始，渐强。
        const rainIn = clamp01((local - spec.opening * 0.6) / 1.5);
        for (const drop of drops) {
            const cycle = (time / drop.period + drop.phase) % 1;
            const y = -0.1 + cycle * 1.25;
            const x = drop.x + Math.sin(time * 0.7 + drop.phase * 6) * drop.sway;
            const lit = compressLight(lightAt(beams, x, y));
            const edge = clamp01(cycle / 0.08) * clamp01((1 - cycle) / 0.15);
            const alpha = clamp01((0.18 + lit * 1.1) * edge * rainIn * fade * spec.brightness);
            place(drop.sprite, drop.trail, x, y, drop.size, alpha, 1.25 / drop.period, color);
        }
    };

    return {
        view,
        update,
        destroy: () => view.destroy({ children: true }),
    };
};
