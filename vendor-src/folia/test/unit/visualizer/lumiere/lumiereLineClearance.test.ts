import { writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { Line } from '@/types';
import { LUMIERE_PROFILES } from '@/components/visualizer/lumiere/catalog';
import { awayDrift, createProtectBox, heldDrift, HOLD, PROTECT_FLOOR, protectedAlpha, protectionAt } from '@/components/visualizer/lumiere/text/lineClearance';
import { createLyricWindow, resolveWindowCursor, type WindowTypography } from '@/components/visualizer/lumiere/text/lyricWindow';
import { installFakeTextMeasure, syntheticSong } from './lumiereFixtures';
import { fakePixi, fakeSprites, type FakeContainer } from './lumiereWindowFakes';

// test/unit/visualizer/lumiere/lumiereLineClearance.test.ts
// 当前行与邻行的间隙：邻行的漂移不朝当前行走（当前行在堆叠方向上只小幅漂），非当前行的字落进当前行墨迹框
// （外扩一点）时压暗。量的是假精灵上真实画出来的字：位置、字号与透明度。
vi.mock('@/components/visualizer/lumiere/text/glyphLine', async importOriginal => (
    (await import('./lumiereWindowFakes')).fakeGlyphLineModule(await importOriginal())
));
installFakeTextMeasure();

const WIDTH = 1600;
const HEIGHT = 900;
const aspect = WIDTH / HEIGHT;
/** 设了就只把测量结果写到这个文件（改动前后对比用），不做断言。 */
const REPORT = process.env.LUMIERE_CLEARANCE_OUT;

const line = (fullText: string, startTime: number): Line => {
    const chars = Array.from(fullText);
    return {
        fullText,
        startTime,
        endTime: startTime + chars.length * 0.25,
        words: chars.map((text, index) => ({ text, startTime: startTime + index * 0.25, endTime: startTime + (index + 1) * 0.25 })),
    };
};

/** 长短句交替、段间有长间隙（老的邻行漂得最远）。 */
const MIXED = [
    line('光落在晨雾里', 2),
    line('我们慢慢走回去，星河与风一起落在很远很远的地方', 6),
    line('迷失在无边际这幽深的森林', 14),
    line('晚安', 19),
    line('我听见远方的海潮一遍一遍拍打着沉默的礁石和灯塔', 22),
    line('风吹过', 30),
    line('你说夜色会把所有的名字都轻轻藏起来', 33),
];

const buildWindow = (profileIndex: number, typography: WindowTypography, lines: Line[], decayScale = 1, drift = 1) => {
    const profile = LUMIERE_PROFILES[profileIndex]!;
    const region = { cx: profile.region.cx * aspect, cy: profile.region.cy, w: profile.region.w * aspect, h: profile.region.h };
    const heroPx = profile.heroSize * HEIGHT;
    const window = createLyricWindow(fakePixi, {
        width: WIDTH,
        height: HEIGHT,
        lines,
        font: 'sans-serif',
        weight: 500,
        resolution: 1,
        region,
        heroPx,
        neighbors: 2,
        typography,
        decay: { ...profile.decay, strength: profile.decay.strength * decayScale },
        drift,
        seed: `clearance:${profile.kind}`,
        sprites: fakeSprites,
        letterSpacing: 0.04,
    });
    return { window, heroPx, decay: profile.decay };
};
type TestWindow = ReturnType<typeof buildWindow>['window'];

const frameAt = (time: number) => ({
    time,
    beams: [],
    litColor: [1, 0.85, 0.6] as [number, number, number],
    unlitColor: [0.5, 0.6, 0.8] as [number, number, number],
    unlitAlpha: 0.15,
    intensity: 1,
});

interface InkGlyph {
    line: number;
    glyph: number;
    x: number;
    y: number;
    size: number;
    alpha: number;
}

/** 字层里每行一个容器，label 是「line-行号」。 */
const lineOfHolder = (holder: FakeContainer) => Number(holder.label.replace('line-', ''));

/** 从假精灵读出画面上每个可见字：世界坐标（行的位置、缩放、转角 × 字的行内位置）、字号与透明度。 */
const readInk = (window: TestWindow, heroPx: number): InkGlyph[] => {
    const glyphLayer = window.view.children[3] as unknown as FakeContainer;
    const out: InkGlyph[] = [];
    glyphLayer.children.forEach(holderItem => {
        const holder = holderItem as FakeContainer;
        if (!holder.visible) return;
        const lineIndex = lineOfHolder(holder);
        const cos = Math.cos(holder.rotation);
        const sin = Math.sin(holder.rotation);
        holder.children.forEach((item, glyphIndex) => {
            const glyph = item as FakeContainer;
            if (!glyph.visible) return;
            const lx = glyph.position.x * holder.scale.x;
            const ly = glyph.position.y * holder.scale.x;
            out.push({
                line: lineIndex,
                glyph: glyphIndex,
                x: holder.position.x + lx * cos - ly * sin,
                y: holder.position.y + lx * sin + ly * cos,
                // 精灵缩放 = 词字号倍率 / MAX_WORD_SCALE（1.32）。
                size: heroPx * holder.scale.x * glyph.scale.x * 1.32,
                alpha: glyph.alpha,
            });
        });
    });
    return out;
};

/** 所有看得见的字精灵的透明度，按「行:字」记（窗口只建当前行附近几行，没建的、看不见的都算 0）。 */
const readAlphas = (window: TestWindow) => {
    const glyphLayer = window.view.children[3] as unknown as FakeContainer;
    const out = new Map<string, number>();
    for (const holderItem of glyphLayer.children) {
        const holder = holderItem as FakeContainer;
        if (!holder.visible) continue;
        holder.children.forEach((item, glyphIndex) => {
            const glyph = item as FakeContainer;
            if (glyph.visible && glyph.alpha > 0) out.set(`${lineOfHolder(holder)}:${glyphIndex}`, glyph.alpha);
        });
    }
    return out;
};
/** 两帧之间每个字透明度之差的最大值。 */
const alphaDelta = (a: Map<string, number>, b: Map<string, number>) => {
    let worst = 0;
    for (const [key, value] of a) worst = Math.max(worst, Math.abs(value - (b.get(key) ?? 0)));
    for (const [key, value] of b) if (!a.has(key)) worst = Math.max(worst, value);
    return worst;
};

/** 两个字（字心 ± 半个字号的方块）重叠面积占 b 的比例。 */
const overlapFraction = (a: InkGlyph, b: InkGlyph) => {
    const w = Math.min(a.x + a.size / 2, b.x + b.size / 2) - Math.max(a.x - a.size / 2, b.x - b.size / 2);
    const h = Math.min(a.y + a.size / 2, b.y + b.size / 2) - Math.max(a.y - a.size / 2, b.y - b.size / 2);
    return w > 0 && h > 0 ? (w * h) / (b.size * b.size) : 0;
};

interface ClearanceStats {
    /** 邻行字压进当前行字的面积（以一个字为 1，每帧求和、再按帧平均；只算整行透明度 ≥ 0.3 的邻行）。 */
    overlap: number;
    /** 同上，但按字实际的透明度加权（当前行的保护会压低它）。 */
    visibleOverlap: number;
    /** 有重叠的帧占比。 */
    overlapFrames: number;
}

/**
 * 按 step 采样整首：当前行（光标所指）与其余可见行的字之间的重叠。只看换行滑动结束之后的帧
 * （新当前行开始前 1.2 秒起滑，最晚的邻行在开始后 0.9 秒到位）：滑动途中字本来就要飞过彼此。
 */
const measure = (profileIndex: number, typography: WindowTypography, lines: Line[], step: number): ClearanceStats => {
    const { window, heroPx } = buildWindow(profileIndex, typography, lines);
    const from = lines[0]!.startTime;
    const to = lines[lines.length - 1]!.endTime + 2;
    let overlap = 0, visibleOverlap = 0, frames = 0, overlapFrames = 0;
    for (let time = from; time <= to; time += step) {
        const { current } = resolveWindowCursor(lines, time);
        if (current < 0 || time < lines[current]!.startTime + 0.9) continue;
        window.update(frameAt(time));
        const ink = readInk(window, heroPx);
        const hero = ink.filter(glyph => glyph.line === current);
        if (hero.length === 0) continue;
        frames += 1;
        let frameOverlap = 0;
        const lineAlpha = new Map<number, number>();
        for (const other of ink) {
            if (other.line === current) continue;
            let alpha = lineAlpha.get(other.line);
            if (alpha === undefined) lineAlpha.set(other.line, alpha = window.lineAnchor(other.line, time).alpha);
            if (alpha < 0.3) continue;
            let worst = 0;
            for (const glyph of hero) worst = Math.max(worst, overlapFraction(glyph, other));
            frameOverlap += worst;
            visibleOverlap += worst * other.alpha;
        }
        overlap += frameOverlap;
        if (frameOverlap > 0) overlapFrames += 1;
    }
    window.destroy();
    const n = Math.max(1, frames);
    return { overlap: overlap / n, visibleOverlap: visibleOverlap / n, overlapFrames: overlapFrames / n };
};

const TYPOGRAPHIES = ['horizontal', 'vertical', 'crossed'] as const;
// 五个族的第一个光位（文字区、字号、崩解各不相同）。
const PROFILES = [0, 20, 40, 60, 80];
const SONGS: Line[][] = [MIXED, syntheticSong(1)];

const measureAll = (typography: WindowTypography): ClearanceStats => {
    const total = { overlap: 0, visibleOverlap: 0, overlapFrames: 0 };
    let count = 0;
    for (const lines of SONGS) {
        for (const profileIndex of PROFILES) {
            const stats = measure(profileIndex, typography, lines, 0.2);
            total.overlap += stats.overlap;
            total.visibleOverlap += stats.visibleOverlap;
            total.overlapFrames += stats.overlapFrames;
            count += 1;
        }
    }
    return { overlap: total.overlap / count, visibleOverlap: total.visibleOverlap / count, overlapFrames: total.overlapFrames / count };
};


/** 换行前后（从开始滑动前 0.5 秒到滑动全部结束）按 60fps 采样，所有字精灵透明度相邻两帧之差的最大值。 */
const maxAlphaStep = (typography: WindowTypography) => {
    let worst = 0;
    for (const profileIndex of [0, 40]) {
        const { window } = buildWindow(profileIndex, typography, MIXED);
        for (const item of MIXED.slice(1)) {
            let previous: Map<string, number> | null = null;
            for (let frame = 0; frame <= 160; frame += 1) {
                window.update(frameAt(item.startTime - 1.7 + frame / 60));
                const alphas = readAlphas(window);
                if (previous) worst = Math.max(worst, alphaDelta(previous, alphas));
                previous = alphas;
            }
        }
        window.destroy();
    }
    return worst;
};

/** 看得见的行（整行透明度 ≥ 0.3）里「几乎静止」（每秒不到 9 像素）的帧占比，按 30fps 采样整首。 */
const stillFraction = (typography: WindowTypography) => {
    let still = 0, total = 0;
    for (const profileIndex of PROFILES) {
        const { window } = buildWindow(profileIndex, typography, MIXED);
        for (let time = MIXED[0]!.startTime; time < MIXED[MIXED.length - 1]!.endTime; time += 1 / 30) {
            MIXED.forEach((_, index) => {
                const a = window.lineAnchor(index, time);
                if (a.alpha < 0.3) return;
                const b = window.lineAnchor(index, time + 1 / 30);
                total += 1;
                if (Math.hypot(b.x - a.x, b.y - a.y) * 30 < 9) still += 1;
            });
        }
        window.destroy();
    }
    return still / Math.max(1, total);
};

/**
 * 改动前（漂移不让开当前行、没有保护框）同一组光位与歌词的测量值（lyricWindow.ts 在 fe670509 的版本）。
 * overlap 与 visibleOverlap 以一个字的面积为 1、按帧平均；overlapFrames 是有重叠的帧占比；
 * alphaStep 是换行前后相邻两帧透明度之差的最大值，still 是看得见的行里几乎静止的帧占比。
 */
const BEFORE: Record<WindowTypography, ClearanceStats & { alphaStep: number; still: number }> = {
    horizontal: { overlap: 1.7105, visibleOverlap: 0.3664, overlapFrames: 0.521, alphaStep: 0.041, still: 0.105 },
    vertical: { overlap: 1.3275, visibleOverlap: 0.2428, overlapFrames: 0.566, alphaStep: 0.041, still: 0.105 },
    crossed: { overlap: 0.5533, visibleOverlap: 0.1167, overlapFrames: 0.332, alphaStep: 0.070, still: 0.104 },
};

describe('当前行与邻行的间隙', () => {
    it.skipIf(!REPORT)('测量报告（改动前后对比用）', () => {
        const rows = TYPOGRAPHIES.map(typography => {
            const stats = measureAll(typography);
            return `${typography}: { overlap: ${stats.overlap.toFixed(4)}, visibleOverlap: ${stats.visibleOverlap.toFixed(4)}, overlapFrames: ${stats.overlapFrames.toFixed(3)} }`;
        });
        rows.push(...TYPOGRAPHIES.map(typography => `${typography}: alpha step ${maxAlphaStep(typography).toFixed(3)}, still ${(stillFraction(typography) * 100).toFixed(1)}%`));
        writeFileSync(REPORT!, rows.join('\n'));
    }, 600_000);

    describe.skipIf(!!REPORT)('画面', () => {
        it.each(TYPOGRAPHIES)('%s：邻行压进当前行的面积与帧数比改动前少得多，看得见的部分更少', typography => {
            const stats = measureAll(typography);
            const before = BEFORE[typography];
            // 实测：面积 0.4% / 4.8% / 0.04%，帧数 6% / 18% / 1%，看得见的部分 0.03% / 1% / 0%（横 / 竖 / 纵横交错）。
            expect(stats.overlap).toBeLessThan(before.overlap * 0.1);
            expect(stats.overlapFrames).toBeLessThan(before.overlapFrames * 0.3);
            expect(stats.visibleOverlap).toBeLessThan(before.visibleOverlap * 0.02);
        }, 60_000);

        it.each(TYPOGRAPHIES)('%s：邻行的漂移不朝当前行走，当前行只在槽位附近绕小圈', typography => {
            // 漂移 = 同一个窗口开 / 关漂移时行心之差（槽位、错落、放进画框都一样）。只看落定的帧。
            const moving = buildWindow(0, typography, MIXED, 0).window;
            const still = buildWindow(0, typography, MIXED, 0, 0).window;
            const vertical = typography === 'vertical';
            for (let time = MIXED[0]!.startTime; time < MIXED[MIXED.length - 1]!.endTime; time += 0.25) {
                const { current } = resolveWindowCursor(MIXED, time);
                if (current < 0 || time < MIXED[current]!.startTime + 0.9) continue;
                for (const index of [current - 2, current - 1, current, current + 1, current + 2]) {
                    if (index < 0 || index >= MIXED.length) continue;
                    const a = moving.lineAnchor(index, time);
                    const b = still.lineAnchor(index, time);
                    const dx = (a.x - b.x) / HEIGHT;
                    const dy = (a.y - b.y) / HEIGHT;
                    const label = `${typography} ${time.toFixed(2)} ${current}/${index}`;
                    if (index === current) {
                        // 小圆的直径 + 绕行幅度（x 0.03、y 0.021）。
                        expect(Math.abs(dx), label).toBeLessThanOrEqual(2 * HOLD + 0.03 + 1e-6);
                        expect(Math.abs(dy), label).toBeLessThanOrEqual(2 * HOLD + 0.021 + 1e-6);
                    } else {
                        // 横排与纵横交错：上一行在上、下一行在下；竖排右起：上一行在右、下一行在左。
                        const away = (index < current ? -1 : 1) * (vertical ? -1 : 1);
                        expect((vertical ? dx : dy) * away, label).toBeGreaterThanOrEqual(-1e-6);
                    }
                }
            }
            moving.destroy();
            still.destroy();
        });

        it('落进当前行框里的邻字压暗到 PROTECT_FLOOR，当前行自己不压', () => {
            let protectedSamples = 0;
            for (const typography of TYPOGRAPHIES) {
                for (const profileIndex of PROFILES) {
                    // 崩解加倍：邻字散进当前行的情况多一些。
                    const { window, heroPx, decay } = buildWindow(profileIndex, typography, SONGS[1]!, 2);
                    const lines = SONGS[1]!;
                    for (let time = lines[0]!.startTime; time < lines[lines.length - 1]!.endTime; time += 0.2) {
                        const { current } = resolveWindowCursor(lines, time);
                        if (current < 0 || time < lines[current]!.startTime + 0.9) continue;
                        window.update(frameAt(time));
                        const ink = readInk(window, heroPx);
                        const starts = new Map(window.glyphTimes(current).map(({ glyphIndex, start }) => [glyphIndex, start]));
                        // 还没开始崩解的当前字一定在墨迹框里。
                        const hero = ink.filter(glyph => glyph.line === current && time < (starts.get(glyph.glyph) ?? 0) + decay.delay);
                        for (const other of ink) {
                            if (other.line === current || !hero.some(glyph => overlapFraction(glyph, other) >= 0.25)) continue;
                            const lineAlpha = window.lineAnchor(other.line, time).alpha;
                            expect(other.alpha, `${typography} ${profileIndex} ${time.toFixed(1)}`).toBeLessThanOrEqual(lineAlpha * (PROTECT_FLOOR + 0.02));
                            protectedSamples += 1;
                        }
                        // 当前行的字不被自己的框压暗：唱过的字至少是整行透明度 × 0.55 × 聚合完成的 1。
                        for (const glyph of ink) {
                            if (glyph.line !== current || !starts.has(glyph.glyph) || time < starts.get(glyph.glyph)! + 0.5) continue;
                            if (time > starts.get(glyph.glyph)! + decay.delay) continue;
                            expect(glyph.alpha).toBeGreaterThan(0.5 * window.lineAnchor(current, time).alpha);
                        }
                    }
                    window.destroy();
                }
            }
            expect(protectedSamples).toBeGreaterThan(10);
        }, 60_000);

        it.each(TYPOGRAPHIES)('%s：换行交接时透明度连续（换行瞬间不跳，60fps 相邻两帧的变化不比改动前大多少）', typography => {
            for (const profileIndex of [0, 40]) {
                const { window } = buildWindow(profileIndex, typography, MIXED);
                for (const item of MIXED) {
                    // 光标换行的瞬间与各槽位起步的瞬间（离场的先走，当前行晚 0.3 秒，新来的晚 0.5–0.6 秒）。
                    for (const lag of [0, 0.15, 0.3, 0.5, 0.6]) {
                        const t0 = item.startTime - 1.2 + lag;
                        window.update(frameAt(t0 - 1e-4));
                        const before = readAlphas(window);
                        window.update(frameAt(t0 + 1e-4));
                        const after = readAlphas(window);
                        expect(alphaDelta(before, after), `${typography} ${t0}`).toBeLessThan(0.01);
                    }
                }
                window.destroy();
            }
            expect(maxAlphaStep(typography)).toBeLessThanOrEqual(Math.max(BEFORE[typography].alphaStep * 1.6, 0.075));
        }, 60_000);

        it.each(TYPOGRAPHIES)('%s：仍然一直在动（几乎静止的帧不比改动前多多少）', typography => {
            expect(stillFraction(typography)).toBeLessThan(BEFORE[typography].still + 0.02);
        }, 60_000);

        it('透明度只由时刻决定（与之前画过哪些时刻无关）', () => {
            const { window } = buildWindow(0, 'crossed', MIXED);
            window.update(frameAt(21.3));
            const first = readAlphas(window);
            [30, 7.7, 2, 21.25].forEach(time => window.update(frameAt(time)));
            window.update(frameAt(21.3));
            expect(readAlphas(window)).toEqual(first);
            window.destroy();
        });
    });
});

describe('间隙的纯函数', () => {
    it('awayDrift：朝当前行的一份翻成背离，背离的不变，换向处连续', () => {
        expect(awayDrift(-0.1, 1)).toBeGreaterThan(0.09);
        expect(awayDrift(0.1, 1)).toBeCloseTo(awayDrift(-0.1, 1));
        expect(awayDrift(-0.1, -1)).toBeCloseTo(-0.1 + 0.005, 3);
        expect(awayDrift(0.1, -1)).toBeLessThan(-0.09);
        expect(awayDrift(0.07, 0)).toBe(0.07);
        // 权重一半时在原样与翻转之间。
        expect(awayDrift(-0.1, 0.5)).toBeCloseTo((awayDrift(-0.1, 1) - 0.1) / 2);
        for (let d = -0.05; d < 0.05; d += 0.0005) {
            expect(Math.abs(awayDrift(d + 0.0005, 1) - awayDrift(d, 1))).toBeLessThanOrEqual(0.0005 + 1e-9);
            expect(awayDrift(d, 1)).toBeGreaterThanOrEqual(0);
        }
    });

    it('heldDrift：起步沿自己的方向，之后绕小圆，离原点不超过 2 × HOLD，速度不变', () => {
        const vx = 0.012, vy = -0.009;
        const speed = Math.hypot(vx, vy);
        expect(heldDrift(vx, vy, 0.05, 0)).toBeCloseTo(vx * 0.05, 4);
        expect(heldDrift(vx, vy, 0.05, 1)).toBeCloseTo(vy * 0.05, 4);
        for (let age = -3; age < 30; age += 0.1) {
            const x = heldDrift(vx, vy, age, 0), y = heldDrift(vx, vy, age, 1);
            expect(Math.hypot(x, y)).toBeLessThanOrEqual(2 * HOLD + 1e-9);
            const step = Math.hypot(heldDrift(vx, vy, age + 0.01, 0) - x, heldDrift(vx, vy, age + 0.01, 1) - y) / 0.01;
            expect(step).toBeCloseTo(speed, 3);
        }
        expect(heldDrift(0, 0, 5, 0)).toBe(0);
    });

    it('protectionAt：框里为 1，渐变边外为 0，按那一行的转角看，自己那一行不算，权重相加封顶 1', () => {
        const box = { ...createProtectBox(), line: 2, x: 100, y: 50, cos: 1, sin: 0, halfW: 80, halfH: 20, margin: 10, weight: 1 };
        expect(protectionAt([box], 1, 1, 100, 50, 5)).toBe(1);
        // 字的方块碰到墨迹框就算在里面：x = 100 + 80 + 5。
        expect(protectionAt([box], 1, 1, 185, 50, 5)).toBe(1);
        expect(protectionAt([box], 1, 1, 190, 50, 5)).toBeCloseTo(0.5);
        expect(protectionAt([box], 1, 1, 195, 50, 5)).toBe(0);
        expect(protectionAt([box], 1, 2, 100, 50, 5)).toBe(0);
        // 渐变单调、连续。
        let previous = 1;
        for (let x = 180; x <= 200; x += 0.5) {
            const value = protectionAt([box], 1, 1, x, 50, 5);
            expect(value).toBeLessThanOrEqual(previous + 1e-12);
            expect(previous - value).toBeLessThan(0.1);
            previous = value;
        }
        // 转 90°：长边变成竖的。
        const turned = { ...box, cos: 0, sin: 1 };
        expect(protectionAt([turned], 1, 1, 100, 50 + 70, 5)).toBe(1);
        expect(protectionAt([turned], 1, 1, 100 + 70, 50, 5)).toBe(0);
        // 交接：两个框各一半。
        const half = { ...box, weight: 0.5 };
        expect(protectionAt([half], 1, 1, 100, 50, 5)).toBeCloseTo(0.5);
        expect(protectionAt([half, { ...half, line: 3 }], 2, 1, 100, 50, 5)).toBeCloseTo(1);
        expect(protectionAt([box, { ...box, line: 3 }], 2, 1, 100, 50, 5)).toBe(1);
        expect(protectedAlpha(1)).toBeCloseTo(PROTECT_FLOOR);
        expect(protectedAlpha(0)).toBe(1);
    });
});
