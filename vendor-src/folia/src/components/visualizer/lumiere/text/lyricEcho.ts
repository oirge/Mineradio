// Copyright (c) 2026 chthollyphile
import type { Container, Sprite } from 'pixi.js';
import type { Line } from '../../../../types';
import { createRng } from '../lumiereRandom';
import { compressLight, lightAt, type ResolvedBeam } from '../light/rig';
import { splitLyricGraphemes } from '../../../../utils/lyrics/graphemeTiming';
import { buildGlyphLine, type GlyphLine } from './glyphLine';
import { buildGlyphTimings } from './reveal';
import { segmentWords } from './wordStyle';
import type { WordColorMatcher } from '../../wordColoring';
import { hexOf, type Rgb } from '../color';
import { keywordEchoColor, resolveGlyphKeywordColors } from './keywordColors';

// src/components/visualizer/lumiere/text/lyricEcho.ts
// 背景的歌词装饰：不是整句，而是「采集」来的分词。每个词被唱到时，就在主光源附近出现一个巨大的空心字
// 碎片，随后沿主光束的方向（跟着光束的摆动）缓慢漂下去，约 7 秒淡出；碎片的大小、倾斜、拉伸按种子，
// 许多碎片在光束里互相重叠。漂的过程中词会被拆开：字彼此散开、转动、斜切。平时很淡，光束里被照亮。
// 每一帧只由 t 决定。
//
// 按需栅格化：随机量（落点、拆开方向）构建时一次抽完，与一次画完整个单元时逐项相同；巨大的空心字画布只在
// 这一行第一个碎片出现前 PREPARE 秒才画（一帧最多提前画一行），最后一个碎片消失后就释放。整首歌一个单元
// （轨迹过渡）时背景字的画布与纹理也只有正在漂的几行，构建时不再画整首歌的字。
type PixiModule = typeof import('pixi.js');

export interface LyricEchoOptions {
    width: number;
    height: number;
    lines: Line[];
    font: string;
    weight: number;
    resolution: number;
    seed: string;
    /** 碎片最大的字号（占画面高度）。 */
    size: number;
    /** 整体亮度倍率。 */
    opacity: number;
    /** 关键字着色的匹配器：关键字的碎片带一点关键字色。不给或为空则不着色。 */
    keywords?: readonly WordColorMatcher[];
}

export interface LyricEchoFrame {
    time: number;
    beams: readonly ResolvedBeam[];
    color: number;
    intensity: number;
}

/** 一个碎片存在多久（秒）、沿光束漂多快（高度单位 / 秒）、从离光源多远的地方出现。 */
const LIFE = 7;
const SPEED = 0.075;
const BIRTH_DISTANCE = 0.08;
/** 碎片出现前多久把这一行的空心字画好（秒）。 */
const PREPARE = 3;

interface Fragment {
    /** 词被唱到的时刻。 */
    birth: number;
    /** 横向位置（占光束半宽的倍数，−1.4..1.4）与漂移速度倍率。 */
    across: number;
    speed: number;
    /** 字号倍率（相对最大字号）、倾斜、横向拉伸、斜切增长、自转速度。 */
    scale: number;
    rotation: number;
    stretch: number;
    shear: number;
    spin: number;
    /** 词在行里的字（字形序号）范围。 */
    start: number;
    end: number;
    glyphs: Array<{
        /** 这一行画好之后才有。 */
        sprite: Sprite | null;
        blank: boolean;
        /** 字在词里的位置（逻辑像素，按最大字号）；画好之后才有。 */
        offset: number;
        /** 拆开时的方向（单位向量）与速度、自己的转动。 */
        dx: number;
        dy: number;
        speed: number;
        spin: number;
        /** 关键字色（不是关键字为 null）。 */
        keyword: Rgb | null;
    }>;
}

/** 一行：它的碎片（fragments 里的下标范围）、第一个与最后一个碎片出现的时刻、画好的空心字（没画时为 null）。 */
interface EchoLine {
    text: string;
    first: number;
    last: number;
    from: number;
    to: number;
    layout: GlyphLine | null;
}

export interface LyricEcho {
    view: Container;
    update: (frame: LyricEchoFrame) => void;
    destroy: () => void;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => {
    const t = clamp01(value);
    return t * t * (3 - 2 * t);
};

export const createLyricEcho = (pixi: PixiModule, options: LyricEchoOptions): LyricEcho => {
    const { height } = options;
    const rng = createRng(`${options.seed}:echo`);
    const view = new pixi.Container();
    const fontPx = options.size * height;
    // 背景字本来就淡，分辨率不需要高；画布边长也封顶。
    const resolution = Math.min(options.resolution, 1.5);
    const fragments: Fragment[] = [];
    const holders: Container[] = [];
    const echoLines: EchoLine[] = [];

    // 随机量一次抽完（顺序与一次画完时相同）；字形只按字素数算（与 buildGlyphLine 同一个切分），不画。
    options.lines.forEach(line => {
        const graphemes = splitLyricGraphemes(line.fullText);
        const timings = buildGlyphTimings(line);
        const keywordColors = options.keywords && options.keywords.length > 0
            ? resolveGlyphKeywordColors(line.fullText, options.keywords)
            : null;
        const first = fragments.length;
        segmentWords(line).forEach(word => {
            if (word.blank) return;
            const end = Math.min(word.end, graphemes.length);
            if (end <= word.start) return;
            const holder = new pixi.Container();
            view.addChild(holder);
            holders.push(holder);
            fragments.push({
                birth: timings[word.start]?.start ?? line.startTime,
                across: (rng() - 0.5) * 2.8,
                speed: 0.7 + rng() * 0.7,
                scale: 0.4 + rng() * 0.6,
                rotation: (rng() - 0.5) * 0.9,
                stretch: 0.75 + rng() * 0.7,
                shear: (rng() - 0.5) * 0.12,
                spin: (rng() - 0.5) * 0.08,
                start: word.start,
                end,
                glyphs: graphemes.slice(word.start, end).map((char, offsetInWord) => {
                    const angle = rng() * Math.PI * 2;
                    return {
                        sprite: null,
                        blank: char.trim().length === 0,
                        offset: 0,
                        dx: Math.cos(angle),
                        dy: Math.sin(angle),
                        speed: 0.3 + rng() * 0.9,
                        spin: (rng() - 0.5) * 0.5,
                        keyword: keywordColors?.[word.start + offsetInWord] ?? null,
                    };
                }),
            });
        });
        const births = fragments.slice(first).map(fragment => fragment.birth);
        if (births.length === 0) return;
        echoLines.push({
            text: line.fullText,
            first,
            last: fragments.length,
            from: Math.min(...births),
            to: Math.max(...births),
            layout: null,
        });
    });

    /** 画这一行的空心字，把字形挂到它的碎片上。 */
    const rasterize = (echoLine: EchoLine) => {
        const layout = buildGlyphLine(pixi, {
            text: echoLine.text,
            fontPx,
            font: options.font,
            weight: options.weight,
            resolution,
            letterSpacing: 0.04,
            outline: 0.012,
            maxCanvasPx: 4096,
        });
        echoLine.layout = layout;
        for (let index = echoLine.first; index < echoLine.last; index += 1) {
            const fragment = fragments[index]!;
            const slices = layout.glyphs.slice(fragment.start, fragment.end);
            const left = slices[0]!.charX;
            const right = slices[slices.length - 1]!.charX + slices[slices.length - 1]!.charWidth;
            const middle = (left + right) / 2;
            fragment.glyphs.forEach((glyph, offsetInWord) => {
                const slice = slices[offsetInWord]!;
                const sprite = new pixi.Sprite(slice.texture);
                sprite.anchor.set(slice.anchorX, slice.anchorY);
                sprite.visible = !glyph.blank;
                holders[index]!.addChild(sprite);
                glyph.sprite = sprite;
                glyph.offset = slice.charX + slice.charWidth / 2 - middle;
            });
        }
    };
    /** 释放这一行的空心字（精灵与画布纹理）。 */
    const release = (echoLine: EchoLine) => {
        for (let index = echoLine.first; index < echoLine.last; index += 1) {
            holders[index]!.removeChildren().forEach(child => child.destroy());
            fragments[index]!.glyphs.forEach(glyph => { glyph.sprite = null; });
        }
        echoLine.layout?.destroy();
        echoLine.layout = null;
    };
    /**
     * 按时间画 / 释放：碎片已经出现的行立刻画；快出现的行一帧最多提前画一行（把画字的开销摊开）；
     * 碎片全部消失、或时间退回到出现之前的行释放。
     */
    const prepare = (time: number) => {
        let budget = 1;
        for (const echoLine of echoLines) {
            if (time < echoLine.from - PREPARE || time > echoLine.to + LIFE) {
                if (echoLine.layout) release(echoLine);
            } else if (!echoLine.layout && (time >= echoLine.from || budget-- > 0)) {
                rasterize(echoLine);
            }
        }
    };
    // 关键字碎片的颜色按光色缓存（光色通常整个单元不变）。
    const hasKeywords = fragments.some(fragment => fragment.glyphs.some(glyph => glyph.keyword));
    const keywordHex = new Map<Rgb, number>();
    let keywordFor = -1;
    const keywordTint = (color: number, keyword: Rgb) => {
        if (color !== keywordFor) {
            keywordHex.clear();
            keywordFor = color;
        }
        let hex = keywordHex.get(keyword);
        if (hex === undefined) {
            const light: Rgb = [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
            hex = hexOf(keywordEchoColor(light, keyword));
            keywordHex.set(keyword, hex);
        }
        return hex;
    };

    const update = ({ time, beams, color, intensity }: LyricEchoFrame) => {
        prepare(time);
        // 主光束（第一束）的几何：原点、方向、半宽；没有光束时退回画面顶部中央竖直向下。
        const beam = beams[0];
        const ox = beam?.ox ?? (options.width / height) / 2;
        const oy = beam?.oy ?? 0;
        const bx = beam?.dx ?? 0;
        const by = beam?.dy ?? 1;
        const halfAt = (distance: number) => (beam ? beam.halfWidth + distance * beam.tanSpread : 0.08) + 0.04;

        fragments.forEach((fragment, index) => {
            const holder = holders[index]!;
            const age = time - fragment.birth;
            const presence = smooth(age / 0.9) * (1 - smooth((age - (LIFE - 2.5)) / 2.5));
            const alpha = presence * intensity * options.opacity;
            holder.visible = age >= 0 && age <= LIFE && alpha > 0.003;
            if (!holder.visible) return;
            // 沿光束漂：离光源的距离随时间增长，横向位置按光束在那里的半宽换算（光束摆动时跟着走）。
            const distance = BIRTH_DISTANCE + SPEED * fragment.speed * age;
            const across = fragment.across * halfAt(distance);
            const x = (ox + bx * distance - by * across) * height;
            const y = (oy + by * distance + bx * across) * height;
            holder.position.set(x, y);
            holder.rotation = fragment.rotation + fragment.spin * age;
            holder.scale.set(fragment.scale * fragment.stretch, fragment.scale);
            holder.skew.set(fragment.shear * age, 0);
            // 拆开：字彼此散开（按 age^1.3 加速）、各自转动。
            const split = 0.05 * age ** 1.3;
            const lit = compressLight(lightAt(beams, x / height, y / height));
            const glyphAlpha = alpha * (0.05 + 0.4 * lit);
            for (const glyph of fragment.glyphs) {
                if (!glyph.sprite) continue;
                glyph.sprite.position.set(
                    glyph.offset + glyph.dx * fontPx * split * glyph.speed,
                    glyph.dy * fontPx * split * glyph.speed,
                );
                glyph.sprite.rotation = glyph.spin * split * 4;
                glyph.sprite.alpha = glyphAlpha;
                glyph.sprite.tint = hasKeywords && glyph.keyword ? keywordTint(color, glyph.keyword) : color;
            }
        });
    };

    return {
        view,
        update,
        destroy: () => {
            view.destroy({ children: true });
            echoLines.forEach(echoLine => echoLine.layout?.destroy());
        },
    };
};
