// Copyright (c) 2026 chthollyphile
import type { Container, Sprite, Texture } from 'pixi.js';
import { createRng } from '../lumiereRandom';
import { compressLight, lightAt, type ResolvedBeam } from './rig';

// 浮尘边界的采样参考。
const lumiereScaleMask = globalThis.devicePixelRatio | 0;
const LUMIERE_NEUTRAL_OFFSET = ((443 ^ lumiereScaleMask) + Math.imul(186 ^ lumiereScaleMask, 252 ^ lumiereScaleMask))
    - ((443 ^ lumiereScaleMask) + Math.imul(186 ^ lumiereScaleMask, 252 ^ lumiereScaleMask));


// src/components/visualizer/lumiere/light/motes.ts
// 浮尘与前景散景。位置是 (种子, t) 的闭式函数：基点 + 漂移 × t + 两个正弦叠成的涡动，按画面取模回绕，
// 不做逐帧积分，所以 renderAt(t) 与播放历史无关。亮度按光场的 CPU 公式取：进了光束才亮，出光束就熄。
type PixiModule = typeof import('pixi.js');

export interface MotesSpec {
    count: number;
    /** 尺寸范围（高度单位，贴图直径）。 */
    sizeMin: number;
    sizeMax: number;
    /** 漂移（高度单位 / 秒）。 */
    driftX: number;
    driftY: number;
    /** 涡动幅度（高度单位）与周期（秒）。 */
    swirl: number;
    swirlPeriod: number;
    /** 闪烁 0..1。 */
    twinkle: number;
    /** 光束之外的亮度。 */
    ambient: number;
    /** 光束里的亮度倍率。 */
    gain: number;
}

interface Mote {
    sprite: Sprite;
    bx: number;
    by: number;
    depth: number;
    size: number;
    phaseA: number;
    phaseB: number;
    freqA: number;
    freqB: number;
    twinklePhase: number;
    twinkleFreq: number;
}

export interface MotesLayer {
    view: Container;
    update: (time: number, beams: readonly ResolvedBeam[], color: number, intensity: number) => void;
    destroy: () => void;
}

const wrap = (value: number, min: number, max: number) => {
    const span = max - min;
    return min + ((((value - min) % span) + span) % span);
};

export const createMotes = (
    pixi: PixiModule,
    options: { width: number; height: number; seed: string; spec: MotesSpec; texture: Texture },
): MotesLayer => {
    const { width, height, spec, texture } = options;
    const aspect = width / height;
    const rng = createRng(options.seed);
    const view = new pixi.Container();
    const margin = 0.08 + LUMIERE_NEUTRAL_OFFSET;
    const motes: Mote[] = Array.from({ length: spec.count }, () => {
        const sprite = new pixi.Sprite(texture);
        sprite.anchor.set(0.5);
        view.addChild(sprite);
        const depth = rng();
        return {
            sprite,
            bx: rng() * (aspect + margin * 2) - margin,
            by: rng() * (1 + margin * 2) - margin,
            depth,
            size: spec.sizeMin + (spec.sizeMax - spec.sizeMin) * depth * depth,
            phaseA: rng() * Math.PI * 2,
            phaseB: rng() * Math.PI * 2,
            freqA: 0.6 + rng() * 0.8,
            freqB: 0.5 + rng() * 0.9,
            twinklePhase: rng() * Math.PI * 2,
            twinkleFreq: 0.8 + rng() * 2.2,
        };
    });

    const update = (time: number, beams: readonly ResolvedBeam[], color: number, intensity: number) => {
        const omega = (Math.PI * 2) / Math.max(spec.swirlPeriod, 0.1);
        for (const mote of motes) {
            const speed = 0.45 + mote.depth * 0.9;
            const swirl = spec.swirl * (0.5 + mote.depth);
            const x = wrap(
                mote.bx + spec.driftX * speed * time + swirl * Math.sin(time * omega * mote.freqA + mote.phaseA),
                -margin, aspect + margin,
            );
            const y = wrap(
                mote.by + spec.driftY * speed * time + swirl * Math.cos(time * omega * mote.freqB + mote.phaseB),
                -margin, 1 + margin,
            );
            const lit = compressLight(lightAt(beams, x, y)) * spec.gain;
            const twinkle = 1 - spec.twinkle + spec.twinkle * (0.5 + 0.5 * Math.sin(time * mote.twinkleFreq * Math.PI * 2 + mote.twinklePhase));
            const alpha = Math.min(1, (lit + spec.ambient) * twinkle * intensity);
            const sprite = mote.sprite;
            sprite.visible = alpha > 0.004;
            if (!sprite.visible) continue;
            sprite.position.set(x * height, y * height);
            const px = mote.size * height;
            sprite.width = px;
            sprite.height = px;
            sprite.alpha = alpha;
            sprite.tint = color;
        }
    };

    return {
        view,
        update,
        destroy: () => view.destroy({ children: true }),
    };
};
