import { expect, it } from 'vitest';
import { resolveMetaphorPose, type MetaphorPose } from '../../../src/components/visualizer/metaphor/metaphorCamera';
import type { MetaphorLayout, MetaphorWord } from '../../../src/components/visualizer/metaphor/metaphorLayout';
import type { MetaphorShot } from '../../../src/components/visualizer/metaphor/metaphorProgram';

// Covers framing of separated lyric rows and motion at rapid word onsets.
const words: MetaphorWord[] = [
    { x0: -5, y0: 1, x1: -2, y1: 2.5, t0: 1.9, t1: 2.2 },
    { x0: 1, y0: 1, x1: 4, y1: 2.5, t0: 2.2, t1: 2.55 },
    { x0: -4, y0: -3, x1: 0, y1: -1.5, t0: 2.55, t1: 2.68 },
    { x0: 1, y0: -3, x1: 6, y1: -1.5, t0: 2.68, t1: 3.3 },
    { x0: 20, y0: -3, x1: 25, y1: -1.5, t0: 4, t1: 4.4 },
];
const layout: MetaphorLayout = {
    composition: 'stair', glyphs: [], words,
    bounds: { x0: -5, y0: -3, x1: 25, y1: 2.5 },
};
const shot: MetaphorShot = {
    start: 2, end: 4, kind: 'close', roll: -0.07, offsetX: 0.08, offsetY: -0.05,
    invert: false, screenAngle: 0.52, seed: 0.59,
};

function expectInsideFrame(word: MetaphorWord, pose: MetaphorPose, aspect: number) {
    const halfHeight = pose.distance * Math.tan(pose.fov * Math.PI / 360);
    const cos = Math.cos(pose.roll), sin = Math.sin(pose.roll);
    for (const x of [word.x0 - pose.x, word.x1 - pose.x]) {
        for (const y of [word.y0 - pose.y, word.y1 - pose.y]) {
            expect(Math.abs(x * cos + y * sin)).toBeLessThan(halfHeight * aspect);
            expect(Math.abs(-x * sin + y * cos)).toBeLessThan(halfHeight);
        }
    }
}

it.each([16 / 9, 9 / 16])('fits all words sung during the close shot at aspect %f', (aspect) => {
    for (const time of [2, 2.4, 3.2, 3.99]) {
        const pose = resolveMetaphorPose({ shot, layout, time, aspect, motion: 2 });
        words.slice(0, -1).forEach(word => expectInsideFrame(word, pose, aspect));
        expect(pose.x).toBeLessThan(6);
    }
});

it('eases between groups of words while keeping the active word visible', () => {
    const aspect = 9 / 16;
    const follow = { ...shot, kind: 'follow' as const, offsetX: 0, offsetY: 0 };
    const poseAt = (time: number) => resolveMetaphorPose({ shot: follow, layout, time, aspect, motion: 0 });
    for (const onset of [2.2, 2.55, 2.68]) {
        const before = poseAt(onset - 0.001);
        const after = poseAt(onset + 0.001);
        expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(0.1);
        expect(Math.abs(after.distance - before.distance)).toBeLessThan(0.2);
    }
    for (let time = 2; time < 3.3; time += 0.025) {
        const active = words.find(word => word.t0 <= time && time < word.t1)!;
        expectInsideFrame(active, poseAt(time), aspect);
    }
    expect(poseAt(3.1)).not.toEqual(poseAt(2.1));
});
