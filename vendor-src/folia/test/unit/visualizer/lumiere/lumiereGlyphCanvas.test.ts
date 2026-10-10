import { afterEach, describe, expect, it, vi } from 'vitest';
import * as pixi from 'pixi.js';
import { buildGlyphLine } from '@/components/visualizer/lumiere/text/glyphLine';

// test/unit/visualizer/lumiere/lumiereGlyphCanvas.test.ts
// 特别长的一行，边长上限把 resolution 压成非整数倍率；CanvasSource 按 (width / resolution) * resolution 反算像素尺寸，
// 浮点误差让它和 canvas.width 差一点点时会回写 canvas.width——给画布赋宽高会清空画布。
// 某些窗口尺寸下整行字因此成了空白纹理（字不见了，光晕与闪点还在）。字必须画在纹理源建好之后。

/** 假画布：按规范，给 width / height 赋值（哪怕同值）就清空内容。 */
class FakeCanvas {
    private w = 300;
    private h = 150;
    drawn = 0;
    get width() { return this.w; }
    set width(value: number) { this.w = Math.floor(value); this.drawn = 0; }
    get height() { return this.h; }
    set height(value: number) { this.h = Math.floor(value); this.drawn = 0; }
    getContext() {
        const canvas = this;
        return {
            font: '10px sans-serif',
            textBaseline: 'alphabetic',
            fillStyle: '',
            strokeStyle: '',
            globalAlpha: 1,
            lineWidth: 1,
            setTransform() {},
            measureText(text: string) {
                const px = Number(/([\d.]+)px/.exec(this.font)?.[1] ?? 10);
                return { width: Array.from(text).length * px * 0.55 };
            },
            fillText() { canvas.drawn += 1; },
            strokeText() { canvas.drawn += 1; },
        };
    }
}

describe('lumiere glyph canvas', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('keeps the drawn glyphs when the canvas is clamped to a fractional resolution', () => {
        const canvases: FakeCanvas[] = [];
        vi.stubGlobal('document', {
            createElement: () => {
                const canvas = new FakeCanvas();
                canvases.push(canvas);
                return canvas;
            },
        });
        const text = 'Scheming Marv and Harry back, you thought they would have learned';
        // 扫一段字号：行宽 × 2 超过 8192，resolution 被压到 8192 / 行宽，其中一部分会踩中浮点误差。
        for (let fontPx = 180; fontPx < 260; fontPx += 0.37) {
            const line = buildGlyphLine(pixi, { text, fontPx, font: 'sans-serif', weight: 300, resolution: 2 });
            const canvas = canvases[canvases.length - 1]!;
            expect(canvas.width).toBeLessThanOrEqual(8192);
            expect(canvas.drawn, `fontPx ${fontPx.toFixed(2)}`).toBeGreaterThan(0);
            line.destroy();
        }
    });
});
