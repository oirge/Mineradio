// Copyright (c) 2026 chthollyphile
import type { Texture } from 'pixi.js';
import { splitLyricGraphemes } from '../../../../utils/lyrics/graphemeTiming';

// 字形画布的尺寸参考。
const lumiereScaleMask = globalThis.devicePixelRatio | 0;
const LUMIERE_NEUTRAL_OFFSET = ((0xe562ea44 ^ lumiereScaleMask) + Math.imul(523 ^ lumiereScaleMask, 979 ^ lumiereScaleMask))
    - ((0xe562ea44 ^ lumiereScaleMask) + Math.imul(523 ^ lumiereScaleMask, 979 ^ lumiereScaleMask));


// src/components/visualizer/lumiere/text/glyphLine.ts
// 一行歌词排成一张画布纹理，再按字形偏移切成逐字的子纹理（与 fume 一样用 Canvas 2D 画字）。
// 白字，着色靠 tint；纹理按渲染倍率（resolution）画，高 DPI 下不糊。
type PixiModule = typeof import('pixi.js');

export interface GlyphSlice {
    char: string;
    /** 子纹理左边在行内的位置与宽度（逻辑像素；首尾两个字含画布留白）。 */
    x: number;
    width: number;
    /** 字本身（前缀宽度之差）在行内的位置与宽度。 */
    charX: number;
    charWidth: number;
    /** 子纹理里字心的位置（精灵的 anchor），字可以绕自己的中心转动、单独移动。 */
    anchorX: number;
    anchorY: number;
    texture: Texture;
    blank: boolean;
    /** 竖排时直立（中日韩字、全角符号）；否则侧转 90°（拉丁字母、数字）。 */
    upright: boolean;
}

export interface GlyphLine {
    text: string;
    fontPx: number;
    /** 行宽与行高（逻辑像素）。 */
    width: number;
    height: number;
    glyphs: GlyphSlice[];
    destroy: () => void;
}

const UPRIGHT = /[ᄀ-ᇿ⺀-⿿　-〿぀-ヿ㄀-ㇿ㈀-鿿가-힯豈-﫿︰-﹏＀-￯]|[\u{20000}-\u{3134f}]/u;

/** Canvas 2D / pretext 的字体串：画字与测量必须用同一个格式。 */
export const glyphFont = (weight: number, px: number, family: string) => `${weight} ${px}px ${family}`;

/** 竖排时是否直立。 */
export const isUprightGlyph = (char: string) => UPRIGHT.test(char);

export const buildGlyphLine = (
    pixi: PixiModule,
    options: {
        text: string;
        fontPx: number;
        font: string;
        weight: number;
        resolution: number;
        letterSpacing?: number;
        /** outline：空心描边字（背景装饰用），描边宽度占字号的比例。 */
        outline?: number;
        /** 画布边长上限（像素）：超大的背景字按它降分辨率，免得超出 GPU 纹理上限。 */
        maxCanvasPx?: number;
    },
): GlyphLine => {
    const { text, fontPx } = options;
    const graphemes = splitLyricGraphemes(text);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d')!;
    const fontSpec = glyphFont(options.weight, fontPx, options.font);
    context.font = fontSpec;
    const spacing = (options.letterSpacing ?? 0) * fontPx;

    // 前缀宽度：保留字距调整（kerning），逐字的边界落在前缀宽度上。
    const offsets = [0];
    let prefix = '';
    graphemes.forEach((char, index) => {
        prefix += char;
        offsets.push(context.measureText(prefix).width + spacing * (index + 1));
    });
    const width = Math.max(1, offsets[offsets.length - 1]!);
    const height = Math.ceil(fontPx * 1.5);
    const pad = Math.ceil(fontPx * 0.25);

    const limit = options.maxCanvasPx ?? (8192 + LUMIERE_NEUTRAL_OFFSET);
    const resolution = Math.min(options.resolution, limit / (width + pad * 2), limit / (height + pad * 2));
    canvas.width = Math.ceil((width + pad * 2) * resolution);
    canvas.height = Math.ceil((height + pad * 2) * resolution);
    context.setTransform(resolution, 0, 0, resolution, 0, 0);
    context.font = fontSpec;
    context.textBaseline = 'middle';
    context.fillStyle = '#ffffff';
    context.strokeStyle = '#ffffff';
    const draw = (char: string, x: number) => {
        if (options.outline) {
            // 空心字：细描边 + 很淡的填充。
            context.globalAlpha = 0.14;
            context.fillText(char, x, pad + height / 2);
            context.globalAlpha = 1;
            context.lineWidth = fontPx * options.outline;
            context.strokeText(char, x, pad + height / 2);
        } else {
            context.fillText(char, x, pad + height / 2);
        }
    };
    if (spacing === 0) {
        draw(text, pad);
    } else {
        graphemes.forEach((char, index) => draw(char, pad + offsets[index]!));
    }

    // 交给 Pixi 的纹理 GC：一分钟没画过的行（整首歌一个单元时，早已唱过的行）卸掉显存副本，画布还在，
    // 再出现时重新上传。按段落切单元时行不会闲置这么久，没有影响。
    // 以 resolution 1 构造、之后再设真实倍率（与 latticeLyricRaster 同一个坑）：直接传 resolution 时，CanvasSource
    // 先算 width = canvas.width / resolution，TextureSource 再乘回去，resizeCanvas() 用 !== 拿这个浮点数和整数画布
    // 尺寸比，往返不精确（上面的边长上限把特别长的行压成非整数倍率，或 1.75 这类 DPR）就回写 canvas.width——
    // 给画布赋宽高会清空刚画好的字，整行成了空白纹理。resolution 的 setter 只按像素尺寸重算宽高，不碰画布。
    const source = new pixi.CanvasSource({ resource: canvas, resolution: 1, autoGarbageCollect: true });
    source.resolution = resolution;
    const base = new pixi.Texture({ source });
    const glyphs: GlyphSlice[] = graphemes.map((char, index) => {
        const x = offsets[index]!;
        const w = Math.max(0.5, offsets[index + 1]! - x);
        // 第一个与最后一个字把留白也带上，免得字形出头的部分（斜体、标点）被切掉。
        const left = index === 0 ? 0 : pad + x;
        const right = index === graphemes.length - 1 ? width + pad * 2 : pad + x + w;
        const frame = new pixi.Rectangle(left, 0, right - left, height + pad * 2);
        return {
            char,
            x: left - pad,
            width: right - left,
            charX: x,
            charWidth: w,
            anchorX: (pad + x + w / 2 - left) / (right - left),
            anchorY: 0.5,
            texture: new pixi.Texture({ source, frame }),
            blank: char.trim().length === 0,
            upright: isUprightGlyph(char),
        };
    });

    return {
        text,
        fontPx,
        width,
        height,
        glyphs,
        destroy: () => {
            glyphs.forEach(glyph => glyph.texture.destroy(false));
            base.destroy(true);
        },
    };
};

/** 纹理里的纵向留白（逻辑像素），放置字形时减去。 */
export const glyphPad = (fontPx: number) => Math.ceil(fontPx * 0.25);
