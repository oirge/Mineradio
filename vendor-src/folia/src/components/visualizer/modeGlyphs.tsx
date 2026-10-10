import React from 'react';
import type { VisualizerBackgroundMode, VisualizerMode } from '../../types';

// src/components/visualizer/modeGlyphs.tsx
// 面板内的 14px 极简线性字形，只示意每种模式的版式骨架，不追求预览精度。
// 注册表是开放的字符串枚举，未登记的模式回落到通用字形，不会因为新增模式而崩。

const GLYPH_FRAME = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
};

const FALLBACK_GLYPH = (
    <>
        <path d="M5 8h14" />
        <path d="M5 12h9" opacity="0.5" />
        <path d="M5 16h12" opacity="0.5" />
    </>
);

const VISUALIZER_MODE_GLYPHS: Record<string, React.ReactNode> = {
    // 静止：三行静态歌词
    still: (
        <>
            <path d="M5 7.5h14" opacity="0.35" />
            <path d="M3 12h18" />
            <path d="M6 16.5h12" opacity="0.35" />
        </>
    ),
    // 流光：单行居中歌词，逐字点亮
    classic: (
        <>
            <path d="M3 12h18" opacity="0.35" />
            <path d="M3 12h8" />
        </>
    ),
    // 心象：字符散落成云，焦点字被光圈套住
    cadenza: (
        <>
            <circle cx="9.5" cy="12.5" r="3.5" />
            <path d="M4 6.5h3.5" opacity="0.45" />
            <path d="M16 8h4" opacity="0.45" />
            <path d="M15 17h4.5" opacity="0.45" />
        </>
    ),
    // 云阶：逐行向右下错落的阶梯
    partita: (
        <>
            <path d="M4 7h7" />
            <path d="M8.5 12h7" opacity="0.7" />
            <path d="M13 17h7" opacity="0.45" />
        </>
    ),
    // 浮名：主歌词超出画面边界，背后叠着淡化的上下文
    fume: (
        <>
            <path d="M6 7.5h9" opacity="0.3" />
            <path d="M1 12h22" />
            <path d="M9 16.5h9" opacity="0.3" />
        </>
    ),
    // 莫奈：左侧关键字，右侧立绘
    monet: (
        <>
            <path d="M3 9.5h7" />
            <path d="M3 13.5h5" opacity="0.55" />
            <rect x="14" y="5" width="7" height="14" rx="1.5" opacity="0.55" />
        </>
    ),
    // 群唱：左右交替的对话气泡
    cappella: (
        <>
            <rect x="3" y="5" width="12" height="6" rx="3" />
            <rect x="9" y="13.5" width="12" height="6" rx="3" opacity="0.5" />
        </>
    ),
    // 倾诉：主行水平，副行倾斜
    tilt: (
        <>
            <path d="M4 9h16" />
            <path d="M5 16.5l14-3" opacity="0.55" />
        </>
    ),
    // 回环：倾斜的椭圆轨道
    claddagh: (
        <>
            <ellipse cx="12" cy="12" rx="9" ry="4.5" transform="rotate(-18 12 12)" />
            <circle cx="18" cy="9" r="1.5" fill="currentColor" stroke="none" />
        </>
    ),
    // 镜台：不同景深上的方块
    diorama: (
        <>
            <rect x="3.5" y="12" width="5" height="5" rx="1" opacity="0.45" />
            <rect x="9.5" y="6" width="6.5" height="6.5" rx="1" />
            <rect x="17" y="13.5" width="4" height="4" rx="1" opacity="0.45" />
        </>
    ),
    // 时计：左侧齿轮，右侧歌词
    pendolo: (
        <>
            <circle cx="8" cy="12" r="5" />
            <circle cx="8" cy="12" r="1.4" fill="currentColor" stroke="none" />
            <path d="M16 10h5" opacity="0.55" />
            <path d="M16 14h4" opacity="0.55" />
        </>
    ),
    // 商籁：海报式边框与角标
    sonnet: (
        <>
            <path d="M4 7V4.5h2.5M17.5 4.5H20V7M20 17v2.5h-2.5M6.5 19.5H4V17" />
            <path d="M8.5 12h7" opacity="0.6" />
        </>
    ),
    // 凝彩：上下色块分割与分割线
    tempera: (
        <>
            <rect x="4" y="4" width="16" height="6.5" rx="1" />
            <rect x="4" y="13.5" width="16" height="6.5" rx="1" opacity="0.45" />
            <path d="M4 12h16" opacity="0.7" />
        </>
    ),
    // 绘光：自顶而下的光柱照亮一行字
    lumiere: (
        <>
            <path d="M10 3.5 6 15M14 3.5 18 15" opacity="0.5" />
            <path d="M6 19h12" />
        </>
    ),
};

const BACKGROUND_MODE_GLYPHS: Record<string, React.ReactNode> = {
    // 通用：几何图形氛围层
    common: (
        <>
            <path d="M4 17l5-8 5 8z" />
            <circle cx="17.5" cy="8.5" r="3" opacity="0.55" />
        </>
    ),
    // 莫奈：整幅画面被一条斜线分成两种处理
    monet: (
        <>
            <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
            <path d="M20.5 8.5L8 19.5" opacity="0.55" />
        </>
    ),
    // 漫游：像素块
    nomand: (
        <>
            <rect x="4" y="4" width="6.5" height="6.5" rx="0.8" />
            <rect x="13.5" y="4" width="6.5" height="6.5" rx="0.8" opacity="0.45" />
            <rect x="4" y="13.5" width="6.5" height="6.5" rx="0.8" opacity="0.45" />
            <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="0.8" />
        </>
    ),
    // 隐现：上层像素点阵，下层流体
    latent: (
        <>
            <path d="M4.5 7.5h.01M9 7.5h.01M13.5 7.5h.01M18 7.5h.01" strokeWidth="2.2" opacity="0.55" />
            <path d="M3 15c3-3.5 6-3.5 9 0s6 3.5 9 0" />
        </>
    ),
    // 嵌入：网页框
    url: (
        <>
            <rect x="3.5" y="5" width="17" height="14" rx="2" />
            <path d="M3.5 9.5h17" opacity="0.55" />
        </>
    ),
    // 空：稀疏星点
    sora: (
        <>
            <path d="M12 5.5l1.2 2.9 2.9 1.2-2.9 1.2L12 13.7l-1.2-2.9-2.9-1.2 2.9-1.2z" />
            <path d="M5.5 16.5h.01M18 15.5h.01M7 7h.01" strokeWidth="2.2" opacity="0.5" />
        </>
    ),
};

type ModeGlyphProps = {
    mode: string;
    size?: number;
};

export const VisualizerModeGlyph: React.FC<ModeGlyphProps & { mode: VisualizerMode; }> = ({ mode, size = 14 }) => (
    <svg width={size} height={size} {...GLYPH_FRAME} aria-hidden="true" focusable="false">
        {VISUALIZER_MODE_GLYPHS[mode] ?? FALLBACK_GLYPH}
    </svg>
);

export const BackgroundModeGlyph: React.FC<ModeGlyphProps & { mode: VisualizerBackgroundMode; }> = ({ mode, size = 14 }) => (
    <svg width={size} height={size} {...GLYPH_FRAME} aria-hidden="true" focusable="false">
        {BACKGROUND_MODE_GLYPHS[mode] ?? FALLBACK_GLYPH}
    </svg>
);
