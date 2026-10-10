import { afterEach, describe, expect, it, vi } from 'vitest';
import * as pixi from 'pixi.js';
import type { Mesh } from 'pixi.js';
import { LUMIERE_PROFILES } from '@/components/visualizer/lumiere/catalog';
import { createLightField } from '@/components/visualizer/lumiere/light/lightFieldShader';
import {
    createLineArt,
    LINE_ART_UNLOAD_AFTER,
    LINE_ART_UNLOAD_LEAD,
    shouldUnloadLineArt,
    type LineArtSpec,
} from '@/components/visualizer/lumiere/lineart/lineArt';
import { createLyricWindow } from '@/components/visualizer/lumiere/text/lyricWindow';
import { installFakeTextMeasure, syntheticSong } from './lumiereFixtures';
import { FakeGraphics, fakePixi, fakeSprites } from './lumiereWindowFakes';

// test/unit/visualizer/lumiere/lumiereGpuRelease.test.ts
// 单元被丢掉时，绘光自建的 GPU 资源要当场放掉，不能留给 Pixi 的 GC（空闲 60 秒才收）。
// 起因：Graphics.destroy({ children: true }) 不销毁 Graphics 自建的 GraphicsContext，每个 context 在渲染器里
// 挂着一个 batcher 和两块 WebGL 缓冲；段落一换，线稿、径迹层就各漏一份，长跑时缓冲涨到上百 MB。
vi.mock('@/components/visualizer/lumiere/text/glyphLine', async importOriginal => (
    (await import('./lumiereWindowFakes')).fakeGlyphLineModule(await importOriginal())
));
installFakeTextMeasure();

afterEach(() => { FakeGraphics.created.length = 0; });

describe('Pixi 的销毁约定（这里的修复依赖它）', () => {
    it('Graphics.destroy({ children: true }) 不销毁自建的 context，要写 context: true', () => {
        const kept = new pixi.Graphics().moveTo(0, 0).lineTo(10, 10).stroke({ width: 2, color: 0xffffff });
        const keptContext = kept.context;
        kept.destroy({ children: true });
        expect(keptContext.destroyed).toBe(false);
        keptContext.destroy();

        const released = new pixi.Graphics().moveTo(0, 0).lineTo(10, 10).stroke({ width: 2, color: 0xffffff });
        const releasedContext = released.context;
        released.destroy({ children: true, context: true });
        expect(releasedContext.destroyed).toBe(true);
    });
});

describe('绘光图层销毁时放掉 GPU 资源', () => {
    it('线稿：每条线的 GraphicsContext 都随图层销毁', () => {
        const spec: LineArtSpec = {
            paths: [
                { points: [[0.1, 0.1], [0.5, 0.2], [0.8, 0.6]], width: 0.002, alpha: 0.8, delay: 0, span: 0.5 },
                { points: [[0.2, 0.7], [0.9, 0.7]], width: 0.002, alpha: 0.6, delay: 0.2, span: 0.4, dash: [0.02, 0.01] },
            ],
            nodes: [{ at: [0.5, 0.2], size: 0.01, delay: 0.1, twinklePhase: 0 }],
        };
        const art = createLineArt(pixi, { height: 900, spec, starTexture: pixi.Texture.WHITE });
        // 画线动画期间每帧 clear() 重画，context 始终是同一个。
        for (let draw = 0; draw <= 1; draw += 0.1) art.update(draw * 4, draw, 1, [], 0xffffff);
        const contexts = (art.view.children[0]!.children as pixi.Graphics[]).map(graphics => graphics.context);
        expect(contexts).toHaveLength(2);
        art.destroy();
        expect(contexts.every(context => context.destroyed)).toBe(true);
    });

    it('歌词窗口：径迹层（Graphics）的 context 随窗口销毁', () => {
        const song = syntheticSong(1);
        const profile = LUMIERE_PROFILES[30]!;
        const aspect = 1600 / 900;
        const window = createLyricWindow(fakePixi, {
            width: 1600,
            height: 900,
            lines: song,
            font: 'x',
            weight: 500,
            resolution: 1,
            region: { cx: profile.region.cx * aspect, cy: profile.region.cy, w: profile.region.w * aspect, h: profile.region.h },
            heroPx: profile.heroSize * 900,
            neighbors: 2,
            typography: 'horizontal',
            decay: profile.decay,
            seed: 'gpu-release',
            sprites: fakeSprites,
        });
        for (let time = song[0]!.startTime; time < song[song.length - 1]!.endTime; time += 0.5) {
            window.update({ time, beams: [], litColor: [1, 0.85, 0.6], unlitColor: [0.5, 0.6, 0.8], unlitAlpha: 0.15, intensity: 1 });
        }
        expect(FakeGraphics.created.length).toBeGreaterThan(0);
        window.destroy();
        expect(FakeGraphics.created.every(graphics => graphics.contextDestroyed)).toBe(true);
    });

    it('光场：网格的顶点 / 索引缓冲随光场销毁', () => {
        // 编着色器要 WebGL 上下文，node 里没有；只替换程序与着色器，几何与网格用真的 Pixi。
        class HeadlessShader { destroy() { /* 没有 GPU 程序可放 */ } }
        const headless = { ...pixi, GlProgram: { from: () => ({}) }, Shader: HeadlessShader } as unknown as typeof pixi;
        const field = createLightField(headless, 1600, 900, 40);
        const { buffers, indexBuffer } = (field.view as Mesh).geometry;
        field.destroy();
        expect([...buffers, indexBuffer].every(buffer => buffer.destroyed)).toBe(true);
    });
});

describe('轨迹过渡：藏起来的线稿放掉 GPU 数据（滞回）', () => {
    // 整首一个单元时，每个镜头的线稿都活到单元销毁；画过的每条线留着一个 batcher 和两块缓冲，要在藏够、且短期不再用时放掉。
    const spec: LineArtSpec = {
        paths: [
            { points: [[0.1, 0.1], [0.5, 0.2], [0.8, 0.6]], width: 0.002, alpha: 0.8, delay: 0, span: 0.5 },
            { points: [[0.2, 0.7], [0.9, 0.7]], width: 0.002, alpha: 0.6, delay: 0.2, span: 0.4 },
        ],
        nodes: [],
    };
    const FRAME = 1 / 60;
    const setup = () => {
        const art = createLineArt(pixi, { height: 900, spec, starTexture: pixi.Texture.WHITE });
        const contexts = (art.view.children[0]!.children as pixi.Graphics[]).map(graphics => graphics.context);
        const unloads = contexts.map(context => vi.spyOn(context, 'unload'));
        const unloadCount = () => unloads[0]!.mock.calls.length;
        return { art, contexts, unloads, unloadCount };
    };
    const hideFor = (art: ReturnType<typeof setup>['art'], from: number, seconds: number, nextUse: (time: number) => number) => {
        for (let time = from; time < from + seconds; time += FRAME) art.idle(time, nextUse(time));
    };

    it('判定：藏够时间且离下次出现够远才放', () => {
        expect(shouldUnloadLineArt(10, 10 + LINE_ART_UNLOAD_AFTER - 0.01, Infinity)).toBe(false);
        expect(shouldUnloadLineArt(10, 10 + LINE_ART_UNLOAD_AFTER, Infinity)).toBe(true);
        expect(shouldUnloadLineArt(10, 20, 20 + LINE_ART_UNLOAD_LEAD - 0.01)).toBe(false);
        expect(shouldUnloadLineArt(10, 20, 20 + LINE_ART_UNLOAD_LEAD)).toBe(true);
    });

    it('没画过的线稿藏多久都不动', () => {
        const { art, unloadCount } = setup();
        hideFor(art, 0, 10, () => Infinity);
        expect(unloadCount()).toBe(0);
        art.destroy();
    });

    it('淡出后逐帧藏着：满时长时每条线各放一次，之后不再重复', () => {
        const { art, contexts, unloads } = setup();
        for (let time = 0; time <= 4; time += FRAME) art.update(time, time / 3.6, 1, [], 0xffffff);
        hideFor(art, 4, LINE_ART_UNLOAD_AFTER - 0.1, () => Infinity);
        unloads.forEach(unload => expect(unload).not.toHaveBeenCalled());
        hideFor(art, 4 + LINE_ART_UNLOAD_AFTER - 0.1, 10, () => Infinity);
        unloads.forEach(unload => expect(unload).toHaveBeenCalledOnce());
        // 只放 GPU 数据，几何指令还在，再画时 Pixi 按指令重传，不会少一帧线。
        expect(contexts.every(context => !context.destroyed && context.instructions.length > 0)).toBe(true);
        // 再画一次又算驻留，重新藏够才会再放。
        art.update(20, 1, 1, [], 0xffffff);
        hideFor(art, 20 + FRAME, LINE_ART_UNLOAD_AFTER + 1, () => Infinity);
        unloads.forEach(unload => expect(unload).toHaveBeenCalledTimes(2));
        art.destroy();
    });

    it('下次出现就在眼前时不放', () => {
        const { art, unloadCount } = setup();
        art.update(0, 1, 1, [], 0xffffff);
        hideFor(art, FRAME, 30, time => time + LINE_ART_UNLOAD_LEAD - 0.5);
        expect(unloadCount()).toBe(0);
        art.destroy();
    });

    it('隔帧显隐不抖：每次藏起来都从头计时', () => {
        const { art, unloadCount } = setup();
        for (let frame = 0; frame < 60 * 30; frame += 1) {
            const time = frame * FRAME;
            if (frame % 2 === 0) art.update(time, 1, 1, [], 0xffffff);
            else art.idle(time, Infinity);
        }
        expect(unloadCount()).toBe(0);
        art.destroy();
    });

    it('回拖到藏起来之前：从回拖处重新计时', () => {
        const { art, unloadCount } = setup();
        art.update(50, 1, 1, [], 0xffffff);
        art.idle(51.9, Infinity);
        art.idle(40, Infinity);
        art.idle(40 + LINE_ART_UNLOAD_AFTER - 0.1, Infinity);
        expect(unloadCount()).toBe(0);
        art.idle(40 + LINE_ART_UNLOAD_AFTER, Infinity);
        expect(unloadCount()).toBe(1);
        art.destroy();
    });
});
