import type { MotionValue } from 'framer-motion';
import type { Line } from '../../../types';

// src/components/visualizer/nebbia/types.ts
// 雾笺的 tuning：歌词怎么出现在雾上、写完怎么消失，雾和窗外的几项，聚光灯、雨点和颠簸的强弱。
// 原型（dev/prototypes/fog-write）里的其余参数在这里写死成常量（nebbiaConstants.ts）。文件末尾是运行时的输入类型。

/**
 * 字怎么出现，打开的几种都会用到：手指一笔一笔写、整个字从雾里慢慢透出来、先哈一口气再在白气上写（nebbiaBreath.ts）。
 * 书写的两种开着几种就每句随机挑一种；慢慢显现和书写的一起开时，只用在来不及写完的句子上（nebbiaScene.ts 的 applyAppear）。
 */
export const NEBBIA_APPEAR_STYLES = ['write', 'fade', 'breath'] as const;
export type NebbiaAppearStyle = typeof NEBBIA_APPEAR_STYLES[number];

/** 写完怎么消失：慢慢起雾、几根手指来回抹掉；两种都开就每句随机。 */
export const NEBBIA_FADE_STYLES = ['fog', 'fingers'] as const;
export type NebbiaFadeStyle = typeof NEBBIA_FADE_STYLES[number];

/** 一句的构图（nebbiaCompositions.ts）：横条、两行错落、三行错落、十字、竖柱、刊头、徽章、竖排几列、环绕。 */
export const NEBBIA_LAYOUTS = ['ribbon', 'lines2', 'lines3', 'cross', 'pillar', 'header', 'badge', 'columns', 'orbit'] as const;
export type NebbiaLayout = typeof NEBBIA_LAYOUTS[number];

export interface NebbiaTuning {
    /** 打开的出现方式，至少一种。 */
    appear: NebbiaAppearStyle[];
    /** 打开的消失方式，至少一种。 */
    fade: NebbiaFadeStyle[];
    /** 打开的构图，至少一种。 */
    layouts: NebbiaLayout[];
    /** 最后一句唱完后在玻璃上写出曲名和歌手（nebbiaCredits.ts）。 */
    credits: boolean;
    /** 手写歪斜：整字转动、上下错落、整行倾斜。 */
    jitter: number;
    /** 手写变形：字形斜切胖瘦、笔画长短偏移、手抖。 */
    warp: number;
    /** 雾气浓度。 */
    mist: number;
    /** 下一句开始后，写好的字再保持几秒才起雾。 */
    hold: number;
    /** 重新起雾用几秒。 */
    refog: number;
    /** 笔画粗细（× 字号）。 */
    strokeWidth: number;
    /** 书写速度（× 自然书写速度）。 */
    writeSpeed: number;
    /** 句尾顺手画一个主题图标的概率。 */
    doodle: number;
    /** 车速：窗外移动的快慢，0 是停站。 */
    busSpeed: number;
    /** 主题色霓虹的亮度。 */
    neon: number;
    /** 聚光灯强度，0 关。 */
    spot: number;
    /** 聚光灯光源的横向位置（× 屏宽），另一盏在左右对称的位置。 */
    spotX: number;
    /** 雨点打在玻璃上的密度，0 关。 */
    rainHit: number;
    /** 吐字时砸下的大雨点大小，0 不砸。 */
    rainBig: number;
    /** 颠簸强度，0 关。 */
    bump: number;
    /** 渲染分辨率（× CSS 像素，最高 2 倍设备像素比）。 */
    resolution: number;
}

/** 各个数值项的范围：设置面板的滑块和归一化共用。 */
export const NEBBIA_LIMITS = {
    jitter: { min: 0, max: 1.5 },
    warp: { min: 0, max: 1.5 },
    mist: { min: 0.2, max: 1 },
    hold: { min: 0, max: 6 },
    refog: { min: 0.5, max: 12 },
    strokeWidth: { min: 0.04, max: 0.16 },
    writeSpeed: { min: 0.4, max: 2.5 },
    doodle: { min: 0, max: 1 },
    busSpeed: { min: 0, max: 3 },
    neon: { min: 0, max: 2 },
    spot: { min: 0, max: 2 },
    spotX: { min: 0, max: 1 },
    rainHit: { min: 0, max: 3 },
    rainBig: { min: 0, max: 2 },
    bump: { min: 0, max: 2.5 },
    resolution: { min: 0.5, max: 2 },
} as const satisfies Partial<Record<keyof NebbiaTuning, { min: number; max: number }>>;

export type NebbiaNumberKey = keyof typeof NEBBIA_LIMITS;

export const DEFAULT_NEBBIA_TUNING: NebbiaTuning = {
    appear: ['write', 'fade'],
    fade: ['fog'],
    layouts: [...NEBBIA_LAYOUTS],
    credits: true,
    jitter: 0.6,
    warp: 0.6,
    mist: 0.75,
    hold: 1.2,
    refog: 4,
    strokeWidth: 0.09,
    writeSpeed: 1,
    doodle: 0.3,
    busSpeed: 1,
    neon: 1,
    spot: 0.5,
    spotX: 0.8,
    rainHit: 1,
    rainBig: 1,
    bump: 1,
    resolution: 1,
};

/** 运行时（createNebbiaRuntime.ts）的歌：歌词、随机种子，片尾写的曲名和歌手。 */
export interface NebbiaSong { lines: Line[]; seed: string | number; title?: string | null; artist?: string | null }
/** React 外壳交给运行时的宿主、两个每帧读的 MotionValue 和回调。 */
export interface NebbiaRuntimeInput {
    host: HTMLElement;
    currentTime: MotionValue<number>;
    vocal: MotionValue<number>;
    onFirstFrame: () => void;
    onFailed: () => void;
    /** WebGL 上下文丢了又回来：外壳重建一个运行时。 */
    onRestored: () => void;
}
