import { describe, expect, it } from 'vitest';
import type { Line } from '@/types';
import { audioLift, beamMask, compressLight, goboMask, GOBO_LEAK, lightAt, resolveBeams, type LightRig } from '@/components/visualizer/lumiere/light/rig';
import { planBursts } from '@/components/visualizer/lumiere/light/crossBurst';
import { flashEnvelope, glyphProgress } from '@/components/visualizer/lumiere/text/reveal';
import {
    decayAmount, flightPoint, flightProgress, freePlacements, resolveLinePhase, resolveSpotX, resolveWindowCursor,
} from '@/components/visualizer/lumiere/text/lyricWindow';
import { MAX_WORD_SCALE, segmentWords, wordJags, wordScales } from '@/components/visualizer/lumiere/text/wordStyle';
import { isUprightGlyph } from '@/components/visualizer/lumiere/text/glyphLine';
import { LUMIERE_PROFILES } from '@/components/visualizer/lumiere/catalog';
import { hasLumiereCredits, resolveLumiereCreditsFrame } from '@/components/visualizer/lumiere/credits';

// test/unit/visualizer/lumiere/lumiereLight.test.ts
// 绘光 L0：光束的 CPU 公式（字与浮尘的亮度按它算）、逐字进度、窗口游标。（移植自 lumisynth test/unit/packs/lumiere.test.ts）
const rig: LightRig = {
    beams: [{
        x: 0.5, y: 0, angle: Math.PI / 2, spread: 0.1, width: 0.04, length: 0.8, softness: 0.5,
        intensity: 1, streaks: 0, streakFreq: 8, streakSpeed: 0, core: 0.5,
    }],
    fog: { density: 1, tyndallBase: 0.2, scale: 2, driftX: 0, driftY: 0, warp: 1, ambient: 0 },
    glare: null,
};
const aspect = 16 / 9;
const drive = { intensity: 1, bass: 0, color: [1, 1, 1] as [number, number, number] };

describe('光束公式', () => {
    const [beam] = resolveBeams(rig, 0, aspect, drive);

    it('光源背后与光束之外为 0，轴线上最亮', () => {
        expect(beamMask(beam!, aspect * 0.5, -0.1)).toBe(0);
        expect(beamMask(beam!, aspect * 0.1, 0.5)).toBe(0);
        const onAxis = beamMask(beam!, aspect * 0.5, 0.5);
        const offAxis = beamMask(beam!, aspect * 0.5 + 0.05, 0.5);
        expect(onAxis).toBeGreaterThan(offAxis);
        expect(offAxis).toBeGreaterThan(0);
    });

    it('沿光束方向衰减', () => {
        expect(beamMask(beam!, aspect * 0.5, 0.2)).toBeGreaterThan(beamMask(beam!, aspect * 0.5, 0.8));
    });

    it('左右对称（无条纹时）', () => {
        expect(beamMask(beam!, aspect * 0.5 - 0.03, 0.5)).toBeCloseTo(beamMask(beam!, aspect * 0.5 + 0.03, 0.5), 10);
    });

    it('压缩后不超过 1，交叠处柔和', () => {
        expect(compressLight(lightAt([beam!, beam!, beam!], aspect * 0.5, 0.3))).toBeLessThan(1);
    });

    it('光源处与射程末端都平滑收掉，没有硬边', () => {
        const wide: LightRig = { ...rig, beams: [{ ...rig.beams[0]!, width: 0.3, spread: 0.5, reach: 0.5 }] };
        const [w] = resolveBeams(wide, 0, aspect, drive);
        // 光源处：紧贴光源几乎为 0，往外逐渐变亮（不会从 0 一步跳到满）。
        const near = beamMask(w!, aspect * 0.5, 0.005);
        const mid = beamMask(w!, aspect * 0.5, 0.15);
        expect(near).toBeLessThan(mid * 0.1);
        let previous = 0;
        for (let y = 0.001; y < 0.3; y += 0.01) {
            const value = beamMask(w!, aspect * 0.5, y);
            expect(Math.abs(value - previous)).toBeLessThan(0.12);
            previous = value;
        }
        // 射程末端：宽光束按宽度收尾，末端前一小段已经明显变暗。
        expect(beamMask(w!, aspect * 0.5, 0.49)).toBeLessThan(beamMask(w!, aspect * 0.5, 0.2) * 0.2);
        expect(beamMask(w!, aspect * 0.5, 0.51)).toBe(0);
    });

    it('摆动只由时刻决定', () => {
        const swaying: LightRig = { ...rig, beams: [{ ...rig.beams[0]!, sway: { amplitude: 0.1, period: 4, phase: 0 } }] };
        const a = resolveBeams(swaying, 3.7, aspect, drive);
        const b = resolveBeams(swaying, 3.7, aspect, drive);
        expect(a).toEqual(b);
        expect(resolveBeams(swaying, 1, aspect, drive)[0]!.dx).not.toBeCloseTo(a[0]!.dx, 5);
    });
});

describe('窗影', () => {
    it('百叶沿截面交替透光，影子里仍有散射光；十字窗中间挡住', () => {
        const samples = Array.from({ length: 40 }, (_, i) => goboMask(1, 10, 0.5, 0, -1 + i / 20, 0));
        expect(Math.max(...samples)).toBeCloseTo(1, 2);
        expect(Math.min(...samples)).toBeCloseTo(GOBO_LEAK, 2);
        expect(goboMask(2, 0, 0.2, 0, 0, 0)).toBeCloseTo(GOBO_LEAK);
        expect(goboMask(2, 0, 0.2, 0, 0.8, 0)).toBeCloseTo(1);
        expect(goboMask(0, 10, 0.5, 0, 0.3, 0.2)).toBe(1);
    });

    it('光束的 CPU 公式把窗影算进去（字与浮尘在影子里变暗）', () => {
        const blinds: LightRig = { ...rig, beams: [{ ...rig.beams[0]!, gobo: { pattern: 'blinds', frequency: 10, duty: 0.5, drift: 0 } }] };
        const [plain] = resolveBeams(rig, 0, aspect, drive);
        const [gated] = resolveBeams(blinds, 0, aspect, drive);
        const xs = Array.from({ length: 30 }, (_, i) => aspect * 0.5 - 0.05 + i * 0.0033);
        const ratios = xs.map(x => beamMask(gated!, x, 0.5) / Math.max(beamMask(plain!, x, 0.5), 1e-9));
        expect(Math.min(...ratios)).toBeLessThan(0.3);
        expect(Math.max(...ratios)).toBeGreaterThan(0.9);
    });
});

describe('音频响应', () => {
    it('低频打满时光束最多亮 15%，弱的起伏几乎不动', () => {
        expect(audioLift(0)).toBe(1);
        expect(audioLift(1)).toBeCloseTo(1.15);
        expect(audioLift(0.3) - 1).toBeLessThan(0.3 * 0.15 * 0.6);
        const [quiet] = resolveBeams(rig, 0, aspect, { ...drive, bass: 0 });
        const [loud] = resolveBeams(rig, 0, aspect, { ...drive, bass: 1 });
        expect(loud!.intensity / quiet!.intensity).toBeCloseTo(1.15);
    });
});

describe('逐字进度', () => {
    const timing = { start: 1, end: 1.5 };
    it('进度与闪点包络', () => {
        expect(glyphProgress(timing, 0.9)).toBe(0);
        expect(glyphProgress(timing, 1.25)).toBeCloseTo(0.5);
        expect(glyphProgress(timing, 2)).toBe(1);
        expect(flashEnvelope(timing, 0.99)).toBe(0);
        // 150ms 平滑升起，中点正好一半。
        expect(flashEnvelope(timing, 1.075)).toBeCloseTo(0.5);
        expect(flashEnvelope(timing, 1.15)).toBeCloseTo(1);
        expect(flashEnvelope(timing, 3)).toBeLessThan(0.05);
    });
    it('极短的字至少 80ms 点亮', () => {
        expect(glyphProgress({ start: 1, end: 1 }, 1.04)).toBeCloseTo(0.5);
    });
});

describe('窗口游标', () => {
    const line = (start: number): Line => ({ fullText: 'x', startTime: start, endTime: start + 3, words: [] });
    const lines = [line(2), line(5), line(8)];
    it('第一行之前为 -1，提前 1.2s 切到下一行，1.5s 正弦缓动地滑动', () => {
        expect(resolveWindowCursor(lines, 0).current).toBe(-1);
        expect(resolveWindowCursor(lines, 0.9).current).toBe(0);
        expect(resolveWindowCursor(lines, 3.8)).toEqual({ current: 1, phase: 0, slide: 0 });
        const middle = resolveWindowCursor(lines, 3.8 + 0.75);
        expect(middle.phase).toBeCloseTo(0.5);
        expect(middle.slide).toBeCloseTo(0.5);
        // 缓入：前段比线性慢。
        expect(resolveWindowCursor(lines, 3.8 + 0.2).slide).toBeLessThan(0.2 / 1.5);
        expect(resolveWindowCursor(lines, 5.3).slide).toBe(1);
        expect(resolveWindowCursor(lines, 20).current).toBe(2);
    });

    it('各行错开起步：离场的先走，新的当前行随后，新进来的最后', () => {
        const at = 3.8 + 0.4;
        const leaving = resolveLinePhase(lines, 1, -2, at).phase;
        const previous = resolveLinePhase(lines, 1, -1, at).phase;
        const hero = resolveLinePhase(lines, 1, 0, at).phase;
        const incoming = resolveLinePhase(lines, 1, 1, at).phase;
        expect(leaving).toBeGreaterThan(previous);
        expect(previous).toBeGreaterThan(hero);
        expect(hero).toBeGreaterThan(incoming);
        expect(resolveLinePhase(lines, -1, 0, at).phase).toBe(1);
    });
});

describe('追字光斑', () => {
    // 两个词之间有 0.4s 停顿，字宽 40px：不平滑时光斑逐字匀速、停顿处骤停骤起。
    const glyphs = Array.from({ length: 8 }, (_, i) => {
        const start = i < 4 ? i * 0.15 : 1 + (i - 4) * 0.15;
        return { center: i * 40, timing: { start, end: start + 0.15 } };
    });
    const frames = Array.from({ length: 150 }, (_, i) => i / 60);
    /** 相邻两帧速度的最大变化（像素 / 帧²），越小越顺。 */
    const maxJerk = (window: number) => {
        const xs = frames.map(t => resolveSpotX(glyphs, t, window));
        let worst = 0;
        for (let i = 2; i < xs.length; i += 1) {
            worst = Math.max(worst, Math.abs((xs[i]! - xs[i - 1]!) - (xs[i - 1]! - xs[i - 2]!)));
        }
        return worst;
    };

    it('时间平均后速度变化明显更小，位置只由 t 决定', () => {
        expect(maxJerk(0.3)).toBeLessThan(maxJerk(0) * 0.35);
        expect(resolveSpotX(glyphs, 0.7)).toBe(resolveSpotX(glyphs, 0.7));
    });

    it('唱完后停在最后一个字上', () => {
        expect(resolveSpotX(glyphs, 5)).toBeCloseTo(7 * 40);
    });
});

describe('十字爆闪的引爆计划', () => {
    const line = (start: number) => ({ glyphs: Array.from({ length: 10 }, (_, i) => ({ glyphIndex: i, start: start + i * 0.2 })) });
    const lines = [line(0), line(3), line(6), line(9)];
    const spec = { mode: 'sung' as const, density: 0.4, every: 2, offset: 1, size: 4, tint: [1, 0.6, 0.4] as [number, number, number] };

    it('只在指定的行、挑中的字被唱到时引爆，按种子确定', () => {
        const plan = planBursts(spec, lines, 'seed');
        expect(plan).toEqual(planBursts(spec, lines, 'seed'));
        expect(new Set(plan.map(trigger => trigger.lineIndex))).toEqual(new Set([1, 3]));
        plan.forEach(trigger => {
            expect(trigger.time).toBeCloseTo(lines[trigger.lineIndex]!.glyphs[trigger.glyphIndex]!.start);
        });
        // 一行 10 个字里挑出一部分（不是一个也不是全部）。
        const perLine = plan.filter(trigger => trigger.lineIndex === 1).length;
        expect(perLine).toBeGreaterThan(0);
        expect(perLine).toBeLessThan(10);
    });

    it('sweep：行首起每 70ms 一个，连成一串', () => {
        const plan = planBursts({ ...spec, mode: 'sweep', density: 1 }, lines, 'seed').filter(trigger => trigger.lineIndex === 1);
        expect(plan).toHaveLength(10);
        plan.forEach((trigger, order) => expect(trigger.time).toBeCloseTo(3 + order * 0.07));
    });

    it('密度很低时每行至少一个', () => {
        const plan = planBursts({ ...spec, density: 0, every: 1, offset: 0 }, lines, 'seed');
        expect(plan).toHaveLength(4);
    });
});

describe('竖排与崩解', () => {
    it('中日韩字直立，拉丁字母与数字侧转', () => {
        expect(isUprightGlyph('光')).toBe(true);
        expect(isUprightGlyph('の')).toBe(true);
        expect(isUprightGlyph('，')).toBe(true);
        expect(isUprightGlyph('A')).toBe(false);
        expect(isUprightGlyph('6')).toBe(false);
        expect(isUprightGlyph('₂')).toBe(false);
    });

    it('崩解：延迟之后才开始，随时间加速，强度为 0 时不动', () => {
        const decay = { strength: 1, delay: 1 };
        expect(decayAmount(decay, 2, 2.9)).toBe(0);
        const a = decayAmount(decay, 2, 4);
        const b = decayAmount(decay, 2, 6);
        expect(a).toBeGreaterThan(0);
        expect(b - a).toBeGreaterThan(a);
        expect(decayAmount({ strength: 0, delay: 1 }, 2, 10)).toBe(0);
    });
});

describe('横竖过渡的飞行曲线', () => {
    const flight = { c1: { x: 80, y: -60 }, c2: { x: -40, y: 90 }, delay: 0.2, duration: 0.5, spin: 1, wobble: 0 };
    const h = { x: -100, y: 0 };
    const v = { x: 0, y: 150 };

    it('曲线两端就是横排与竖排位置，中途偏离直线', () => {
        expect(flightPoint(flight, h, v, 0)).toEqual(h);
        expect(flightPoint(flight, h, v, 1)).toEqual(v);
        const middle = flightPoint(flight, h, v, 0.5);
        const straight = { x: (h.x + v.x) / 2, y: (h.y + v.y) / 2 };
        expect(Math.hypot(middle.x - straight.x, middle.y - straight.y)).toBeGreaterThan(5);
    });

    it('起飞前停在起点、到时之后停在终点，中间单调；径迹尾端落后于字', () => {
        expect(flightProgress(flight, 0.1)).toBe(0);
        expect(flightProgress(flight, 0.8)).toBe(1);
        const samples = [0.25, 0.35, 0.45, 0.55, 0.65].map(orient => flightProgress(flight, orient));
        samples.slice(1).forEach((value, index) => expect(value).toBeGreaterThan(samples[index]!));
        expect(flightProgress(flight, 0.45, 0.2)).toBeLessThan(flightProgress(flight, 0.45));
    });
});

describe('纵横交错的自由落点', () => {
    const region = { cx: 0.9, cy: 0.5, w: 1.3, h: 0.5 };
    it('上一行在上半圈、下一行在下半圈，横竖都会出现，更远的位置透明', () => {
        const orients = new Set<number>();
        for (let seed = 0; seed < 40; seed += 1) {
            const random = (() => { let n = seed * 7919; return () => ((n = (n * 16807) % 2147483647) / 2147483647); })();
            const placements = freePlacements(random, region, 0.95);
            expect(placements.get(-1)!.dy).toBeLessThan(0);
            expect(placements.get(1)!.dy).toBeGreaterThan(0);
            expect(placements.get(-2)!.alpha).toBe(0);
            expect(placements.get(2)!.alpha).toBe(0);
            expect(Math.abs(placements.get(-1)!.dx)).toBeLessThanOrEqual(region.w * 0.46);
            orients.add(placements.get(-1)!.orient);
            orients.add(placements.get(1)!.orient);
        }
        expect(orients).toEqual(new Set([0, 1]));
    });
});

describe('分词字号', () => {
    const words = segmentWords({ fullText: '我把名字写进晨雾里' });
    it('按词切开、覆盖整行', () => {
        expect(words.length).toBeGreaterThan(1);
        expect(words[0]!.start).toBe(0);
        expect(words[words.length - 1]!.end).toBe(9);
    });
    it('虚词小一号、重点词大一号，按种子确定', () => {
        const scales = wordScales(words, 'seed');
        expect(scales).toEqual(wordScales(words, 'seed'));
        const first = words.findIndex(word => word.text === '我');
        if (first >= 0) expect(scales[first]).toBeCloseTo(0.62);
        expect(Math.max(...scales)).toBeCloseTo(1.45);
        scales.forEach(scale => expect(scale).toBeLessThanOrEqual(MAX_WORD_SCALE));
    });
    it('用户保存的精细分词优先（走 folia 的 segmentLyricWords）', () => {
        const custom = segmentWords({ fullText: '我把名字写进晨雾里', wordSegments: ['我把', '名字写', '进晨雾里'] });
        expect(custom.map(word => word.text)).toEqual(['我把', '名字写', '进晨雾里']);
        expect(custom.map(word => [word.start, word.end])).toEqual([[0, 2], [2, 5], [5, 9]]);
        // 与原文拼不回去的旧分词被忽略，退回默认分词。
        const stale = segmentWords({ fullText: '我把名字写进晨雾里', wordSegments: ['别的', '歌词'] });
        expect(stale.at(-1)!.end).toBe(9);
    });
    it('空白与标点不算词', () => {
        const words = segmentWords({ fullText: 'light falls, again' });
        expect(words.filter(word => !word.blank).map(word => word.text)).toEqual(['light', 'falls', 'again']);
    });
    it('错落：重点词不动，其余词上下错开、小字错得多', () => {
        const scales = wordScales(words, 'seed');
        const jags = wordJags(words, scales, 'seed');
        expect(jags).toEqual(wordJags(words, scales, 'seed'));
        expect(jags[scales.indexOf(Math.max(...scales))]).toBe(0);
        jags.forEach((jag, index) => expect(Math.abs(jag)).toBeLessThanOrEqual(scales[index]! < 0.7 ? 0.32 : 0.2));
        expect(jags.some(jag => Math.abs(jag) > 0.02)).toBe(true);
    });
});

describe('光位 profile', () => {
    it.each(LUMIERE_PROFILES)('$kind：光束不超过上限、文字区在画内', profile => {
        const light = profile.light({ aspect, random: () => 0.5 });
        expect(light.beams.length).toBeGreaterThan(0);
        expect(light.beams.length).toBeLessThanOrEqual(6);
        const { cx, cy, w, h } = profile.region;
        expect(cx - w / 2).toBeGreaterThanOrEqual(0);
        expect(cx + w / 2).toBeLessThanOrEqual(1);
        expect(cy - h / 2).toBeGreaterThanOrEqual(0);
        expect(cy + h / 2).toBeLessThanOrEqual(1);
        const art = profile.lineArt({ aspect, random: () => 0.5 });
        expect(art.paths.every(path => path.points.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)))).toBe(true);
    });
});

describe('片尾卡', () => {
    it('最后一句之前不出现；歌词先失焦熄去，卡随后淡入到位', () => {
        expect(resolveLumiereCreditsFrame(99, 100)).toMatchObject({ active: false, lyricAlpha: 1, posterAlpha: 0 });
        const early = resolveLumiereCreditsFrame(100.4, 100);
        expect(early.active).toBe(true);
        expect(early.lyricAlpha).toBeLessThan(1);
        expect(early.posterAlpha).toBe(0);
        const late = resolveLumiereCreditsFrame(103, 100);
        expect(late).toMatchObject({ lyricAlpha: 0, posterAlpha: 1, posterScale: 1 });
        expect(late.lyricBlur).toBeGreaterThan(0);
    });

    it('没有曲名、艺人、专辑时不做片尾卡', () => {
        expect(hasLumiereCredits({ title: '  ', artist: null, album: '' })).toBe(false);
        expect(hasLumiereCredits({ title: null, artist: 'YOASOBI', album: null })).toBe(true);
    });
});
