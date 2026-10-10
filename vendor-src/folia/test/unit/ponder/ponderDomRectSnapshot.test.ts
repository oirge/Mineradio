import { describe, expect, it, vi } from 'vitest';
import { refreshPonderDomRectSnapshot } from '@/utils/ponder/ponderDomRectSnapshot';
import type { PonderRect, PonderSceneScript } from '@/types/ponder';

// test/unit/ponder/ponderDomRectSnapshot.test.ts
// Hover-only DOM may disappear after the tutorial overlay opens; its last measurable geometry stays usable.

const rect = (left: number): PonderRect => ({ left, top: 20, width: 40, height: 24 });

const scenes: PonderSceneScript[] = [
    {
        id: 'one',
        titleKey: 'one',
        anchors: {
            bar: { kind: 'dom', selector: '[data-bar]' },
            slots: { kind: 'dom', selector: '[data-slots]' },
        },
        steps: [{ kind: 'pause', id: 'wait', keyframe: true }],
    },
    {
        id: 'two',
        titleKey: 'two',
        anchors: {
            // Repeated selectors across chapters are measured only once per refresh.
            slots: { kind: 'dom', selector: '[data-slots]' },
        },
        steps: [{ kind: 'pause', id: 'wait', keyframe: true }],
    },
];

describe('refreshPonderDomRectSnapshot', () => {
    it('一次捕获目标所有章节的 DOM 锚点且去重', () => {
        const readRect = vi.fn((selector: string) => selector === '[data-bar]' ? rect(10) : rect(80));

        expect(refreshPonderDomRectSnapshot(scenes, readRect)).toEqual({
            '[data-bar]': rect(10),
            '[data-slots]': rect(80),
        });
        expect(readRect).toHaveBeenCalledTimes(2);
    });

    it('底栏折叠后保留上一次能量到的槽位', () => {
        const previous = { '[data-bar]': rect(10), '[data-slots]': rect(80) };
        const readRect = (selector: string) => selector === '[data-bar]' ? rect(12) : null;

        expect(refreshPonderDomRectSnapshot(scenes, readRect, previous)).toEqual({
            '[data-bar]': rect(12),
            '[data-slots]': rect(80),
        });
    });
});
