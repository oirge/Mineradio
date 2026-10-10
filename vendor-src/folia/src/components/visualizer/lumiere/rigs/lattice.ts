// Copyright (c) 2026 chthollyphile
import { archWindow, canopy, crossWindow, doorSlit, gridPanel, mergeDiagrams, roseWindow, tallWindows } from '../lineart/diagrams';
import { blindsWindow, mergeSpecs, scatteredSparks } from '../lineart/recipes';
import type { LumiereProfile } from '../types';
import { familyOf, GLARE, MOTES, rig, shaft, STARFALL } from './base';

// src/components/visualizer/lumiere/rigs/lattice.ts
// 窗隙族（窗光与窗影）：光从窗、门缝、叶隙斜射进来，窗影把光束切成图样。排版 4 横 / 3 竖 / 3 纵横。
const lattice = familyOf('lattice', {
    region: { cx: 0.56, cy: 0.58, w: 0.66, h: 0.5 },
    motes: { ...MOTES, driftX: 0.008, driftY: -0.006 },
});

/** 从左上的窗斜射进来的宽光（窗光的公共形状）。 */
const windowBeam = (overrides: Parameters<typeof shaft>[0] = {}) => shaft({
    x: 0.1, y: 0.06, angle: 0.62, spread: 0.1, width: 0.34, length: 1.3, softness: 0.35,
    intensity: 1, streaks: 0.25, streakFreq: 4, core: 0.3,
    sway: { amplitude: 0.01, period: 17, phase: 0 },
    ...overrides,
});

const sparks = (region?: [number, number, number, number]) => ({ aspect, random }: { aspect: number; random: () => number }) => (
    scatteredSparks({ aspect, count: 14, random, delay: 0.3, region: region ?? [0.3, 0.3, 0.95, 0.9] })
);

/** 百叶（n）：左上的窗透进一道宽斜光，百叶把它切成一条条平行的光带。 */
export const latticeBlinds = lattice({
    kind: 'lattice-blinds',
    label: '百叶',
    mood: 'neutral',
    light: rig([windowBeam({ gobo: { pattern: 'blinds', frequency: 13, duty: 0.52, drift: 0.02 } })],
        { driftX: 0.012, driftY: -0.02 }, { ...GLARE, x: 0.1, y: 0.06, radius: 0.16, intensity: 0.8 }),
    lineArt: context => mergeSpecs(
        blindsWindow({ x: context.aspect * 0.03, y: 0.02, w: context.aspect * 0.16, h: 0.26, slats: 9, alpha: 0.5 }),
        sparks()(context),
    ),
    typography: 'horizontal',
    decay: { strength: 1, delay: 1 },
});

/** 十字窗（q）：右上的十字窗投下四块光斑，中间一道窗棂的影子。 */
export const latticeCross = lattice({
    kind: 'lattice-cross',
    label: '十字窗',
    mood: 'quiet',
    light: rig([windowBeam({ x: 0.9, angle: Math.PI - 0.7, width: 0.3, intensity: 0.9, gobo: { pattern: 'cross', frequency: 0, duty: 0.16, drift: 0 } })],
        { driftX: -0.008 }, { ...GLARE, x: 0.9, y: 0.06, radius: 0.14, intensity: 0.7 }),
    lineArt: context => mergeSpecs(
        crossWindow(context.aspect * 0.8, 0.01, context.aspect * 0.16, 0.26),
        sparks([0.05, 0.3, 0.7, 0.9])(context),
    ),
    region: { cx: 0.4, cy: 0.52, w: 0.6, h: 0.62 },
    typography: 'vertical',
    decay: { strength: 0.7, delay: 1.4 },
});

/** 拱窗（l）：高高的拱窗斜照下一道长长的丁达尔光束。 */
export const latticeArch = lattice({
    kind: 'lattice-arch',
    label: '拱窗',
    mood: 'loud',
    light: rig([
        windowBeam({ x: 0.14, y: -0.02, angle: 0.95, width: 0.14, spread: 0.06, length: 1.6, intensity: 1.3, streaks: 0.55, streakFreq: 8, core: 0.6 }),
        windowBeam({ x: 0.14, y: -0.02, angle: 0.95, width: 0.3, spread: 0.2, length: 0.9, softness: 0.9, intensity: 0.3, streaks: 0.8, streakFreq: 22 }),
    ], { density: 1.1 }, { ...GLARE, x: 0.14, y: 0.0, radius: 0.18, intensity: 1.1, streak: 0.6 }),
    lineArt: context => mergeSpecs(
        archWindow(context.aspect * 0.08, -0.06, context.aspect * 0.12, 0.32),
        sparks()(context),
    ),
    typography: 'crossed',
    decay: { strength: 1.2, delay: 0.8 },
    starfall: { ...STARFALL, rain: 90, rainSpread: 0.8 },
});

/** 玫瑰窗（l）：顶上一扇圆花窗，放射出一扇细光束。 */
export const latticeRose = lattice({
    kind: 'lattice-rose',
    label: '玫瑰窗',
    mood: 'loud',
    light: rig([-2, -1, 0, 1, 2, 3].map(k => shaft({
        y: 0.08, angle: Math.PI / 2 + (k - 0.5) * 0.2, spread: 0.035, width: 0.03, length: 1, intensity: 0.65 - Math.abs(k - 0.5) * 0.06,
        streaks: 0.4, streakFreq: 5, sway: { amplitude: 0.015, period: 13, phase: k * 0.1 },
    })), {}, { ...GLARE, y: 0.08, radius: 0.16, intensity: 1.1, streak: 0.5 }),
    lineArt: ({ aspect, random }) => mergeSpecs(
        roseWindow(aspect * 0.5, 0.08, 0.12),
        scatteredSparks({ aspect, count: 16, random, delay: 0.3 }),
    ),
    region: { cx: 0.5, cy: 0.6, w: 0.72, h: 0.46 },
    typography: 'horizontal',
    decay: { strength: 1.2, delay: 0.8 },
    starfall: STARFALL,
});

/** 门缝（q）：左边一道门缝，极窄的光横着划过画面。 */
export const latticeSlit = lattice({
    kind: 'lattice-slit',
    label: '门缝',
    mood: 'quiet',
    light: rig([shaft({ x: 0.1, y: 0.42, angle: 0.06, spread: 0.02, width: 0.012, length: 2.4, intensity: 1, streaks: 0.3, streakFreq: 3, core: 0.8, sway: { amplitude: 0.01, period: 15, phase: 0 } })],
        { density: 0.8, ambient: 0.015 }, { ...GLARE, x: 0.1, y: 0.42, radius: 0.08, intensity: 0.8, streak: 0.9 }),
    lineArt: ({ aspect, random }) => mergeSpecs(
        doorSlit(aspect * 0.1, 0.08, 0.86, 0.012),
        scatteredSparks({ aspect, count: 10, random, delay: 0.3, region: [0.2, 0.2, 0.95, 0.9] }),
    ),
    region: { cx: 0.55, cy: 0.5, w: 0.6, h: 0.64 },
    typography: 'vertical',
    decay: { strength: 0.6, delay: 1.6 },
});

/** 障子（q）：方格纸窗透进柔和的漫射光，窗格的细影子落在光里。 */
export const latticeShoji = lattice({
    kind: 'lattice-shoji',
    label: '障子',
    mood: 'quiet',
    light: rig([windowBeam({ x: 0.12, y: 0.1, angle: 0.4, width: 0.5, spread: 0.18, softness: 0.95, intensity: 0.7, streaks: 0.1, core: 0.2,
        gobo: { pattern: 'blinds', frequency: 10, duty: 0.86, drift: 0 } })], { density: 0.7, tyndallBase: 0.25 }, null),
    lineArt: ({ aspect, random }) => mergeSpecs(
        gridPanel(aspect * 0.02, 0.06, aspect * 0.18, 0.4, 3, 5),
        scatteredSparks({ aspect, count: 10, random, delay: 0.3 }),
    ),
    typography: 'horizontal',
    decay: { strength: 0.6, delay: 1.6 },
});

/** 格栅（n）：菱形格栅的光影在字上流动。 */
export const latticeGrille = lattice({
    kind: 'lattice-grille',
    label: '格栅',
    mood: 'neutral',
    light: rig([windowBeam({ width: 0.4, spread: 0.12, intensity: 1, gobo: { pattern: 'lattice', frequency: 9, duty: 0.62, drift: 0.04 } })],
        { driftX: 0.01 }, { ...GLARE, x: 0.1, y: 0.06, radius: 0.14, intensity: 0.7 }),
    lineArt: context => mergeSpecs(
        gridPanel(context.aspect * 0.02, 0.02, context.aspect * 0.16, 0.26, 4, 4, true),
        sparks()(context),
    ),
    typography: 'crossed',
    decay: { strength: 1, delay: 1 },
});

/** 扫窗（n）：光源在动，百叶的影子扫过整句。 */
export const latticeSweep = lattice({
    kind: 'lattice-sweep',
    label: '扫窗',
    mood: 'neutral',
    light: rig([windowBeam({ angle: 0.75, width: 0.3, intensity: 1, sway: { amplitude: 0.32, period: 10, phase: 0 }, gobo: { pattern: 'blinds', frequency: 11, duty: 0.55, drift: 0.05 } })],
        { driftX: 0.01 }, { ...GLARE, x: 0.1, y: 0.06, radius: 0.14, intensity: 0.7 }),
    lineArt: context => mergeSpecs(
        blindsWindow({ x: context.aspect * 0.03, y: 0.02, w: context.aspect * 0.16, h: 0.26, slats: 8, alpha: 0.45 }),
        sparks()(context),
    ),
    typography: 'horizontal',
    decay: { strength: 1, delay: 1 },
    camera: { push: 0.02, driftX: 0.012, driftY: 0 },
});

/** 叶隙（q）：树叶缝隙里漏下来的斑驳光，随风摇曳。 */
export const latticeKomorebi = lattice({
    kind: 'lattice-komorebi',
    label: '叶隙',
    mood: 'quiet',
    light: rig([
        shaft({ x: 0.35, y: -0.05, angle: 1.35, spread: 0.2, width: 0.2, length: 1.3, softness: 0.7, intensity: 1, streaks: 0.2, core: 0.3,
            gobo: { pattern: 'leaves', frequency: 7, duty: 0.52, drift: 0.12 }, sway: { amplitude: 0.03, period: 7, phase: 0 } }),
        shaft({ x: 0.72, y: -0.05, angle: 1.8, spread: 0.14, width: 0.12, length: 1.1, softness: 0.7, intensity: 0.7, streaks: 0.2, core: 0.3,
            gobo: { pattern: 'leaves', frequency: 8, duty: 0.55, drift: 0.1 }, sway: { amplitude: 0.03, period: 8, phase: 0.4 } }),
    ], { density: 0.9, driftX: 0.01 }, null),
    lineArt: ({ aspect, random }) => mergeDiagrams(canopy(aspect, random), scatteredSparks({ aspect, count: 12, random, delay: 0.3 })),
    motes: { ...MOTES, count: 220, driftX: 0.01, driftY: 0.004, swirl: 0.03 },
    region: { cx: 0.5, cy: 0.54, w: 0.72, h: 0.6 },
    typography: 'vertical',
    decay: { strength: 0.8, delay: 1.2 },
});

/** 殿堂（l）：一排高窗照下平行的斜光，层层烟雾。 */
export const latticeNave = lattice({
    kind: 'lattice-nave',
    label: '殿堂',
    mood: 'loud',
    light: rig([0.12, 0.34, 0.56, 0.78].map((x, i) => windowBeam({
        x, y: -0.02, angle: 1.1, width: 0.06, spread: 0.05, length: 1.5, softness: 0.5, intensity: 0.75, streaks: 0.5, streakFreq: 6, core: 0.5,
        sway: { amplitude: 0.008, period: 19, phase: i * 0.2 },
    })), { density: 1.2, driftX: 0.006, driftY: -0.03 }, { ...GLARE, x: 0.45, y: 0.0, radius: 0.25, intensity: 0.6, streak: 0.3 }),
    lineArt: ({ aspect, random }) => mergeSpecs(
        tallWindows(aspect * 0.05, aspect * 0.95, -0.08, 0.26, 4),
        scatteredSparks({ aspect, count: 18, random, delay: 0.3 }),
    ),
    typography: 'crossed',
    decay: { strength: 1.2, delay: 0.8 },
    starfall: { ...STARFALL, rain: 80, rainSpread: 1.2 },
});

export const LATTICE_PROFILES: LumiereProfile[] = [
    latticeBlinds, latticeCross, latticeArch, latticeRose, latticeSlit,
    latticeShoji, latticeGrille, latticeSweep, latticeKomorebi, latticeNave,
];
