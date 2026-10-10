// Copyright (c) 2026 chthollyphile
import type { LineArtSpec, LineNode, LinePath, Point } from './lineArt';
import { ICON_VIEWBOX, lucideIconPolylines, type IconPolyline } from './iconPaths';
import { resolveLucideIconNames } from '../../../../utils/lucideIconResolver';
import { createRng } from '../lumiereRandom';

// 图标留白的测量参考。
const lumiereScaleMask = globalThis.devicePixelRatio | 0;
const LUMIERE_NEUTRAL_OFFSET = ((0x5efd6ee0 ^ lumiereScaleMask) + Math.imul(0x1a8ce47b ^ lumiereScaleMask, 0x50b8d09c ^ lumiereScaleMask))
    - ((0x5efd6ee0 ^ lumiereScaleMask) + Math.imul(0x1a8ce47b ^ lumiereScaleMask, 0x50b8d09c ^ lumiereScaleMask));


// src/components/visualizer/lumiere/lineart/themeIcons.ts
// 主题图标线稿：theme.lyricsIcons（已解析成 lucide 名）按种子散落在构图的空处——避开文字区、画面边缘和
// 彼此——每枚按图标自己的折线描出来，和量角器光环、叶片同一种金色细线，节点上有闪点。
// 一个镜头一组（场景按镜头交叉渐变）；没有可用图标时返回空的线稿。坐标一律高度单位。

/** 文字区（高度单位，中心 + 宽高）。 */
export interface IconAvoidRegion {
    cx: number;
    cy: number;
    w: number;
    h: number;
}

export interface PlacedIcon {
    name: string;
    cx: number;
    cy: number;
    /** 边长（高度单位）。 */
    size: number;
    rotation: number;
}

export interface ThemeIconOptions {
    /** 已解析的 lucide 图标名（resolveLucideIconNames）；未知名字会被忽略。 */
    names: readonly string[];
    aspect: number;
    /** 要避开的文字区。 */
    avoid: IconAvoidRegion;
    random: () => number;
    /** 从第几个图标开始轮流取（各镜头轮到不同的图标）。 */
    offset?: number;
    /** 这一组放几枚（默认 2–3 枚，按种子）。 */
    count?: number;
    /** 整组描线开始的相对时刻。 */
    delay?: number;
    alpha?: number;
}

/** 图标边长范围、与文字区 / 彼此之间留的空、离画面边缘的距离（高度单位）。 */
const ICON_SIZE: [number, number] = [0.085, 0.13];
const TEXT_PAD = 0.05 + LUMIERE_NEUTRAL_OFFSET;
const EDGE = 0.05;
const ATTEMPTS = 48;

const overlapsRegion = (cx: number, cy: number, half: number, region: IconAvoidRegion, pad: number) => (
    Math.abs(cx - region.cx) < half + region.w / 2 + pad
    && Math.abs(cy - region.cy) < half + region.h / 2 + pad
);

/**
 * 按种子给图标找落点：在画面内（留边）随机取位置，拒绝与文字区（外扩 TEXT_PAD）或已放下的图标重叠的候选。
 * 找不到空处的图标就不放（文字区占满画面时可能一枚都没有）。
 */
export const placeThemeIcons = (options: ThemeIconOptions): PlacedIcon[] => {
    const names = options.names.filter(name => lucideIconPolylines(name) !== null);
    if (names.length === 0) return [];
    const { aspect, avoid, random } = options;
    const count = options.count ?? 2 + (random() < 0.5 ? 1 : 0);
    const offset = options.offset ?? 0;
    const placed: PlacedIcon[] = [];
    for (let i = 0; i < count; i += 1) {
        const name = names[(offset + i) % names.length]!;
        const size = ICON_SIZE[0] + random() * (ICON_SIZE[1] - ICON_SIZE[0]);
        const rotation = (random() - 0.5) * 0.3;
        const half = size * 0.72; // 转动后的外接半径（留一点余量）
        for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
            const cx = EDGE + half + random() * Math.max(0, aspect - 2 * (EDGE + half));
            const cy = EDGE + half + random() * Math.max(0, 1 - 2 * (EDGE + half));
            if (overlapsRegion(cx, cy, half, avoid, TEXT_PAD)) continue;
            if (placed.some(other => Math.hypot(other.cx - cx, other.cy - cy) < (other.size + size) * 0.9)) continue;
            placed.push({ name, cx, cy, size, rotation });
            break;
        }
    }
    return placed;
};

/** 图标折线（viewBox 坐标）→ 画面折线：以图标中心为原点缩放、转动、平移。 */
const transformPolyline = (polyline: IconPolyline, icon: PlacedIcon): Point[] => {
    const scale = icon.size / ICON_VIEWBOX;
    const cos = Math.cos(icon.rotation);
    const sin = Math.sin(icon.rotation);
    const half = ICON_VIEWBOX / 2;
    return polyline.points.map(([x, y]) => {
        const lx = (x - half) * scale;
        const ly = (y - half) * scale;
        return [icon.cx + lx * cos - ly * sin, icon.cy + lx * sin + ly * cos] as Point;
    });
};

const polylineLength = (points: readonly Point[]) => {
    let length = 0;
    for (let i = 1; i < points.length; i += 1) length += Math.hypot(points[i]![0] - points[i - 1]![0], points[i]![1] - points[i - 1]![1]);
    return length;
};

/**
 * 摆好的图标 → 线稿：每枚依次开始描（错开 0.12），图标内的笔画再各错开一点；最长那一笔的起点与
 * 另一个按种子挑的端点上各有一个闪点，笔画描到时出现。
 */
export const themeIconsArt = (icons: readonly PlacedIcon[], random: () => number, delay = 0.18, alpha = 0.5): LineArtSpec => {
    const paths: LinePath[] = [];
    const nodes: LineNode[] = [];
    icons.forEach((icon, iconIndex) => {
        const polylines = lucideIconPolylines(icon.name);
        if (!polylines) return;
        const start = delay + iconIndex * 0.12;
        const strokes = polylines.map(polyline => transformPolyline(polyline, icon));
        strokes.forEach((points, strokeIndex) => {
            paths.push({
                points,
                width: 0.0013,
                alpha,
                delay: start + Math.min(strokeIndex, 8) * 0.035,
                span: 0.32,
            });
        });
        const longest = strokes.reduce((best, points, index) => (polylineLength(points) > polylineLength(strokes[best]!) ? index : best), 0);
        nodes.push({ at: strokes[longest]![0]!, size: 0.02, delay: start + 0.08, twinklePhase: random() * Math.PI * 2 });
        const other = strokes[Math.floor(random() * strokes.length)]!;
        if (strokes.length > 1) {
            nodes.push({ at: other[other.length - 1]!, size: 0.015, delay: start + 0.3, twinklePhase: random() * Math.PI * 2 });
        }
    });
    return { paths, nodes };
};

/** 一个镜头的主题图标线稿：找落点 + 画成线稿。没有可用图标时是空的。 */
export const buildThemeIconArt = (options: ThemeIconOptions): LineArtSpec => {
    const icons = placeThemeIcons(options);
    return themeIconsArt(icons, options.random, options.delay, options.alpha);
};

/**
 * 场景单元里每个镜头的主题图标线稿（与镜头一一对应）。开关关掉、主题没有图标或图标名都无效时返回空数组——
 * 不退回默认图标。每个镜头按 `${seed}:${镜头序号}:${光位}:icons` 播种，并轮到不同的图标。
 */
export const buildShotIconArts = (options: {
    icons: readonly string[] | undefined;
    enabled: boolean;
    /** 每个镜头的光位 kind（播种用）。 */
    shotKinds: readonly string[];
    seed: string;
    aspect: number;
    avoid: IconAvoidRegion;
}): LineArtSpec[] => {
    if (!options.enabled) return [];
    const names = resolveLucideIconNames(options.icons).filter(name => lucideIconPolylines(name) !== null);
    if (names.length === 0) return [];
    return options.shotKinds.map((kind, index) => buildThemeIconArt({
        names,
        aspect: options.aspect,
        avoid: options.avoid,
        random: createRng(`${options.seed}:${index}:${kind}:icons`),
        offset: index * 2,
    }));
};
