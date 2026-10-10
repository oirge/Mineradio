// Copyright (c) 2026 chthollyphile
import { circle, gridPanel, grating, mergeDiagrams, moire, polarizers, rings, standingWave, twoSources } from '../lineart/diagrams';
import { mergeSpecs, scatteredSparks, slitBarrier, viewfinderFrame } from '../lineart/recipes';
import type { WaveSpec } from '../light/rig';
import type { LumiereProfile, RigContext } from '../types';
import { familyOf, GLARE, rig, shaft, STARFALL } from './base';

// src/components/visualizer/lumiere/rigs/wave.ts
// 衍射族（干涉与衍射）：条纹、光环、莫尔、虹彩。干涉模块在一块区域里发光，窗影与色散做光栅、莫尔、薄膜。
// 排版 4 横 / 3 竖 / 3 纵横。
const wave = familyOf('wave', { starfall: { ...STARFALL, rain: 40 } });

const sparks = ({ aspect, random }: RigContext) => scatteredSparks({ aspect, count: 12, random, delay: 0.3 });
const fringes = (spec: WaveSpec) => ({ wave: spec });

/** 双缝（n）：顶光穿过挡板上的两道缝，下方屏上是明暗相间的干涉条纹。 */
export const waveSlits = wave({
    kind: 'wave-slits',
    label: '双缝',
    mood: 'neutral',
    light: rig([shaft({ spread: 0.05, width: 0.04, length: 0.6, intensity: 0.9 })], { density: 0.9 }, GLARE,
        fringes({ mode: 'slits', cx: 0.5, cy: 0.72, radius: 0.3, frequency: 5, speed: 0.4, strength: 0.55 })),
    lineArt: context => mergeSpecs(
        slitBarrier({ cx: context.aspect * 0.5, y: 0.3, width: context.aspect * 0.5, gap: 0.012, separation: 0.08 }),
        viewfinderFrame({ aspect: context.aspect, left: 0.2, top: 0.52, right: 0.8, bottom: 0.92, delay: 0.2, alpha: 0.28 }),
        sparks(context),
    ),
    region: { cx: 0.5, cy: 0.5, w: 0.72, h: 0.5 },
    typography: 'crossed',
    decay: { strength: 1, delay: 1 },
});

/** 牛顿环（q）：一圈圈明暗相间的同心环，字在环心。 */
export const waveNewton = wave({
    kind: 'wave-newton',
    label: '牛顿环',
    mood: 'quiet',
    light: rig([shaft({ spread: 0.06, width: 0.04, length: 0.6, intensity: 0.6 })], { density: 0.7 }, { ...GLARE, intensity: 0.5 },
        fringes({ mode: 'rings', cx: 0.5, cy: 0.5, radius: 0.4, frequency: 5, speed: 0.3, strength: 0.5, shield: 0.75 })),
    lineArt: context => mergeDiagrams(rings(context.aspect * 0.5, 0.5, 0.4, 6), sparks(context)),
    region: { cx: 0.5, cy: 0.5, w: 0.4, h: 0.62 },
    typography: 'vertical',
    decay: { strength: 0.6, delay: 1.6 },
});

/** 艾里斑（q）：一个点光源的衍射亮斑与一圈圈淡淡的外环。 */
export const waveAiry = wave({
    kind: 'wave-airy',
    label: '艾里斑',
    mood: 'quiet',
    light: rig([shaft({ x: 0.5, y: -0.05, spread: 0.02, width: 0.01, length: 0.6, intensity: 0.5, reach: 0.4 })], { density: 0.6 },
        { x: 0.5, y: 0.4, radius: 0.04, intensity: 1, streak: 0.4 },
        fringes({ mode: 'airy', cx: 0.5, cy: 0.4, radius: 0.3, frequency: 3, speed: 0, strength: 0.7 })),
    lineArt: context => mergeDiagrams(rings(context.aspect * 0.5, 0.4, 0.3, 4, { alpha: 0.3 }), sparks(context)),
    region: { cx: 0.5, cy: 0.72, w: 0.72, h: 0.36 },
    typography: 'horizontal',
    decay: { strength: 0.6, delay: 1.6 },
});

/** 光栅（n）：一束光打到光栅上，下面分出几级带彩边的衍射光。 */
export const waveGrating = wave({
    kind: 'wave-grating',
    label: '光栅',
    mood: 'neutral',
    light: rig([
        shaft({ spread: 0.01, width: 0.03, length: 2, intensity: 0.9, reach: 0.32, sway: undefined }),
        ...[-2, -1, 0, 1, 2].map(k => shaft({
            y: 0.3, angle: Math.PI / 2 + k * 0.32, spread: 0.02, width: 0.02, length: 1.2, intensity: 0.8 - Math.abs(k) * 0.15,
            streaks: 0.2, core: 0.6, spectrum: k === 0 ? 0 : 0.8, sway: undefined,
        })),
    ], { density: 0.9 }, { ...GLARE, y: 0.3, radius: 0.05, intensity: 0.9, streak: 0.6 }),
    lineArt: context => mergeDiagrams(grating(context.aspect * 0.5, 0.3, context.aspect * 0.4, 16), sparks(context)),
    region: { cx: 0.5, cy: 0.7, w: 0.72, h: 0.38 },
    typography: 'horizontal',
    decay: { strength: 1, delay: 1 },
});

/** 波叠（l）：两个点源的圆波相互干涉，明暗的双曲线条纹。 */
export const waveSources = wave({
    kind: 'wave-sources',
    label: '波叠',
    mood: 'loud',
    light: rig([shaft({ spread: 0.15, intensity: 0.4 })], { density: 0.8 }, { ...GLARE, intensity: 0.5 },
        fringes({ mode: 'sources', cx: 0.5, cy: 0.5, radius: 0.46, frequency: 4, speed: 1.2, strength: 0.6, separation: 0.14 })),
    lineArt: context => mergeDiagrams(twoSources(context.aspect * 0.5, 0.5, 0.14, 0.3), sparks(context)),
    typography: 'crossed',
    burst: { mode: 'sung', density: 0.3, every: 2, offset: 0, size: 3.2, tint: [0.85, 0.9, 1] },
    decay: { strength: 1.3, delay: 0.7 },
});

/** 莫尔（n）：两层细光栅错开一点角度，叠出缓慢流动的莫尔光纹。 */
export const waveMoire = wave({
    kind: 'wave-moire',
    label: '莫尔',
    mood: 'neutral',
    light: rig([
        shaft({ spread: 0.2, width: 0.3, length: 1.3, softness: 0.6, intensity: 0.6, streaks: 0, core: 0.2, gobo: { pattern: 'blinds', frequency: 22, duty: 0.5, drift: 0.02 }, sway: undefined }),
        shaft({ angle: Math.PI / 2 + 0.06, spread: 0.2, width: 0.3, length: 1.3, softness: 0.6, intensity: 0.6, streaks: 0, core: 0.2, gobo: { pattern: 'blinds', frequency: 23, duty: 0.5, drift: -0.02 }, sway: { amplitude: 0.03, period: 14, phase: 0 } }),
    ], { density: 0.8 }, { ...GLARE, intensity: 0.5 }),
    lineArt: context => mergeDiagrams(moire(context.aspect * 0.5, 0.32, 0.4, 24, 0.08), sparks(context)),
    typography: 'horizontal',
    decay: { strength: 1, delay: 1 },
});

/** 薄膜（q）：肥皂泡一样流动的虹彩。 */
export const waveFilm = wave({
    kind: 'wave-film',
    label: '薄膜',
    mood: 'quiet',
    light: rig([shaft({ spread: 0.4, width: 0.3, length: 1.2, softness: 0.95, intensity: 0.45, streaks: 0.6, streakFreq: 3, streakSpeed: 0.2, core: 0.2, spectrum: 1,
        sway: { amplitude: 0.15, period: 13, phase: 0 } })], { density: 0.7 }, null,
    fringes({ mode: 'rings', cx: 0.5, cy: 0.4, radius: 0.3, frequency: 1.6, speed: 0.6, strength: 0.25 })),
    lineArt: context => mergeDiagrams(
        { paths: [circle(context.aspect * 0.5, 0.4, 0.3, { width: 0.0016, alpha: 0.45 }), circle(context.aspect * 0.5 - 0.08, 0.3, 0.06, { width: 0.001, alpha: 0.3, delay: 0.2 })], nodes: [] },
        sparks(context),
    ),
    region: { cx: 0.5, cy: 0.5, w: 0.4, h: 0.62 },
    typography: 'vertical',
    decay: { strength: 0.6, delay: 1.6 },
});

/** 偏振（n）：两片偏振片一转，透过来的光一明一暗地呼吸。 */
export const wavePolar = wave({
    kind: 'wave-polar',
    label: '偏振',
    mood: 'neutral',
    // 第一束穿过第一片、走到第二片；第二束从第二片出发，随偏振片转动一明一暗（按画幅比例定位）。
    light: ({ aspect }) => {
        const second = aspect * 0.5 + 0.12;
        return rig([
            shaft({ x: -0.02, y: 0.36, angle: 0, spread: 0.02, width: 0.14, length: 3, intensity: 0.8, streaks: 0.2, core: 0.4, reach: second + 0.02 * aspect, sway: undefined }),
            shaft({ x: second / aspect, y: 0.36, angle: 0, spread: 0.02, width: 0.14, length: 3, intensity: 0.7, streaks: 0.2, core: 0.4, sway: undefined, pulse: { amplitude: 0.9, period: 6, phase: 0 } }),
        ], { density: 0.8 }, null)();
    },
    lineArt: context => mergeDiagrams(polarizers(context.aspect * 0.5, 0.36, 0.1, 0.24, Math.PI / 3), sparks(context)),
    region: { cx: 0.5, cy: 0.7, w: 0.72, h: 0.36 },
    typography: 'horizontal',
    decay: { strength: 1, delay: 1 },
});

/** 驻波（l）：字行上方几条驻波一样的光线，随节拍一起振动。 */
export const waveStanding = wave({
    kind: 'wave-standing',
    label: '驻波',
    mood: 'loud',
    light: rig([0.26, 0.34, 0.42].map((y, i) => shaft({
        x: -0.02, y, angle: 0, spread: 0.004, width: 0.01, length: 3, intensity: 0.7, streaks: 0.6, streakFreq: 4, core: 0.8, sway: undefined,
        pulse: { amplitude: 0.6, period: 1.2, phase: i / 3 },
    })), { density: 0.9 }, null),
    lineArt: context => mergeDiagrams(standingWave(context.aspect * 0.08, context.aspect * 0.92, 0.34, 0.07, 6), sparks(context)),
    typography: 'crossed',
    decay: { strength: 1.3, delay: 0.7 },
});

/** 全息（l）：字像一张全息片，细密的斜纹与流动的虹彩。 */
export const waveHolo = wave({
    kind: 'wave-holo',
    label: '全息',
    mood: 'loud',
    light: rig([shaft({ spread: 0.3, width: 0.3, length: 1.3, softness: 0.8, intensity: 0.8, streaks: 0.3, core: 0.3, spectrum: 0.8,
        gobo: { pattern: 'lattice', frequency: 24, duty: 0.7, drift: 0.15 }, sway: { amplitude: 0.1, period: 10, phase: 0 } })], { density: 0.8 }, { ...GLARE, intensity: 0.6 },
    fringes({ mode: 'rings', cx: 0.5, cy: 0.5, radius: 0.5, frequency: 8, speed: 1, strength: 0.15 })),
    lineArt: context => mergeDiagrams(gridPanel(context.aspect * 0.3, 0.15, context.aspect * 0.4, 0.7, 6, 8, true, { alpha: 0.3 }), sparks(context)),
    region: { cx: 0.5, cy: 0.5, w: 0.4, h: 0.62 },
    typography: 'vertical',
    decay: { strength: 1.3, delay: 0.7 },
});

export const WAVE_PROFILES: LumiereProfile[] = [
    waveSlits, waveNewton, waveAiry, waveGrating, waveSources,
    waveMoire, waveFilm, wavePolar, waveStanding, waveHolo,
];
