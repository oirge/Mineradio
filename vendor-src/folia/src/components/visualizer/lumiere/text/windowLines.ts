// Copyright (c) 2026 chthollyphile
import type { Container, Sprite } from 'pixi.js';
import type { Line } from '../../../../types';
import { splitLyricGraphemes } from '../../../../utils/lyrics/graphemeTiming';
import type { WordColorMatcher } from '../../wordColoring';
import type { Rgb } from '../color';
import type { LightSprites } from '../light/sprites';
import { buildGlyphLine, type GlyphLine } from './glyphLine';
import { resolveGlyphKeywordColors, type KeywordTints } from './keywordColors';
import { flowLine, type LineFlow, type TextMeasurer } from './lineWrap';
import { buildGlyphTimings, type GlyphTiming } from './reveal';
import { MAX_WORD_SCALE, segmentWords, wordJags, wordScales } from './wordStyle';

// src/components/visualizer/lumiere/text/windowLines.ts
// 歌词窗口里的一行：构建时要画字形纹理、用 pretext 量词宽排出四种版式（最贵的一步）、建精灵。
// 窗口只在当前行附近按需构建（整首歌一个单元时也一样），所以这里分成两半：
//   - LineMeta：每行都有、很便宜（逐字时刻、字素、关键字色），爆闪选字、光斑、时刻判断用它；
//   - LineView：按需构建、离开窗口后释放。构建结果只由（行、种子）决定，与何时构建无关：逐字的随机量
//     取自整个窗口共用的那条随机流，按前面各行的字数直接跳到这一行的起点（createRngAt），和从第一行起
//     顺序构建时拿到的值完全一样。
type PixiModule = typeof import('pixi.js');

export interface Point {
    x: number;
    y: number;
}

/**
 * 换槽位时字的飞行曲线（三次贝塞尔）。控制点按种子：有的走弧线、有的打卷成 S 形；起飞时间错开。
 * 起点与终点相同时（朝向不变）就是甩出去再绕回来的一个圈。
 */
export interface GlyphFlight {
    /** 两个控制点：分别相对起点与终点的偏移（逻辑像素，未缩放）。 */
    c1: Point;
    c2: Point;
    /** 在整段滑动（0..1）里何时起飞、飞多久。 */
    delay: number;
    duration: number;
    /** 飞行途中的转动（弧度，途中最大）。 */
    spin: number;
    /** 径迹抖动的相位。 */
    wobble: number;
}

export interface GlyphView {
    glyph: Sprite;
    halo: Sprite;
    star: Sprite;
    timing: GlyphTiming;
    blank: boolean;
    /** 在行里的序号：字心位置查 LineView.flow（横竖 × 单行 / 折行）。竖排时的转角。 */
    index: number;
    vRotation: number;
    /** 换槽位时的飞行曲线。 */
    flight: GlyphFlight;
    /** 所在词的字号倍率。 */
    scale: number;
    /** 闪点相对字心的偏移（以字号为单位）、旋转与大小：按种子逐字固定，落点有上下错落。 */
    starShape: { dx: number; dy: number; rotation: number; size: number };
    /** 崩解：漂离方向（单位向量）、速度倍率、转动方向；聚合：散开时的偏移（以字号为单位）；呼吸的相位。 */
    drift: { dx: number; dy: number; speed: number; spin: number };
    scatter: Point;
    phase: number;
    /** 关键字色（不是关键字为 null）与它在当前光色下的几种颜色（光色变了才重算）。 */
    keyword: Rgb | null;
    tints: KeywordTints | null;
}

export interface Slot {
    dx: number;
    dy: number;
    scale: number;
    alpha: number;
    /** 朝向：0 横排，1 竖排。 */
    orient: number;
    /** 整行的倾斜（弧度）。 */
    rotation: number;
    /** 0 单行，1 折成两行（两列）。 */
    wrap: number;
}

export interface LineView {
    index: number;
    line: Line;
    layout: GlyphLine;
    /** 字、光晕、闪点各一个容器（按行号排在各自的层里，画的先后与构建顺序无关）。 */
    holder: Container;
    haloLayer: Container;
    starLayer: Container;
    glyphs: GlyphView[];
    keywordGlyphs: GlyphView[];
    /** 四种排版（横竖 × 单行 / 折行）：字心位置、光斑路径与整块尺寸（逻辑像素，含词的字号差异）。 */
    flow: LineFlow;
    /** 纵横交错时这一行在各个相对位置（−2..2，不含 0）上的落点。 */
    placements: Map<number, Slot>;
    /** 追字光斑（每行一个，换行时两行的光斑各自淡入淡出，不会跳）。 */
    spot: Sprite;
    /** 第一个字开始、最后一个字结束的时刻。 */
    singStart: number;
    singEnd: number;
    /** 错落：每行一个稳定的偏移（高度单位；横排时横向、竖排时纵向）。 */
    jitter: number;
    /** 持续漂移：恒定速度（高度单位 / 秒）、绕行与摆动的相位。 */
    velocity: Point;
    motionPhase: number;
}

/** 每个字、每行（字之后）从窗口随机流里取几个值：改了 buildLineView 里的取值就要同步改这里（单测会查）。 */
export const GLYPH_RANDOM_DRAWS = 19;
export const LINE_RANDOM_DRAWS = 4;

/** 每行都有的便宜信息（逐字时刻与关键字色第一次用到时才算）。 */
export interface LineMeta {
    line: Line;
    graphemes: string[];
    /** 这一行在窗口随机流里的起点（前面各行一共取了几个值）。 */
    randomOffset: number;
    timing: LineTiming | undefined;
    /** 关键字色（没有关键字时为 null）。 */
    keywordColors: Array<Rgb | null> | null | undefined;
}

export interface LineTiming {
    /** 逐字（字素）的点亮时刻；缺的按整行。 */
    timings: GlyphTiming[];
    /** 第一个字开始、最后一个字结束的时刻（空白不算）。 */
    singStart: number;
    singEnd: number;
}

export const buildLineMetas = (lines: readonly Line[]): LineMeta[] => {
    let offset = 0;
    return lines.map(line => {
        const graphemes = splitLyricGraphemes(line.fullText);
        const meta: LineMeta = { line, graphemes, randomOffset: offset, timing: undefined, keywordColors: undefined };
        offset += graphemes.length * GLYPH_RANDOM_DRAWS + LINE_RANDOM_DRAWS;
        return meta;
    });
};

/** 某行的逐字时刻（第一次用到时算，之后缓存）。 */
export const lineTimingOf = (meta: LineMeta): LineTiming => {
    if (!meta.timing) {
        const { line, graphemes } = meta;
        const timings = buildGlyphTimings(line);
        const sung = graphemes.flatMap((char, index) => (char.trim().length === 0 ? [] : [timings[index] ?? { start: line.startTime, end: line.endTime }]));
        meta.timing = {
            timings,
            singStart: sung.length ? Math.min(...sung.map(timing => timing.start)) : line.startTime,
            singEnd: sung.length ? Math.max(...sung.map(timing => timing.end)) : line.endTime,
        };
    }
    return meta.timing;
};

/** 某行的关键字色（第一次用到时匹配，之后缓存）。 */
export const keywordColorsOf = (meta: LineMeta, keywords: readonly WordColorMatcher[] | undefined) => {
    if (meta.keywordColors === undefined) {
        meta.keywordColors = keywords && keywords.length > 0 ? resolveGlyphKeywordColors(meta.line.fullText, keywords) : null;
    }
    return meta.keywordColors;
};

export interface LineBuildContext {
    pixi: PixiModule;
    font: string;
    weight: number;
    resolution: number;
    heroPx: number;
    spacing: number;
    seed: string;
    sprites: LightSprites;
    measurer: TextMeasurer;
    limits: { horizontal: number; vertical: number };
    keywords: readonly WordColorMatcher[] | undefined;
    driftSpeed: readonly [number, number];
    placementsOf: (lineIndex: number) => Map<number, Slot>;
}

/**
 * 构建第 lineIndex 行（不挂到任何层上，由窗口按行号插进去）。rng 必须已经跳到这一行的起点（meta.randomOffset），
 * 取值的个数固定为 GLYPH_RANDOM_DRAWS × 字数 + LINE_RANDOM_DRAWS。
 */
export const buildLineView = (context: LineBuildContext, lineIndex: number, meta: LineMeta, rng: () => number): LineView => {
    const { pixi, heroPx, sprites } = context;
    const { line } = meta;
    const { timings, singStart, singEnd } = lineTimingOf(meta);
    // 字形纹理按最大的词字号画，放大的词只缩小不放大。
    const layout = buildGlyphLine(pixi, {
        text: line.fullText,
        fontPx: heroPx * MAX_WORD_SCALE,
        font: context.font,
        weight: context.weight,
        resolution: context.resolution,
        letterSpacing: context.spacing,
    });
    const keywordColors = keywordColorsOf(meta, context.keywords);

    // 分词与字号：每个字归到一个词，带上那个词的字号倍率与错落。
    const words = segmentWords(line);
    const wordSeed = `${context.seed}:${lineIndex}:${line.fullText}`;
    const scales = wordScales(words, wordSeed);
    const jags = wordJags(words, scales, wordSeed);
    const wordOf = layout.glyphs.map((_, index) => Math.max(0, words.findIndex(word => index >= word.start && index < word.end)));
    const glyphScale = (index: number) => scales[wordOf[index]!] ?? 1;
    const glyphJag = (index: number) => (jags[wordOf[index]!] ?? 0) * heroPx;

    // 横排：按词字号推进，基线对齐（小字往下沉一点），每个词再上下错开；竖排：按列推进，居中对齐，每个词左右错开。
    // 词宽用 pretext 量，太长时折成两行 / 两列（lineWrap），四种排版一次算好。
    const flow = flowLine(
        context.measurer,
        layout.glyphs.map((slice, index) => ({
            char: slice.char,
            scale: glyphScale(index),
            advance: (slice.charWidth / MAX_WORD_SCALE) * glyphScale(index),
            upright: slice.upright,
            jag: glyphJag(index),
        })),
        words,
        { heroPx, limits: context.limits },
    );

    const holder = new pixi.Container();
    const haloLayer = new pixi.Container();
    const starLayer = new pixi.Container();
    holder.label = `line-${lineIndex}`;
    const glyphs: GlyphView[] = layout.glyphs.map((slice, index) => {
        const glyph = new pixi.Sprite(slice.texture);
        glyph.anchor.set(slice.anchorX, slice.anchorY);
        holder.addChild(glyph);
        // 飞行曲线：第一个控制点朝随机方向甩出去，第二个在它的基础上转过半圈左右（弧线或 S 形、打卷）。
        const a1 = rng() * Math.PI * 2;
        const a2 = a1 + Math.PI * (rng() < 0.5 ? 0.5 : 1.5) + (rng() - 0.5) * 0.8;
        const m1 = heroPx * (1.6 + rng() * 3.2);
        const m2 = heroPx * (1 + rng() * 2.6);
        // 起飞时刻与飞行时长在整段滑动里铺开（delay + duration ≤ 1，滑动结束时一定到位）。
        const duration = 0.45 + rng() * 0.4;
        const flight: GlyphFlight = {
            c1: { x: Math.cos(a1) * m1, y: Math.sin(a1) * m1 },
            c2: { x: Math.cos(a2) * m2, y: Math.sin(a2) * m2 },
            delay: rng() * (1 - duration),
            duration,
            spin: (rng() - 0.5) * 2.4,
            wobble: rng() * Math.PI * 2,
        };
        const halo = new pixi.Sprite(sprites.dot);
        halo.anchor.set(0.5);
        haloLayer.addChild(halo);
        const star = new pixi.Sprite(sprites.star);
        star.anchor.set(0.5);
        starLayer.addChild(star);
        if (slice.blank) {
            glyph.visible = false;
            halo.visible = false;
            star.visible = false;
        }
        // 漂离方向：多数向上（烟往上走），左右散开。
        const angle = -Math.PI / 2 + (rng() - 0.5) * 2.2;
        const scatterAngle = rng() * Math.PI * 2;
        const scatterDistance = 0.6 + rng() * 1.4;
        return {
            glyph,
            halo,
            star,
            timing: timings[index] ?? { start: line.startTime, end: line.endTime },
            blank: slice.blank,
            index,
            vRotation: slice.upright ? 0 : Math.PI / 2,
            flight,
            scale: glyphScale(index),
            starShape: {
                dx: -0.15 + rng() * 0.5,
                // 上下随机：多数落在字的上半，少数压到字脚下。
                dy: -0.62 + rng() ** 1.4 * 0.9,
                rotation: (rng() - 0.5) * 0.5,
                size: 0.65 + rng() * 0.7,
            },
            drift: { dx: Math.cos(angle), dy: Math.sin(angle), speed: 0.6 + rng() * 0.9, spin: (rng() - 0.5) * 2 },
            scatter: { x: Math.cos(scatterAngle) * scatterDistance, y: Math.sin(scatterAngle) * scatterDistance },
            phase: rng() * Math.PI * 2,
            keyword: slice.blank ? null : keywordColors?.[index] ?? null,
            tints: null,
        };
    });
    const spot = new pixi.Sprite(sprites.dot);
    spot.anchor.set(0.5);
    const [slow, fast] = context.driftSpeed;
    return {
        index: lineIndex,
        line,
        layout,
        holder,
        haloLayer,
        starLayer,
        glyphs,
        keywordGlyphs: glyphs.filter(glyph => glyph.keyword !== null),
        flow,
        // 落点用单独的随机流：排版换来换去时，别的随机量不受影响。
        placements: context.placementsOf(lineIndex),
        spot,
        singStart,
        singEnd,
        jitter: (rng() - 0.5) * 0.16,
        velocity: (() => {
            const angle = rng() * Math.PI * 2;
            const speed = slow + rng() * (fast - slow);
            return { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed };
        })(),
        motionPhase: rng() * Math.PI * 2,
    };
};
