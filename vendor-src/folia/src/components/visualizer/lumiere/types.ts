// Copyright (c) 2026 chthollyphile
import type { Mood } from './lumiereKernel';
import type { LineArtSpec } from './lineart/lineArt';
import type { MotesSpec } from './light/motes';
import type { LightRig } from './light/rig';
import type { StarfallSpec } from './light/starfall';
import type { DecaySpec, WindowTypography } from './text/lyricWindow';

// src/components/visualizer/lumiere/types.ts
// 绘光的光位（镜头风格）profile 与 tuning。一个光位 = 光束组 + 烟雾 + 浮尘 + 前景散景 + 线稿配方 +
// 文字区 + 运镜，全是数据，由同一套场景构建器解释（设计见 lumisynth 仓库 docs/LUMIERE.md 第二节）。
// LumiereSceneTuning 是场景直接读的参数；用户可见的 LumiereTuning 在 src/types.ts，由运行时映射过来。

export interface RigContext {
    /** 宽高比。 */
    aspect: number;
    /** 按单元播种的随机数。 */
    random: () => number;
}

/** 十字爆闪（EVA 式，行内一串小十字），只给部分光位（冠冕、日食、频闪、聚点……）。 */
export interface BurstSpec {
    /** sung：挑中的字在被唱到时各自引爆；sweep：行首一口气沿整行连续炸开。 */
    mode: 'sung' | 'sweep';
    /** 一行里挑多少比例的字（0..1，按种子）。 */
    density: number;
    /** 每隔几行一次（1 = 每行），从第 offset 行开始。 */
    every: number;
    offset: number;
    /** 竖向光柱长度（以当时的字号为单位）。 */
    size: number;
    /** 乘在光色上（偏橙红就是 EVA 的味道）。 */
    tint: [number, number, number];
}

export interface LumiereProfile {
    kind: string;
    label: string;
    family: string;
    mood: Mood;
    light: (context: RigContext) => LightRig;
    motes: MotesSpec;
    /** 前景散景（在文字之上）；null 表示没有。 */
    front: MotesSpec | null;
    lineArt: (context: RigContext) => LineArtSpec;
    /** 文字区（画面比例，中心 + 宽高）。 */
    region: { cx: number; cy: number; w: number; h: number };
    /** 当前行字号（占画面高度）。 */
    heroSize: number;
    /** 默认排版：横排为主 / 竖排为主 / 纵横交错。 */
    typography: WindowTypography;
    /** 崩解：字点亮后多久开始漂离、强度。 */
    decay: DecaySpec;
    /** 十字爆闪；不给则没有。 */
    burst?: BurstSpec;
    /** 星空点亮（开场光点倾泻 + 星空 + 光雨）；不给则没有，主光柱照常淡入。 */
    starfall?: StarfallSpec;
    /** 背景歌词碎片的最大字号（占画面高度）；不给用 0.34。 */
    echo?: { size: number };
    /** 线稿亮度倍率（以线稿为主角的族——叶脉、星象——调高）；不给为 1。 */
    artGain?: number;
    camera: {
        /** 镜头全程推近多少（1 + push）。 */
        push: number;
        /** 全程平移（画面比例）。 */
        driftX: number;
        driftY: number;
    };
}

export interface LumiereSceneTuning {
    /** 光强倍率。 */
    lightIntensity: number;
    /** 光束随低频变亮的程度（1 = 低频打满时亮 15%，0 = 不随音乐变）。 */
    audioResponse: number;
    /** 烟雾浓度倍率。 */
    fogDensity: number;
    /**
     * 暗场强度（0..1，浅色主题保底 0.94，见 lumiereDarkField.ts）。场景不读它：暗场底是运行时在所有场景之下
     * 铺的一整块底，每帧从这份共享 tuning 现读。
     */
    darkField: number;
    /** 浮尘数量倍率。 */
    moteAmount: number;
    /** 图形组（光场、线稿、浮尘）bloom 强度倍率（乘在默认的高值上）。 */
    bloom: number;
    /** 文字组 bloom 强度倍率。 */
    textBloom: number;
    /** 未唱字的不透明度。 */
    unlitOpacity: number;
    /** 当前行之外显示几行。 */
    windowNeighbors: 1 | 2;
    /** 崩解强度倍率（0 = 字一直待在排版位置上）。 */
    decay: number;
    /** 背景歌词（巨大空心字）的亮度倍率（0 = 关）。 */
    echo: number;
    /** 烟雾噪声倍频数（画质）。 */
    fogOctaves: number;
    lineArt: boolean;
    frontBokeh: boolean;
    /** 所有换位都让字沿曲线飞、带径迹（默认只有纵横交错或横竖切换时飞）。 */
    trails: boolean;
    /** 隐藏歌词径迹，字的飞行仍照常；每帧从共享 tuning 现读。 */
    hideTrails: boolean;
    /** 画框装饰（取景器的四角、刻度与对位十字）。 */
    overlayFrame: boolean;
    /**
     * 仅显示歌词文字（设置项，默认关）：只画字和字上的效果，图形组（光场、烟雾、星空、线稿、浮尘）与前景不画、
     * 也不每帧更新；没有开场、背景碎片与主题图标，画框与片尾卡的光也不画。光束照常在 CPU 上算，字仍按光束明暗。
     */
    textOnly: boolean;
    /** 关键字着色：主题 wordColors 的关键字点亮时带关键字色（字、光晕、闪点、十字爆闪、背景碎片）。 */
    keywordColors: boolean;
    /** 主题图标：主题 lyricsIcons 的 Lucide 图标画成线稿，散落在文字区外（独立于 lineArt 开关）。 */
    themeIcons: boolean;
    /** 主题色占比 0..1：0 = 香槟金光，越高光色越接近强调色、字色越接近主色 / 次色（见 resolveLumierePalette）。 */
    themeColorMix: number;
}

export const DEFAULT_LUMIERE_SCENE_TUNING: LumiereSceneTuning = {
    lightIntensity: 1,
    audioResponse: 1,
    fogDensity: 1,
    darkField: 0.75,
    moteAmount: 1,
    bloom: 1,
    textBloom: 1,
    unlitOpacity: 0.22,
    windowNeighbors: 2,
    decay: 1,
    echo: 1,
    fogOctaves: 5,
    lineArt: true,
    frontBokeh: true,
    overlayFrame: true,
    trails: false,
    hideTrails: false,
    textOnly: false,
    keywordColors: true,
    themeIcons: true,
    themeColorMix: 0.3,
};

/** bloom 的默认值：绘光的主要观感，给得高。 */
export interface BloomPreset {
    strength: number;
    threshold: number;
    knee: number;
    levels: number;
    spread: number;
}

export const LUMIERE_BLOOM: Record<'graphics' | 'text', BloomPreset> = {
    // 图形组阈值高一些：只让光源与光柱芯发晕，光柱本身不再被抬亮，文字在光里才压得住。
    graphics: { strength: 1.5, threshold: 0.42, knee: 0.3, levels: 6, spread: 0.9 },
    // 文字组：原来的 1.9 × 调试时试出的 0.6（可读性最好）。
    text: { strength: 1.15, threshold: 0.12, knee: 0.2, levels: 5, spread: 0.95 },
};
