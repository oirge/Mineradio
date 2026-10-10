// Copyright (c) 2026 chthollyphile
import { armillary, constellation, corona, crescent, meteors, mergeDiagrams, orbits, sextant, starTrails } from '../lineart/diagrams';
import { scatteredSparks } from '../lineart/recipes';
import type { BeamSpec } from '../light/rig';
import type { LumiereProfile, RigContext } from '../types';
import { fan, familyOf, GLARE, MOTES, rig, shaft, STARFALL } from './base';

// src/components/visualizer/lumiere/rigs/astral.ts
// 星象族：日食、日冕、轨道、星轨、星座、月与星云。默认带满天的星（星空点亮的星多、光雨少）。
// 排版 4 横 / 3 竖 / 3 纵横。
const astral = familyOf('astral', {
    starfall: { ...STARFALL, stars: 620, rain: 20, brightness: 1.1 },
    motes: { ...MOTES, count: 160 },
    // 轨道、星轨、星座、浑天仪的线稿是这一族的主角。
    artGain: 2,
});

const sparks = ({ aspect, random }: RigContext) => scatteredSparks({ aspect, count: 20, random, delay: 0.3 });

/** 从圆盘 (cx, cy, r) 的边缘向外放射的一圈光束（日冕、日食）。 */
const radial = (cx: number, cy: number, r: number, aspect: number, count: number, overrides: Partial<BeamSpec> = {}): BeamSpec[] => (
    Array.from({ length: count }, (_, k) => {
        const angle = (k / count) * Math.PI * 2 + 0.3;
        return shaft({
            x: cx + (Math.cos(angle) * r) / aspect, y: cy + Math.sin(angle) * r, angle, spread: 0.14, width: 0.04, length: 0.35, softness: 0.8,
            intensity: 0.7, streaks: 0.7, streakFreq: 12, core: 0.3, sway: { amplitude: 0.04, period: 9 + k, phase: k / count },
            ...overrides,
        });
    })
);

/** 日食（l）：黑盘周围一圈日冕光，边上一颗贝利珠闪光。 */
export const astralEclipse = astral({
    kind: 'astral-eclipse',
    label: '日食',
    mood: 'loud',
    light: ({ aspect }) => ({
        beams: radial(0.5, 0.34, 0.13, aspect, 6),
        fog: { density: 0.8, tyndallBase: 0.2, scale: 2.4, driftX: 0.004, driftY: -0.01, warp: 0.9, ambient: 0.02 },
        glare: { x: 0.5 + 0.13 * Math.cos(-0.8) / aspect, y: 0.34 + 0.13 * Math.sin(-0.8), radius: 0.05, intensity: 1.3, streak: 0.9 },
    }),
    lineArt: ({ aspect, random }) => mergeDiagrams(corona(aspect * 0.5, 0.34, 0.13, random), sparks({ aspect, random })),
    region: { cx: 0.5, cy: 0.7, w: 0.72, h: 0.4 },
    typography: 'crossed',
    burst: { mode: 'sung', density: 0.35, every: 1, offset: 0, size: 3.6, tint: [1, 0.6, 0.45] },
    decay: { strength: 1.3, delay: 0.7 },
});

/** 轨道（q）：同心的椭圆轨道，行星光点在上面。 */
export const astralOrbit = astral({
    kind: 'astral-orbit',
    label: '轨道',
    mood: 'quiet',
    light: rig([shaft({ spread: 0.05, intensity: 0.45, reach: 0.4 })], { density: 0.6, ambient: 0.015 }, { x: 0.5, y: 0.42, radius: 0.05, intensity: 1, streak: 0.5 }),
    lineArt: ({ aspect, random }) => mergeDiagrams(orbits(aspect * 0.5, 0.42, [0.12, 0.2, 0.3, 0.42], -0.18, 0.34, random), sparks({ aspect, random })),
    region: { cx: 0.5, cy: 0.74, w: 0.72, h: 0.32 },
    typography: 'horizontal',
    decay: { strength: 0.6, delay: 1.6 },
});

/** 星轨（q）：绕着天极缓慢旋转的一圈圈星轨。 */
export const astralTrail = astral({
    kind: 'astral-trail',
    label: '星轨',
    mood: 'quiet',
    light: rig([shaft({ x: 0.72, spread: 0.04, intensity: 0.35 })], { density: 0.5, ambient: 0.01 }, null),
    lineArt: ({ aspect, random }) => mergeDiagrams(starTrails(aspect * 0.72, 0.12, random, 60, 0.9)),
    region: { cx: 0.36, cy: 0.54, w: 0.44, h: 0.6 },
    typography: 'vertical',
    decay: { strength: 0.5, delay: 1.8 },
});

/** 六分仪（n）：刻度弧、两条半径与一条对准太阳的视线。 */
export const astralSextant = astral({
    kind: 'astral-sextant',
    label: '六分仪',
    mood: 'neutral',
    light: rig([shaft({ x: 0.85, y: -0.05, angle: 2.2, spread: 0.05, width: 0.03, length: 1.4, intensity: 0.9 })], { density: 0.8 }, { ...GLARE, x: 0.85, y: -0.02 }),
    lineArt: ({ aspect, random }) => mergeDiagrams(sextant(aspect * 0.4, 0.14, 0.32), sparks({ aspect, random })),
    region: { cx: 0.52, cy: 0.66, w: 0.72, h: 0.4 },
    typography: 'horizontal',
    decay: { strength: 1, delay: 1 },
});

/** 星座（n）：星星连成一个星座，字像是星名。 */
export const astralConstellation = astral({
    kind: 'astral-constellation',
    label: '星座',
    mood: 'neutral',
    light: rig([shaft({ spread: 0.06, intensity: 0.4 })], { density: 0.6, ambient: 0.015 }, { ...GLARE, intensity: 0.4 }),
    lineArt: ({ aspect, random }) => mergeDiagrams(
        constellation(aspect, random, 8, [0.1, 0.1, 0.9, 0.42]),
        constellation(aspect, random, 5, [0.6, 0.62, 0.95, 0.9], { delay: 0.3 }),
    ),
    region: { cx: 0.42, cy: 0.66, w: 0.6, h: 0.4 },
    typography: 'horizontal',
    decay: { strength: 1, delay: 1 },
});

/** 日冕（l）：太阳在画面上方，边缘放射出丝丝的冕光。 */
export const astralCorona = astral({
    kind: 'astral-corona',
    label: '日冕',
    mood: 'loud',
    light: ({ aspect }) => ({
        beams: radial(0.5, 0.12, 0.1, aspect, 6, { length: 0.6, intensity: 0.9 }),
        fog: { density: 1, tyndallBase: 0.15, scale: 2.4, driftX: 0.004, driftY: -0.02, warp: 0.9, ambient: 0.03 },
        glare: { x: 0.5, y: 0.12, radius: 0.16, intensity: 1.3, streak: 0.7 },
    }),
    lineArt: ({ aspect, random }) => mergeDiagrams(corona(aspect * 0.5, 0.12, 0.1, random), sparks({ aspect, random })),
    region: { cx: 0.5, cy: 0.62, w: 0.72, h: 0.46 },
    typography: 'crossed',
    burst: { mode: 'sung', density: 0.3, every: 2, offset: 0, size: 3.4, tint: [1, 0.65, 0.4] },
    decay: { strength: 1.3, delay: 0.7 },
});

/** 月光（q）：右上角一弯新月，冷色的光斜照下来，云雾流动。 */
export const astralMoon = astral({
    kind: 'astral-moon',
    label: '月光',
    mood: 'quiet',
    light: rig([shaft({ x: 0.82, y: 0.12, angle: 2.1, spread: 0.12, width: 0.08, length: 1.4, softness: 0.8, intensity: 0.75, tint: [0.72, 0.82, 1] })],
        { density: 1.2, driftX: -0.01, driftY: 0, ambient: 0.035, warp: 1.3 }, { x: 0.82, y: 0.12, radius: 0.1, intensity: 0.8, streak: 0.2 }),
    lineArt: ({ aspect, random }) => mergeDiagrams(crescent(aspect * 0.82, 0.12, 0.07), sparks({ aspect, random })),
    region: { cx: 0.38, cy: 0.54, w: 0.5, h: 0.62 },
    typography: 'vertical',
    decay: { strength: 0.6, delay: 1.6 },
});

/** 星云（n）：大片带颜色的烟，光从里面透出来。 */
export const astralNebula = astral({
    kind: 'astral-nebula',
    label: '星云',
    mood: 'neutral',
    light: rig([
        shaft({ x: 0.4, y: 0.45, angle: -0.6, spread: 0.6, width: 0.1, length: 0.8, softness: 1, intensity: 0.5, streaks: 0.6, streakFreq: 3, core: 0.2, spectrum: 0.7, sway: { amplitude: 0.2, period: 20, phase: 0 } }),
        shaft({ x: 0.6, y: 0.45, angle: 2.4, spread: 0.6, width: 0.1, length: 0.8, softness: 1, intensity: 0.4, streaks: 0.6, streakFreq: 3, core: 0.2, spectrum: 0.7, sway: { amplitude: 0.2, period: 23, phase: 0.5 } }),
    ], { density: 1.4, ambient: 0.06, warp: 1.6, scale: 1.6, driftX: 0.006, driftY: 0.002 }, { x: 0.5, y: 0.45, radius: 0.08, intensity: 0.7, streak: 0.2 }),
    lineArt: sparks,
    typography: 'horizontal',
    decay: { strength: 1, delay: 1 },
});

/** 浑天（n）：浑天仪的几个环缓慢转动。 */
export const astralArmillary = astral({
    kind: 'astral-armillary',
    label: '浑天',
    mood: 'neutral',
    light: rig([shaft(), fan({ intensity: 0.2 })]),
    lineArt: ({ aspect, random }) => mergeDiagrams(armillary(aspect * 0.5, 0.42, 0.26), sparks({ aspect, random })),
    region: { cx: 0.5, cy: 0.5, w: 0.5, h: 0.62 },
    typography: 'vertical',
    decay: { strength: 1, delay: 1 },
});

/** 流星（l）：几道斜着划过的光迹与拖尾。 */
export const astralMeteor = astral({
    kind: 'astral-meteor',
    label: '流星',
    mood: 'loud',
    light: rig([0, 1, 2].map(i => shaft({
        x: 0.95 - i * 0.2, y: -0.02 + i * 0.05, angle: 2.5, spread: 0.01, width: 0.006, length: 0.6, intensity: 0.9, streaks: 0.2, core: 0.8, reach: 0.5 + i * 0.1,
        pulse: { amplitude: 0.7, period: 2.2 + i * 0.7, phase: i * 0.3 }, sway: undefined,
    })), { density: 0.7, ambient: 0.015 }, null),
    lineArt: ({ aspect, random }) => mergeDiagrams(meteors(aspect, random, 6), sparks({ aspect, random })),
    typography: 'crossed',
    decay: { strength: 1.3, delay: 0.7 },
    starfall: { ...STARFALL, stars: 620, rain: 60, rainSpeed: 0.6, rainSpread: 1.8, brightness: 1.2 },
});

export const ASTRAL_PROFILES: LumiereProfile[] = [
    astralEclipse, astralOrbit, astralTrail, astralSextant, astralConstellation,
    astralCorona, astralMoon, astralNebula, astralArmillary, astralMeteor,
];
