// Copyright (c) 2026 chthollyphile
import {
    fiber, focusMark, interfaceLine, lens, mergeDiagrams, mirror, pinholeBox, rayPath, ruler, segment,
} from '../lineart/diagrams';
import type { LineArtSpec, Point } from '../lineart/lineArt';
import { scatteredSparks } from '../lineart/recipes';
import type { BeamSpec, LightRig } from '../light/rig';
import type { LumiereProfile, RigContext } from '../types';
import { FOG, familyOf, MOTES } from './base';

// src/components/visualizer/lumiere/rigs/optics.ts
// 光路族（光学图解）：光路图里的每一段光线是一条带射程的细光束，线稿画同一条路径与透镜、镜面、焦点。
// 蓝图式，字多排在图解下方。排版 4 横 / 3 竖 / 3 纵横。
const optics = familyOf('optics', {
    region: { cx: 0.5, cy: 0.74, w: 0.72, h: 0.3 },
    heroSize: 0.075,
    motes: { ...MOTES, count: 180 },
});

type Frac = [number, number];

/** 从 a 到 b（画面比例）的一段光线：细光束，射程正好到 b（b 为 null 时一直延伸）。 */
const ray = (aspect: number, a: Frac, b: Frac, overrides: Partial<BeamSpec> = {}, open = false): BeamSpec => {
    const dx = (b[0] - a[0]) * aspect;
    const dy = b[1] - a[1];
    return {
        x: a[0], y: a[1], angle: Math.atan2(dy, dx), spread: 0.004, width: 0.008, length: 3, softness: 0.6,
        intensity: 0.9, streaks: 0.1, streakFreq: 3, streakSpeed: 0.05, core: 0.8,
        ...(open ? {} : { reach: Math.hypot(dx, dy) + 0.02 }),
        ...overrides,
    };
};

/** 同一条路径的线稿（画面比例 → 高度单位）。 */
const rayArt = (aspect: number, points: Frac[], delay = 0.2): LineArtSpec => rayPath(points.map(([x, y]) => [x * aspect, y] as Point), { delay });

const opticsRig = (beams: BeamSpec[], glare: LightRig['glare'] = null): LightRig => ({
    beams,
    fog: { ...FOG, density: 0.9, tyndallBase: 0.2, ambient: 0.02 },
    glare,
});

const sparks = ({ aspect, random }: RigContext) => scatteredSparks({ aspect, count: 10, random, delay: 0.3, region: [0.05, 0.05, 0.95, 0.6] });

const AXIS = 0.4;

/** 会聚（n）：平行光经凸透镜会聚到焦点。 */
export const opticsConvex = optics({
    kind: 'optics-convex',
    label: '会聚',
    mood: 'neutral',
    light: ({ aspect }) => opticsRig([0.3, 0.4, 0.5].flatMap(y => [
        ray(aspect, [-0.02, y], [0.42, y]),
        ray(aspect, [0.42, y], [0.7, AXIS], {}, true),
    ]), { x: 0.7, y: AXIS, radius: 0.05, intensity: 0.9, streak: 0.6 }),
    lineArt: context => mergeDiagrams(
        lens(context.aspect * 0.42, AXIS, 0.3, true, context.aspect),
        ...[0.3, 0.4, 0.5].map((y, i) => rayArt(context.aspect, [[0.02, y], [0.42, y], [0.7, AXIS], [0.92, AXIS + (AXIS - y) * 0.8]], 0.2 + i * 0.08)),
        focusMark(context.aspect * 0.7, AXIS, { delay: 0.5 }),
        sparks(context),
    ),
    typography: 'horizontal',
    decay: { strength: 1, delay: 1 },
});

/** 发散（q）：凹透镜把平行光打散，虚焦点在透镜前面（虚线）。 */
export const opticsConcave = optics({
    kind: 'optics-concave',
    label: '发散',
    mood: 'quiet',
    light: ({ aspect }) => opticsRig([0.32, 0.4, 0.48].flatMap(y => [
        ray(aspect, [-0.02, y], [0.42, y], { intensity: 0.7 }),
        ray(aspect, [0.42, y], [0.42 + (0.42 - 0.26), y + (y - AXIS) * 1.6], { intensity: 0.7, spread: 0.01 }, true),
    ])),
    lineArt: context => mergeDiagrams(
        lens(context.aspect * 0.42, AXIS, 0.28, false, context.aspect),
        ...[0.32, 0.48].map((y, i) => mergeDiagrams(
            rayArt(context.aspect, [[0.02, y], [0.42, y], [0.62, y + (y - AXIS) * 2.2]], 0.2 + i * 0.1),
            { paths: [segment([context.aspect * 0.42, y], [context.aspect * 0.26, AXIS], { width: 0.0009, alpha: 0.35, delay: 0.5, dash: [0.005, 0.006] })], nodes: [] },
        )),
        focusMark(context.aspect * 0.26, AXIS, { delay: 0.6 }),
        sparks(context),
    ),
    region: { cx: 0.72, cy: 0.56, w: 0.4, h: 0.72 },
    typography: 'vertical',
    decay: { strength: 0.7, delay: 1.4 },
});

/** 反射（q）：光线打在平面镜上，入射角等于反射角，法线与角标。 */
export const opticsMirror = optics({
    kind: 'optics-mirror',
    label: '反射',
    mood: 'quiet',
    light: ({ aspect }) => opticsRig([
        ray(aspect, [0.12, 0.08], [0.5, 0.6], { width: 0.02, intensity: 1 }),
        ray(aspect, [0.5, 0.6], [0.88, 0.08], { width: 0.02, intensity: 0.8 }, true),
    ], { x: 0.5, y: 0.6, radius: 0.05, intensity: 0.8, streak: 0.7 }),
    lineArt: context => mergeDiagrams(
        mirror(context.aspect * 0.5, 0.6, 0.6, 0),
        rayArt(context.aspect, [[0.12, 0.08], [0.5, 0.6], [0.88, 0.08]]),
        sparks(context),
    ),
    region: { cx: 0.5, cy: 0.34, w: 0.5, h: 0.36 },
    heroSize: 0.07,
    typography: 'crossed',
    decay: { strength: 0.7, delay: 1.4 },
});

/** 折射（n）：光线穿过介质界面向法线偏折。 */
export const opticsRefract = optics({
    kind: 'optics-refract',
    label: '折射',
    mood: 'neutral',
    light: ({ aspect }) => opticsRig([
        ray(aspect, [0.18, 0.05], [0.46, 0.5], { width: 0.02, intensity: 1 }),
        ray(aspect, [0.46, 0.5], [0.58, 1.05], { width: 0.02, intensity: 0.8 }, true),
        ray(aspect, [0.46, 0.5], [0.74, 0.05], { width: 0.01, intensity: 0.3 }, true),
    ], { x: 0.46, y: 0.5, radius: 0.05, intensity: 0.8, streak: 0.8 }),
    lineArt: context => mergeDiagrams(
        interfaceLine(context.aspect, 0.5),
        rayArt(context.aspect, [[0.18, 0.05], [0.46, 0.5], [0.58, 0.98]]),
        { paths: [segment([context.aspect * 0.46, 0.18], [context.aspect * 0.46, 0.82], { width: 0.0009, alpha: 0.35, delay: 0.4, dash: [0.006, 0.006] })], nodes: [] },
        sparks(context),
    ),
    region: { cx: 0.72, cy: 0.3, w: 0.44, h: 0.3 },
    heroSize: 0.07,
    typography: 'horizontal',
    decay: { strength: 1, delay: 1 },
});

/** 光具座（n）：横向光学台上一串透镜与刻度尺，一束光依次穿过。 */
export const opticsBench = optics({
    kind: 'optics-bench',
    label: '光具座',
    mood: 'neutral',
    light: ({ aspect }) => opticsRig([
        ray(aspect, [-0.02, AXIS], [0.3, AXIS], { width: 0.05, spread: 0.01, intensity: 0.8 }),
        { ...ray(aspect, [0.3, AXIS], [0.5, AXIS], { width: 0.05, intensity: 0.9 }), spread: -0.06 },
        { ...ray(aspect, [0.5, AXIS], [0.7, AXIS], { width: 0.02, intensity: 0.9 }), spread: 0.06 },
        ray(aspect, [0.7, AXIS], [1.02, AXIS], { width: 0.05, intensity: 0.7 }, true),
    ], { x: 0.5, y: AXIS, radius: 0.04, intensity: 0.7, streak: 0.6 }),
    lineArt: context => mergeDiagrams(
        ...[0.3, 0.5, 0.7].map((x, i) => lens(context.aspect * x, AXIS, 0.16 + (i % 2) * 0.04, i !== 1, context.aspect, { delay: i * 0.1 })),
        ruler(context.aspect * 0.06, context.aspect * 0.94, 0.58, 40, { delay: 0.3 }),
        sparks(context),
    ),
    typography: 'horizontal',
    decay: { strength: 1, delay: 1 },
});

/** 潜望（n）：光线在两面镜之间折返，从上面拐到下面。 */
export const opticsPeriscope = optics({
    kind: 'optics-periscope',
    label: '潜望',
    mood: 'neutral',
    light: ({ aspect }) => opticsRig([
        ray(aspect, [1.02, 0.14], [0.3, 0.14], { width: 0.02 }),
        ray(aspect, [0.3, 0.14], [0.3, 0.84], { width: 0.02 }),
        ray(aspect, [0.3, 0.84], [1.02, 0.84], { width: 0.02, intensity: 0.8 }, true),
    ], { x: 0.3, y: 0.14, radius: 0.04, intensity: 0.7, streak: 0.4 }),
    lineArt: context => mergeDiagrams(
        mirror(context.aspect * 0.3, 0.14, 0.14, Math.PI / 4),
        mirror(context.aspect * 0.3, 0.84, 0.14, Math.PI / 4, { delay: 0.1 }),
        rayArt(context.aspect, [[0.98, 0.14], [0.3, 0.14], [0.3, 0.84], [0.98, 0.84]]),
        sparks(context),
    ),
    region: { cx: 0.62, cy: 0.49, w: 0.4, h: 0.5 },
    typography: 'vertical',
    decay: { strength: 0.8, delay: 1.2 },
});

/** 光纤（l）：光在一条弯曲的光纤里全反射前进，从另一头喷出一锥光。 */
export const opticsFiber = optics({
    kind: 'optics-fiber',
    label: '光纤',
    mood: 'loud',
    light: () => opticsRig([
        { x: 0.84, y: 0.2, angle: -0.5, spread: 0.3, width: 0.02, length: 0.9, softness: 0.6, intensity: 1.2, streaks: 0.5, streakFreq: 9, streakSpeed: 0.1, core: 0.6,
            pulse: { amplitude: 0.2, period: 2.3, phase: 0 } },
        { x: 0.84, y: 0.2, angle: -0.5, spread: 0.08, width: 0.02, length: 1.2, softness: 0.5, intensity: 0.9, streaks: 0.2, streakFreq: 3, streakSpeed: 0, core: 0.8 },
    ], { x: 0.84, y: 0.2, radius: 0.07, intensity: 1.2, streak: 0.8 }),
    lineArt: context => mergeDiagrams(
        fiber([[context.aspect * 0.04, 0.86], [context.aspect * 0.4, 0.95], [context.aspect * 0.5, 0.1], [context.aspect * 0.84, 0.2]], 0.012),
        sparks(context),
    ),
    region: { cx: 0.46, cy: 0.52, w: 0.6, h: 0.5 },
    typography: 'crossed',
    burst: { mode: 'sung', density: 0.3, every: 2, offset: 0, size: 3.2, tint: [0.8, 0.9, 1] },
    decay: { strength: 1.3, delay: 0.7 },
    starfall: { stars: 380, opening: 3, rain: 60, rainSpeed: 0.3, rainSpread: 0.8, brightness: 1 },
});

/** 暗箱（q）：一道光经小孔穿进暗箱（过孔会聚再散开），背面是倒立的像。 */
export const opticsPinhole = optics({
    kind: 'optics-pinhole',
    label: '暗箱',
    mood: 'quiet',
    light: ({ aspect }) => {
        const distance = (0.45 + 0.02) * aspect;
        return opticsRig([
            { x: -0.02, y: AXIS, angle: 0, spread: -Math.atan(0.15 / distance), width: 0.3, length: 3, softness: 0.4, intensity: 0.8, streaks: 0.3, streakFreq: 6, streakSpeed: 0.05, core: 0.3, reach: distance + 0.3 },
        ], { x: 0.45, y: AXIS, radius: 0.03, intensity: 1, streak: 0.3 });
    },
    lineArt: context => mergeDiagrams(pinholeBox(context.aspect * 0.45 + 0.15, AXIS, 0.3, 0.3), sparks(context)),
    region: { cx: 0.2, cy: 0.52, w: 0.3, h: 0.7 },
    heroSize: 0.07,
    typography: 'vertical',
    decay: { strength: 0.6, delay: 1.6 },
});

/** 望远（l）：物镜把平行光聚到焦点，目镜再把它变成更细的平行光。 */
export const opticsTelescope = optics({
    kind: 'optics-telescope',
    label: '望远',
    mood: 'loud',
    light: ({ aspect }) => opticsRig([0.3, 0.5].flatMap(y => [
        ray(aspect, [-0.02, y], [0.28, y], { width: 0.02 }),
        ray(aspect, [0.28, y], [0.62, AXIS]),
        ray(aspect, [0.72, AXIS + (y - AXIS) * 0.3], [1.02, AXIS + (y - AXIS) * 0.3], { width: 0.02, intensity: 1.1 }, true),
    ]), { x: 0.62, y: AXIS, radius: 0.05, intensity: 1, streak: 0.8 }),
    lineArt: context => mergeDiagrams(
        lens(context.aspect * 0.28, AXIS, 0.36, true, context.aspect),
        lens(context.aspect * 0.72, AXIS, 0.12, true, context.aspect, { delay: 0.1 }),
        ...[0.3, 0.5].map((y, i) => rayArt(context.aspect, [[0.02, y], [0.28, y], [0.62, AXIS], [0.72, AXIS - (y - AXIS) * 0.3], [0.98, AXIS - (y - AXIS) * 0.3]], 0.2 + i * 0.1)),
        focusMark(context.aspect * 0.62, AXIS, { delay: 0.5 }),
        sparks(context),
    ),
    typography: 'horizontal',
    burst: { mode: 'sung', density: 0.25, every: 2, offset: 1, size: 3.2, tint: [1, 0.8, 0.55] },
    decay: { strength: 1.2, delay: 0.8 },
});

/** 追迹（l）：几条光线在画面里反复折射，织成一张网。 */
export const opticsRaytrace = optics({
    kind: 'optics-raytrace',
    label: '追迹',
    mood: 'loud',
    light: ({ aspect, random }) => {
        const points: Frac[] = Array.from({ length: 7 }, (_, i) => [0.05 + (i / 6) * 0.9, 0.1 + random() * 0.55]);
        return opticsRig(points.slice(0, 6).map((point, i) => ray(aspect, point, points[i + 1]!, { intensity: 0.8, width: 0.012 })),
            { x: points[0]![0], y: points[0]![1], radius: 0.05, intensity: 0.9, streak: 0.6 });
    },
    lineArt: ({ aspect, random }) => {
        const art: LineArtSpec[] = [];
        for (let k = 0; k < 4; k += 1) {
            const points: Frac[] = Array.from({ length: 6 }, (_, i) => [0.05 + (i / 5) * 0.9, 0.08 + random() * 0.6]);
            art.push(rayArt(aspect, points, 0.1 + k * 0.1));
        }
        return mergeDiagrams(...art, scatteredSparks({ aspect, count: 16, random, delay: 0.3 }));
    },
    typography: 'crossed',
    decay: { strength: 1.3, delay: 0.7 },
});

export const OPTICS_PROFILES: LumiereProfile[] = [
    opticsConvex, opticsConcave, opticsMirror, opticsRefract, opticsBench,
    opticsPeriscope, opticsFiber, opticsPinhole, opticsTelescope, opticsRaytrace,
];
