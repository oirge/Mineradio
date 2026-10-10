import { describe, expect, it, vi } from 'vitest';
import type { Line } from '@/types';
import { LUMIERE_PROFILES } from '@/components/visualizer/lumiere/catalog';
import { createRng, createRngAt } from '@/components/visualizer/lumiere/lumiereRandom';
import { createTextMeasurer } from '@/components/visualizer/lumiere/text/lineWrap';
import { createLyricWindow, type WindowTypography } from '@/components/visualizer/lumiere/text/lyricWindow';
import { buildLineMetas, buildLineView, GLYPH_RANDOM_DRAWS, LINE_RANDOM_DRAWS } from '@/components/visualizer/lumiere/text/windowLines';
import { installFakeTextMeasure, syntheticSong } from './lumiereFixtures';
import { fakePixi, fakeSprites, type FakeContainer } from './lumiereWindowFakes';

// test/unit/visualizer/lumiere/lumiereLazyWindow.test.ts
// 歌词窗口按需构建：只建当前行附近几行（整首歌一个单元时也一样），每行的构建结果与何时构建无关
// （随机流跳到这一行的起点），画面只由时刻决定。
vi.mock('@/components/visualizer/lumiere/text/glyphLine', async importOriginal => (
    (await import('./lumiereWindowFakes')).fakeGlyphLineModule(await importOriginal())
));
installFakeTextMeasure();

const WIDTH = 1600;
const HEIGHT = 900;
const aspect = WIDTH / HEIGHT;
/** 整首歌（约 40 行）当成一个单元。 */
const SONG = syntheticSong(4);

const buildWindow = (typography: WindowTypography, lines: Line[] = SONG) => {
    const profile = LUMIERE_PROFILES[30]!;
    return createLyricWindow(fakePixi, {
        width: WIDTH,
        height: HEIGHT,
        lines,
        font: 'x',
        weight: 500,
        resolution: 1,
        region: { cx: profile.region.cx * aspect, cy: profile.region.cy, w: profile.region.w * aspect, h: profile.region.h },
        heroPx: profile.heroSize * HEIGHT,
        neighbors: 2,
        typography,
        typographyOf: index => (['horizontal', 'vertical', 'crossed'] as const)[Math.floor(index / 3) % 3]!,
        decay: profile.decay,
        seed: 'lazy',
        sprites: fakeSprites,
    });
};
const frameAt = (time: number) => ({ time, beams: [], litColor: [1, 0.85, 0.6] as [number, number, number], unlitColor: [0.5, 0.6, 0.8] as [number, number, number], unlitAlpha: 0.15, intensity: 1 });

/** 画面上所有看得见的字：「行:字」→ 位置、缩放、透明度（行容器的 label 是「line-行号」）。 */
const snapshot = (window: ReturnType<typeof buildWindow>) => {
    const out: Record<string, number[]> = {};
    for (const holderItem of (window.view.children[3] as unknown as FakeContainer).children) {
        const holder = holderItem as FakeContainer;
        if (!holder.visible) continue;
        holder.children.forEach((item, glyphIndex) => {
            const glyph = item as FakeContainer;
            if (!glyph.visible) return;
            out[`${holder.label}:${glyphIndex}`] = [holder.position.x, holder.position.y, holder.scale.x, holder.rotation, glyph.position.x, glyph.position.y, glyph.alpha];
        });
    }
    return out;
};

describe('随机流跳到某一行的起点', () => {
    it('createRngAt(seed, n) 与 createRng(seed) 取掉 n 个值之后的流一样', () => {
        const stream = createRng('lazy:window');
        const values = Array.from({ length: 500 }, () => stream());
        for (const skip of [0, 1, 7, 123, 490]) {
            const jumped = createRngAt('lazy:window', skip);
            expect(Array.from({ length: 10 }, () => jumped()).slice(0, Math.min(10, 500 - skip))).toEqual(values.slice(skip, skip + 10));
        }
    });

    it('每行取的随机数个数 = GLYPH_RANDOM_DRAWS × 字数 + LINE_RANDOM_DRAWS（与 buildLineMetas 记的起点一致）', () => {
        const metas = buildLineMetas(SONG.slice(0, 6));
        const context = {
            pixi: fakePixi, font: 'x', weight: 500, resolution: 1, heroPx: 70, spacing: 0, seed: 'lazy', sprites: fakeSprites,
            measurer: createTextMeasurer('x', 500, 0), limits: { horizontal: 1400, vertical: 600 }, keywords: undefined,
            driftSpeed: [0.013, 0.022] as const, placementsOf: () => new Map(),
        };
        metas.forEach((meta, index) => {
            let draws = 0;
            const base = createRng('count');
            buildLineView(context, index, meta, () => { draws += 1; return base(); });
            expect(draws).toBe(meta.graphemes.length * GLYPH_RANDOM_DRAWS + LINE_RANDOM_DRAWS);
            if (index > 0) expect(meta.randomOffset).toBe(metas[index - 1]!.randomOffset + metas[index - 1]!.graphemes.length * GLYPH_RANDOM_DRAWS + LINE_RANDOM_DRAWS);
        });
    });
});

describe('歌词窗口按需构建', () => {
    it('整首歌一个单元时，任何时刻都只建当前行附近的几行', () => {
        const window = buildWindow('horizontal');
        const layer = window.view.children[3] as unknown as FakeContainer;
        let most = 0;
        for (let time = SONG[0]!.startTime - 2; time < SONG[SONG.length - 1]!.endTime + 2; time += 0.25) {
            window.update(frameAt(time));
            most = Math.max(most, layer.children.length);
            // 按行号排（画的先后与构建顺序无关）。
            const order = layer.children.map(item => Number((item as FakeContainer).label.replace('line-', '')));
            expect(order).toEqual([...order].sort((a, b) => a - b));
        }
        // 当前行 ±3、还在滑动的再往前 3 行、往后预建 2 行、释放前留 2 行余量。
        expect(most).toBeLessThanOrEqual(16);
        expect(most).toBeLessThan(SONG.length);
        window.destroy();
        expect(layer.children.length).toBe(0);
    });

    it('画面只由时刻决定：顺着播到某一刻、直接跳过去、来回拖动之后再回来，每个字都一样', () => {
        for (const typography of ['horizontal', 'crossed'] as const) {
            const played = buildWindow(typography);
            const jumped = buildWindow(typography);
            const target = SONG[Math.floor(SONG.length / 2)]!.startTime - 0.4;
            for (let time = SONG[0]!.startTime - 1; time < target; time += 1 / 30) played.update(frameAt(time));
            played.update(frameAt(target));
            jumped.update(frameAt(SONG[SONG.length - 1]!.endTime));
            jumped.update(frameAt(3));
            jumped.update(frameAt(target));
            expect(snapshot(jumped)).toEqual(snapshot(played));
            // 查询别的行（会临时建它们）也不改变画面。
            SONG.forEach((_, index) => jumped.lineAnchor(index, target + 5));
            jumped.update(frameAt(target));
            expect(snapshot(jumped)).toEqual(snapshot(played));
            played.destroy();
            jumped.destroy();
        }
    });

    it('爆闪选字用的逐字时刻与关键字不必构建那一行', () => {
        const window = buildWindow('vertical');
        const layer = window.view.children[3] as unknown as FakeContainer;
        const times = window.glyphTimes(SONG.length - 1);
        expect(times.length).toBeGreaterThan(0);
        expect(times.every(({ start }) => start >= SONG[SONG.length - 1]!.startTime - 1e-9)).toBe(true);
        expect(window.glyphKeyword(SONG.length - 1, 0)).toBeNull();
        expect(layer.children.length).toBe(0);
    });
});
