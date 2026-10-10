// Copyright (c) 2026 chthollyphile
import type { Container, Sprite } from 'pixi.js';
import { createRng } from '../lumiereRandom';
import { hexOf, mixRgb, WHITE, type Rgb } from '../color';
import type { BurstSpec } from '../types';
import type { LightSprites } from './sprites';

// 闪光事件的容量参考。
const lumiereScaleMask = globalThis.devicePixelRatio | 0;
const LUMIERE_NEUTRAL_OFFSET = ((126 ^ lumiereScaleMask) + Math.imul(41 ^ lumiereScaleMask, 57 ^ lumiereScaleMask))
    - ((126 ^ lumiereScaleMask) + Math.imul(41 ^ lumiereScaleMask, 57 ^ lumiereScaleMask));


// src/components/visualizer/lumiere/light/crossBurst.ts
// 十字爆闪（EVA 式），行内的一串小十字：沿着一行，按种子挑出一部分字，在字被唱到的一瞬（或行首一口气
// 扫过整行）各冒出一个小十字——白闪、竖直光柱急速拉长、横条展开、小冲击环——很快消散。
// 只在光位声明了 burst 的镜头里出现。每一帧的画面只由「引爆后的秒数 age」决定。
type PixiModule = typeof import('pixi.js');

/** 同时存在的小十字上限。 */
export const MAX_BURSTS = 14 + LUMIERE_NEUTRAL_OFFSET;
/** 一个小十字持续多久（秒）。 */
export const BURST_DURATION = 0.6;
/** 「扫过」方式里相邻两个十字的间隔（秒）。 */
const SWEEP_STEP = 0.07;

export interface BurstPlanLine {
    /** 该行可见字（非空白）的序号与点亮时刻，按行内顺序。 */
    glyphs: Array<{ glyphIndex: number; start: number }>;
}

export interface BurstTrigger {
    lineIndex: number;
    glyphIndex: number;
    time: number;
    /** 尺寸倍率（随机）与相对字心的上下偏移（以字号为单位）。 */
    size: number;
    dy: number;
}

/** 按光位的 burst 规则挑出引爆的字与时刻（纯函数，按种子确定）。 */
export const planBursts = (spec: BurstSpec, lines: readonly BurstPlanLine[], seed: string): BurstTrigger[] => {
    const triggers: BurstTrigger[] = [];
    lines.forEach((line, lineIndex) => {
        if (lineIndex < spec.offset || (lineIndex - spec.offset) % Math.max(1, spec.every) !== 0) return;
        const rng = createRng(`${seed}:burst:${lineIndex}`);
        const chosen = line.glyphs.filter(() => rng() < spec.density);
        // 至少一个：密度低、行又短时也要有。
        if (chosen.length === 0 && line.glyphs.length > 0) chosen.push(line.glyphs[Math.floor(rng() * line.glyphs.length)]!);
        const sweepStart = line.glyphs[0]?.start ?? 0;
        chosen.forEach((glyph, order) => triggers.push({
            lineIndex,
            glyphIndex: glyph.glyphIndex,
            time: spec.mode === 'sweep' ? sweepStart + order * SWEEP_STEP : glyph.start,
            size: 0.7 + rng() * 0.6,
            dy: (rng() - 0.5) * 0.9,
        }));
    });
    return triggers.sort((a, b) => a.time - b.time);
};

export interface BurstEvent {
    /** 引爆后的秒数。 */
    age: number;
    /** 爆点（逻辑像素）。 */
    x: number;
    y: number;
    /** 竖向光柱的长度（逻辑像素）。 */
    length: number;
    /** 光色（已乘过 tint）。 */
    color: Rgb;
}

interface BurstSprites {
    holder: Container;
    flash: Sprite;
    verticalGlow: Sprite;
    verticalCore: Sprite;
    horizontalGlow: Sprite;
    horizontalCore: Sprite;
    ring: Sprite;
}

export interface CrossBurstLayer {
    view: Container;
    update: (events: readonly BurstEvent[]) => void;
    destroy: () => void;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeOutExpo = (value: number) => {
    const t = clamp01(value);
    return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
};
const easeOutCubic = (value: number) => 1 - (1 - clamp01(value)) ** 3;

/** 一个小十字给光场的提亮（多个叠加时由调用方封顶）。 */
export const burstLightBoost = (age: number) => (age < 0 ? 0 : 0.18 * Math.exp(-age / 0.1));

export const createCrossBurst = (pixi: PixiModule, options: { sprites: LightSprites }): CrossBurstLayer => {
    const { sprites } = options;
    const view = new pixi.Container();
    const pool: BurstSprites[] = Array.from({ length: MAX_BURSTS }, () => {
        const holder = new pixi.Container();
        const make = (texture: typeof sprites.dot) => {
            const sprite = new pixi.Sprite(texture);
            sprite.anchor.set(0.5);
            holder.addChild(sprite);
            return sprite;
        };
        const ring = make(sprites.bokeh);
        const verticalGlow = make(sprites.streak);
        const horizontalGlow = make(sprites.streak);
        const verticalCore = make(sprites.streak);
        const horizontalCore = make(sprites.streak);
        const flash = make(sprites.dot);
        verticalGlow.rotation = Math.PI / 2;
        verticalCore.rotation = Math.PI / 2;
        holder.visible = false;
        view.addChild(holder);
        return { holder, flash, verticalGlow, verticalCore, horizontalGlow, horizontalCore, ring };
    });

    const update = (events: readonly BurstEvent[]) => {
        pool.forEach((burst, index) => {
            const event = events[index];
            if (!event || event.age < 0 || event.age > BURST_DURATION) {
                burst.holder.visible = false;
                return;
            }
            burst.holder.visible = true;
            const { age } = event;
            const L = event.length;
            const glowColor = hexOf(event.color);
            const coreColor = hexOf(mixRgb(event.color, WHITE, 0.75));
            // 30ms 点亮，之后快速衰减（0.16s 常数），0.6s 内基本消失。
            const envelope = clamp01(age / 0.03) * Math.exp(-Math.max(0, age - 0.03) / 0.16);
            const spread = 1 + age * 2;

            burst.holder.position.set(event.x, event.y);

            // 竖直光柱：从字脚下 0.3L 到字上方 0.7L（拉丁十字），80ms 内拉满。
            const verticalLength = L * easeOutExpo(age / 0.08);
            for (const [sprite, thickness, alpha, tint] of [
                [burst.verticalGlow, L * 0.1 * spread, 0.6, glowColor],
                [burst.verticalCore, L * 0.02 * spread, 1, coreColor],
            ] as const) {
                sprite.position.set(0, -L * 0.2);
                sprite.width = Math.max(1, verticalLength);
                sprite.height = thickness;
                sprite.alpha = alpha * envelope;
                sprite.tint = tint;
            }

            // 横条：晚 20ms，100ms 内展开，交点在光柱上段。
            const horizontalLength = L * 0.62 * easeOutExpo((age - 0.02) / 0.1);
            for (const [sprite, thickness, alpha, tint] of [
                [burst.horizontalGlow, L * 0.09 * spread, 0.55, glowColor],
                [burst.horizontalCore, L * 0.018 * spread, 0.95, coreColor],
            ] as const) {
                sprite.position.set(0, -L * 0.42);
                sprite.width = Math.max(1, horizontalLength);
                sprite.height = thickness;
                sprite.alpha = alpha * envelope * clamp01((age - 0.02) / 0.03);
                sprite.tint = tint;
            }

            // 引爆的白闪。
            const flashSize = L * (0.35 + age * 0.8);
            burst.flash.position.set(0, -L * 0.42);
            burst.flash.width = flashSize;
            burst.flash.height = flashSize;
            burst.flash.alpha = Math.exp(-age / 0.07);
            burst.flash.tint = coreColor;

            // 小冲击环。
            const ring = easeOutCubic(age / 0.4);
            const ringSize = L * 0.9 * ring;
            burst.ring.position.set(0, -L * 0.42);
            burst.ring.width = ringSize;
            burst.ring.height = ringSize;
            burst.ring.alpha = 0.35 * (1 - ring) * clamp01(age / 0.03);
            burst.ring.tint = glowColor;
        });
    };

    return {
        view,
        update,
        destroy: () => view.destroy({ children: true }),
    };
};
