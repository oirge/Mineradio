import { describe, expect, it, vi } from 'vitest';
import type { Line } from '@/types';
import { LUMIERE_PROFILES } from '@/components/visualizer/lumiere/catalog';
import { createLyricWindow, type WindowTypography } from '@/components/visualizer/lumiere/text/lyricWindow';
import { installFakeTextMeasure } from './lumiereFixtures';
import { fakePixi, fakeSprites } from './lumiereWindowFakes';

// test/unit/visualizer/lumiere/lumiereGlyphContinuity.test.ts
// 字的飞行连续：两次换行挨得很近（不到 2 秒，两次滑动重叠）时，新一次换位从字此刻在上一条曲线上的位置
// 起飞（依次叠上还在进行的换位），不会跳回起点。判据是「尖峰」：某一帧（1/60 秒）的位移比前后两帧都多出
// 几个像素——平滑运动相邻两帧只差零点几到一两像素，跳变那一帧等于跳的距离（改之前实测几十到上百像素）。
vi.mock('@/components/visualizer/lumiere/text/glyphLine', async importOriginal => (
    (await import('./lumiereWindowFakes')).fakeGlyphLineModule(await importOriginal())
));
installFakeTextMeasure();

const DT = 1 / 60;
const MAX_SPIKE = 6;

/** 短句接短句：行距 1.1–1.9 秒，每行的滑动（1.5 秒 + 错开）都和下一次重叠。 */
const TEXTS = ['光落在晨雾里', '风吹过', '晚安', '我们慢慢走回去', '回去', 'hello again', '星河与风', '夜色', '把名字写进雾里', '走吧'];
const LINES: Line[] = (() => {
    let time = 2;
    return TEXTS.map((fullText, index) => {
        const chars = Array.from(fullText);
        const duration = 1.1 + ((index * 3) % 5) * 0.2;
        const step = (duration - 0.05) / chars.length;
        const line: Line = {
            fullText,
            startTime: time,
            endTime: time + duration - 0.05,
            words: chars.map((text, k) => ({ text, startTime: time + k * step, endTime: time + (k + 1) * step })),
        };
        time += duration;
        return line;
    });
})();

const build = (typography: WindowTypography, typographyOf?: (index: number) => WindowTypography, alwaysFly = false) => {
    const profile = LUMIERE_PROFILES[0]!;
    const aspect = 1600 / 900;
    return createLyricWindow(fakePixi, {
        width: 1600,
        height: 900,
        lines: LINES,
        font: 'x',
        weight: 500,
        resolution: 1,
        region: { cx: profile.region.cx * aspect, cy: profile.region.cy, w: profile.region.w * aspect, h: profile.region.h },
        heroPx: profile.heroSize * 900,
        neighbors: 2,
        typography,
        typographyOf,
        decay: profile.decay,
        alwaysFly,
        seed: 'continuity',
        sprites: fakeSprites,
    });
};

describe('字的飞行连续（换行间隔不到 2 秒）', () => {
    const cases: Array<[string, WindowTypography, ((index: number) => WindowTypography) | undefined, boolean]> = [
        ['纵横交错（每次换位都飞）', 'crossed', undefined, false],
        ['横竖交替（朝向每行都变）', 'horizontal', index => (index % 2 === 0 ? 'horizontal' : 'vertical'), false],
        ['横排 + 径迹（每次换位都飞）', 'horizontal', undefined, true],
    ];
    it.each(cases)('%s', (_label, typography, typographyOf, alwaysFly) => {
        const window = build(typography, typographyOf, alwaysFly);
        const from = LINES[0]!.startTime - 2;
        const to = LINES[LINES.length - 1]!.endTime + 3;
        LINES.forEach((_, lineIndex) => {
            window.glyphTimes(lineIndex).forEach(({ glyphIndex }) => {
                const points: Array<{ x: number; y: number } | null> = [];
                for (let time = from; time <= to; time += DT) {
                    points.push(window.lineAnchor(lineIndex, time).alpha > 0.05 ? window.glyphAnchor(lineIndex, glyphIndex, time) : null);
                }
                const step = (k: number) => {
                    const [a, b] = [points[k - 1], points[k]];
                    return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : null;
                };
                for (let k = 2; k < points.length - 1; k += 1) {
                    const [before, here, after] = [step(k - 1), step(k), step(k + 1)];
                    if (before === null || here === null || after === null) continue;
                    expect(here - Math.max(before, after), `line ${lineIndex} glyph ${glyphIndex} at ${(from + k * DT).toFixed(3)}s`).toBeLessThan(MAX_SPIKE);
                }
            });
        });
        window.destroy();
    }, 60_000);
});
