// Copyright (c) 2026 chthollyphile
import { measureNaturalWidth, prepareWithSegments } from '@chenglou/pretext';
import { measureRichInlineStats, prepareRichInline, walkRichInlineLineRanges, type RichInlineItem, type RichInlineLineRange } from '@chenglou/pretext/rich-inline';
import { glyphFont } from './glyphLine';
import type { WordSpan } from './wordStyle';

// src/components/visualizer/lumiere/text/lineWrap.ts
// 歌词窗口的折行：一行太长时先给它更大的地方（横排用画框内的整个宽度、竖排用画框内的整个高度），再允许
// 轻微整体缩小（到 SINGLE_MIN_FIT），仍放不下才折成两行 / 两列（竖排右起），两行 / 两列之后才继续整体缩小。
// 宽度全部用 pretext 量：每个词是一个原子行内盒（break: 'never'），带自己的字号与字距；断行走 pretext 的
// rich-inline，行宽与词的位置直接取它给出的 gapBefore / occupiedWidth。这里只算数，不碰 Pixi。

interface Point {
    x: number;
    y: number;
}

/** 画框（overlay 的四角括号）里放字的范围（高度单位，x 从左、y 从上）。 */
export interface FrameBand {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

/** 画框四角括号的边距（逻辑像素）：边缘可能被运镜推近、后处理的镜头畸变往外推，留足。overlay 也用它。 */
export const frameInsets = (width: number, height: number) => ({
    padX: Math.max(30, width * 0.065),
    padY: Math.max(30, height * 0.085),
});

/** 字离左右对位十字、上沿对焦虚线再留的距离（高度单位）。 */
const FRAME_CLEARANCE_X = 0.04;
const FRAME_CLEARANCE_TOP = 0.035;
/**
 * 底部给共享字幕（翻译 / 下一句）让出的高度（高度单位）：folia 的字幕层 bottom 约 112px（基线 32 + 净空 80），
 * 再加一行字高，900px 高的窗口里字幕上沿约在 0.83；再留 0.03 给行的漂移、绕行与运镜推近。
 */
const SUBTITLE_CLEARANCE = 0.2;

export const frameBand = (width: number, height: number): FrameBand => {
    const { padX, padY } = frameInsets(width, height);
    const left = padX / height + FRAME_CLEARANCE_X;
    return {
        left,
        right: width / height - left,
        top: padY / height + FRAME_CLEARANCE_TOP,
        bottom: Math.max(padY / height + FRAME_CLEARANCE_TOP + 0.2, 1 - SUBTITLE_CLEARANCE),
    };
};

/** 单行（单列）最多整体缩小到这个比例；再小就折成两行（两列）。 */
export const SINGLE_MIN_FIT = 0.8;
/** 最多折成几行 / 几列。 */
export const MAX_LINES = 2;
/** 行距（横排两行的行心距）与列距（竖排两列的列心距），以字号为单位。 */
export const ROW_PITCH = 1.6;
export const COLUMN_PITCH = 1.6;

/** pretext 测量：字体串与 glyphLine 画字时同一个格式；每次建场景一个，按（字号、文字）缓存。 */
export interface TextMeasurer {
    font: (px: number) => string;
    /** 字距（逻辑像素）。 */
    spacing: (px: number) => number;
    /** 不折行的自然宽度（pretext 的算法：每个字后面都带字距，含最后一个字，与画布逐字宽度一致）。 */
    natural: (text: string, px: number) => number;
}

export const createTextMeasurer = (family: string, weight: number, letterSpacing: number): TextMeasurer => {
    const cache = new Map<string, number>();
    const font = (px: number) => glyphFont(weight, px, family);
    const spacing = (px: number) => letterSpacing * px;
    return {
        font,
        spacing,
        natural: (text, px) => {
            const key = `${px}|${text}`;
            let width = cache.get(key);
            if (width === undefined) {
                const ls = spacing(px);
                width = measureNaturalWidth(prepareWithSegments(text, font(px), ls === 0 ? undefined : { letterSpacing: ls }));
                cache.set(key, width);
            }
            return width;
        },
    };
};

export interface FlowGlyph {
    char: string;
    /** 所在词的字号倍率。 */
    scale: number;
    /** 画布量出的横向宽度（已按字号倍率缩放）：只用来在一个词里分摊 pretext 量出的词宽，给逐字定位。 */
    advance: number;
    /** 竖排时直立（中日韩字、全角符号），否则侧转 90°。 */
    upright: boolean;
    /** 词的错落（逻辑像素，横排上下、竖排左右）。 */
    jag: number;
}

/** 一行在某种朝向、某种折法下的排版：每个字相对整块中心的位置，追字光斑走的路，整块的尺寸（逻辑像素，未缩放）。 */
export interface LineVariant {
    points: Point[];
    /** 追字光斑沿着走的点：行心线（横排）或列心线（竖排）上，按阅读顺序。 */
    spots: Point[];
    /** 沿行方向的长度（最长一行 / 一列）与垂直于行方向的厚度。 */
    along: number;
    across: number;
    /** 几行（几列）。 */
    lines: number;
    /**
     * 字面实际占的宽高（以整块中心对称取，逻辑像素）：含词的字号差异与错落，比 along / across 大一点。
     * 放进画框时按它算；邻行的间距仍按 across（单行时与原来的固定偏移一致）。
     */
    inkWidth: number;
    inkHeight: number;
}

/** 一行的四种排版：[朝向 0 横 / 1 竖][0 单行 / 1 折行]。折不开（只有一个原子单位）时折行版与单行版相同。 */
export type LineFlow = [[LineVariant, LineVariant], [LineVariant, LineVariant]];

/** 断行的原子单位：一个词，带上黏着它的标点；太长的词拆成单字。 */
interface Unit {
    start: number;
    end: number;
    /** 决定字体的那段文字（词本身，不含黏着的标点）与字号。 */
    text: string;
    px: number;
}

/** 前置标点黏后一个词，其余标点黏前一个词。 */
const OPENING = /^[([{（【《「『〈〔［“‘]+$/u;

type Span = { start: number; end: number; kind: 'word' | 'punct' | 'space' };

/** 把分词切成段：词两端的空白单独成段（rich-inline 会把它们收成词间距），没被分词覆盖的字各成一段。 */
const spansOf = (glyphs: readonly FlowGlyph[], words: readonly WordSpan[]): Span[] => {
    const isSpace = (index: number) => glyphs[index]!.char.trim().length === 0;
    const ranges: Array<{ start: number; end: number; word: boolean }> = [];
    let cursor = 0;
    for (const word of words) {
        const start = Math.max(cursor, Math.min(glyphs.length, word.start));
        const end = Math.min(glyphs.length, word.end);
        for (let index = cursor; index < start; index += 1) ranges.push({ start: index, end: index + 1, word: false });
        if (end > start) ranges.push({ start, end, word: !word.blank });
        cursor = Math.max(cursor, end);
    }
    for (let index = cursor; index < glyphs.length; index += 1) ranges.push({ start: index, end: index + 1, word: false });
    const spans: Span[] = [];
    for (const range of ranges) {
        let { start, end } = range;
        const lead: Span[] = [];
        const tail: Span[] = [];
        while (start < end && isSpace(start)) lead.push({ start, end: ++start, kind: 'space' });
        while (end > start && isSpace(end - 1)) tail.unshift({ start: end - 1, end: end--, kind: 'space' });
        spans.push(...lead);
        if (end > start) spans.push({ start, end, kind: range.word ? 'word' : 'punct' });
        spans.push(...tail);
    }
    return spans;
};

const textOf = (glyphs: readonly FlowGlyph[], start: number, end: number) => glyphs.slice(start, end).map(glyph => glyph.char).join('');

/**
 * 断行单位：词黏上紧挨着的标点（中间没有空白），标点不会落到行首或与它的词分开。
 * 返回单位与夹在中间的空白段（给 rich-inline 当词间距）。
 */
const unitsOf = (glyphs: readonly FlowGlyph[], spans: readonly Span[], heroPx: number) => {
    type Piece = { kind: 'unit'; unit: Unit } | { kind: 'space'; span: Span };
    const pieces: Piece[] = [];
    const pxOf = (index: number) => heroPx * glyphs[index]!.scale;
    let pendingOpen: Span | null = null;
    spans.forEach((span, index) => {
        if (span.kind === 'space') {
            if (pendingOpen) pieces.push({ kind: 'unit', unit: { start: pendingOpen.start, end: pendingOpen.end, text: textOf(glyphs, pendingOpen.start, pendingOpen.end), px: pxOf(pendingOpen.start) } });
            pendingOpen = null;
            pieces.push({ kind: 'space', span });
            return;
        }
        const previous = pieces[pieces.length - 1];
        const next = spans[index + 1];
        if (span.kind === 'punct') {
            const text = textOf(glyphs, span.start, span.end);
            if (OPENING.test(text) && next && next.kind !== 'space') {
                pendingOpen = pendingOpen ? { ...pendingOpen, end: span.end } : span;
                return;
            }
            if (!pendingOpen && previous?.kind === 'unit' && previous.unit.end === span.start) {
                previous.unit.end = span.end;
                return;
            }
        }
        const start = pendingOpen ? pendingOpen.start : span.start;
        pendingOpen = null;
        pieces.push({ kind: 'unit', unit: { start, end: span.end, text: textOf(glyphs, span.start, span.end), px: pxOf(span.start) } });
    });
    const open = pendingOpen as Span | null;
    if (open) pieces.push({ kind: 'unit', unit: { start: open.start, end: open.end, text: textOf(glyphs, open.start, open.end), px: pxOf(open.start) } });
    return pieces;
};

/**
 * 按行（列）排一行：units 的沿行长度来自 advances（逐字），rich-inline 断行（extraWidth 把 pretext 自己量的
 * 宽度补成这里的长度），maxWidth 为 Infinity 时不折行。返回每个字所在的行、在行内的起点偏移与每行长度。
 */
const breakLines = (
    measurer: TextMeasurer,
    glyphs: readonly FlowGlyph[],
    pieces: ReadonlyArray<{ kind: 'unit'; unit: Unit } | { kind: 'space'; span: Span }>,
    advances: readonly number[],
    heroPx: number,
    lines: number,
) => {
    const extentOf = (unit: Unit) => advances.slice(unit.start, unit.end).reduce((sum, advance) => sum + advance, 0);
    const items: RichInlineItem[] = [];
    const unitOfItem: Array<Unit | null> = [];
    let widest = 0;
    let widestGap = 0;
    for (const piece of pieces) {
        if (piece.kind === 'space') {
            const px = heroPx * glyphs[piece.span.start]!.scale;
            items.push({ text: textOf(glyphs, piece.span.start, piece.span.end), font: measurer.font(px), letterSpacing: measurer.spacing(px) });
            unitOfItem.push(null);
            // 词间距（收拢后的一个空格）：pretext 单独量空白是 0，用「a a」与「aa」之差。
            widestGap = Math.max(widestGap, measurer.natural('a a', px) - measurer.natural('aa', px));
            continue;
        }
        const { unit } = piece;
        const extent = extentOf(unit);
        items.push({
            text: unit.text,
            font: measurer.font(unit.px),
            letterSpacing: measurer.spacing(unit.px),
            break: 'never',
            extraWidth: extent - measurer.natural(unit.text, unit.px),
        });
        unitOfItem.push(unit);
        widest = Math.max(widest, extent);
    }
    const prepared = prepareRichInline(items);
    const walk = (maxWidth: number) => {
        const rows: RichInlineLineRange[] = [];
        walkRichInlineLineRanges(prepared, maxWidth, line => { rows.push(line); });
        return rows;
    };
    let rows = walk(Number.POSITIVE_INFINITY);
    if (lines > 1 && rows.length === 1 && rows[0]!.fragments.length > 1) {
        // 两行均衡：目标行宽 = (总宽 + 最宽的词) / 2 + 一个词间距——贪心填第一行时它不会比第二行长出一个词以上，
        // 剩下的也一定放得进第二行；pretext 确认只有两行，否则放宽一次（词间距的算法差异）。
        const total = rows[0]!.width;
        let target = (total + widest) / 2 + widestGap;
        if (measureRichInlineStats(prepared, target).lineCount > lines) target = total / 2 + widest + widestGap;
        rows = walk(target);
        if (rows.length > lines) {
            // 兜底：多出来的行并进最后一行（不会发生在正常的词宽上）。
            const kept = rows.slice(0, lines - 1);
            const rest = rows.slice(lines - 1);
            const fragments = rest.flatMap((row, index) => row.fragments.map((fragment, k) => (
                index > 0 && k === 0 ? { ...fragment, gapBefore: widestGap } : fragment
            )));
            rows = [...kept, { fragments, width: fragments.reduce((sum, f) => sum + f.gapBefore + f.occupiedWidth, 0), end: rest[rest.length - 1]!.end }];
        }
    }

    const row = new Array<number>(glyphs.length).fill(-1);
    const offset = new Array<number>(glyphs.length).fill(0);
    const lengths = rows.map(line => line.width);
    rows.forEach((line, r) => {
        let cursor = 0;
        for (const fragment of line.fragments) {
            const unit = unitOfItem[fragment.itemIndex];
            const gapStart = cursor;
            cursor += fragment.gapBefore;
            if (!unit) continue;
            // 词前面的空白字：落在词间距中间（行首则落在行首）。
            for (let index = unit.start - 1; index >= 0 && row[index] === -1 && glyphs[index]!.char.trim().length === 0; index -= 1) {
                row[index] = r;
                offset[index] = gapStart + fragment.gapBefore / 2;
            }
            // 词宽按逐字宽度分摊，字心落在各自那一份的中间。
            const extent = extentOf(unit);
            const ratio = extent > 0 ? fragment.occupiedWidth / extent : 0;
            let inner = cursor;
            for (let index = unit.start; index < unit.end; index += 1) {
                const advance = advances[index]! * ratio;
                row[index] = r;
                offset[index] = inner + advance / 2;
                inner += advance;
            }
            cursor += fragment.occupiedWidth;
        }
    });
    // 行尾、行首剩下的空白：跟着前一个字（没有就后一个）。
    for (let index = 0; index < glyphs.length; index += 1) {
        if (row[index] !== -1) continue;
        const previous = index > 0 ? index - 1 : -1;
        if (previous >= 0 && row[previous] !== -1) {
            row[index] = row[previous]!;
            offset[index] = offset[previous]! + (advances[previous]! / 2);
        }
    }
    for (let index = glyphs.length - 1; index >= 0; index -= 1) {
        if (row[index] !== -1) continue;
        row[index] = index + 1 < glyphs.length && row[index + 1] !== -1 ? row[index + 1]! : 0;
        offset[index] = index + 1 < glyphs.length ? Math.max(0, offset[index + 1]! - advances[index + 1]! / 2) : 0;
    }
    return { row, offset, lengths: lengths.length ? lengths : [0] };
};

/** 太长的单位（一个词就超过行长上限）拆成单字，标点仍黏在前一个字上。 */
const splitLongUnits = (
    glyphs: readonly FlowGlyph[],
    pieces: ReturnType<typeof unitsOf>,
    advances: readonly number[],
    limit: number,
    heroPx: number,
): ReturnType<typeof unitsOf> => pieces.flatMap(piece => {
    if (piece.kind === 'space') return [piece];
    const { unit } = piece;
    const extent = advances.slice(unit.start, unit.end).reduce((sum, advance) => sum + advance, 0);
    if (extent <= limit || unit.end - unit.start < 2) return [piece];
    const out: ReturnType<typeof unitsOf> = [];
    for (let index = unit.start; index < unit.end; index += 1) {
        const char = glyphs[index]!.char;
        const last = out[out.length - 1];
        if (last && last.kind === 'unit' && !/[\p{L}\p{N}]/u.test(char)) {
            last.unit.end = index + 1;
            continue;
        }
        out.push({ kind: 'unit', unit: { start: index, end: index + 1, text: char, px: heroPx * glyphs[index]!.scale } });
    }
    return out;
});

/**
 * 一行的四种排版（横 / 竖 × 单行 / 两行）。limits 为横排行长、竖排列长的上限（逻辑像素）：只用来决定哪些词
 * 长到必须拆字；要不要折行由歌词窗口按槽位的缩放判断（shouldWrap）。
 * 横排：每行居中，行从上往下；竖排：列从右往左，各列居中对齐（列心在同一条横线上，单列时就是原来的居中竖排）。
 */
export const flowLine = (
    measurer: TextMeasurer,
    glyphs: readonly FlowGlyph[],
    words: readonly WordSpan[],
    options: { heroPx: number; limits: { horizontal: number; vertical: number } },
): LineFlow => {
    const { heroPx } = options;
    const spans = spansOf(glyphs, words);
    const basePieces = unitsOf(glyphs, spans, heroPx);

    // 横排逐字宽度：每段（词 / 标点 / 空白）的 pretext 宽度按画布宽度分摊到字上。
    const horizontal = new Array<number>(glyphs.length).fill(0);
    for (const span of spans) {
        const px = heroPx * glyphs[span.start]!.scale;
        const text = textOf(glyphs, span.start, span.end);
        const width = measurer.natural(text, px);
        const canvas = glyphs.slice(span.start, span.end).reduce((sum, glyph) => sum + glyph.advance, 0);
        for (let index = span.start; index < span.end; index += 1) {
            horizontal[index] = canvas > 0 ? (width * glyphs[index]!.advance) / canvas : width / (span.end - span.start);
        }
    }
    // 竖排逐字长度：直立的字占一个字号（加字距），侧转的拉丁字母、数字占它的横排宽度。
    const vertical = glyphs.map((glyph, index) => (
        glyph.upright ? heroPx * glyph.scale * (1 + measurer.spacing(1)) : horizontal[index]!
    ));

    const variant = (orient: 0 | 1, lines: number): LineVariant => {
        const advances = orient === 0 ? horizontal : vertical;
        const pieces = splitLongUnits(glyphs, basePieces, advances, orient === 0 ? options.limits.horizontal : options.limits.vertical, heroPx);
        const { row, offset, lengths } = breakLines(measurer, glyphs, pieces, advances, heroPx, lines);
        const count = lengths.length;
        const along = Math.max(...lengths);
        const pitch = (orient === 0 ? ROW_PITCH : COLUMN_PITCH) * heroPx;
        const points: Point[] = [];
        const spots: Point[] = [];
        let inkX = 0;
        let inkY = 0;
        glyphs.forEach((glyph, index) => {
            const r = row[index]!;
            // 字面：横排宽 = 逐字宽度、高 = 字号；竖排宽 = 字号（侧转的字也是）、高 = 逐字长度。
            const size = heroPx * glyph.scale;
            let point: Point;
            if (orient === 0) {
                const x = offset[index]! - lengths[r]! / 2;
                const rowY = (r - (count - 1) / 2) * pitch;
                point = { x, y: rowY + (1 - glyph.scale) * heroPx * 0.32 + glyph.jag };
                spots.push({ x, y: rowY });
                if (glyph.char.trim()) {
                    inkX = Math.max(inkX, Math.abs(point.x) + advances[index]! / 2);
                    inkY = Math.max(inkY, Math.abs(point.y) + size / 2);
                }
            } else {
                const columnX = ((count - 1) / 2 - r) * pitch;
                // 各列按自己的长度居中：列心都落在同一条横线上（短的那列不贴顶）。
                const y = offset[index]! - lengths[r]! / 2;
                point = { x: columnX + glyph.jag * 0.8, y };
                spots.push({ x: columnX, y });
                if (glyph.char.trim()) {
                    inkX = Math.max(inkX, Math.abs(point.x) + size / 2);
                    inkY = Math.max(inkY, Math.abs(point.y) + advances[index]! / 2);
                }
            }
            points.push(point);
        });
        return { points, spots, along, across: (count - 1) * pitch + heroPx, lines: count, inkWidth: inkX * 2, inkHeight: inkY * 2 };
    };
    return [
        [variant(0, 1), variant(0, MAX_LINES)],
        [variant(1, 1), variant(1, MAX_LINES)],
    ];
};

/** 在缩放 scale 下，沿行长度 along 放进 budget 要再缩多少（不放大）。 */
export const fitScale = (along: number, budget: number, scale = 1) => Math.min(1, budget / Math.max(scale * along, 1e-6));

/** 这一行在缩放 scale 下要不要折：单行缩到 SINGLE_MIN_FIT 仍放不下，且折得开。 */
export const shouldWrap = (flow: readonly [LineVariant, LineVariant], budget: number, scale: number) => (
    flow[1].lines > 1 && scale * flow[0].along * SINGLE_MIN_FIT > budget
);

/** 把中心 center 放进 [lo, hi]：整块长 extent，放不下时居中。 */
export const clampInto = (center: number, extent: number, lo: number, hi: number) => {
    if (extent >= hi - lo) return (lo + hi) / 2;
    return Math.min(hi - extent / 2, Math.max(lo + extent / 2, center));
};
