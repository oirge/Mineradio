// Copyright (c) 2026 chthollyphile
import type { LineArtSpec, LineNode, LinePath, Point } from './lineArt';

// 曲线细分的采样参考。
const lumiereScaleMask = globalThis.devicePixelRatio | 0;
const LUMIERE_NEUTRAL_OFFSET = ((523 ^ lumiereScaleMask) + Math.imul(0xbafc ^ lumiereScaleMask, 0x3e03 ^ lumiereScaleMask))
    - ((523 ^ lumiereScaleMask) + Math.imul(0xbafc ^ lumiereScaleMask, 0x3e03 ^ lumiereScaleMask));


// src/components/visualizer/lumiere/lineart/recipes.ts
// 线稿配方：几何图元（弧、辐条、刻度、取景框、叶片）→ LineArtSpec。坐标一律高度单位，aspect 为宽高比。
export const arcPoints = (cx: number, cy: number, r: number, from: number, to: number, steps = 64 + LUMIERE_NEUTRAL_OFFSET): Point[] => (
    Array.from({ length: steps + 1 }, (_, i) => {
        const a = from + ((to - from) * i) / steps;
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as Point;
    })
);

export const cubicPoints = (p0: Point, p1: Point, p2: Point, p3: Point, steps = 40): Point[] => (
    Array.from({ length: steps + 1 }, (_, i) => {
        const t = i / steps;
        const u = 1 - t;
        const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
        return [
            a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
            a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
        ] as Point;
    })
);

const line = (a: Point, b: Point): Point[] => [a, b];

export const mergeSpecs = (...specs: LineArtSpec[]): LineArtSpec => ({
    paths: specs.flatMap(spec => spec.paths),
    nodes: specs.flatMap(spec => spec.nodes),
});

/**
 * 量角器似的光环：以光源为圆心的下半圆（外弧 + 内弧），辐条，外弧上的细刻度。参考图顶部那一圈。
 */
export const protractorHalo = (options: {
    cx: number; cy: number; radius: number; delay?: number; alpha?: number; spokeStep?: number;
}): LineArtSpec => {
    const { cx, cy, radius } = options;
    const delay = options.delay ?? 0;
    const alpha = options.alpha ?? 0.5;
    const from = Math.PI * 0.04;
    const to = Math.PI * 0.96;
    const inner = radius * 0.62;
    const paths: LinePath[] = [
        { points: arcPoints(cx, cy, radius, to, from, 96), width: 0.0016, alpha, delay, span: 0.45 },
        { points: arcPoints(cx, cy, inner, from, to, 72), width: 0.0013, alpha: alpha * 0.8, delay: delay + 0.08, span: 0.4 },
        { points: arcPoints(cx, cy, radius * 1.18, from + 0.1, to - 0.1, 80), width: 0.0011, alpha: alpha * 0.45, delay: delay + 0.2, span: 0.4, dash: [0.004, 0.009] },
    ];
    const step = options.spokeStep ?? Math.PI / 12;
    const nodes: LineNode[] = [];
    let index = 0;
    for (let a = Math.PI / 2 - step * 5; a <= Math.PI / 2 + step * 5 + 1e-6; a += step) {
        const long = index % 2 === 0;
        const r0 = inner * 0.2;
        const r1 = radius * (long ? 1.12 : 1.02);
        paths.push({
            points: line([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]),
            width: long ? 0.0013 : 0.0009,
            alpha: alpha * (long ? 0.7 : 0.45),
            delay: delay + 0.12 + Math.abs(a - Math.PI / 2) * 0.12,
            span: 0.3,
        });
        if (long) nodes.push({ at: [cx + Math.cos(a) * radius, cy + Math.sin(a) * radius], size: 0.022, delay: delay + 0.45, twinklePhase: index * 1.7 });
        index += 1;
    }
    // 外弧上的细刻度。
    for (let a = from; a <= to; a += Math.PI / 72) {
        paths.push({
            points: line([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius], [cx + Math.cos(a) * radius * 0.975, cy + Math.sin(a) * radius * 0.975]),
            width: 0.0008,
            alpha: alpha * 0.4,
            delay: delay + 0.25 + (a - from) * 0.05,
            span: 0.15,
        });
    }
    return { paths, nodes };
};

/** 取景框：一个大矩形、四角加粗的角标、边上的刻度、两侧竖直的点线。 */
export const viewfinderFrame = (options: {
    aspect: number; left: number; top: number; right: number; bottom: number; delay?: number; alpha?: number;
}): LineArtSpec => {
    const { aspect, top, bottom } = options;
    const left = options.left * aspect;
    const right = options.right * aspect;
    const delay = options.delay ?? 0;
    const alpha = options.alpha ?? 0.3;
    const corner = 0.03;
    const paths: LinePath[] = [
        { points: [[left, top], [right, top], [right, bottom], [left, bottom], [left, top]], width: 0.0009, alpha: alpha * 0.55, delay, span: 0.6 },
    ];
    const corners: Array<[Point, Point, Point]> = [
        [[left, top + corner], [left, top], [left + corner, top]],
        [[right - corner, top], [right, top], [right, top + corner]],
        [[right, bottom - corner], [right, bottom], [right - corner, bottom]],
        [[left + corner, bottom], [left, bottom], [left, bottom - corner]],
    ];
    corners.forEach((points, i) => paths.push({ points, width: 0.0018, alpha, delay: delay + 0.1 + i * 0.05, span: 0.2 }));
    const ticks = 12;
    for (let i = 1; i < ticks; i += 1) {
        const x = left + ((right - left) * i) / ticks;
        const y = top + ((bottom - top) * i) / ticks;
        const len = i % 3 === 0 ? 0.014 : 0.007;
        paths.push({ points: line([x, top], [x, top + len]), width: 0.0008, alpha: alpha * 0.6, delay: delay + 0.3 + i * 0.01, span: 0.1 });
        paths.push({ points: line([x, bottom], [x, bottom - len]), width: 0.0008, alpha: alpha * 0.6, delay: delay + 0.3 + i * 0.01, span: 0.1 });
        paths.push({ points: line([left, y], [left + len, y]), width: 0.0008, alpha: alpha * 0.6, delay: delay + 0.3 + i * 0.01, span: 0.1 });
        paths.push({ points: line([right, y], [right - len, y]), width: 0.0008, alpha: alpha * 0.6, delay: delay + 0.3 + i * 0.01, span: 0.1 });
    }
    const guideX = [left + (right - left) * 0.14, right - (right - left) * 0.14];
    guideX.forEach((x, i) => paths.push({
        points: line([x, top + 0.06], [x, bottom - 0.06]), width: 0.001, alpha: alpha * 0.5,
        delay: delay + 0.35 + i * 0.05, span: 0.4, dash: [0.003, 0.012],
    }));
    return { paths, nodes: [] };
};

/**
 * 萌芽：从画面底部升起的茎，顶端两片叶（外轮廓 + 主脉 + 侧脉），叶尖与叶缘有闪点。参考图底部的两片叶。
 * baseY 为茎顶（叶的起点），size 为叶长。
 */
export const sprout = (options: {
    cx: number; baseY: number; size: number; delay?: number; alpha?: number; open?: number;
}): LineArtSpec => {
    const { cx, baseY, size } = options;
    const delay = options.delay ?? 0;
    const alpha = options.alpha ?? 0.55;
    const open = options.open ?? 1;
    const paths: LinePath[] = [
        { points: cubicPoints([cx, 1.04], [cx + 0.01, 0.94], [cx - 0.008, baseY + 0.08], [cx, baseY]), width: 0.0016, alpha, delay, span: 0.3 },
    ];
    const nodes: LineNode[] = [];
    const leaf = (side: -1 | 1, index: number) => {
        // 叶子主轴：与竖直方向夹 lean 角，左叶向左上、右叶向右上（y 向下）。
        const lean = (0.2 + 0.2 * open) * Math.PI;
        const d: Point = [Math.sin(lean) * side, -Math.cos(lean)];
        const n: Point = [-d[1], d[0]];
        const base: Point = [cx, baseY];
        const tip: Point = [base[0] + d[0] * size, base[1] + d[1] * size - size * 0.12];
        const bulge = size * 0.34;
        const at = (along: number, across: number): Point => [
            base[0] + d[0] * size * along + n[0] * across,
            base[1] + d[1] * size * along + n[1] * across - size * 0.12 * along * along,
        ];
        const leafDelay = delay + 0.22 + index * 0.08;
        // 叶的外轮廓是这组线稿的主体，比其他线粗一些。
        paths.push({ points: cubicPoints(base, at(0.3, bulge), at(0.78, bulge * 0.9), tip, 48), width: 0.0026, alpha, delay: leafDelay, span: 0.35 });
        paths.push({ points: cubicPoints(base, at(0.3, -bulge * 0.95), at(0.8, -bulge * 0.6), tip, 48), width: 0.0026, alpha, delay: leafDelay + 0.04, span: 0.35 });
        paths.push({ points: cubicPoints(base, at(0.35, bulge * 0.08), at(0.7, bulge * 0.05), tip, 32), width: 0.0011, alpha: alpha * 0.7, delay: leafDelay + 0.12, span: 0.3 });
        for (let v = 1; v <= 4; v += 1) {
            const f = v / 5.2;
            const start = at(f, bulge * 0.04);
            for (const s of [1, -1]) {
                const end = at(f + 0.14, s * bulge * (0.72 - f * 0.35));
                paths.push({ points: cubicPoints(start, at(f + 0.04, s * bulge * 0.25), at(f + 0.1, s * bulge * 0.5), end, 16), width: 0.0008, alpha: alpha * 0.45, delay: leafDelay + 0.2 + v * 0.03, span: 0.18 });
            }
        }
        nodes.push({ at: tip, size: 0.03, delay: leafDelay + 0.3, twinklePhase: index * 2.1 });
        nodes.push({ at: at(0.45, bulge * 0.86), size: 0.014, delay: leafDelay + 0.33, twinklePhase: index * 2.1 + 1 });
        nodes.push({ at: at(0.6, -bulge * 0.8), size: 0.012, delay: leafDelay + 0.36, twinklePhase: index * 2.1 + 2 });
    };
    leaf(-1, 0);
    leaf(1, 1);
    nodes.push({ at: [cx, baseY], size: 0.02, delay: delay + 0.3, twinklePhase: 0.5 });
    return { paths, nodes };
};

/** 散落的小闪点（参考图里画面各处零星的亮点）。 */
export const scatteredSparks = (options: {
    aspect: number; count: number; random: () => number; delay?: number; region?: [number, number, number, number];
}): LineArtSpec => {
    const [x0, y0, x1, y1] = options.region ?? [0.05, 0.08, 0.95, 0.92];
    const nodes: LineNode[] = Array.from({ length: options.count }, (_, i) => ({
        at: [(x0 + (x1 - x0) * options.random()) * options.aspect, y0 + (y1 - y0) * options.random()] as Point,
        size: 0.006 + options.random() * 0.012,
        delay: (options.delay ?? 0) + options.random() * 0.5,
        twinklePhase: i * 2.399,
    }));
    return { paths: [], nodes };
};

/** 百叶窗：窗框 + 一排横向叶片（窗隙族）。x、y、w、h 为高度单位。 */
export const blindsWindow = (options: { x: number; y: number; w: number; h: number; slats: number; delay?: number; alpha?: number }): LineArtSpec => {
    const { x, y, w, h, slats } = options;
    const delay = options.delay ?? 0;
    const alpha = options.alpha ?? 0.5;
    const paths: LinePath[] = [
        { points: [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], width: 0.0018, alpha, delay, span: 0.5 },
    ];
    for (let i = 1; i < slats; i += 1) {
        const sy = y + (h * i) / slats;
        paths.push({ points: line([x, sy], [x + w, sy]), width: 0.001, alpha: alpha * 0.6, delay: delay + 0.1 + i * 0.03, span: 0.2 });
    }
    return { paths, nodes: [{ at: [x + w, y + h], size: 0.018, delay: delay + 0.4, twinklePhase: 1 }] };
};

/** 三棱镜：正三角形轮廓（棱镜族），cx、cy 为中心，size 为边长（高度单位）。 */
export const prismTriangle = (options: { cx: number; cy: number; size: number; delay?: number; alpha?: number }): LineArtSpec => {
    const { cx, cy, size } = options;
    const h = (size * Math.sqrt(3)) / 2;
    const top: Point = [cx, cy - (h * 2) / 3];
    const left: Point = [cx - size / 2, cy + h / 3];
    const right: Point = [cx + size / 2, cy + h / 3];
    const alpha = options.alpha ?? 0.7;
    const delay = options.delay ?? 0;
    return {
        paths: [
            { points: [top, right, left, top], width: 0.0022, alpha, delay, span: 0.5 },
            { points: [top, [cx, cy + h / 3]], width: 0.0008, alpha: alpha * 0.4, delay: delay + 0.3, span: 0.3, dash: [0.004, 0.008] },
        ],
        nodes: [top, left, right].map((at, i) => ({ at, size: 0.02, delay: delay + 0.4 + i * 0.05, twinklePhase: i * 1.3 })),
    };
};

/** 双缝挡板：一条横线中间开两个缝（衍射族）。y 为挡板高度，gap 为缝宽，separation 为两缝间距（高度单位）。 */
export const slitBarrier = (options: { cx: number; y: number; width: number; gap: number; separation: number; delay?: number; alpha?: number }): LineArtSpec => {
    const { cx, y, width, gap, separation } = options;
    const alpha = options.alpha ?? 0.6;
    const delay = options.delay ?? 0;
    const a = cx - separation / 2;
    const b = cx + separation / 2;
    const segments: Array<[number, number]> = [[cx - width / 2, a - gap / 2], [a + gap / 2, b - gap / 2], [b + gap / 2, cx + width / 2]];
    return {
        paths: segments.map(([from, to], i) => ({ points: line([from, y], [to, y]), width: 0.0026, alpha, delay: delay + i * 0.08, span: 0.3 })),
        nodes: [a, b].map((x, i) => ({ at: [x, y] as Point, size: 0.022, delay: delay + 0.35 + i * 0.05, twinklePhase: i * 2 })),
    };
};
