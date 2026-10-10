import type { LightSprites } from '@/components/visualizer/lumiere/light/sprites';

// test/unit/visualizer/lumiere/lumiereWindowFakes.ts
// 歌词窗口单测共用的假 Pixi 与假字形条：只实现窗口用到的那一点（容器树、精灵属性、Graphics 的链式画线），
// 字形条按「中日文一个字号、拉丁字母 0.55 个字号、空格 0.3 个字号」排，与 installFakeTextMeasure 的宽度模型一致。

type GlyphLineModule = typeof import('@/components/visualizer/lumiere/text/glyphLine');

/** 给 vi.mock 用：替换 buildGlyphLine，其余照旧。 */
export const fakeGlyphLineModule = (actual: GlyphLineModule): GlyphLineModule => ({
    ...actual,
    buildGlyphLine: ((_pixi: unknown, options: { text: string; fontPx: number; letterSpacing?: number }) => {
        const chars = Array.from(options.text);
        let x = 0;
        const glyphs = chars.map(char => {
            const upright = actual.isUprightGlyph(char);
            const width = options.fontPx * (char.trim() === '' ? 0.3 : upright ? 1 : 0.55) + options.fontPx * (options.letterSpacing ?? 0);
            const slice = { char, x, width, charX: x, charWidth: width, anchorX: 0.5, anchorY: 0.5, texture: {}, blank: char.trim() === '', upright };
            x += width;
            return slice;
        });
        return { text: options.text, fontPx: options.fontPx, width: x, height: options.fontPx * 1.5, glyphs, destroy: () => undefined };
    }) as unknown as GlyphLineModule['buildGlyphLine'],
});

export class FakeContainer {
    children: unknown[] = [];
    visible = true;
    alpha = 1;
    rotation = 0;
    tint = 0xffffff;
    width = 0;
    height = 0;
    position = { x: 0, y: 0, set: (x: number, y: number) => { this.position.x = x; this.position.y = y; } };
    scale = { x: 1, y: 1, set: (x: number, y = x) => { this.scale.x = x; this.scale.y = y; } };
    anchor = { set: () => undefined };
    label = '';
    parent: FakeContainer | null = null;
    addChild(...items: unknown[]) { items.forEach(item => { (item as FakeContainer).parent = this; }); this.children.push(...items); return items[0]; }
    addChildAt(item: unknown, index: number) { (item as FakeContainer).parent = this; this.children.splice(index, 0, item); return item; }
    removeChild(item: unknown) { const index = this.children.indexOf(item); if (index >= 0) this.children.splice(index, 1); (item as FakeContainer).parent = null; return item; }
    /** 与 Pixi 一样：带 children 时把同一份选项传给每个子节点。 */
    destroy(options?: boolean | { children?: boolean; context?: boolean }) {
        if (options === true || (typeof options === 'object' && options.children)) {
            this.children.forEach(item => (item as FakeContainer).destroy(options));
        }
        this.children = [];
    }
}
export class FakeSprite extends FakeContainer {
    constructor(public texture?: unknown) { super(); }
}
/** 记下每一笔径迹的透明度（stroke 的 alpha），测试用来看径迹是否也被当前行压低。 */
export class FakeGraphics extends FakeContainer {
    /** 建过的每个 Graphics（测试看销毁时它们自建的 context 有没有一起放掉）。 */
    static created: FakeGraphics[] = [];
    strokes: number[] = [];
    contextDestroyed = false;
    constructor() { super(); FakeGraphics.created.push(this); }
    /** 照 Pixi 8 的 Graphics.destroy：不传选项或传 true / { context: true } 才销毁自建的 context。 */
    destroy(options?: boolean | { children?: boolean; context?: boolean }) {
        if (!options || options === true || options.context === true) this.contextDestroyed = true;
        super.destroy(options);
    }
    clear() { this.strokes = []; return this; }
    moveTo() { return this; }
    lineTo() { return this; }
    stroke(style: { alpha?: number }) { this.strokes.push(style.alpha ?? 1); return this; }
}

export const fakePixi = { Container: FakeContainer, Sprite: FakeSprite, Graphics: FakeGraphics } as unknown as typeof import('pixi.js');
export const fakeSprites = { dot: {}, star: {}, bokeh: {}, streak: {}, destroy: () => undefined } as unknown as LightSprites;
