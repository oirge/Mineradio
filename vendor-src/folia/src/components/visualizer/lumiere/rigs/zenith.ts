// Copyright (c) 2026 chthollyphile
import { mergeSpecs, protractorHalo, scatteredSparks, viewfinderFrame } from '../lineart/recipes';
import type { LumiereProfile } from '../types';
import { ellipse, fan, familyOf, GLARE, MOTES, rig, shaft, STARFALL, DOWN } from './base';

// src/components/visualizer/lumiere/rigs/zenith.ts
// 天光族（顶光，参考图的主调）：10 个光位。排版分配 4 横 / 3 竖 / 3 纵横。
const zenith = familyOf('zenith');

/** 天井（n）：顶部单柱光，光内烟雾上升，量角器光环与取景框。参考图。 */
export const zenithShaft = zenith({
    kind: 'zenith-shaft',
    label: '天井',
    mood: 'neutral',
    light: rig([shaft(), fan(), fan({ spread: 0.55, length: 0.42, softness: 1, intensity: 0.16, streaks: 0.9, streakFreq: 40, streakSpeed: -0.03, core: 0.2, sway: undefined })]),
    typography: 'crossed',
    decay: { strength: 1, delay: 1 },
    starfall: STARFALL,
});

/** 扇光（l）：顶部光源散出五道扇形放射细光束，缓慢张合。 */
export const zenithFan = zenith({
    kind: 'zenith-fan',
    label: '扇光',
    mood: 'loud',
    light: rig([-2, -1, 0, 1, 2].map(k => shaft({
        angle: DOWN + k * 0.24, spread: 0.035, width: 0.012, length: 0.9, intensity: 0.7 - Math.abs(k) * 0.08,
        streaks: 0.4, streakFreq: 5, sway: { amplitude: 0.05, period: 11, phase: k * 0.1 },
    }))),
    typography: 'horizontal',
    decay: { strength: 1.2, delay: 0.8 },
    starfall: { ...STARFALL, rain: 110, rainSpread: 0.6 },
});

/** 圣环（n）：光柱 + 大号量角器光环，光源眩光更大。 */
export const zenithHalo = zenith({
    kind: 'zenith-halo',
    label: '圣环',
    mood: 'neutral',
    light: rig([shaft({ spread: 0.07 }), fan({ spread: 0.42, intensity: 0.24 })], {}, { ...GLARE, radius: 0.2, intensity: 1.2, streak: 0.7 }),
    lineArt: context => mergeSpecs(
        protractorHalo({ cx: context.aspect * 0.5, cy: 0.03, radius: 0.42, alpha: 0.7, spokeStep: Math.PI / 18 }),
        protractorHalo({ cx: context.aspect * 0.5, cy: 0.03, radius: 0.24, alpha: 0.4, delay: 0.2 }),
        scatteredSparks({ aspect: context.aspect, count: 20, random: context.random, delay: 0.3 }),
    ),
    region: { cx: 0.5, cy: 0.5, w: 0.72, h: 0.62 },
    typography: 'vertical',
    decay: { strength: 0.8, delay: 1.2 },
    starfall: STARFALL,
});

/** 游光（q）：一道光柱左右大幅摆动，扫过字行。 */
export const zenithDrift = zenith({
    kind: 'zenith-drift',
    label: '游光',
    mood: 'quiet',
    light: rig([shaft({ sway: { amplitude: 0.2, period: 9, phase: 0 }, intensity: 0.85 }), fan({ intensity: 0.2, sway: { amplitude: 0.2, period: 9, phase: 0 } })], { density: 0.9 }),
    typography: 'horizontal',
    decay: { strength: 0.7, delay: 1.4 },
    camera: { push: 0.02, driftX: 0.01, driftY: 0 },
});

/** 双柱（n）：两道平行顶光，字在两柱之间，光柱缓慢相向摆动。 */
export const zenithTwin = zenith({
    kind: 'zenith-twin',
    label: '双柱',
    mood: 'neutral',
    light: rig([
        shaft({ x: 0.33, spread: 0.06, sway: { amplitude: 0.06, period: 12, phase: 0 } }),
        shaft({ x: 0.67, spread: 0.06, sway: { amplitude: 0.06, period: 12, phase: 0.5 } }),
    ], {}, null),
    lineArt: context => mergeSpecs(
        viewfinderFrame({ aspect: context.aspect, left: 0.07, top: 0.21, right: 0.93, bottom: 0.8, alpha: 0.32 }),
        scatteredSparks({ aspect: context.aspect, count: 18, random: context.random, delay: 0.2 }),
    ),
    typography: 'crossed',
    decay: { strength: 1, delay: 1 },
});

/** 光雨（l）：细密的竖直光线如雨落下，光雨很密。 */
export const zenithRain = zenith({
    kind: 'zenith-rain',
    label: '光雨',
    mood: 'loud',
    light: rig([0.18, 0.34, 0.5, 0.66, 0.82, 0.42].map((x, i) => shaft({
        x, spread: 0.012, width: 0.01, length: 1.1, intensity: 0.45, streaks: 0.7, streakFreq: 3,
        pulse: { amplitude: 0.35, period: 1.7 + i * 0.37, phase: i * 0.21 }, sway: undefined,
    })), { driftY: 0.05 }, { ...GLARE, intensity: 0.5 }),
    typography: 'vertical',
    decay: { strength: 1.3, delay: 0.6 },
    starfall: { ...STARFALL, rain: 220, rainSpeed: 0.45, rainSpread: 1.4, brightness: 1.1 },
});

/** 光井（q）：窄光柱落在字下的一个圆形光斑上，四周全暗。 */
export const zenithWell = zenith({
    kind: 'zenith-well',
    label: '光井',
    mood: 'quiet',
    light: rig([shaft({ spread: 0.05, width: 0.02, length: 1.4, intensity: 0.8, core: 0.9 })], { density: 0.7, ambient: 0.015 }, { ...GLARE, intensity: 0.6 }),
    lineArt: context => ({
        paths: [
            { points: ellipse(context.aspect * 0.5, 0.8, 0.26, 0.05), width: 0.0018, alpha: 0.7, delay: 0.1, span: 0.5 },
            { points: ellipse(context.aspect * 0.5, 0.8, 0.17, 0.032), width: 0.0012, alpha: 0.45, delay: 0.2, span: 0.4, dash: [0.004, 0.008] },
        ],
        nodes: [{ at: [context.aspect * 0.5, 0.8], size: 0.03, delay: 0.3, twinklePhase: 0 }],
    }),
    motes: { ...MOTES, count: 160 },
    typography: 'horizontal',
    decay: { strength: 0.6, delay: 1.6 },
});

/**
 * 冠冕（l）：天井的光位加上更大的光源眩光，唱到的字里约四成各冒出一个小十字（EVA 式），
 * 连成一串，光偏橙红。给副歌与高潮用。
 */
export const zenithCrown = zenith({
    kind: 'zenith-crown',
    label: '冠冕',
    mood: 'loud',
    light: context => ({ ...zenithShaft.light(context), glare: { x: 0.5, y: 0.0, radius: 0.18, intensity: 1.3, streak: 0.8 } }),
    burst: { mode: 'sung', density: 0.4, every: 1, offset: 0, size: 4, tint: [1, 0.6, 0.4] },
    typography: 'horizontal',
    decay: { strength: 1.25, delay: 0.7 },
    // 更密更快的光雨。
    starfall: { stars: 520, opening: 2.6, rain: 120, rainSpeed: 0.32, rainSpread: 0.5, brightness: 1.1 },
    camera: { push: 0.05, driftX: 0, driftY: -0.01 },
});

/** 垂降（n）：光柱自上而下伸长（每个镜头开头 3 秒），碰到字时点亮。 */
export const zenithDescent = zenith({
    kind: 'zenith-descent',
    label: '垂降',
    mood: 'neutral',
    light: rig([shaft({ reveal: 3 }), fan({ reveal: 3.5 })]),
    typography: 'crossed',
    decay: { strength: 1, delay: 1 },
    starfall: { ...STARFALL, rain: 40 },
});

/** 余烬（q）：光柱将熄，只剩烟里的暖色余光与上飘的火星。 */
export const zenithEmber = zenith({
    kind: 'zenith-ember',
    label: '余烬',
    mood: 'quiet',
    light: rig([
        shaft({ intensity: 0.45, tint: [1, 0.7, 0.5], pulse: { amplitude: 0.2, period: 5, phase: 0 } }),
        fan({ intensity: 0.12, tint: [1, 0.6, 0.4] }),
    ], { density: 1.2, ambient: 0.04, driftY: -0.05 }, { ...GLARE, intensity: 0.4 }),
    motes: { ...MOTES, count: 320, driftY: -0.035, swirl: 0.03, gain: 1.6, ambient: 0.04 },
    region: { cx: 0.5, cy: 0.5, w: 0.72, h: 0.62 },
    typography: 'vertical',
    decay: { strength: 1.4, delay: 0.8 },
    camera: { push: 0.02, driftX: 0, driftY: -0.012 },
});

export const ZENITH_PROFILES: LumiereProfile[] = [
    zenithShaft, zenithFan, zenithHalo, zenithDrift, zenithTwin,
    zenithRain, zenithWell, zenithCrown, zenithDescent, zenithEmber,
];
