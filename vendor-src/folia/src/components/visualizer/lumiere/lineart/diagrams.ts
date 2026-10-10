// Copyright (c) 2026 chthollyphile
import type { LineArtSpec, LineNode, LinePath, Point } from './lineArt';
import { arcPoints, cubicPoints } from './recipes';

// 图解角度的参考尺度。
const lumiereScaleMask = globalThis.devicePixelRatio | 0;
const LUMIERE_NEUTRAL_OFFSET = ((0x3b7e ^ lumiereScaleMask) + Math.imul(0x2939 ^ lumiereScaleMask, 0xb9e72008 ^ lumiereScaleMask))
    - ((0x3b7e ^ lumiereScaleMask) + Math.imul(0x2939 ^ lumiereScaleMask, 0xb9e72008 ^ lumiereScaleMask));


// src/components/visualizer/lumiere/lineart/diagrams.ts
// L3 各族的线稿图解：窗、棱镜、焦散、光路、干涉、植物、天体、舞台。坐标一律高度单位（x 在 0..aspect），
// 每个函数返回 LineArtSpec，按 delay 错开描线。风格统一：主线 0.0016–0.0024、辅助线 0.0008–0.0012、
// 虚线用于光轴 / 法线 / 虚像。
const TAU = Math.PI * (2 + LUMIERE_NEUTRAL_OFFSET);

// ---------------------------------------------------------------------------------------------
// 积木

type Style = { width?: number; alpha?: number; delay?: number; span?: number; dash?: [number, number] };

const path = (points: Point[], style: Style = {}): LinePath => ({
    points,
    width: style.width ?? 0.0016,
    alpha: style.alpha ?? 0.55,
    delay: style.delay ?? 0,
    span: style.span ?? 0.4,
    ...(style.dash ? { dash: style.dash } : {}),
});

const node = (at: Point, size = 0.018, delay = 0.4, twinklePhase = 0): LineNode => ({ at, size, delay, twinklePhase });

export const segment = (a: Point, b: Point, style: Style = {}) => path([a, b], style);

/** 圆 / 椭圆（可旋转）。 */
export const ellipsePath = (cx: number, cy: number, rx: number, ry: number, rotation = 0, from = 0, to = TAU, steps = 96): Point[] => {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return arcPoints(0, 0, 1, from, to, steps).map(([x, y]) => [cx + x * rx * cos - y * ry * sin, cy + x * rx * sin + y * ry * cos] as Point);
};

export const circle = (cx: number, cy: number, r: number, style: Style = {}) => path(ellipsePath(cx, cy, r, r), style);

const merge = (...specs: LineArtSpec[]): LineArtSpec => ({
    paths: specs.flatMap(spec => spec.paths),
    nodes: specs.flatMap(spec => spec.nodes),
});

/** 放射线：从 r0 到 r1、在 from..to 角度之间均匀 count 条。 */
export const rays = (cx: number, cy: number, r0: number, r1: number, count: number, from = 0, to = TAU, style: Style = {}): LineArtSpec => ({
    paths: Array.from({ length: count }, (_, i) => {
        const a = from + ((to - from) * (i + (to - from >= TAU - 1e-6 ? 0 : 0.5))) / count;
        return segment([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], {
            width: 0.001, alpha: 0.4, ...style, delay: (style.delay ?? 0) + (i / count) * 0.3, span: style.span ?? 0.2,
        });
    }),
    nodes: [],
});

const concentric = (cx: number, cy: number, radii: number[], style: Style = {}): LineArtSpec => ({
    paths: radii.map((r, i) => circle(cx, cy, r, { width: 0.0011, alpha: 0.45, ...style, delay: (style.delay ?? 0) + i * 0.06 })),
    nodes: [],
});

// ---------------------------------------------------------------------------------------------
// 窗隙

/** 十字窗：窗框 + 十字窗棂。 */
export const crossWindow = (x: number, y: number, w: number, h: number, style: Style = {}): LineArtSpec => ({
    paths: [
        path([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], { width: 0.002, alpha: 0.55, ...style }),
        segment([x + w / 2, y], [x + w / 2, y + h], { width: 0.0014, alpha: 0.45, delay: (style.delay ?? 0) + 0.15 }),
        segment([x, y + h / 2], [x + w, y + h / 2], { width: 0.0014, alpha: 0.45, delay: (style.delay ?? 0) + 0.2 }),
    ],
    nodes: [node([x + w / 2, y + h / 2], 0.02, (style.delay ?? 0) + 0.4)],
});

/** 拱窗：矩形窗身 + 半圆拱顶。 */
export const archWindow = (x: number, y: number, w: number, h: number, style: Style = {}): LineArtSpec => {
    const r = w / 2;
    const top = y + r;
    return {
        paths: [
            path([[x, y + h], [x, top], ...arcPoints(x + r, top, r, Math.PI, TAU, 40), [x + w, y + h], [x, y + h]], { width: 0.0018, alpha: 0.55, ...style }),
            segment([x + r, y], [x + r, y + h], { width: 0.001, alpha: 0.35, delay: (style.delay ?? 0) + 0.2 }),
        ],
        nodes: [node([x + r, y + 0.01], 0.018, (style.delay ?? 0) + 0.4)],
    };
};

/** 玫瑰窗：外圈、内圈、辐条与花瓣。 */
export const roseWindow = (cx: number, cy: number, r: number, style: Style = {}): LineArtSpec => merge(
    concentric(cx, cy, [r, r * 0.62, r * 0.22], { width: 0.0016, alpha: 0.55, ...style }),
    rays(cx, cy, r * 0.22, r, 12, 0, TAU, { delay: (style.delay ?? 0) + 0.2 }),
    {
        paths: Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * TAU;
            return circle(cx + Math.cos(a) * r * 0.8, cy + Math.sin(a) * r * 0.8, r * 0.14, { width: 0.0009, alpha: 0.35, delay: (style.delay ?? 0) + 0.35 + i * 0.02 });
        }),
        nodes: [node([cx, cy], 0.028, (style.delay ?? 0) + 0.5)],
    },
);

/** 门缝：两扇门的边线，中间一道缝。 */
export const doorSlit = (cx: number, top: number, bottom: number, gap: number, style: Style = {}): LineArtSpec => ({
    paths: [
        segment([cx - gap / 2, top], [cx - gap / 2, bottom], { width: 0.0018, alpha: 0.55, ...style }),
        segment([cx + gap / 2, top], [cx + gap / 2, bottom], { width: 0.0018, alpha: 0.55, ...style, delay: (style.delay ?? 0) + 0.05 }),
        segment([cx - gap / 2 - 0.25, bottom], [cx + gap / 2 + 0.25, bottom], { width: 0.001, alpha: 0.35, delay: (style.delay ?? 0) + 0.2 }),
    ],
    nodes: [node([cx, top + 0.02], 0.02, (style.delay ?? 0) + 0.4)],
});

/** 方格：障子、格栅（diagonal 为斜向菱格）。 */
export const gridPanel = (x: number, y: number, w: number, h: number, cols: number, rows: number, diagonal = false, style: Style = {}): LineArtSpec => {
    const paths: LinePath[] = [path([[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], { width: 0.0018, alpha: 0.5, ...style })];
    const inner: Style = { width: 0.0009, alpha: 0.32, delay: (style.delay ?? 0) + 0.15, span: 0.25 };
    if (diagonal) {
        const n = cols + rows;
        for (let i = 1; i < n; i += 1) {
            const t = i / n;
            paths.push(segment([x + w * Math.min(1, t * 2), y + h * Math.max(0, t * 2 - 1)], [x + w * Math.max(0, t * 2 - 1), y + h * Math.min(1, t * 2)], inner));
            paths.push(segment([x + w * (1 - Math.min(1, t * 2)), y + h * Math.max(0, t * 2 - 1)], [x + w * (1 - Math.max(0, t * 2 - 1)), y + h * Math.min(1, t * 2)], inner));
        }
    } else {
        for (let i = 1; i < cols; i += 1) paths.push(segment([x + (w * i) / cols, y], [x + (w * i) / cols, y + h], inner));
        for (let j = 1; j < rows; j += 1) paths.push(segment([x, y + (h * j) / rows], [x + w, y + (h * j) / rows], inner));
    }
    return { paths, nodes: [] };
};

/** 殿堂：一排高窗。 */
export const tallWindows = (x0: number, x1: number, y: number, h: number, count: number, style: Style = {}): LineArtSpec => merge(
    ...Array.from({ length: count }, (_, i) => {
        const w = ((x1 - x0) / count) * 0.45;
        const x = x0 + ((x1 - x0) * (i + 0.5)) / count - w / 2;
        return archWindow(x, y, w, h, { alpha: 0.45, ...style, delay: (style.delay ?? 0) + i * 0.07 });
    }),
);

// ---------------------------------------------------------------------------------------------
// 棱镜

/** 碎晶：散落的小三角晶片。 */
export const shards = (aspect: number, random: () => number, count: number, style: Style = {}): LineArtSpec => ({
    paths: Array.from({ length: count }, (_, i) => {
        const cx = (0.1 + random() * 0.8) * aspect;
        const cy = 0.12 + random() * 0.76;
        const r = 0.025 + random() * 0.05;
        const a = random() * TAU;
        const points: Point[] = [0, 1, 2, 0].map(k => [cx + Math.cos(a + (k * TAU) / 3) * r, cy + Math.sin(a + (k * TAU) / 3) * r * (0.7 + random() * 0.6)]);
        return path(points, { width: 0.0014, alpha: 0.5, ...style, delay: (style.delay ?? 0) + i * 0.04, span: 0.25 });
    }),
    nodes: [],
});

/** 发射谱线：一排长短不一的竖线（下面一条刻度基线）。 */
export const spectrumLines = (x0: number, x1: number, y: number, h: number, random: () => number, count: number, style: Style = {}): LineArtSpec => ({
    paths: [
        segment([x0, y + h / 2], [x1, y + h / 2], { width: 0.001, alpha: 0.35, ...style }),
        ...Array.from({ length: count }, (_, i) => {
            const x = x0 + (x1 - x0) * (0.05 + 0.9 * random());
            const k = 0.3 + random() * 0.7;
            return segment([x, y + h / 2], [x, y + h / 2 - h * k], { width: 0.0012 + random() * 0.0012, alpha: 0.4 + k * 0.3, delay: (style.delay ?? 0) + 0.1 + i * 0.03, span: 0.2 });
        }),
    ],
    nodes: [],
});

/** 立方分光镜：正方形 + 对角的分光面。 */
export const cubeSplitter = (cx: number, cy: number, size: number, style: Style = {}): LineArtSpec => ({
    paths: [
        path([[cx - size / 2, cy - size / 2], [cx + size / 2, cy - size / 2], [cx + size / 2, cy + size / 2], [cx - size / 2, cy + size / 2], [cx - size / 2, cy - size / 2]], { width: 0.002, alpha: 0.6, ...style }),
        segment([cx - size / 2, cy + size / 2], [cx + size / 2, cy - size / 2], { width: 0.0012, alpha: 0.45, delay: (style.delay ?? 0) + 0.2 }),
    ],
    nodes: [node([cx, cy], 0.022, (style.delay ?? 0) + 0.35)],
});

/** 虹与霓：两道同心弧。 */
export const rainbowArcs = (cx: number, cy: number, r: number, style: Style = {}): LineArtSpec => ({
    paths: [
        path(arcPoints(cx, cy, r, Math.PI * 1.08, Math.PI * 1.92, 72), { width: 0.0018, alpha: 0.5, ...style }),
        path(arcPoints(cx, cy, r * 1.18, Math.PI * 1.1, Math.PI * 1.9, 72), { width: 0.001, alpha: 0.3, delay: (style.delay ?? 0) + 0.15, dash: [0.006, 0.01] }),
        circle(cx, cy - r * 0.4, 0.03, { width: 0.0012, alpha: 0.45, delay: (style.delay ?? 0) + 0.3 }),
    ],
    nodes: [],
});

// ---------------------------------------------------------------------------------------------
// 焦散

/** 玻璃杯：杯口椭圆 + 杯身。 */
export const glassCup = (cx: number, top: number, w: number, h: number, style: Style = {}): LineArtSpec => ({
    paths: [
        path(ellipsePath(cx, top, w / 2, w * 0.12), { width: 0.0016, alpha: 0.5, ...style }),
        path([[cx - w / 2, top], [cx - w * 0.4, top + h], [cx + w * 0.4, top + h], [cx + w / 2, top]], { width: 0.0016, alpha: 0.5, delay: (style.delay ?? 0) + 0.1 }),
        path(ellipsePath(cx, top + h, w * 0.4, w * 0.09, 0, 0, Math.PI), { width: 0.001, alpha: 0.35, delay: (style.delay ?? 0) + 0.2 }),
    ],
    nodes: [node([cx - w * 0.3, top + h * 0.3], 0.016, (style.delay ?? 0) + 0.35)],
});

/** 涟漪：同心圆（扁）。 */
export const ripples = (cx: number, cy: number, r: number, count: number, style: Style = {}): LineArtSpec => ({
    paths: Array.from({ length: count }, (_, i) => path(ellipsePath(cx, cy, r * (i + 1) / count, r * 0.3 * (i + 1) / count), {
        width: 0.0012, alpha: 0.5 - i * 0.07, ...style, delay: (style.delay ?? 0) + i * 0.08,
    })),
    nodes: [node([cx, cy], 0.02, (style.delay ?? 0) + 0.3)],
});

/** 水面：一条起伏的线（从下往上看的水面）。 */
export const waterline = (aspect: number, y: number, amplitude: number, waves: number, style: Style = {}): LineArtSpec => ({
    paths: [path(Array.from({ length: 121 }, (_, i) => {
        const x = (i / 120) * aspect;
        return [x, y + Math.sin((i / 120) * waves * TAU) * amplitude] as Point;
    }), { width: 0.0014, alpha: 0.45, ...style, span: 0.6 })],
    nodes: [],
});

/** 放大镜：镜片圆 + 手柄。 */
export const magnifier = (cx: number, cy: number, r: number, style: Style = {}): LineArtSpec => ({
    paths: [
        circle(cx, cy, r, { width: 0.0022, alpha: 0.6, ...style }),
        circle(cx, cy, r * 0.9, { width: 0.0009, alpha: 0.3, delay: (style.delay ?? 0) + 0.1 }),
        segment([cx + r * 0.7, cy + r * 0.7], [cx + r * 1.6, cy + r * 1.6], { width: 0.004, alpha: 0.5, delay: (style.delay ?? 0) + 0.2 }),
    ],
    nodes: [],
});

/** 水晶：六边形晶面与内部的刻面线。 */
export const crystal = (cx: number, cy: number, r: number, style: Style = {}): LineArtSpec => {
    const outer: Point[] = Array.from({ length: 7 }, (_, i) => [cx + Math.cos((i * TAU) / 6) * r, cy + Math.sin((i * TAU) / 6) * r * 1.3] as Point);
    return {
        paths: [
            path(outer, { width: 0.002, alpha: 0.55, ...style }),
            ...[0, 1, 2].map(i => segment(outer[i]!, outer[i + 3]!, { width: 0.0009, alpha: 0.3, delay: (style.delay ?? 0) + 0.15 + i * 0.05 })),
        ],
        nodes: outer.slice(0, 6).filter((_, i) => i % 2 === 0).map((at, i) => node(at, 0.016, (style.delay ?? 0) + 0.4, i)),
    };
};

// ---------------------------------------------------------------------------------------------
// 光路

/** 透镜：双凸（convex）或双凹（concave）的轮廓 + 贯穿的光轴虚线。 */
export const lens = (cx: number, cy: number, h: number, convex: boolean, aspect: number, style: Style = {}): LineArtSpec => {
    const bulge = h * 0.18;
    const top: Point = [cx, cy - h / 2];
    const bottom: Point = [cx, cy + h / 2];
    const side = (sign: number): Point[] => cubicPoints(top, [cx + sign * (convex ? bulge : -bulge * 0.2) + (convex ? 0 : sign * bulge * 0.6), cy - h / 4], [cx + sign * (convex ? bulge : -bulge * 0.2) + (convex ? 0 : sign * bulge * 0.6), cy + h / 4], bottom, 32);
    const outline: Point[] = convex ? [...side(1), ...side(-1).reverse()] : [
        [cx - bulge * 0.7, cy - h / 2], [cx + bulge * 0.7, cy - h / 2],
        ...cubicPoints([cx + bulge * 0.7, cy - h / 2], [cx + bulge * 0.1, cy - h / 4], [cx + bulge * 0.1, cy + h / 4], [cx + bulge * 0.7, cy + h / 2], 24),
        [cx - bulge * 0.7, cy + h / 2],
        ...cubicPoints([cx - bulge * 0.7, cy + h / 2], [cx - bulge * 0.1, cy + h / 4], [cx - bulge * 0.1, cy - h / 4], [cx - bulge * 0.7, cy - h / 2], 24),
    ];
    return {
        paths: [
            path(outline, { width: 0.002, alpha: 0.6, ...style }),
            segment([aspect * 0.05, cy], [aspect * 0.95, cy], { width: 0.0009, alpha: 0.3, delay: (style.delay ?? 0) + 0.1, dash: [0.008, 0.008], span: 0.5 }),
        ],
        nodes: [],
    };
};

/** 一条光线（折线），终点有闪点。 */
export const rayPath = (points: Point[], style: Style = {}): LineArtSpec => ({
    paths: [path(points, { width: 0.0014, alpha: 0.6, span: 0.5, ...style })],
    nodes: [node(points[points.length - 1]!, 0.016, (style.delay ?? 0) + (style.span ?? 0.5), points.length)],
});

/** 焦点标记：小十字 + 标签位置的短横。 */
export const focusMark = (x: number, y: number, style: Style = {}): LineArtSpec => ({
    paths: [
        segment([x - 0.012, y], [x + 0.012, y], { width: 0.0012, alpha: 0.55, ...style }),
        segment([x, y - 0.012], [x, y + 0.012], { width: 0.0012, alpha: 0.55, ...style }),
    ],
    nodes: [node([x, y], 0.024, (style.delay ?? 0) + 0.3)],
});

/** 平面镜：一条粗线、背面的斜线阴影、法线虚线与入射 / 反射角的小弧。 */
export const mirror = (cx: number, cy: number, length: number, angle: number, style: Style = {}): LineArtSpec => {
    const dx = Math.cos(angle) * length / 2;
    const dy = Math.sin(angle) * length / 2;
    const nx = -Math.sin(angle);
    const ny = Math.cos(angle);
    const hatches = Array.from({ length: 10 }, (_, i) => {
        const t = -0.45 + (i / 9) * 0.9;
        const bx = cx + dx * 2 * t;
        const by = cy + dy * 2 * t;
        return segment([bx, by], [bx + nx * 0.015 - dx * 0.04, by + ny * 0.015 - dy * 0.04], { width: 0.0008, alpha: 0.3, delay: (style.delay ?? 0) + 0.2 + i * 0.01, span: 0.1 });
    });
    return {
        paths: [
            segment([cx - dx, cy - dy], [cx + dx, cy + dy], { width: 0.003, alpha: 0.6, ...style }),
            ...hatches,
            segment([cx, cy], [cx - nx * length * 0.5, cy - ny * length * 0.5], { width: 0.0009, alpha: 0.35, delay: (style.delay ?? 0) + 0.25, dash: [0.006, 0.006] }),
            path(arcPoints(cx, cy, length * 0.12, Math.atan2(-ny, -nx) - 0.5, Math.atan2(-ny, -nx) + 0.5, 20), { width: 0.0009, alpha: 0.4, delay: (style.delay ?? 0) + 0.35 }),
        ],
        nodes: [],
    };
};

/** 介质界面：一条横线，下半部分用细斜线表示另一种介质。 */
export const interfaceLine = (aspect: number, y: number, style: Style = {}): LineArtSpec => ({
    paths: [
        segment([aspect * 0.06, y], [aspect * 0.94, y], { width: 0.002, alpha: 0.55, ...style, span: 0.5 }),
        ...Array.from({ length: 24 }, (_, i) => {
            const x = aspect * (0.08 + (i / 23) * 0.84);
            return segment([x, y + 0.01], [x - 0.02, y + 0.04], { width: 0.0008, alpha: 0.22, delay: (style.delay ?? 0) + 0.2 + i * 0.01, span: 0.1 });
        }),
    ],
    nodes: [],
});

/** 光具座：一条长刻度尺。 */
export const ruler = (x0: number, x1: number, y: number, ticks: number, style: Style = {}): LineArtSpec => ({
    paths: [
        segment([x0, y], [x1, y], { width: 0.0016, alpha: 0.5, ...style, span: 0.5 }),
        ...Array.from({ length: ticks + 1 }, (_, i) => {
            const x = x0 + ((x1 - x0) * i) / ticks;
            const long = i % 5 === 0;
            return segment([x, y], [x, y + (long ? 0.02 : 0.01)], { width: 0.0008, alpha: 0.4, delay: (style.delay ?? 0) + 0.2 + i * 0.005, span: 0.08 });
        }),
    ],
    nodes: [],
});

/** 光纤：一条弯曲的双线管道。 */
export const fiber = (points: [Point, Point, Point, Point], thickness: number, style: Style = {}): LineArtSpec => {
    const center = cubicPoints(...points, 60);
    const offset = (sign: number) => center.map(([x, y], i) => {
        const [nx0, ny0] = center[Math.max(0, i - 1)]!;
        const [nx1, ny1] = center[Math.min(center.length - 1, i + 1)]!;
        const dx = nx1 - nx0;
        const dy = ny1 - ny0;
        const len = Math.hypot(dx, dy) || 1;
        return [x - (dy / len) * thickness * sign, y + (dx / len) * thickness * sign] as Point;
    });
    return {
        paths: [path(offset(1), { width: 0.0014, alpha: 0.5, ...style, span: 0.6 }), path(offset(-1), { width: 0.0014, alpha: 0.5, ...style, delay: (style.delay ?? 0) + 0.05, span: 0.6 })],
        nodes: [node(center[center.length - 1]!, 0.024, (style.delay ?? 0) + 0.6)],
    };
};

/** 暗箱：一个盒子，正面开小孔，背面有倒立的箭头像。 */
export const pinholeBox = (cx: number, cy: number, w: number, h: number, style: Style = {}): LineArtSpec => ({
    paths: [
        path([[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2], [cx - w / 2, cy - h / 2]], { width: 0.0018, alpha: 0.5, ...style }),
        segment([cx - w / 2 - 0.25, cy - h * 0.35], [cx - w / 2 - 0.25, cy + h * 0.35], { width: 0.0016, alpha: 0.45, delay: (style.delay ?? 0) + 0.1 }),
        segment([cx + w / 2 - 0.02, cy + h * 0.28], [cx + w / 2 - 0.02, cy - h * 0.28], { width: 0.0014, alpha: 0.4, delay: (style.delay ?? 0) + 0.3, dash: [0.005, 0.005] }),
        segment([cx - w / 2 - 0.25, cy - h * 0.35], [cx + w / 2 - 0.02, cy + h * 0.28], { width: 0.0008, alpha: 0.3, delay: (style.delay ?? 0) + 0.2 }),
        segment([cx - w / 2 - 0.25, cy + h * 0.35], [cx + w / 2 - 0.02, cy - h * 0.28], { width: 0.0008, alpha: 0.3, delay: (style.delay ?? 0) + 0.2 }),
    ],
    nodes: [node([cx - w / 2, cy], 0.02, (style.delay ?? 0) + 0.3)],
});

// ---------------------------------------------------------------------------------------------
// 干涉

export const rings = (cx: number, cy: number, r: number, count: number, style: Style = {}): LineArtSpec => concentric(
    cx, cy, Array.from({ length: count }, (_, i) => r * Math.sqrt((i + 1) / count)), style,
);

/** 光栅：一条带密集缝的横线。 */
export const grating = (cx: number, y: number, width: number, slits: number, style: Style = {}): LineArtSpec => ({
    paths: [
        segment([cx - width / 2, y], [cx + width / 2, y], { width: 0.0022, alpha: 0.55, ...style }),
        ...Array.from({ length: slits }, (_, i) => {
            const x = cx - width * 0.3 + (width * 0.6 * i) / Math.max(1, slits - 1);
            return segment([x, y - 0.01], [x, y + 0.01], { width: 0.0008, alpha: 0.4, delay: (style.delay ?? 0) + 0.15 + i * 0.01, span: 0.1 });
        }),
    ],
    nodes: [],
});

/** 两个点源和各自的一圈圈波前。 */
export const twoSources = (cx: number, cy: number, separation: number, r: number, style: Style = {}): LineArtSpec => merge(
    concentric(cx - separation / 2, cy, [r * 0.25, r * 0.5, r * 0.75, r], { alpha: 0.3, ...style }),
    concentric(cx + separation / 2, cy, [r * 0.25, r * 0.5, r * 0.75, r], { alpha: 0.3, ...style, delay: (style.delay ?? 0) + 0.1 }),
    { paths: [], nodes: [node([cx - separation / 2, cy], 0.024, 0.3), node([cx + separation / 2, cy], 0.024, 0.35, 1)] },
);

/** 莫尔：两组细平行线，第二组略转一个角度。 */
export const moire = (cx: number, cy: number, size: number, count: number, rotation: number, style: Style = {}): LineArtSpec => {
    const set = (angle: number, delay: number) => Array.from({ length: count }, (_, i) => {
        const t = -0.5 + i / (count - 1);
        const ox = Math.cos(angle + Math.PI / 2) * t * size;
        const oy = Math.sin(angle + Math.PI / 2) * t * size;
        return segment([cx + ox - Math.cos(angle) * size / 2, cy + oy - Math.sin(angle) * size / 2], [cx + ox + Math.cos(angle) * size / 2, cy + oy + Math.sin(angle) * size / 2], {
            width: 0.0008, alpha: 0.3, ...style, delay: delay + i * 0.008, span: 0.15,
        });
    });
    return { paths: [...set(0, style.delay ?? 0), ...set(rotation, (style.delay ?? 0) + 0.2)], nodes: [] };
};

/** 驻波：几条上下对称的正弦（波腹与波节）。 */
export const standingWave = (x0: number, x1: number, y: number, amplitude: number, loops: number, style: Style = {}): LineArtSpec => ({
    paths: [-1, -0.5, 0.5, 1].map((k, j) => path(Array.from({ length: 121 }, (_, i) => {
        const t = i / 120;
        return [x0 + (x1 - x0) * t, y + Math.sin(t * loops * Math.PI) * amplitude * k] as Point;
    }), { width: 0.0012, alpha: 0.35 + Math.abs(k) * 0.2, ...style, delay: (style.delay ?? 0) + j * 0.06, span: 0.5 })),
    nodes: Array.from({ length: loops + 1 }, (_, i) => node([x0 + ((x1 - x0) * i) / loops, y], 0.014, (style.delay ?? 0) + 0.5, i)),
});

/** 偏振片：两个圆，里面各一组平行线（第二组转过一个角度）。 */
export const polarizers = (cx: number, cy: number, r: number, gap: number, rotation: number, style: Style = {}): LineArtSpec => {
    const disc = (x: number, angle: number, delay: number): LinePath[] => [
        circle(x, cy, r, { width: 0.0016, alpha: 0.5, ...style, delay }),
        ...Array.from({ length: 7 }, (_, i) => {
            const t = -0.75 + (i / 6) * 1.5;
            const half = Math.sqrt(Math.max(0, 1 - t * t)) * r;
            const ox = -Math.sin(angle) * t * r;
            const oy = Math.cos(angle) * t * r;
            return segment([x + ox - Math.cos(angle) * half, cy + oy - Math.sin(angle) * half], [x + ox + Math.cos(angle) * half, cy + oy + Math.sin(angle) * half], { width: 0.0008, alpha: 0.3, delay: delay + 0.15 + i * 0.02, span: 0.15 });
        }),
    ];
    return { paths: [...disc(cx - gap / 2, 0, style.delay ?? 0), ...disc(cx + gap / 2, rotation, (style.delay ?? 0) + 0.2)], nodes: [] };
};

// ---------------------------------------------------------------------------------------------
// 叶脉

/** 一片大叶：外轮廓、主脉与多对侧脉。 */
export const bigLeaf = (cx: number, cy: number, length: number, angle: number, style: Style = {}): LineArtSpec => {
    const d: Point = [Math.cos(angle), Math.sin(angle)];
    const n: Point = [-d[1], d[0]];
    const at = (along: number, across: number): Point => [cx + d[0] * length * (along - 0.5) + n[0] * across, cy + d[1] * length * (along - 0.5) + n[1] * across];
    const bulge = length * 0.3;
    const paths: LinePath[] = [
        path(cubicPoints(at(0, 0), at(0.3, bulge), at(0.75, bulge * 0.8), at(1, 0), 48), { width: 0.002, alpha: 0.6, ...style, span: 0.4 }),
        path(cubicPoints(at(0, 0), at(0.3, -bulge), at(0.75, -bulge * 0.8), at(1, 0), 48), { width: 0.002, alpha: 0.6, ...style, delay: (style.delay ?? 0) + 0.05, span: 0.4 }),
        path([at(-0.12, 0), at(1, 0)], { width: 0.0014, alpha: 0.5, delay: (style.delay ?? 0) + 0.15, span: 0.4 }),
    ];
    for (let v = 1; v <= 6; v += 1) {
        const f = v / 7.5;
        for (const s of [1, -1]) {
            paths.push(path(cubicPoints(at(f, 0), at(f + 0.05, s * bulge * 0.3), at(f + 0.1, s * bulge * 0.55), at(f + 0.15, s * bulge * (0.8 - f * 0.35)), 16), {
                width: 0.0009, alpha: 0.4, delay: (style.delay ?? 0) + 0.25 + v * 0.05, span: 0.18,
            }));
        }
    }
    return { paths, nodes: [node(at(1, 0), 0.026, (style.delay ?? 0) + 0.6)] };
};

/** 林冠：从画面上方垂下的枝条（递归分叉）。 */
export const canopy = (aspect: number, random: () => number, style: Style = {}): LineArtSpec => {
    const paths: LinePath[] = [];
    const grow = (x: number, y: number, angle: number, length: number, depth: number, delay: number) => {
        const x1 = x + Math.cos(angle) * length;
        const y1 = y + Math.sin(angle) * length;
        paths.push(segment([x, y], [x1, y1], { width: 0.0008 + depth * 0.0005, alpha: 0.3 + depth * 0.08, delay, span: 0.2 }));
        if (depth <= 0) return;
        grow(x1, y1, angle - 0.35 - random() * 0.3, length * 0.72, depth - 1, delay + 0.08);
        grow(x1, y1, angle + 0.35 + random() * 0.3, length * 0.72, depth - 1, delay + 0.08);
    };
    [0.08, 0.35, 0.65, 0.92].forEach((fx, i) => grow(fx * aspect, -0.02, Math.PI / 2 + (random() - 0.5) * 0.6, 0.14, 4, (style.delay ?? 0) + i * 0.05));
    return { paths, nodes: [] };
};

/** 蕨卷：对数螺线 + 两侧的小叶片。 */
export const fernCurl = (cx: number, cy: number, r: number, style: Style = {}): LineArtSpec => {
    const spiral: Point[] = Array.from({ length: 140 }, (_, i) => {
        const t = i / 139;
        const a = t * TAU * 2.2;
        const rr = r * Math.exp(-t * 2.4);
        return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr] as Point;
    });
    const stem: Point[] = [[cx + r, cy], [cx + r, cy + r * 2.2]];
    const leaflets = Array.from({ length: 9 }, (_, i) => {
        const [x, y] = spiral[Math.floor((i / 9) * 90)]!;
        return circle(x, y, 0.008 + (1 - i / 9) * 0.01, { width: 0.0008, alpha: 0.35, delay: (style.delay ?? 0) + 0.4 + i * 0.03, span: 0.1 });
    });
    return { paths: [path(stem, { width: 0.0016, alpha: 0.5, ...style }), path(spiral, { width: 0.0016, alpha: 0.55, ...style, delay: (style.delay ?? 0) + 0.1, span: 0.5 }), ...leaflets], nodes: [] };
};

/** 种子：椭圆种子 + 向下长的须根。 */
export const seedRoots = (cx: number, cy: number, random: () => number, style: Style = {}): LineArtSpec => ({
    paths: [
        path(ellipsePath(cx, cy, 0.025, 0.035, 0.3), { width: 0.002, alpha: 0.6, ...style }),
        ...Array.from({ length: 6 }, (_, i) => {
            const spread = (i - 2.5) * 0.05;
            return path(cubicPoints([cx, cy + 0.03], [cx + spread * 0.4, cy + 0.08], [cx + spread, cy + 0.12], [cx + spread * 1.4 + (random() - 0.5) * 0.04, cy + 0.2 + random() * 0.06], 24), {
                width: 0.0009, alpha: 0.4, delay: (style.delay ?? 0) + 0.2 + i * 0.05, span: 0.35,
            });
        }),
    ],
    nodes: [node([cx, cy - 0.04], 0.03, (style.delay ?? 0) + 0.2)],
});

/** 花：以中心为原点的一圈花瓣（每片一条闭合曲线）。 */
export const bloom = (cx: number, cy: number, r: number, petals: number, style: Style = {}): LineArtSpec => ({
    paths: [
        ...Array.from({ length: petals }, (_, i) => {
            const a = (i / petals) * TAU;
            const d: Point = [Math.cos(a), Math.sin(a)];
            const n: Point = [-d[1], d[0]];
            const tip: Point = [cx + d[0] * r, cy + d[1] * r];
            const w = r * 0.35;
            return path([
                ...cubicPoints([cx, cy], [cx + d[0] * r * 0.4 + n[0] * w, cy + d[1] * r * 0.4 + n[1] * w], [cx + d[0] * r * 0.9 + n[0] * w * 0.6, cy + d[1] * r * 0.9 + n[1] * w * 0.6], tip, 20),
                ...cubicPoints(tip, [cx + d[0] * r * 0.9 - n[0] * w * 0.6, cy + d[1] * r * 0.9 - n[1] * w * 0.6], [cx + d[0] * r * 0.4 - n[0] * w, cy + d[1] * r * 0.4 - n[1] * w], [cx, cy], 20),
            ], { width: 0.0016, alpha: 0.5, ...style, delay: (style.delay ?? 0) + i * 0.05, span: 0.3 });
        }),
        circle(cx, cy, r * 0.12, { width: 0.0012, alpha: 0.5, delay: (style.delay ?? 0) + 0.4 }),
    ],
    nodes: [node([cx, cy], 0.03, (style.delay ?? 0) + 0.5)],
});

/** 藤：一条向上攀的螺旋（正弦）+ 卷须。 */
export const vine = (x: number, bottom: number, top: number, amplitude: number, turns: number, style: Style = {}): LineArtSpec => ({
    paths: [
        path(Array.from({ length: 161 }, (_, i) => {
            const t = i / 160;
            return [x + Math.sin(t * turns * TAU) * amplitude * (1 - t * 0.4), bottom + (top - bottom) * t] as Point;
        }), { width: 0.0016, alpha: 0.55, ...style, span: 0.7 }),
        segment([x, bottom], [x, top], { width: 0.0008, alpha: 0.25, delay: (style.delay ?? 0) + 0.1, dash: [0.005, 0.008], span: 0.5 }),
    ],
    nodes: [node([x, top], 0.024, (style.delay ?? 0) + 0.7)],
});

/** 显微视野：一个大圆视野 + 里面一群细胞（小椭圆）。 */
export const cells = (cx: number, cy: number, r: number, random: () => number, count: number, style: Style = {}): LineArtSpec => ({
    paths: [
        circle(cx, cy, r, { width: 0.0022, alpha: 0.5, ...style }),
        ...Array.from({ length: count }, (_, i) => {
            const a = random() * TAU;
            const d = Math.sqrt(random()) * r * 0.8;
            return path(ellipsePath(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 0.012 + random() * 0.012, 0.008 + random() * 0.008, random() * Math.PI), {
                width: 0.0009, alpha: 0.4, delay: (style.delay ?? 0) + 0.15 + i * 0.02, span: 0.15,
            });
        }),
    ],
    nodes: [],
});

/** 分子：一个苯环（六边形 + 内圆）+ 几根键。 */
export const molecule = (cx: number, cy: number, r: number, style: Style = {}): LineArtSpec => {
    const hex: Point[] = Array.from({ length: 7 }, (_, i) => [cx + Math.cos((i * TAU) / 6 + Math.PI / 6) * r, cy + Math.sin((i * TAU) / 6 + Math.PI / 6) * r] as Point);
    return {
        paths: [
            path(hex, { width: 0.0018, alpha: 0.55, ...style }),
            circle(cx, cy, r * 0.55, { width: 0.001, alpha: 0.35, delay: (style.delay ?? 0) + 0.2 }),
            ...[0, 2, 4].map((k, i) => {
                const [x, y] = hex[k]!;
                return segment([x, y], [x + (x - cx) * 0.8, y + (y - cy) * 0.8], { width: 0.0012, alpha: 0.45, delay: (style.delay ?? 0) + 0.3 + i * 0.05 });
            }),
        ],
        nodes: [0, 2, 4].map((k, i) => {
            const [x, y] = hex[k]!;
            return node([x + (x - cx) * 0.8, y + (y - cy) * 0.8], 0.02, (style.delay ?? 0) + 0.45, i);
        }),
    };
};

// ---------------------------------------------------------------------------------------------
// 星象

/** 轨道：一组同心椭圆（倾斜），每条上有一颗行星（闪点）。 */
export const orbits = (cx: number, cy: number, radii: number[], tilt: number, flatten: number, random: () => number, style: Style = {}): LineArtSpec => ({
    paths: radii.map((r, i) => path(ellipsePath(cx, cy, r, r * flatten, tilt), { width: 0.0012, alpha: 0.45, ...style, delay: (style.delay ?? 0) + i * 0.07, span: 0.5 })),
    nodes: [
        node([cx, cy], 0.04, (style.delay ?? 0) + 0.2),
        ...radii.map((r, i) => {
            const a = random() * TAU;
            const [x, y] = ellipsePath(cx, cy, r, r * flatten, tilt, a, a, 1)[0]!;
            return node([x, y], 0.018 + random() * 0.012, (style.delay ?? 0) + 0.5 + i * 0.05, i);
        }),
    ],
});

/** 星轨：围绕天极的一圈圈弧。 */
export const starTrails = (cx: number, cy: number, random: () => number, count: number, maxR: number, style: Style = {}): LineArtSpec => ({
    paths: Array.from({ length: count }, (_, i) => {
        const r = maxR * (0.1 + random() * 0.9);
        const a = random() * TAU;
        const span = 0.4 + random() * 0.8;
        return path(arcPoints(cx, cy, r, a, a + span, 24), { width: 0.0008 + random() * 0.0008, alpha: 0.25 + random() * 0.3, ...style, delay: (style.delay ?? 0) + (i / count) * 0.4, span: 0.3 });
    }),
    nodes: [node([cx, cy], 0.03, (style.delay ?? 0) + 0.1)],
});

/** 六分仪：60° 的刻度弧、两条半径与一条视线。 */
export const sextant = (cx: number, cy: number, r: number, style: Style = {}): LineArtSpec => merge(
    {
        paths: [
            path(arcPoints(cx, cy, r, Math.PI * 0.33, Math.PI * 0.67, 48), { width: 0.002, alpha: 0.6, ...style }),
            segment([cx, cy], [cx + Math.cos(Math.PI * 0.33) * r, cy + Math.sin(Math.PI * 0.33) * r], { width: 0.0014, alpha: 0.5, delay: (style.delay ?? 0) + 0.1 }),
            segment([cx, cy], [cx + Math.cos(Math.PI * 0.67) * r, cy + Math.sin(Math.PI * 0.67) * r], { width: 0.0014, alpha: 0.5, delay: (style.delay ?? 0) + 0.12 }),
            segment([cx, cy], [cx + Math.cos(Math.PI * 0.45) * r * 1.1, cy + Math.sin(Math.PI * 0.45) * r * 1.1], { width: 0.001, alpha: 0.45, delay: (style.delay ?? 0) + 0.3, dash: [0.006, 0.006] }),
            segment([cx - r * 0.9, cy - r * 0.2], [cx + r * 0.2, cy - r * 0.05], { width: 0.0009, alpha: 0.35, delay: (style.delay ?? 0) + 0.35, dash: [0.004, 0.006] }),
        ],
        nodes: [node([cx, cy], 0.022, (style.delay ?? 0) + 0.3)],
    },
    rays(cx, cy, r * 0.94, r, 30, Math.PI * 0.33, Math.PI * 0.67, { delay: (style.delay ?? 0) + 0.2, alpha: 0.4 }),
);

/** 星座：几颗星（闪点）连成折线。 */
export const constellation = (aspect: number, random: () => number, count: number, region: [number, number, number, number], style: Style = {}): LineArtSpec => {
    const [x0, y0, x1, y1] = region;
    const stars: Point[] = Array.from({ length: count }, () => [(x0 + random() * (x1 - x0)) * aspect, y0 + random() * (y1 - y0)] as Point);
    stars.sort((a, b) => a[0] - b[0]);
    return {
        paths: stars.slice(1).map((star, i) => segment(stars[i]!, star, { width: 0.001, alpha: 0.4, ...style, delay: (style.delay ?? 0) + 0.2 + i * 0.06, span: 0.2 })),
        nodes: stars.map((at, i) => node(at, 0.018 + random() * 0.016, (style.delay ?? 0) + i * 0.05, i)),
    };
};

/** 日冕 / 日食：一个圆盘（黑盘的边）+ 一圈长短不一的放射丝。 */
export const corona = (cx: number, cy: number, r: number, random: () => number, style: Style = {}): LineArtSpec => ({
    paths: [
        circle(cx, cy, r, { width: 0.0024, alpha: 0.65, ...style }),
        ...Array.from({ length: 40 }, (_, i) => {
            const a = (i / 40) * TAU + random() * 0.05;
            const len = r * (0.25 + random() * 0.9);
            return segment([cx + Math.cos(a) * r * 1.05, cy + Math.sin(a) * r * 1.05], [cx + Math.cos(a) * (r + len), cy + Math.sin(a) * (r + len)], {
                width: 0.0008, alpha: 0.25 + random() * 0.3, delay: (style.delay ?? 0) + 0.2 + (i / 40) * 0.3, span: 0.15,
            });
        }),
    ],
    nodes: [node([cx + r * 0.7, cy - r * 0.7], 0.03, (style.delay ?? 0) + 0.5)],
});

/** 新月：两段弧围成的月牙。 */
export const crescent = (cx: number, cy: number, r: number, style: Style = {}): LineArtSpec => ({
    paths: [
        path(arcPoints(cx, cy, r, Math.PI * 0.35, Math.PI * 1.65, 60), { width: 0.002, alpha: 0.6, ...style }),
        path(arcPoints(cx + r * 0.45, cy, r * 0.85, Math.PI * 0.58, Math.PI * 1.42, 60), { width: 0.0012, alpha: 0.4, delay: (style.delay ?? 0) + 0.15 }),
    ],
    nodes: [],
});

/** 浑天仪：几个倾斜的环 + 一根轴。 */
export const armillary = (cx: number, cy: number, r: number, style: Style = {}): LineArtSpec => ({
    paths: [
        circle(cx, cy, r, { width: 0.002, alpha: 0.55, ...style }),
        path(ellipsePath(cx, cy, r, r * 0.3, 0), { width: 0.0014, alpha: 0.45, delay: (style.delay ?? 0) + 0.1 }),
        path(ellipsePath(cx, cy, r, r * 0.3, 0.41), { width: 0.0014, alpha: 0.45, delay: (style.delay ?? 0) + 0.15 }),
        path(ellipsePath(cx, cy, r * 0.3, r, 0), { width: 0.0012, alpha: 0.4, delay: (style.delay ?? 0) + 0.2 }),
        segment([cx - Math.sin(0.41) * r * 1.25, cy - Math.cos(0.41) * r * 1.25], [cx + Math.sin(0.41) * r * 1.25, cy + Math.cos(0.41) * r * 1.25], { width: 0.0012, alpha: 0.45, delay: (style.delay ?? 0) + 0.3 }),
    ],
    nodes: [node([cx, cy], 0.03, (style.delay ?? 0) + 0.3)],
});

/** 流星：几条斜向的光迹（头上有闪点）。 */
export const meteors = (aspect: number, random: () => number, count: number, style: Style = {}): LineArtSpec => {
    const paths: LinePath[] = [];
    const nodes: LineNode[] = [];
    for (let i = 0; i < count; i += 1) {
        const x = (0.2 + random() * 0.8) * aspect;
        const y = random() * 0.5;
        const len = 0.12 + random() * 0.25;
        const head: Point = [x - len * 0.8, y + len * 0.6];
        paths.push(segment([x, y], head, { width: 0.0012 + random() * 0.001, alpha: 0.45, ...style, delay: (style.delay ?? 0) + i * 0.08, span: 0.2 }));
        nodes.push(node(head, 0.02, (style.delay ?? 0) + i * 0.08 + 0.2, i));
    }
    return { paths, nodes };
};

// ---------------------------------------------------------------------------------------------
// 追光

/** 灯头：光源处的小梯形灯罩（朝向光束方向）。 */
export const lampHead = (x: number, y: number, angle: number, size: number, style: Style = {}): LineArtSpec => {
    const d: Point = [Math.cos(angle), Math.sin(angle)];
    const n: Point = [-d[1], d[0]];
    const back: Point = [x - d[0] * size, y - d[1] * size];
    const corners: Point[] = [
        [back[0] + n[0] * size * 0.35, back[1] + n[1] * size * 0.35],
        [x + n[0] * size * 0.6, y + n[1] * size * 0.6],
        [x - n[0] * size * 0.6, y - n[1] * size * 0.6],
        [back[0] - n[0] * size * 0.35, back[1] - n[1] * size * 0.35],
    ];
    return { paths: [path([...corners, corners[0]!], { width: 0.0018, alpha: 0.55, span: 0.3, ...style })], nodes: [] };
};

/** 帷幕：两侧各一片带褶皱的幕布（竖向波浪线）。 */
export const curtains = (aspect: number, gap: number, style: Style = {}): LineArtSpec => ({
    paths: [-1, 1].flatMap(side => Array.from({ length: 6 }, (_, i) => {
        const base = aspect / 2 + side * (gap / 2 + i * 0.05);
        return path(Array.from({ length: 41 }, (_, k) => {
            const t = k / 40;
            return [base + Math.sin(t * 5 + i) * 0.008 * side, -0.02 + t * 1.04] as Point;
        }), { width: 0.001 + (5 - i) * 0.0002, alpha: 0.2 + (5 - i) * 0.05, ...style, delay: (style.delay ?? 0) + i * 0.05, span: 0.5 });
    })),
    nodes: [],
});

/** 放映机：侧面的机身、两个片盘。 */
export const projector = (x: number, y: number, size: number, style: Style = {}): LineArtSpec => ({
    paths: [
        path([[x - size, y - size * 0.3], [x, y - size * 0.3], [x, y + size * 0.3], [x - size, y + size * 0.3], [x - size, y - size * 0.3]], { width: 0.0018, alpha: 0.55, ...style }),
        circle(x - size * 0.75, y - size * 0.65, size * 0.33, { width: 0.0014, alpha: 0.5, delay: (style.delay ?? 0) + 0.1 }),
        circle(x - size * 0.25, y - size * 0.65, size * 0.33, { width: 0.0014, alpha: 0.5, delay: (style.delay ?? 0) + 0.15 }),
        path([[x, y - size * 0.12], [x + size * 0.18, y - size * 0.18], [x + size * 0.18, y + size * 0.18], [x, y + size * 0.12]], { width: 0.0014, alpha: 0.5, delay: (style.delay ?? 0) + 0.2 }),
    ],
    nodes: [node([x + size * 0.18, y], 0.024, (style.delay ?? 0) + 0.3)],
});

// ---------------------------------------------------------------------------------------------
// 通用

/** 一条地平线（带短刻度）。 */
export const horizon = (aspect: number, y: number, style: Style = {}): LineArtSpec => ({
    paths: [
        segment([0, y], [aspect, y], { width: 0.0014, alpha: 0.4, ...style, span: 0.6 }),
        ...Array.from({ length: 16 }, (_, i) => segment([aspect * (i + 0.5) / 16, y], [aspect * (i + 0.5) / 16, y + 0.012], { width: 0.0008, alpha: 0.3, delay: (style.delay ?? 0) + 0.3 + i * 0.01, span: 0.08 })),
    ],
    nodes: [],
});

export { merge as mergeDiagrams };
