import { describe, expect, it } from 'vitest';
import { shouldOfferPonderHint } from '@/utils/ponder/ponderHintGate';
import type { PonderHintVisibility } from '@/types/ponder';

// test/unit/ponder/ponderHintGate.test.ts
// 三档可见性的完整行为矩阵。这是整套 UX 里唯一一处策略判断，其余都是机械动作，
// 所以它值得被穷举而不是抽查。

const gate = (over: Partial<Parameters<typeof shouldOfferPonderHint>[0]> = {}) =>
    shouldOfferPonderHint({
        visibility: 'always',
        targetId: 'panel-slide',
        seenIds: new Set<string>(),
        hasBlockingWindow: false,
        supportsFinePointer: true,
        ...over,
    });

describe('shouldOfferPonderHint', () => {
    it('always：看过与否都提示', () => {
        expect(gate()).toBe(true);
        expect(gate({ seenIds: new Set(['panel-slide']) })).toBe(true);
    });

    it('unseen：只对没看过的提示', () => {
        expect(gate({ visibility: 'unseen' })).toBe(true);
        expect(gate({ visibility: 'unseen', seenIds: new Set(['panel-slide']) })).toBe(false);
    });

    it('unseen：别的 target 看过不影响这个', () => {
        expect(gate({ visibility: 'unseen', seenIds: new Set(['player-bar']) })).toBe(true);
    });

    it('off：任何情况都不提示', () => {
        (['always', 'unseen', 'off'] as PonderHintVisibility[]).forEach(visibility => {
            expect(gate({ visibility, supportsFinePointer: false })).toBe(false);
        });
        expect(gate({ visibility: 'off' })).toBe(false);
    });

    it('粗指针下不提示：跟随光标的胶囊对触屏没有意义', () => {
        expect(gate({ supportsFinePointer: false })).toBe(false);
    });

    it('有模态窗口时默认不提示', () => {
        expect(gate({ hasBlockingWindow: true })).toBe(false);
    });

    it('但 target 就在那个模态内部时放行（命令面板的问号按钮）', () => {
        expect(gate({
            targetId: 'player-bar',
            hasBlockingWindow: true,
            isInsideBlockingWindow: true,
        })).toBe(true);
    });

    it('模态内的例外不能盖过 off 和 unseen 已看过', () => {
        expect(gate({ visibility: 'off', hasBlockingWindow: true, isInsideBlockingWindow: true })).toBe(false);
        expect(gate({
            visibility: 'unseen',
            targetId: 'player-bar',
            seenIds: new Set(['player-bar']),
            hasBlockingWindow: true,
            isInsideBlockingWindow: true,
        })).toBe(false);
    });
});
