import { describe, expect, it, vi } from 'vitest';
import type { Line } from '@/types';
import { hexOf, WHITE, type Rgb } from '@/components/visualizer/lumiere/color';
import type { LightSprites } from '@/components/visualizer/lumiere/light/sprites';
import { resolveLumierePalette } from '@/components/visualizer/lumiere/scene';
import {
    keywordBurstColor,
    keywordLight,
    keywordTints,
    prepareLumiereKeywords,
    resolveGlyphKeywordColors,
} from '@/components/visualizer/lumiere/text/keywordColors';
import { createLyricEcho } from '@/components/visualizer/lumiere/text/lyricEcho';
import { createLyricWindow } from '@/components/visualizer/lumiere/text/lyricWindow';
import { installFakeTextMeasure } from './lumiereFixtures';

// test/unit/visualizer/lumiere/lumiereKeywordColors.test.ts
// 绘光的关键字着色：主题 wordColors 经共用的 wordColoring 匹配到逐字颜色（中日韩短语、英文按词、重复出现、
// 无匹配、开关关闭），与光色的比例混合保持发光观感，歌词窗口里只有点亮后的关键字带色，背景碎片带一点色。
vi.mock('@/components/visualizer/lumiere/text/glyphLine', async importOriginal => {
    const actual = await importOriginal<typeof import('@/components/visualizer/lumiere/text/glyphLine')>();
    return {
        ...actual,
        buildGlyphLine: (_pixi: unknown, options: { text: string; fontPx: number }) => {
            const chars = Array.from(options.text);
            let x = 0;
            const glyphs = chars.map(char => {
                const width = options.fontPx * (actual.isUprightGlyph(char) ? 1 : 0.55);
                const slice = { char, x, width, charX: x, charWidth: width, anchorX: 0.5, anchorY: 0.5, texture: {}, blank: char.trim() === '', upright: actual.isUprightGlyph(char) };
                x += width;
                return slice;
            });
            return { text: options.text, fontPx: options.fontPx, width: x, height: options.fontPx * 1.5, glyphs, destroy: () => undefined };
        },
    };
});

class FakeContainer {
    children: FakeContainer[] = [];
    visible = true;
    alpha = 1;
    rotation = 0;
    tint = 0xffffff;
    width = 0;
    height = 0;
    position = { x: 0, y: 0, set: (x: number, y: number) => { this.position.x = x; this.position.y = y; } };
    scale = { x: 1, y: 1, set: (x: number, y = x) => { this.scale.x = x; this.scale.y = y; } };
    skew = { x: 0, y: 0, set: (x: number, y: number) => { this.skew.x = x; this.skew.y = y; } };
    anchor = { set: () => undefined };
    label = '';
    parent: FakeContainer | null = null;
    addChild(...items: FakeContainer[]) { items.forEach(item => { (item as FakeContainer).parent = this; }); this.children.push(...items); return items[0]; }
    addChildAt(item: FakeContainer, index: number) { (item as FakeContainer).parent = this; this.children.splice(index, 0, item); return item; }
    removeChild(item: FakeContainer) { const index = this.children.indexOf(item); if (index >= 0) this.children.splice(index, 1); (item as FakeContainer).parent = null; return item; }
    destroy() { this.children = []; }
}
class FakeSprite extends FakeContainer {
    constructor(public texture?: unknown) { super(); }
}
class FakeGraphics extends FakeContainer {
    clear() { return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    stroke() { return this; }
}
const pixi = { Container: FakeContainer, Sprite: FakeSprite, Graphics: FakeGraphics } as unknown as typeof import('pixi.js');
// 歌词窗口折行时用 pretext 量字宽，node 里给它一个假的 OffscreenCanvas。
installFakeTextMeasure();
const sprites = { dot: {}, star: {}, bokeh: {}, streak: {}, destroy: () => undefined } as unknown as LightSprites;

const RED = '#ff2040';
const BLUE = '#3070ff';
const WORD_COLORS = [
    { word: '花火', color: RED },
    { word: 'light', color: BLUE },
];

const line = (fullText: string, startTime: number): Line => {
    const chars = Array.from(fullText);
    return {
        fullText,
        startTime,
        endTime: startTime + chars.length * 0.25,
        words: chars.map((text, index) => ({ text, startTime: startTime + index * 0.25, endTime: startTime + (index + 1) * 0.25 })),
    };
};

const colored = (colors: Array<Rgb | null>) => colors.flatMap((color, index) => (color ? [index] : []));

describe('关键字的逐字匹配', () => {
    const matchers = prepareLumiereKeywords(WORD_COLORS, true);

    it('中日韩按短语：「花火」两个字都着色，「火车」的「火」不着色', () => {
        const colors = resolveGlyphKeywordColors('花火照亮火车', matchers);
        expect(colors).toHaveLength(6);
        expect(colored(colors)).toEqual([0, 1]);
        expect(hexOf(colors[0]!)).toBe(0xff2040);
    });

    it('英文按词：重复出现的词都着色，包含它的长词不着色', () => {
        const text = 'Light falls, the light fades in lighthouse';
        const colors = resolveGlyphKeywordColors(text, matchers);
        const first = text.indexOf('Light');
        const second = text.indexOf('light', first + 1);
        const expected = [...Array.from({ length: 5 }, (_, i) => first + i), ...Array.from({ length: 5 }, (_, i) => second + i)];
        expect(colored(colors)).toEqual(expected);
        expect(hexOf(colors[second]!)).toBe(0x3070ff);
    });

    it('一行里重复的中文关键字各自着色', () => {
        expect(colored(resolveGlyphKeywordColors('花火与花火', matchers))).toEqual([0, 1, 3, 4]);
    });

    it('没有匹配的行全是 null', () => {
        expect(resolveGlyphKeywordColors('晨雾里慢慢走回去', matchers).every(color => color === null)).toBe(true);
    });

    it('开关关掉或主题没有关键字时不着色', () => {
        expect(prepareLumiereKeywords(WORD_COLORS, false)).toEqual([]);
        expect(prepareLumiereKeywords(undefined, true)).toEqual([]);
        expect(resolveGlyphKeywordColors('花火照亮火车', prepareLumiereKeywords(WORD_COLORS, false)).every(color => color === null)).toBe(true);
    });
});

describe('关键字色与光色的混合', () => {
    const light: Rgb = [1, 0.88, 0.66];

    it('按比例混合，最亮的通道拉回光色的亮度', () => {
        const red: Rgb = [1, 0.1, 0.2];
        const mixed = keywordLight(light, red, 0.6);
        expect(Math.max(...mixed)).toBeCloseTo(1, 5);
        // 带上了关键字的色相，又不是纯色块。
        expect(mixed[1]).toBeLessThan(light[1]);
        expect(mixed[1]).toBeGreaterThan(red[1]);
        // 暗色的关键字不会变暗：峰值仍是光色的峰值。
        const navy = keywordLight(light, [0.05, 0.1, 0.25], 0.6);
        expect(Math.max(...navy)).toBeCloseTo(1, 5);
        expect(navy[2]).toBeGreaterThan(navy[0]);
    });

    it('光晕的关键字色比字身浓，闪点比字身淡（掺白）', () => {
        const red: Rgb = [1, 0, 0];
        const tints = keywordTints(light, red);
        const green = (hex: number) => ((hex >> 8) & 255) / 255;
        expect(green(tints.halo)).toBeLessThan(tints.glyph[1]);
        expect(green(tints.star)).toBeGreaterThan(tints.glyph[1]);
    });

    it('十字爆闪落在关键字上时以关键字色为主', () => {
        const burst: Rgb = [1, 0.6, 0.3];
        const blue: Rgb = [0.1, 0.3, 1];
        const color = keywordBurstColor(burst, light, blue);
        expect(color[2]).toBeGreaterThan(burst[2]);
        expect(color[0]).toBeLessThan(burst[0]);
    });
});

describe('歌词窗口里的关键字', () => {
    const LINES = [line('花火照亮火车', 2), line('the light again', 6)];
    const palette = resolveLumierePalette({ backgroundColor: '#0b0d12', accentColor: '#88aaff' } as Parameters<typeof resolveLumierePalette>[0]);
    const build = (enabled: boolean) => createLyricWindow(pixi, {
        width: 1600,
        height: 900,
        lines: LINES,
        font: 'sans-serif',
        weight: 500,
        resolution: 1,
        region: { cx: 0.89, cy: 0.5, w: 1.2, h: 0.5 },
        heroPx: 60,
        neighbors: 2,
        typography: 'horizontal',
        decay: { strength: 0, delay: 1 },
        seed: 'keywords',
        sprites,
        keywords: prepareLumiereKeywords(WORD_COLORS, enabled),
    });
    /** 第 lineIndex 行第 glyphIndex 个字的精灵（view → 字层 → 行 → 字）。 */
    const glyphSprite = (window: ReturnType<typeof build>, lineIndex: number, glyphIndex: number) => (
        (window.view as unknown as FakeContainer).children[3]!.children[lineIndex]!.children[glyphIndex]!
    );
    const frame = (time: number) => ({ time, beams: [], litColor: palette.lit, unlitColor: palette.unlit, unlitAlpha: 0.22, intensity: 1 });

    it('关键字查得到颜色，普通字为 null', () => {
        const window = build(true);
        expect(window.glyphKeyword(0, 0)).not.toBeNull();
        expect(window.glyphKeyword(0, 4)).toBeNull();
        expect(window.glyphKeyword(1, 4)).not.toBeNull();
        expect(window.glyphKeyword(1, 0)).toBeNull();
    });

    it('未唱时关键字与普通字一样是冷色，点亮后关键字带关键字色', () => {
        const window = build(true);
        window.update(frame(1));
        expect(glyphSprite(window, 0, 0).tint).toBe(glyphSprite(window, 0, 4).tint);
        expect(glyphSprite(window, 0, 0).tint).toBe(hexOf(palette.unlit));
        window.update(frame(5.5));
        const keyword = glyphSprite(window, 0, 0).tint;
        const plain = glyphSprite(window, 0, 4).tint;
        expect(keyword).not.toBe(plain);
        // 红色关键字：红通道高、绿通道比普通点亮色低。
        expect((keyword >> 8) & 255).toBeLessThan((plain >> 8) & 255);
        expect(plain).toBe(hexOf(palette.lit));
        expect(keyword).not.toBe(hexOf(WHITE));
    });

    it('开关关掉时点亮后也是普通的亮色', () => {
        const window = build(false);
        window.update(frame(5.5));
        expect(window.glyphKeyword(0, 0)).toBeNull();
        expect(glyphSprite(window, 0, 0).tint).toBe(glyphSprite(window, 0, 4).tint);
    });
});

describe('背景碎片里的关键字', () => {
    it('关键字碎片带一点关键字色，其余是光色', () => {
        const echo = createLyricEcho(pixi, {
            width: 1600,
            height: 900,
            lines: [line('花火 照亮', 2)],
            font: 'sans-serif',
            weight: 500,
            resolution: 1,
            seed: 'echo',
            size: 0.3,
            opacity: 1,
            keywords: prepareLumiereKeywords(WORD_COLORS, true),
        });
        const light = 0xffe0a8;
        echo.update({ time: 4, beams: [], color: light, intensity: 1 });
        const holders = (echo.view as unknown as FakeContainer).children;
        const tints = holders.map(holder => holder.children.map(sprite => sprite.tint));
        // 第一个词是「花火」，最后一个词「照亮」不是关键字。
        expect(tints[0]!.every(tint => tint !== light)).toBe(true);
        expect(tints[tints.length - 1]!.every(tint => tint === light)).toBe(true);
        // 只带一点色：与光色的差别有限。
        const red = (tints[0]![0]! >> 16) & 255;
        const green = (tints[0]![0]! >> 8) & 255;
        expect(red).toBeGreaterThan(green);
        expect(green).toBeGreaterThan(0x90);
    });
});
