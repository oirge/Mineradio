// Copyright (c) 2026 chthollyphile
import { curtains, lampHead, mergeDiagrams, projector } from '../lineart/diagrams';
import type { LineArtSpec } from '../lineart/lineArt';
import { scatteredSparks } from '../lineart/recipes';
import type { BeamSpec, LightRig } from '../light/rig';
import type { LumiereProfile, RigContext } from '../types';
import { FOG, familyOf, MOTES, shaft } from './base';

// src/components/visualizer/lumiere/rigs/stage.ts
// 追光族（舞台）：聚光灯、探照、脚光、逆光、频闪、激光、放映机。烟机的烟更浓，光源处画灯头。
// 排版 4 横 / 3 竖 / 3 纵横。
const stage = familyOf('stage', {
    motes: { ...MOTES, count: 200 },
});

const HAZE = { ...FOG, density: 1.25, tyndallBase: 0.08, scale: 2, driftX: 0.01, driftY: -0.015, warp: 1.1, ambient: 0.035 };

type Frac = [number, number];

/** 从 a 指向 b（画面比例）的一盏灯。 */
const lamp = (aspect: number, a: Frac, b: Frac, overrides: Partial<BeamSpec> = {}): BeamSpec => shaft({
    x: a[0], y: a[1], angle: Math.atan2(b[1] - a[1], (b[0] - a[0]) * aspect), spread: 0.08, width: 0.03, length: 1.3, softness: 0.55,
    intensity: 1, streaks: 0.4, streakFreq: 6, core: 0.6, sway: undefined,
    ...overrides,
});

const stageRig = (beams: BeamSpec[], glare: LightRig['glare'] = null, fog: Partial<LightRig['fog']> = {}): LightRig => ({ beams, fog: { ...HAZE, ...fog }, glare });

/** 每盏灯的灯头线稿 + 闪点。 */
const lampsArt = (context: RigContext, beams: BeamSpec[]): LineArtSpec => mergeDiagrams(
    ...beams.map((beam, i) => lampHead(beam.x * context.aspect, beam.y, beam.angle, 0.035, { delay: i * 0.05 })),
    scatteredSparks({ aspect: context.aspect, count: 10, random: context.random, delay: 0.3 }),
);

const withLamps = (build: (context: RigContext) => LightRig) => ({
    light: build,
    lineArt: (context: RigContext) => lampsArt(context, build(context).beams),
});

const CENTER: Frac = [0.5, 0.56];

/** 独光（n）：一束追光从左上斜打在字上。 */
export const stageSpot = stage({
    kind: 'stage-spot',
    label: '独光',
    mood: 'neutral',
    ...withLamps(({ aspect }) => stageRig([lamp(aspect, [0.14, 0.02], CENTER, { sway: { amplitude: 0.02, period: 12, phase: 0 } })], { x: 0.14, y: 0.02, radius: 0.08, intensity: 0.9, streak: 0.5 })),
    typography: 'horizontal',
    decay: { strength: 1, delay: 1 },
});

/** 交叉（l）：两束光从上方两角打下，交点正是字。 */
export const stageCross = stage({
    kind: 'stage-cross',
    label: '交叉',
    mood: 'loud',
    ...withLamps(({ aspect }) => stageRig([
        lamp(aspect, [0.06, 0.02], CENTER, { sway: { amplitude: 0.03, period: 9, phase: 0 } }),
        lamp(aspect, [0.94, 0.02], CENTER, { sway: { amplitude: 0.03, period: 9, phase: 0.5 } }),
    ], { x: 0.5, y: 0.56, radius: 0.06, intensity: 0.6, streak: 0.6 })),
    typography: 'crossed',
    burst: { mode: 'sung', density: 0.3, every: 2, offset: 1, size: 3.4, tint: [1, 0.75, 0.5] },
    decay: { strength: 1.3, delay: 0.7 },
});

/** 探照（l）：底下几盏探照灯在烟里来回扫。 */
export const stageSearch = stage({
    kind: 'stage-search',
    label: '探照',
    mood: 'loud',
    ...withLamps(() => stageRig([0.15, 0.38, 0.62, 0.85].map((x, i) => shaft({
        x, y: 1.02, angle: -Math.PI / 2, spread: 0.035, width: 0.03, length: 1.4, softness: 0.5, intensity: 0.8, streaks: 0.3, streakFreq: 5, core: 0.6,
        sway: { amplitude: 0.45, period: 7 + i * 1.3, phase: i * 0.27 },
    })))),
    region: { cx: 0.5, cy: 0.44, w: 0.72, h: 0.46 },
    typography: 'horizontal',
    decay: { strength: 1.3, delay: 0.7 },
});

/** 脚光（q）：台口的一排暖光自下而上。 */
export const stageFootlight = stage({
    kind: 'stage-footlight',
    label: '脚光',
    mood: 'quiet',
    ...withLamps(() => stageRig([0.25, 0.5, 0.75].map(x => shaft({
        x, y: 1.03, angle: -Math.PI / 2, spread: 0.22, width: 0.08, length: 0.7, softness: 0.9, intensity: 0.6, streaks: 0.4, streakFreq: 10, core: 0.3,
        tint: [1, 0.8, 0.6], sway: undefined,
    })), null, { driftY: -0.03 })),
    region: { cx: 0.5, cy: 0.46, w: 0.5, h: 0.62 },
    typography: 'vertical',
    decay: { strength: 0.6, delay: 1.6 },
});

/** 逆光（n）：字后面一团强光，光束从背后往外放射，字像剪影。 */
export const stageBacklight = stage({
    kind: 'stage-backlight',
    label: '逆光',
    mood: 'neutral',
    light: () => stageRig(Array.from({ length: 6 }, (_, k) => shaft({
        x: 0.5, y: 0.5, angle: (k / 6) * Math.PI * 2 + 0.5, spread: 0.12, width: 0.02, length: 0.8, softness: 0.7, intensity: 0.6,
        streaks: 0.6, streakFreq: 10, core: 0.4, sway: { amplitude: 0.05, period: 11, phase: k / 6 },
    })), { x: 0.5, y: 0.5, radius: 0.22, intensity: 1.2, streak: 0.8 }),
    lineArt: ({ aspect, random }) => scatteredSparks({ aspect, count: 18, random, delay: 0.3 }),
    region: { cx: 0.5, cy: 0.5, w: 0.72, h: 0.5 },
    typography: 'crossed',
    decay: { strength: 1, delay: 1 },
});

/** 针光（q）：一道极窄的光锥，只照亮字那一小块。 */
export const stagePinspot = stage({
    kind: 'stage-pinspot',
    label: '针光',
    mood: 'quiet',
    ...withLamps(({ aspect }) => stageRig([lamp(aspect, [0.5, 0.02], CENTER, { spread: 0.03, width: 0.01, intensity: 0.9, core: 0.9 })], null, { ambient: 0.015 })),
    typography: 'horizontal',
    decay: { strength: 0.6, delay: 1.6 },
});

/** 频闪（l）：几盏灯随节拍一明一灭地频闪。 */
export const stageStrobe = stage({
    kind: 'stage-strobe',
    label: '频闪',
    mood: 'loud',
    ...withLamps(({ aspect }) => stageRig([0.1, 0.36, 0.64, 0.9].map((x, i) => lamp(aspect, [x, 0.02], [0.5, 0.6], {
        spread: 0.08, intensity: 0.55, pulse: { amplitude: 0.95, period: 0.5, phase: i * 0.25 },
    })), { x: 0.5, y: 0.02, radius: 0.2, intensity: 0.6, streak: 0.4 })),
    typography: 'crossed',
    burst: { mode: 'sweep', density: 0.5, every: 2, offset: 0, size: 3, tint: [1, 0.9, 0.8] },
    decay: { strength: 1.4, delay: 0.6 },
});

/** 幕缝（q）：帷幕的缝隙里透出一道竖直的光。 */
export const stageCurtain = stage({
    kind: 'stage-curtain',
    label: '幕缝',
    mood: 'quiet',
    light: () => stageRig([shaft({ spread: 0.01, width: 0.04, length: 1.6, softness: 0.5, intensity: 0.9, streaks: 0.3, core: 0.7, sway: undefined })],
        { x: 0.5, y: -0.02, radius: 0.08, intensity: 0.8, streak: 0.5 }, { ambient: 0.02 }),
    lineArt: ({ aspect, random }) => mergeDiagrams(curtains(aspect, 0.06), scatteredSparks({ aspect, count: 8, random, delay: 0.3, region: [0.3, 0.2, 0.7, 0.9] })),
    region: { cx: 0.5, cy: 0.5, w: 0.3, h: 0.66 },
    typography: 'vertical',
    decay: { strength: 0.6, delay: 1.6 },
});

/** 激光（l）：台底一扇细锐的激光线，在烟里扫动。 */
export const stageLaser = stage({
    kind: 'stage-laser',
    label: '激光',
    mood: 'loud',
    ...withLamps(() => stageRig(Array.from({ length: 6 }, (_, k) => shaft({
        x: 0.5, y: 1.02, angle: -Math.PI / 2 + (k - 2.5) * 0.22, spread: 0.002, width: 0.004, length: 2, softness: 0.3, intensity: 1.2,
        streaks: 0, core: 0.9, sway: { amplitude: 0.25, period: 4.5, phase: k * 0.08 },
    })), { x: 0.5, y: 1.0, radius: 0.06, intensity: 1, streak: 0.6 }, { density: 1.4 })),
    region: { cx: 0.5, cy: 0.4, w: 0.72, h: 0.46 },
    typography: 'horizontal',
    decay: { strength: 1.3, delay: 0.7 },
});

/** 放映（n）：左边一台放映机，光锥里满是浮尘，字像投在光里。 */
export const stageProjector = stage({
    kind: 'stage-projector',
    label: '放映',
    mood: 'neutral',
    light: () => stageRig([shaft({ x: 0.12, y: 0.4, angle: 0.05, spread: 0.2, width: 0.02, length: 1.8, softness: 0.4, intensity: 1, streaks: 0.5, streakFreq: 9, core: 0.4, sway: undefined,
        pulse: { amplitude: 0.05, period: 0.12, phase: 0 } })], { x: 0.12, y: 0.4, radius: 0.05, intensity: 1, streak: 0.4 }),
    lineArt: ({ aspect, random }) => mergeDiagrams(projector(aspect * 0.12, 0.4, 0.1), scatteredSparks({ aspect, count: 10, random, delay: 0.3 })),
    motes: { ...MOTES, count: 380, driftX: 0.004, swirl: 0.03, gain: 1.8 },
    region: { cx: 0.62, cy: 0.5, w: 0.44, h: 0.58 },
    typography: 'vertical',
    decay: { strength: 1, delay: 1 },
});

export const STAGE_PROFILES: LumiereProfile[] = [
    stageSpot, stageCross, stageSearch, stageFootlight, stageBacklight,
    stagePinspot, stageStrobe, stageCurtain, stageLaser, stageProjector,
];
