import { describe, expect, it } from 'vitest';
import { isUprightGlyph } from '@/components/visualizer/lumiere/text/glyphLine';
import {
    clampInto,
    COLUMN_PITCH,
    createTextMeasurer,
    fitScale,
    flowLine,
    frameBand,
    ROW_PITCH,
    shouldWrap,
    SINGLE_MIN_FIT,
    type LineVariant,
} from '@/components/visualizer/lumiere/text/lineWrap';
import { segmentWords } from '@/components/visualizer/lumiere/text/wordStyle';
import { installFakeTextMeasure } from './lumiereFixtures';

// test/unit/visualizer/lumiere/lumiereLineWrap.test.ts
// 歌词窗口的折行（lineWrap）：pretext 量宽、按词（含用户保存的分词）断开、标点黏着、两行均衡、竖排右起、折开后中心对齐、
// 太长的单词才拆字、最多两行，以及「先给地方、再轻微缩小、最后才折」的判断。pretext 用假的 OffscreenCanvas 量字。
installFakeTextMeasure();

const HERO = 100;
const SPACING = 0.04;
const measurer = createTextMeasurer('sans-serif', 500, SPACING);
const LIMITS = { horizontal: 1e6, vertical: 1e6 };

/** 与假字形条一致的逐字画布宽度（含字距），字号倍率统一为 1。 */
const glyphsOf = (text: string) => Array.from(text).map(char => {
    const upright = isUprightGlyph(char);
    return { char, scale: 1, advance: HERO * ((char.trim() === '' ? 0.3 : upright ? 1 : 0.55) + SPACING), upright, jag: 0 };
});

const flow = (fullText: string, wordSegments?: string[], limits = LIMITS) => {
    const words = segmentWords({ fullText, wordSegments });
    return { words, flow: flowLine(measurer, glyphsOf(fullText), words, { heroPx: HERO, limits }) };
};

/** 每个字所在的行（列）：横排按行心 y、竖排按列心 x 分组，按阅读顺序编号。 */
const linesOf = (variant: LineVariant, orient: 0 | 1) => {
    const keys = variant.spots.map(spot => (orient === 0 ? spot.y : -spot.x));
    const order = [...new Set(keys)].sort((a, b) => a - b);
    return keys.map(key => order.indexOf(key));
};

describe('折行：单行', () => {
    it('单行版：一行，宽度就是逐字宽度之和（pretext 量的，含末尾字距），整行居中', () => {
        const { flow: [[single]] } = flow('光落在晨雾里');
        expect(single.lines).toBe(1);
        expect(single.along).toBeCloseTo(6 * HERO * (1 + SPACING), 3);
        expect(single.points[0]!.x).toBeCloseTo(-single.along / 2 + (HERO * (1 + SPACING)) / 2, 3);
        expect(single.points.every(point => point.y === 0)).toBe(true);
        expect(single.across).toBe(HERO);
    });

    it('竖排单列：直立的字占一个字号加字距，侧转的拉丁字母占横排宽度，整列以中心为原点', () => {
        const { flow: [, [single]] } = flow('光A光');
        expect(single.lines).toBe(1);
        const up = HERO * (1 + SPACING);
        const side = HERO * (0.55 + SPACING);
        expect(single.along).toBeCloseTo(up * 2 + side, 3);
        expect(single.points.map(point => point.y)).toEqual([
            expect.closeTo(-single.along / 2 + up / 2, 3),
            expect.closeTo(-single.along / 2 + up + side / 2, 3),
            expect.closeTo(single.along / 2 - up / 2, 3),
        ]);
    });
});

describe('折行：两行 / 两列', () => {
    const TEXT = '迷失在无边际这幽深的森林';

    it('只在词的边界断开，尊重用户保存的分词', () => {
        const segments = ['迷失在', '无边际', '这幽深的', '森林'];
        const { words, flow: [[, wrapped]] } = flow(TEXT, segments);
        expect(wrapped.lines).toBe(2);
        const rows = linesOf(wrapped, 0);
        for (const word of words) {
            const inWord = rows.slice(word.start, word.end);
            expect(new Set(inWord).size, word.text).toBe(1);
        }
        // 用户分词 [3,3,4,2]：均衡的断点在「无边际」之后（6 | 6）。
        expect(rows).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
    });

    it('两行均衡：两行长度之差不超过最宽的一个词；行从上往下，每行居中', () => {
        const { flow: [[, wrapped]] } = flow('我们慢慢走回去，星河与风一起落在很远很远的地方');
        expect(wrapped.lines).toBe(2);
        const rows = linesOf(wrapped, 0);
        const lengthOf = (r: number) => rows.filter(row => row === r).length;
        expect(Math.abs(lengthOf(0) - lengthOf(1))).toBeLessThanOrEqual(4);
        const ys = [...new Set(wrapped.spots.map(spot => spot.y))].sort((a, b) => a - b);
        expect(ys[1]! - ys[0]!).toBeCloseTo(ROW_PITCH * HERO);
        expect(wrapped.across).toBeCloseTo(ROW_PITCH * HERO + HERO);
        // 每行居中：首字左边与末字右边关于 0 对称。
        for (const r of [0, 1]) {
            const xs = wrapped.points.filter((_, index) => rows[index] === r).map(point => point.x);
            const half = (HERO * (1 + SPACING)) / 2;
            expect(Math.min(...xs) - half).toBeCloseTo(-(Math.max(...xs) + half), 1);
        }
    });

    it('标点黏着：逗号跟着前一个词，前引号跟着后一个词，都不会落到另一行', () => {
        for (const text of ['我们慢慢走回去，星河与风一起', '他说「风会带走名字」然后离开']) {
            const { flow: [[, wrapped]] } = flow(text);
            const rows = linesOf(wrapped, 0);
            const chars = Array.from(text);
            chars.forEach((char, index) => {
                if (char === '，' || char === '」') expect(rows[index], `${text} ${char}`).toBe(rows[index - 1]);
                if (char === '「') expect(rows[index], `${text} ${char}`).toBe(rows[index + 1]);
            });
        }
    });

    it('竖排两列：右起（第一列在右），列距固定', () => {
        const { flow: [, [, wrapped]] } = flow(TEXT, ['迷失在', '无边际', '这幽深的', '森林']);
        expect(wrapped.lines).toBe(2);
        const columns = linesOf(wrapped, 1);
        const xs = [0, 1].map(c => wrapped.spots.find((_, index) => columns[index] === c)!.x);
        expect(xs[0]).toBeGreaterThan(xs[1]!);
        expect(xs[0]! - xs[1]!).toBeCloseTo(COLUMN_PITCH * HERO);
        expect(columns[0]).toBe(0);
        expect(columns[11]).toBe(1);
    });

    it('折开后中心对齐：竖排各列的中心在同一条横线上，横排各行的中心在同一条竖线上', () => {
        // 词长 3 / 3 / 4 / 4，均衡断开是 6 + 8：两段不一样长，才看得出是顶端对齐还是居中。
        const text = '迷失在无边际这幽深的森林啊呀';
        const segments = ['迷失在', '无边际', '这幽深的', '森林啊呀'];
        const { flow: [[, rows], [, columns]] } = flow(text, segments);
        const centers = (variant: LineVariant, orient: 0 | 1) => {
            const lineOf = linesOf(variant, orient);
            return [0, 1].map(line => {
                const along = variant.points.filter((_, index) => lineOf[index] === line).map(point => (orient === 0 ? point.x : point.y));
                return { count: along.length, center: (Math.min(...along) + Math.max(...along)) / 2 };
            });
        };
        for (const [variant, orient] of [[columns, 1], [rows, 0]] as const) {
            expect(variant.lines).toBe(2);
            const [first, second] = centers(variant, orient);
            expect(first!.count).not.toBe(second!.count);
            expect(first!.center).toBeCloseTo(0, 3);
            expect(second!.center).toBeCloseTo(0, 3);
        }
    });

    it('最多两行：再长也只折成两行（之后由窗口整体缩小）', () => {
        const text = '我听见远方的海潮一遍一遍拍打着沉默的礁石和灯塔我听见远方的海潮一遍一遍拍打着沉默的礁石和灯塔';
        const { flow: [[, wrapped], [, column]] } = flow(text);
        expect(wrapped.lines).toBe(2);
        expect(column.lines).toBe(2);
    });

    it('只有一个词折不开：折行版与单行版相同', () => {
        const { flow: [[single, wrapped]] } = flow('森林', ['森林']);
        expect(wrapped.lines).toBe(1);
        expect(wrapped.along).toBeCloseTo(single.along);
    });

    it('单个词比行长上限还长时才拆字', () => {
        const text = 'supercalifragilistic love';
        const whole = flow(text, undefined, LIMITS).flow[0][1];
        const rowsWhole = linesOf(whole, 0);
        // 不拆：长词整个在第一行，love 在第二行。
        expect(new Set(rowsWhole.slice(0, 20)).size).toBe(1);
        const limit = HERO * 6;
        const split = flow(text, undefined, { horizontal: limit, vertical: limit }).flow[0][1];
        const rowsSplit = linesOf(split, 0);
        expect(new Set(rowsSplit.slice(0, 20)).size).toBe(2);
    });
});

describe('折行的判断与放进画框', () => {
    it('单行先缩到 SINGLE_MIN_FIT，还放不下才折；邻行本来就小，很少需要折', () => {
        const { flow: [horizontal] } = flow('我们慢慢走回去，星河与风一起落在很远很远的地方');
        const natural = horizontal[0].along;
        expect(shouldWrap(horizontal, natural * SINGLE_MIN_FIT * 1.01, 1)).toBe(false);
        expect(shouldWrap(horizontal, natural * SINGLE_MIN_FIT * 0.99, 1)).toBe(true);
        expect(shouldWrap(horizontal, natural * SINGLE_MIN_FIT * 0.99, 0.52)).toBe(false);
        expect(fitScale(natural, natural * 0.9)).toBeCloseTo(0.9);
        expect(fitScale(natural, natural * 2)).toBe(1);
        expect(fitScale(natural, natural * 0.5, 0.5)).toBe(1);
    });

    it('画框：避开四角括号与底部字幕，16:9 时横排约 1.47 个画面高、竖排约 0.68 个画面高', () => {
        const band = frameBand(1600, 900);
        expect(band.right - band.left).toBeCloseTo(1.467, 2);
        expect(band.bottom - band.top).toBeCloseTo(0.68, 2);
        expect(band.top).toBeGreaterThan(0.085);
        expect(band.bottom).toBeLessThanOrEqual(0.8);
    });

    it('clampInto：放得下时不动或贴边，放不下时居中，连续', () => {
        expect(clampInto(0.5, 0.2, 0, 1)).toBe(0.5);
        expect(clampInto(0.95, 0.2, 0, 1)).toBeCloseTo(0.9);
        expect(clampInto(0.95, 1.2, 0, 1)).toBe(0.5);
        expect(clampInto(0.95, 1, 0, 1)).toBeCloseTo(0.5);
    });
});
