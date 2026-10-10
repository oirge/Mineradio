import { describe, expect, it } from 'vitest';
import {
    layoutSonnetPosterBlocks,
    type SonnetPosterBlockBox,
} from '@/components/visualizer/sonnet/sonnetPosterBlocksLayout';

// test/unit/visualizer/sonnetPosterBlocksLayout.test.ts
// Locks collision-free, justified poster packing and deterministic layout variation.
const box = (
    measuredWidth: number,
    measuredHeight: number,
    role: 'hero' | 'semi-hero' | 'support',
): SonnetPosterBlockBox => ({
    isHero: role === 'hero',
    isSemiHero: role === 'semi-hero',
    displayText: role,
    fontScale: role === 'hero' ? 4.4 : role === 'semi-hero' ? 3.1 : 1.15,
    measuredWidth,
    measuredHeight,
    x: 0,
    y: 0,
    rotation: 0,
    vertical: false,
    layoutDirection: 'horizontal',
    enterX: 0,
    enterY: 0,
});

const makeBoxes = () => [
    box(128, 42, 'support'),
    box(184, 68, 'semi-hero'),
    box(360, 142, 'hero'),
    box(116, 40, 'support'),
    box(152, 40, 'support'),
    box(208, 66, 'semi-hero'),
    box(104, 40, 'support'),
];

describe('Sonnet poster blocks layout', () => {
    it('wraps following supports beside the hero and never overlaps measured boxes', () => {
        const boxes = makeBoxes();
        const plan = layoutSonnetPosterBlocks(boxes, 1280, 720, 40, 28);
        const hero = boxes.find(item => item.isHero)!;
        const supports = boxes.filter(item => !item.isHero && !item.isSemiHero);
        const heroRight = hero.x + hero.measuredWidth / 2;
        const heroTop = hero.y - hero.measuredHeight / 2;
        const heroBottom = hero.y + hero.measuredHeight / 2;

        expect(supports.some(item => (
            item.x - item.measuredWidth / 2 >= heroRight
            && item.y + item.measuredHeight / 2 > heroTop
            && item.y - item.measuredHeight / 2 < heroBottom
        ))).toBe(true);
        supports.slice(1).forEach((item, index) => {
            const previous = supports[index];
            expect(item.y - item.measuredHeight / 2)
                .toBeGreaterThanOrEqual(previous.y - previous.measuredHeight / 2 - 0.001);
        });
        for (let firstIndex = 0; firstIndex < boxes.length; firstIndex += 1) {
            for (let secondIndex = firstIndex + 1; secondIndex < boxes.length; secondIndex += 1) {
                const first = boxes[firstIndex];
                const second = boxes[secondIndex];
                const separated = first.x + first.measuredWidth / 2 <= second.x - second.measuredWidth / 2
                    || second.x + second.measuredWidth / 2 <= first.x - first.measuredWidth / 2
                    || first.y + first.measuredHeight / 2 <= second.y - second.measuredHeight / 2
                    || second.y + second.measuredHeight / 2 <= first.y - first.measuredHeight / 2;
                expect(separated).toBe(true);
            }
        }
        expect(plan.placements).toEqual(boxes);
    });

    it('is stable for one seed and varies composition across seeds', () => {
        const first = layoutSonnetPosterBlocks(makeBoxes(), 1280, 720, 40, 12);
        const repeated = layoutSonnetPosterBlocks(makeBoxes(), 1280, 720, 40, 12);
        const alternate = layoutSonnetPosterBlocks(makeBoxes(), 1280, 720, 40, 13);

        expect(first.placements.map(item => [item.x, item.y, item.fontScale]))
            .toEqual(repeated.placements.map(item => [item.x, item.y, item.fontScale]));
        expect(alternate.placements.map(item => item.x))
            .not.toEqual(first.placements.map(item => item.x));
    });

    it('keeps dense lyric groups finite and collision-free', () => {
        const boxes = [
            box(420, 150, 'hero'),
            box(230, 76, 'semi-hero'),
            ...Array.from({ length: 28 }, (_, index) => box(72 + index % 5 * 18, 38, 'support')),
        ];
        layoutSonnetPosterBlocks(boxes, 1280, 720, 32, 98);

        expect(boxes.every(item => Number.isFinite(item.x) && Number.isFinite(item.y))).toBe(true);
        for (let firstIndex = 0; firstIndex < boxes.length; firstIndex += 1) {
            for (let secondIndex = firstIndex + 1; secondIndex < boxes.length; secondIndex += 1) {
                const first = boxes[firstIndex];
                const second = boxes[secondIndex];
                expect(
                    first.x + first.measuredWidth / 2 <= second.x - second.measuredWidth / 2
                    || second.x + second.measuredWidth / 2 <= first.x - first.measuredWidth / 2
                    || first.y + first.measuredHeight / 2 <= second.y - second.measuredHeight / 2
                    || second.y + second.measuredHeight / 2 <= first.y - first.measuredHeight / 2,
                ).toBe(true);
            }
        }
    });
});
