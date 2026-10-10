import { describe, expect, it, vi } from 'vitest';
import { compileLumiereProgram } from '@/components/visualizer/lumiere/lumiereProgram';
import { buildLumiereSceneShots } from '@/components/visualizer/lumiere/lumiereUnit';
import {
    applyLumiereCamera,
    createLumiereCamera,
    lumiereTypographyOfLine,
    resolveLumiereLeadShot,
} from '@/components/visualizer/lumiere/lumiereUnitLayout';
import { createLyricWindow } from '@/components/visualizer/lumiere/text/lyricWindow';
import { installFakeTextMeasure, syntheticSong } from './lumiereFixtures';
import { fakePixi, fakeSprites } from './lumiereWindowFakes';

// test/unit/visualizer/lumiere/lumiereSeamlessContinuity.test.ts
// 轨迹过渡的连续性：整首歌一个单元时，每个镜头边界（含原来的段落边界、三种排版之间的切换）前后，
// 行与字在画面上的位置（歌词窗口 + 场景运镜）逐帧（1/60 秒）连续——只有平滑的运动，没有一帧里的跳变。
// 判据是「尖峰」：某一帧的位移比前后两帧的位移都多出多少像素。平滑运动（含字沿曲线飞、贴着画框边停住）
// 相邻两帧的位移只差零点几到一两像素；跳变那一帧的位移等于跳的距离（实测 20–130 像素），前后两帧都很小。
// 窗口与运镜按 scene.ts 的同一套函数（lumiereUnitLayout）搭。
vi.mock('@/components/visualizer/lumiere/text/glyphLine', async importOriginal => (
    (await import('./lumiereWindowFakes')).fakeGlyphLineModule(await importOriginal())
));
installFakeTextMeasure();

const WIDTH = 1600;
const HEIGHT = 900;
const DT = 1 / 60;
/** 尖峰上限（像素）：平滑运动远低于它，跳变远高于它。 */
const MAX_SPIKE = 6;

const program = compileLumiereProgram(syntheticSong(3), 'jump', {}, { seamless: true });
const unit = program.paragraphs[0]!;
const shots = buildLumiereSceneShots(unit);
const lead = resolveLumiereLeadShot(shots).profile;
const aspect = WIDTH / HEIGHT;
const window = createLyricWindow(fakePixi, {
    width: WIDTH,
    height: HEIGHT,
    lines: unit.lines,
    font: 'x',
    weight: 500,
    resolution: 1,
    region: { cx: lead.region.cx * aspect, cy: lead.region.cy, w: lead.region.w * aspect, h: lead.region.h },
    heroPx: lead.heroSize * HEIGHT,
    neighbors: 2,
    typography: lead.typography,
    typographyOf: lumiereTypographyOfLine(shots),
    decay: lead.decay,
    seed: `${program.seed}:${unit.id}`,
    sprites: fakeSprites,
});
const camera = createLumiereCamera({
    width: WIDTH,
    height: HEIGHT,
    camera: lead.camera,
    startTime: unit.startTime,
    endTime: unit.endTime,
    sections: unit.sections,
});
/** 每个镜头边界前 1.5 秒到后 2.5 秒（覆盖边界处换行的整个滑动与字的飞行）。 */
const boundaries = unit.shots.slice(1).map(shot => shot.startTime);

type Sample = (time: number) => { x: number; y: number } | null;

/** 在所有镜头边界附近逐帧采样，返回尖峰最大的那一处（某一帧的位移减去前后两帧位移中较大的那个）。 */
const worstSpike = (sample: Sample) => {
    let worst = { spike: 0, time: 0 };
    for (const boundary of boundaries) {
        const steps = Math.round(4 / DT);
        const points = Array.from({ length: steps + 1 }, (_, k) => sample(boundary - 1.5 + k * DT));
        const step = (k: number) => {
            const [a, b] = [points[k - 1], points[k]];
            return a && b ? Math.hypot(b.x - a.x, b.y - a.y) : null;
        };
        for (let k = 2; k < steps; k += 1) {
            const [before, here, after] = [step(k - 1), step(k), step(k + 1)];
            if (before === null || here === null || after === null) continue;
            const spike = here - Math.max(before, after);
            if (spike > worst.spike) worst = { spike, time: boundary - 1.5 + k * DT };
        }
    }
    return worst;
};

/** 看得见的时候（透明度 > 0.05）才算。 */
const visible = (lineIndex: number, time: number) => window.lineAnchor(lineIndex, time).alpha > 0.05;

describe('轨迹过渡：镜头边界前后逐帧连续', () => {
    it('节目里有三种排版之间的切换，并且确实跨过原来的段落边界', () => {
        const kinds = new Set(shots.map(shot => shot.profile.typography));
        expect(kinds).toEqual(new Set(['horizontal', 'vertical', 'crossed']));
        expect(unit.sections!.length).toBeGreaterThan(3);
        expect(boundaries.length).toBeGreaterThan(unit.sections!.length);
    });

    it('运镜连续（段落边界处往返推拉不跳）', () => {
        const corners = [[0, 0], [WIDTH, HEIGHT], [WIDTH * 0.3, HEIGHT * 0.7]] as const;
        corners.forEach(([x, y]) => {
            const { spike } = worstSpike(time => applyLumiereCamera(camera(time), x, y));
            expect(spike).toBeLessThan(0.5);
        });
    });

    it('每一行（整行的位置，含运镜）连续', () => {
        unit.lines.forEach((_, lineIndex) => {
            const { spike, time } = worstSpike(t => {
                if (!visible(lineIndex, t)) return null;
                const anchor = window.lineAnchor(lineIndex, t);
                return applyLumiereCamera(camera(t), anchor.x, anchor.y);
            });
            expect(spike, `line ${lineIndex} at ${time.toFixed(3)}s`).toBeLessThan(MAX_SPIKE);
        });
    }, 60_000);

    // 字：两次换行的滑动重叠（行很短，约 2 秒以内）时，新一次换位从字此刻在上一条曲线上的位置起飞
    // （lyricWindow 依次叠上还在进行的换位），不会跳回起点、缩放与转角也不跳。
    it('每个字（含运镜）连续', () => {
        unit.lines.forEach((_, lineIndex) => {
            window.glyphTimes(lineIndex).forEach(({ glyphIndex }) => {
                const { spike, time } = worstSpike(t => {
                    if (!visible(lineIndex, t)) return null;
                    const anchor = window.glyphAnchor(lineIndex, glyphIndex, t);
                    return applyLumiereCamera(camera(t), anchor.x, anchor.y);
                });
                expect(spike, `line ${lineIndex} glyph ${glyphIndex} at ${time.toFixed(3)}s`).toBeLessThan(MAX_SPIKE);
            });
        });
    }, 120_000);
});
