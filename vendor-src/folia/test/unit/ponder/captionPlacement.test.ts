import { describe, expect, it } from 'vitest';
import { pickCaptionSpot, type PonderBox } from '@/utils/ponder/captionPlacement';
import type { PonderRect } from '@/types/ponder';

// test/unit/ponder/captionPlacement.test.ts
// 字幕不许压住骨架框，也不许压住上下外框。这是「贴着目标」和「不挡住界面」之间的取舍，
// 值得穷举 —— 压住目标本身是最糟的情况，恰恰也是最容易写出来的那种实现。

const viewport = { width: 1440, height: 900 };
const size = { width: 384, height: 76 };

const reserved: PonderBox[] = [
    { left: 0, top: 0, width: 1440, height: 76 },
    { left: 0, top: 750, width: 1440, height: 150 },
];

const pick = (target: { x: number; y: number }, obstacles: PonderRect[] = []) =>
    pickCaptionSpot({ target, size, obstacles, viewport, reserved });

const boxOf = (spot: { left: number; top: number }): PonderBox => ({ ...spot, ...size });

const overlaps = (a: PonderBox, b: PonderBox) =>
    a.left < b.left + b.width && b.left < a.left + a.width
    && a.top < b.top + b.height && b.top < a.top + a.height;

describe('pickCaptionSpot', () => {
    it('空场地时放在目标正下方', () => {
        const spot = pick({ x: 720, y: 400 });
        expect(spot.left).toBe(720 - size.width / 2);
        expect(spot.top).toBe(400 + 28);
    });

    it('下方被骨架框占住时改放上方', () => {
        const blocker: PonderRect = { left: 500, top: 420, width: 440, height: 200 };
        const spot = pick({ x: 720, y: 400 }, [blocker]);

        expect(overlaps(boxOf(spot), { ...blocker })).toBe(false);
        expect(spot.top).toBeLessThan(400);
    });

    it('永远不压住它所指的那个框', () => {
        // 目标点就在框中心：放下方会正好骑在框上。
        const subject: PonderRect = { left: 620, top: 360, width: 200, height: 120 };
        const spot = pick({ x: 720, y: 420 }, [subject]);

        expect(overlaps(boxOf(spot), { ...subject })).toBe(false);
    });

    it('目标靠近底部时不会压住底部外框', () => {
        const spot = pick({ x: 720, y: 730 });
        expect(overlaps(boxOf(spot), reserved[1])).toBe(false);
    });

    it('目标靠近顶部时不会压住顶部标题栏', () => {
        const spot = pick({ x: 720, y: 90 });
        expect(overlaps(boxOf(spot), reserved[0])).toBe(false);
    });

    it('目标贴着左边缘时字幕整体留在视口内', () => {
        const spot = pick({ x: 40, y: 400 });
        expect(spot.left).toBeGreaterThanOrEqual(16);
        expect(spot.left + size.width).toBeLessThanOrEqual(viewport.width - 16);
    });

    it('目标贴着右边缘时同样留在视口内', () => {
        const spot = pick({ x: 1420, y: 400 });
        expect(spot.left + size.width).toBeLessThanOrEqual(viewport.width - 16);
    });

    it('四周全被占满时仍返回一个视口内的位置，而不是抛错', () => {
        const wall: PonderRect = { left: 0, top: 0, width: 1440, height: 900 };
        const spot = pick({ x: 720, y: 400 }, [wall]);

        expect(spot.left).toBeGreaterThanOrEqual(16);
        expect(spot.top).toBeGreaterThanOrEqual(16);
        expect(spot.top + size.height).toBeLessThanOrEqual(viewport.height - 16);
    });

    it('左右都被挡时选压得更少的一侧', () => {
        const big: PonderRect = { left: 760, top: 300, width: 600, height: 300 };
        const small: PonderRect = { left: 300, top: 380, width: 40, height: 40 };
        const spot = pick({ x: 720, y: 440 }, [big, small]);

        expect(overlaps(boxOf(spot), { ...big })).toBe(false);
    });
});
