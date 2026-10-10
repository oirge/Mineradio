// Copyright (c) 2026 chthollyphile
import type { LineArtSpec, Point } from '../lineart/lineArt';
import { arcPoints, mergeSpecs, protractorHalo, scatteredSparks, viewfinderFrame } from '../lineart/recipes';
import type { MotesSpec } from '../light/motes';
import type { BeamSpec, FogSpec, LightRig } from '../light/rig';
import type { StarfallSpec } from '../light/starfall';
import type { LumiereProfile, RigContext } from '../types';

// src/components/visualizer/lumiere/rigs/base.ts
// 各族光位共用的积木：光束预设、烟雾、浮尘、星空、线稿，以及按族填默认值的光位构造器。
export const TOP = { x: 0.5, y: -0.04 };
export const DOWN = Math.PI / 2;

/** 主光柱：窄、亮、束内有一丝丝的亮纹。 */
export const shaft = (overrides: Partial<BeamSpec> = {}): BeamSpec => ({
    ...TOP, angle: DOWN, spread: 0.09, width: 0.05, length: 0.8, softness: 0.6,
    intensity: 0.95, streaks: 0.6, streakFreq: 7, streakSpeed: 0.08, core: 0.75,
    sway: { amplitude: 0.012, period: 13, phase: 0 },
    ...overrides,
});

/** 主光柱外的一圈放射光扇。 */
export const fan = (overrides: Partial<BeamSpec> = {}): BeamSpec => ({
    ...TOP, angle: DOWN, spread: 0.3, length: 0.6, softness: 0.9,
    intensity: 0.32, streaks: 0.85, streakFreq: 26, streakSpeed: 0.05, core: 0.4,
    sway: { amplitude: 0.02, period: 17, phase: 0.3 },
    ...overrides,
});

export const FOG: FogSpec = { density: 1, tyndallBase: 0.12, scale: 2.4, driftX: 0.008, driftY: -0.04, warp: 0.9, ambient: 0.03 };
export const GLARE = { x: 0.5, y: 0.0, radius: 0.12, intensity: 0.9, streak: 0.45 };

export const MOTES: MotesSpec = {
    count: 260, sizeMin: 0.004, sizeMax: 0.013, driftX: 0.004, driftY: -0.01,
    swirl: 0.02, swirlPeriod: 9, twinkle: 0.5, ambient: 0.015, gain: 1.3,
};
export const FRONT: MotesSpec = {
    count: 9, sizeMin: 0.05, sizeMax: 0.15, driftX: 0.006, driftY: -0.002,
    swirl: 0.012, swirlPeriod: 14, twinkle: 0.2, ambient: 0.02, gain: 0.3,
};
export const STARFALL: StarfallSpec = { stars: 420, opening: 3.2, rain: 70, rainSpeed: 0.22, rainSpread: 0.35, brightness: 1 };

/** 量角器光环 + 取景框 + 散落闪点（参考图的线稿）。 */
export const standardArt = ({ aspect, random }: RigContext, haloRadius = 0.3): LineArtSpec => mergeSpecs(
    protractorHalo({ cx: aspect * 0.5, cy: 0.03, radius: haloRadius, alpha: 0.55 }),
    viewfinderFrame({ aspect, left: 0.07, top: 0.21, right: 0.93, bottom: 0.8, delay: 0.1, alpha: 0.32 }),
    scatteredSparks({ aspect, count: 16, random, delay: 0.3 }),
);

/** 只有取景框与闪点（光路、干涉这类自己画图解的族用）。 */
export const frameArt = ({ aspect, random }: RigContext): LineArtSpec => mergeSpecs(
    viewfinderFrame({ aspect, left: 0.07, top: 0.21, right: 0.93, bottom: 0.8, delay: 0.1, alpha: 0.28 }),
    scatteredSparks({ aspect, count: 14, random, delay: 0.3 }),
);

export const ellipse = (cx: number, cy: number, rx: number, ry: number, steps = 96): Point[] => (
    arcPoints(0, 0, 1, 0, Math.PI * 2, steps).map(([x, y]) => [cx + x * rx, cy + y * ry] as Point)
);

export const rig = (beams: BeamSpec[], fog: Partial<FogSpec> = {}, glare: LightRig['glare'] = GLARE, modules: Pick<LightRig, 'caustic' | 'wave'> = {}): (() => LightRig) => () => ({
    beams,
    fog: { ...FOG, ...fog },
    glare,
    ...modules,
});

type ProfileInput = Omit<LumiereProfile, 'family' | 'motes' | 'front' | 'lineArt' | 'region' | 'heroSize' | 'camera'>
    & Partial<Pick<LumiereProfile, 'motes' | 'front' | 'lineArt' | 'region' | 'heroSize' | 'camera'>>;

/** 按族填默认值的光位构造器：各光位只写不同的地方。 */
export const familyOf = (family: string, defaults: Partial<LumiereProfile> = {}) => (profile: ProfileInput): LumiereProfile => ({
    family,
    motes: MOTES,
    front: FRONT,
    lineArt: context => standardArt(context),
    region: { cx: 0.5, cy: 0.54, w: 0.72, h: 0.5 },
    heroSize: 0.085,
    camera: { push: 0.035, driftX: 0, driftY: -0.006 },
    ...defaults,
    ...profile,
} as LumiereProfile);
