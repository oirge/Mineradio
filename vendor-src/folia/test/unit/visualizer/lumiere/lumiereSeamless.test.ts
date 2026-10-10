import { describe, expect, it } from 'vitest';
import { DEFAULT_LUMIERE_TUNING } from '@/types';
import { compileLumiereProgram } from '@/components/visualizer/lumiere/lumiereProgram';
import {
    LUMIERE_COMPILE_KEYS,
    requiresLumiereSceneRebuild,
    resolveLumiereCompileOptions,
    toLumiereSceneTuning,
} from '@/components/visualizer/lumiere/lumiereRuntimeTuning';
import { resolveLumiereSceneFrames } from '@/components/visualizer/lumiere/lumiereSceneFrames';
import { mergeLumiereParagraphs } from '@/components/visualizer/lumiere/lumiereSeamless';
import { resolveLumiereCameraProgress } from '@/components/visualizer/lumiere/lumiereUnitLayout';
import { buildLumiereSceneShots } from '@/components/visualizer/lumiere/lumiereUnit';
import { syntheticSong } from './lumiereFixtures';

// test/unit/visualizer/lumiere/lumiereSeamless.test.ts
// 轨迹过渡：整首歌编成一个单元（镜头与光位与按段落编译时逐个相同、没有段落转场与再次开场）、
// 运行时只画这一个场景、运镜按原段落往返推拉，以及它走「重新编译」而不是场景重建。

describe('轨迹过渡的编译', () => {
    const lines = syntheticSong(7);
    const normal = compileLumiereProgram(lines, 'seamless', {}, { duration: 200 });
    const seamless = compileLumiereProgram(lines, 'seamless', {}, { duration: 200, seamless: true });

    it('整首歌一个单元：覆盖全部行与整条时间轴', () => {
        expect(normal.paragraphs.length).toBeGreaterThan(2);
        expect(seamless.paragraphs).toHaveLength(1);
        const unit = seamless.paragraphs[0]!;
        expect(unit.lineIndices).toEqual(lines.map((_, index) => index));
        expect(unit.lines).toEqual(lines);
        expect(unit.startTime).toBe(normal.paragraphs[0]!.startTime);
        expect(unit.endTime).toBe(normal.paragraphs.at(-1)!.endTime);
        expect(unit.lyricEndTime).toBe(normal.paragraphs.at(-1)!.lyricEndTime);
        expect(seamless.duration).toBe(normal.duration);
        expect(seamless.lyricEndTime).toBe(normal.lyricEndTime);
    });

    it('镜头与光位和按段落编译时逐个相同（段落性质的 mood 与跨段落的 chain 照旧），且确定', () => {
        const shots = normal.paragraphs.flatMap(paragraph => paragraph.shots);
        expect(seamless.paragraphs[0]!.shots).toEqual(shots);
        expect(compileLumiereProgram(lines, 'seamless', {}, { duration: 200, seamless: true })).toEqual(seamless);
        const other = compileLumiereProgram(lines, 'other', {}, { duration: 200, seamless: true });
        expect(other.paragraphs[0]!.shots.map(shot => shot.kind)).not.toEqual(shots.map(shot => shot.kind));
        // 镜头仍首尾相接铺满单元。
        const unitShots = seamless.paragraphs[0]!.shots;
        unitShots.slice(1).forEach((shot, index) => expect(shot.startTime).toBeCloseTo(unitShots[index]!.endTime));
    });

    it('没有段落转场、只在歌曲开头开场一次；原段落范围与性质留在 sections', () => {
        const unit = seamless.paragraphs[0]!;
        expect(unit.transitionOut).toBeNull();
        expect(unit.opening).toBe(true);
        expect(unit.sections).toEqual(normal.paragraphs.map(({ startTime, endTime, kind }) => ({ startTime, endTime, kind })));
        expect(normal.paragraphs[0]!.sections).toBeUndefined();
    });

    it('场景镜头的行号换成单元内的下标（整首歌时就是全曲行号）', () => {
        const unit = seamless.paragraphs[0]!;
        const sceneShots = buildLumiereSceneShots(unit);
        expect(sceneShots.map(shot => shot.lines)).toEqual(unit.shots.map(shot => shot.lineIndices));
    });

    it('纯音乐同样并成一个单元', () => {
        const instrumental = compileLumiereProgram([], 'song', {}, { duration: 200, seamless: true });
        expect(instrumental.paragraphs).toHaveLength(1);
        expect(instrumental.paragraphs[0]!.shots.every(shot => shot.isBridge)).toBe(true);
        expect(instrumental.paragraphs[0]!.endTime).toBe(200);
    });

    it('只有一段时原样返回', () => {
        const single = compileLumiereProgram(lines.slice(0, 1), 'one');
        expect(mergeLumiereParagraphs(single.paragraphs)).toEqual(single.paragraphs);
    });

    it('运行时任何时刻都只画这一个场景，没有交叉渐变 / 模糊 / 缩放', () => {
        const normalBoundary = normal.paragraphs[1]!.startTime;
        const normalFrames = resolveLumiereSceneFrames(normal, normalBoundary + 0.1, true);
        expect(normalFrames.layers.length).toBeGreaterThan(1);
        for (let time = -1; time <= seamless.duration + 1; time += 0.05) {
            const frames = resolveLumiereSceneFrames(seamless, time, true);
            expect(frames.activeIndex).toBe(0);
            expect(frames.layers).toEqual([{ index: 0, alpha: 1, scale: 1, blur: 0 }]);
        }
    });
});

describe('轨迹过渡的运镜', () => {
    const span = { startTime: 0, endTime: 30 };

    it('没有 sections 时整个单元推一次（原来的曲线）', () => {
        for (const time of [0, 7, 15, 22, 30]) {
            expect(resolveLumiereCameraProgress(time, span)).toBeCloseTo((1 - Math.cos((time / 30) * Math.PI)) / 2);
        }
    });

    it('有 sections 时每段推一次、下一段拉回，边界处连续', () => {
        const sections = [
            { startTime: 0, endTime: 10, kind: 'verse' as const },
            { startTime: 10, endTime: 20, kind: 'chorus' as const },
            { startTime: 20, endTime: 30, kind: 'outro' as const },
        ];
        expect(resolveLumiereCameraProgress(0, span, sections)).toBeCloseTo(0);
        expect(resolveLumiereCameraProgress(10, span, sections)).toBeCloseTo(1);
        expect(resolveLumiereCameraProgress(15, span, sections)).toBeCloseTo(0.5);
        expect(resolveLumiereCameraProgress(20, span, sections)).toBeCloseTo(0);
        for (const boundary of [10, 20]) {
            expect(resolveLumiereCameraProgress(boundary - 1e-4, span, sections))
                .toBeCloseTo(resolveLumiereCameraProgress(boundary + 1e-4, span, sections), 4);
        }
    });
});

describe('轨迹过渡的设置接入', () => {
    it('是编译选项，不是场景 tuning：切换不走场景重建', () => {
        expect(LUMIERE_COMPILE_KEYS).toContain('seamlessTransitions');
        expect(resolveLumiereCompileOptions({ seamlessTransitions: true })).toEqual({ seamless: true });
        expect(resolveLumiereCompileOptions({ seamlessTransitions: false })).toEqual({ seamless: false });
        expect(resolveLumiereCompileOptions(DEFAULT_LUMIERE_TUNING)).toEqual({ seamless: true });
        const off = toLumiereSceneTuning({ ...DEFAULT_LUMIERE_TUNING, seamlessTransitions: false }, { showText: true });
        const on = toLumiereSceneTuning({ ...DEFAULT_LUMIERE_TUNING, seamlessTransitions: true }, { showText: true });
        expect(on).toEqual(off);
        expect(requiresLumiereSceneRebuild(off, on)).toBe(false);
    });
});
