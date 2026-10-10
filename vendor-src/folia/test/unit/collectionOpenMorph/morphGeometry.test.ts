import { describe, expect, it } from 'vitest';
import {
    boxOf,
    collectionMorphEntranceTravel,
    collectionMorphFlyIn,
    collectionMorphRectSeed,
    collectionMorphScatterTravel,
    collectionMorphSeed,
    estimateCenterTarget,
    isNearViewportCenter,
    isMorphTargetSettled,
    MORPH_CARD_COVER_RADIUS_PX,
    MORPH_CIRCLE_RADIUS,
    radiusPercent,
    type CollectionMorphRect,
} from '@/library/suites/grid/transitions/morphGeometry';

// test/unit/collectionOpenMorph/morphGeometry.test.ts
// 移形换影的几何部分。这些公式之前散在三处（overlay / GridView / ArtistGridView），
// 每处各写一遍，所以「飞到哪里」这件事一直没有被任何测试约束过。

const rect = (x: number, y: number, width: number, height: number): CollectionMorphRect => ({ x, y, width, height });

describe('boxOf', () => {
    it('maps a rect onto the box properties the layers animate', () => {
        expect(boxOf(rect(10, 20, 30, 40))).toEqual({ left: 10, top: 20, width: 30, height: 40 });
    });

    // 形变动画的是盒子而不是 x/y/scaleX/scaleY：object-cover 按布局盒子裁图，
    // 非等比 scale 会把封面内容拉变形（歌手页方形头像那一段尤其明显）。
    it('never produces a scale, so images are never stretched', () => {
        expect(Object.keys(boxOf(rect(0, 0, 1, 1)))).not.toContain('scaleX');
        expect(Object.keys(boxOf(rect(0, 0, 1, 1)))).not.toContain('scaleY');
    });
});

describe('estimateCenterTarget', () => {
    it('sits on the viewport centre and is sized within the documented clamp', () => {
        for (const viewport of [{ width: 1440, height: 1100 }, { width: 800, height: 600 }, { width: 3840, height: 2160 }]) {
            const target = estimateCenterTarget(viewport);
            expect(target.x + target.width / 2).toBeCloseTo(viewport.width / 2, 6);
            expect(target.y + target.height / 2).toBeCloseTo(viewport.height / 2, 6);
            expect(target.width).toBeGreaterThanOrEqual(160);
            expect(target.width).toBeLessThanOrEqual(280);
            expect(target.height / target.width).toBeCloseTo(1.16, 6);
        }
    });
});

describe('isNearViewportCenter', () => {
    const viewport = { width: 1000, height: 800 };

    it('counts a centred card and rejects one beyond the exclusion radius', () => {
        expect(isNearViewportCenter(rect(400, 300, 200, 200), viewport)).toBe(true);
        expect(isNearViewportCenter(rect(0, 0, 100, 100), viewport)).toBe(false);
    });

    it('keeps the strict 100px boundary the scatter relies on', () => {
        // 中心正好偏 99px：算 hero；偏 101px：算可四散的卡片。
        expect(isNearViewportCenter(rect(500 - 50 + 99, 400 - 50, 100, 100), viewport)).toBe(true);
        expect(isNearViewportCenter(rect(500 - 50 + 101, 400 - 50, 100, 100), viewport)).toBe(false);
    });
});

describe('collectionMorphSeed', () => {
    it('is deterministic and stays in [0, 1)', () => {
        for (const key of ['song-1', 'song-2', '', '曲目', 'a'.repeat(200)]) {
            const first = collectionMorphSeed(key);
            expect(collectionMorphSeed(key)).toBe(first);
            expect(first).toBeGreaterThanOrEqual(0);
            expect(first).toBeLessThan(1);
        }
    });

    it('spreads different ids apart instead of collapsing them', () => {
        const seeds = new Set(Array.from({ length: 40 }, (_, i) => collectionMorphSeed(`track-${i}`)));
        expect(seeds.size).toBeGreaterThan(35);
    });
});

describe('collectionMorphRectSeed', () => {
    it('is stable for the same rect and unsigned for the rotate/sign derivations', () => {
        const seed = collectionMorphRectSeed(rect(120.4, 33.6, 200, 200));
        expect(collectionMorphRectSeed(rect(120.4, 33.6, 200, 200))).toBe(seed);
        expect(seed).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(seed)).toBe(true);
    });
});

describe('collectionMorphFlyIn', () => {
    const origin = { x: 0, y: 0 };
    const flyIn = (card: { x: number; y: number }, spacing = 100, reach = 900) => (
        collectionMorphFlyIn(card, origin, spacing, reach, collectionMorphSeed(`card-${card.x}-${card.y}`))
    );

    it('pushes the card radially outward by exactly the reach', () => {
        const card = { x: 300, y: 400 };
        const result = flyIn(card);
        expect(Math.hypot(result.x, result.y)).toBeCloseTo(900, 6);
        // 方向沿着 origin → card 的径向。
        expect(result.x / result.y).toBeCloseTo(300 / 400, 6);
    });

    it('falls back to straight up for a card sitting on the origin', () => {
        const result = collectionMorphFlyIn({ x: 0, y: 0 }, origin, 100, 900, 0.5);
        expect(result.x).toBe(0);
        expect(result.y).toBe(-900);
    });

    it('never tilts a card, and keeps the stagger inside its window', () => {
        for (let x = -3; x <= 3; x += 1) {
            for (let y = -3; y <= 3; y += 1) {
                const result = flyIn({ x: x * 300, y: y * 300 });
                // 不倾斜是契约：网格入场让每一格各自歪一个角度，读起来是「随机」而不是
                // 「被安排好的」——Apple 的网格入场是有秩序的。
                expect(result.rotate).toBe(0);
                expect(result.delay).toBeGreaterThanOrEqual(0.04);
                expect(result.delay).toBeLessThanOrEqual(0.32);
            }
        }
    });

    it('starts nearer cards earlier than far ones with the same seed', () => {
        const near = collectionMorphFlyIn({ x: 50, y: 0 }, origin, 100, 900, 0.5);
        const far = collectionMorphFlyIn({ x: 5000, y: 0 }, origin, 100, 900, 0.5);
        expect(near.delay).toBeLessThan(far.delay);
    });
});

describe('travel distances', () => {
    // 入场是「就位」，不是「从屏幕外飞进来」：短距离是 Apple 网格入场的语言，顺带把
    // 每张卡要走的距离（也就是单帧要喂的动画量）压下来。
    it('keeps the entrance a short push instead of a flight from off-screen', () => {
        const desktop = collectionMorphEntranceTravel({ width: 1440, height: 1100 });
        const small = collectionMorphEntranceTravel({ width: 800, height: 600 });
        expect(desktop).toBeLessThanOrEqual(260);
        expect(small).toBeLessThan(desktop);
        expect(small).toBeGreaterThan(100);
    });

    it('scatters shorter than it would take to leave the screen', () => {
        const viewport = { width: 1440, height: 1100 };
        expect(collectionMorphScatterTravel(viewport)).toBeLessThanOrEqual(220);
        expect(collectionMorphScatterTravel(viewport)).toBeLessThan(Math.hypot(viewport.width, viewport.height) * 0.2);
    });
});

describe('isMorphTargetSettled', () => {
    const candidate = (key: string, frame: CollectionMorphRect, overrides: Partial<{ cover: CollectionMorphRect; title: CollectionMorphRect }> = {}) => ({
        key,
        frame,
        cover: overrides.cover ?? frame,
        title: overrides.title ?? frame,
    });

    it('needs two consecutive measurements of the same, still card', () => {
        const first = candidate('a-1', rect(600, 400, 200, 260));
        expect(isMorphTargetSettled(null, first, 1.5)).toBe(false);
        expect(isMorphTargetSettled(first, candidate('a-1', rect(600, 400, 200, 260)), 1.5)).toBe(true);
    });

    it('rejects a different card (the grid is still panning to its restored focus)', () => {
        const first = candidate('a-1', rect(600, 400, 200, 260));
        expect(isMorphTargetSettled(first, candidate('a-9', rect(600, 400, 200, 260)), 1.5)).toBe(false);
    });

    it('falls back to the rectangles when a card carries no identifier', () => {
        const first = candidate('', rect(600, 400, 200, 260));
        expect(isMorphTargetSettled(first, candidate('', rect(600, 400, 200, 260)), 1.5)).toBe(true);
        // 没有标识时仍然靠矩形判定：还在滑的卡片不会被接受。
        expect(isMorphTargetSettled(first, candidate('', rect(600, 400, 200, 400)), 1.5)).toBe(false);
    });

    it('rejects a card that is still sliding, on any of the three rects', () => {
        const first = candidate('a-1', rect(600, 400, 200, 260));
        expect(isMorphTargetSettled(first, candidate('a-1', rect(608, 400, 200, 260)), 1.5)).toBe(false);
        expect(isMorphTargetSettled(first, candidate('a-1', rect(600, 400, 200, 260), { cover: rect(610, 410, 190, 250) }), 1.5)).toBe(false);
        expect(isMorphTargetSettled(first, candidate('a-1', rect(600, 400, 200, 260), { title: rect(600, 700, 200, 24) }), 1.5)).toBe(false);
    });

    it('accepts sub-pixel jitter from the measurement itself', () => {
        const first = candidate('a-1', rect(600, 400, 200, 260));
        expect(isMorphTargetSettled(first, candidate('a-1', rect(601, 400.4, 200.2, 260)), 1.5)).toBe(true);
    });
});

// 圆形落点：盒子动画让百分比圆角自动跟着盒子走，所以落点一旦是正方形就是正圆；
// 两端又都用百分比，framer 才不会在 px 与 % 之间插不出来而在落点跳一下。
describe('the circle radius contract', () => {
    it('is a percentage, so it tracks the box instead of drifting from it', () => {
        expect(MORPH_CIRCLE_RADIUS).toBe('50%');
    });

    it('expresses the card corner as a percentage of the same box', () => {
        // 起点是卡片自己的圆角：12px 的封面角在 200px 宽的盒子上就是 6%。
        expect(radiusPercent(MORPH_CARD_COVER_RADIUS_PX, 200)).toBe('6%');
        expect(radiusPercent(16, 200)).toBe('8%');
    });

    it('keeps the unit usable for a degenerate box', () => {
        expect(radiusPercent(12, 0)).toBe('12px');
    });

    it('keeps both ends of the rounding in the same unit', () => {
        const start = radiusPercent(MORPH_CARD_COVER_RADIUS_PX, 200);
        expect(start.endsWith('%')).toBe(true);
        expect(MORPH_CIRCLE_RADIUS.endsWith('%')).toBe(true);
    });
});
