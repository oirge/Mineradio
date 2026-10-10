import { describe, expect, it, vi } from 'vitest';
import { anchorPointToPx, resolvePonderAnchors } from '@/utils/ponder/resolvePonderAnchors';
import type { PonderAnchorSource, PonderRect } from '@/types/ponder';

// test/unit/ponder/resolvePonderAnchors.test.ts
// readRect 是注入的，所以这里能在 node 环境下把三种锚点来源的换算全部验掉。
// 最要紧的两条：derived 成环必须抛而不是栈溢出，dom 取不到时宁可少画一个框也不画错位置的框。

const viewport = { width: 1000, height: 800 };

const resolve = (
    anchors: Record<string, PonderAnchorSource>,
    rects: Record<string, PonderRect> = {},
) => resolvePonderAnchors(anchors, {
    readRect: selector => rects[selector] ?? null,
    viewport,
});

const toggle: PonderRect = { left: 200, top: 300, width: 48, height: 48 };

describe('resolvePonderAnchors — dom', () => {
    it('量得到就直接用真实矩形', () => {
        const out = resolve({ toggle: { kind: 'dom', selector: '#t' } }, { '#t': toggle });
        expect(out.toggle).toEqual(toggle);
    });

    it('量不到且有 fallback 时退回 fallback', () => {
        const out = resolve({
            toggle: { kind: 'dom', selector: '#missing', fallback: { left: 0.5, top: 0.5, width: 0.1, height: 0.1 } },
        });
        expect(out.toggle).toEqual({ left: 500, top: 400, width: 100, height: 80 });
    });

    it('量不到又没有 fallback 时整个省略该锚点', () => {
        const out = resolve({ toggle: { kind: 'dom', selector: '#missing' } });
        expect(out).not.toHaveProperty('toggle');
    });
});

describe('resolvePonderAnchors — synthetic', () => {
    it('默认按左上角定位', () => {
        const out = resolve({ p: { kind: 'synthetic', rect: { left: 0.1, top: 0.2, width: 0.5, height: 0.25 } } });
        expect(out.p).toEqual({ left: 100, top: 160, width: 500, height: 200 });
    });

    it('anchorX center / anchorY bottom 改变 left/top 的含义', () => {
        const out = resolve({
            p: {
                kind: 'synthetic',
                rect: { left: 0.5, top: 1, width: 0.5, height: 0.25, anchorX: 'center', anchorY: 'bottom' },
            },
        });
        expect(out.p).toEqual({ left: 250, top: 600, width: 500, height: 200 });
    });

    it('anchorX right 把 left 当作右边界', () => {
        const out = resolve({
            p: { kind: 'synthetic', rect: { left: 1, top: 0, width: 0.2, height: 0.1, anchorX: 'right' } },
        });
        expect(out.p.left).toBe(800);
    });
});

describe('resolvePonderAnchors — derived', () => {
    it('expand 向左外扩：滑轨 = 按钮往左 48px', () => {
        const out = resolve({
            toggle: { kind: 'dom', selector: '#t' },
            track: { kind: 'derived', from: 'toggle', expand: { left: 48 } },
        }, { '#t': toggle });

        expect(out.track).toEqual({ left: 152, top: 300, width: 96, height: 48 });
    });

    it('at + size 只取一个点再画定尺寸的框：判定线在按钮左 36px', () => {
        const out = resolve({
            toggle: { kind: 'dom', selector: '#t' },
            threshold: {
                kind: 'derived',
                from: 'toggle',
                at: { anchor: 'toggle', x: 0.5, y: 0.5, offset: { x: -36 } },
                size: { width: 2, height: 56 },
            },
        }, { '#t': toggle });

        // 按钮中心 x = 224，左移 36 → 188；框宽 2 故 left = 187。
        expect(out.threshold).toEqual({ left: 187, top: 296, width: 2, height: 56 });
    });

    it('derived 可以链式引用 derived', () => {
        const out = resolve({
            toggle: { kind: 'dom', selector: '#t' },
            track: { kind: 'derived', from: 'toggle', expand: { left: 48 } },
            trackEdge: { kind: 'derived', from: 'track', expand: { right: 10 } },
        }, { '#t': toggle });

        expect(out.trackEdge.width).toBe(106);
    });

    it('base 解析不出来时该 derived 锚点也一并省略', () => {
        const out = resolve({
            toggle: { kind: 'dom', selector: '#missing' },
            track: { kind: 'derived', from: 'toggle', expand: { left: 48 } },
        });
        expect(out).toEqual({});
    });

    it('成环时抛错，而不是无声栈溢出', () => {
        expect(() => resolve({
            a: { kind: 'derived', from: 'b' },
            b: { kind: 'derived', from: 'a' },
        })).toThrow(/成环/);
    });

    it('from 指向不存在的锚点时省略，不抛', () => {
        const out = resolve({ a: { kind: 'derived', from: 'nope' } });
        expect(out).toEqual({});
    });

    it('每个 dom 锚点只量一次，即使被多个 derived 引用', () => {
        const readRect = vi.fn(() => toggle);
        resolvePonderAnchors({
            toggle: { kind: 'dom', selector: '#t' },
            a: { kind: 'derived', from: 'toggle', expand: { left: 10 } },
            b: { kind: 'derived', from: 'toggle', expand: { right: 10 } },
        }, { readRect, viewport });

        expect(readRect).toHaveBeenCalledTimes(1);
    });
});

describe('resolvePonderAnchors — relative', () => {
    it('在来源 surface 内按比例定位页面区域', () => {
        const out = resolve({
            page: { kind: 'synthetic', rect: { left: 0.1, top: 0.2, width: 0.8, height: 0.5 } },
            header: { kind: 'relative', from: 'page', rect: { left: 0.05, top: 0.04, width: 0.9, height: 0.12 } },
        });

        expect(out.header).toEqual({ left: 140, top: 176, width: 720, height: 48 });
    });

    // 下面三条对应合成界面里的 inset / aspect-square 写法：两边算得不一样，
    // 高亮就会落在真实元素旁边，这正是 relativeRectStyle 要避免的。
    it('right / bottom 从反方向贴边，和 CSS inset 同义', () => {
        const out = resolve({
            page: { kind: 'synthetic', rect: { left: 0, top: 0, width: 1, height: 1 } },
            corner: { kind: 'relative', from: 'page', rect: { right: 0.1, bottom: 0.2, width: 0.25, height: 0.3 } },
        });

        expect(out.corner).toEqual({ left: 650, top: 400, width: 250, height: 240 });
    });

    it('只给 left+right / top+bottom 时宽高由四边推出来', () => {
        const out = resolve({
            page: { kind: 'synthetic', rect: { left: 0, top: 0, width: 1, height: 1 } },
            inset: { kind: 'relative', from: 'page', rect: { left: 0.1, right: 0.1, top: 0.25, bottom: 0.25 } },
        });

        expect(out.inset).toEqual({ left: 100, top: 200, width: 800, height: 400 });
    });

    it('square 把宽度原样当高度，拿到的是像素意义上的正方形', () => {
        const out = resolve({
            page: { kind: 'synthetic', rect: { left: 0, top: 0, width: 1, height: 1 } },
            button: { kind: 'relative', from: 'page', rect: { left: 0.05, top: 0.05, width: 0.1, square: true } },
        });

        expect(out.button).toEqual({ left: 50, top: 40, width: 100, height: 100 });
    });

    it('aspect 按像素宽度推高度，和同宽比例的 square 同高', () => {
        const out = resolve({
            page: { kind: 'synthetic', rect: { left: 0, top: 0, width: 1, height: 1 } },
            button: { kind: 'relative', from: 'page', rect: { right: 0.03, bottom: 0.05, width: 0.1, square: true } },
            track: { kind: 'relative', from: 'page', rect: { right: 0.03, bottom: 0.05, width: 0.2, aspect: 0.5 } },
        });

        expect(out.track.height).toBe(out.button.height);
        expect(out.track.top).toBe(out.button.top);
    });

    it('相对锚点可以再挂在相对锚点上', () => {
        const out = resolve({
            page: { kind: 'synthetic', rect: { left: 0, top: 0, width: 1, height: 1 } },
            wall: { kind: 'relative', from: 'page', rect: { left: 0.1, top: 0.1, width: 0.8, height: 0.8 } },
            poster: { kind: 'relative', from: 'wall', rect: { left: 0.25, top: 0.5, width: 0.2, height: 0.25 } },
        });

        expect(out.poster).toEqual({ left: 300, top: 400, width: 160, height: 160 });
    });
});

describe('anchorPointToPx', () => {
    it('默认取中心', () => {
        expect(anchorPointToPx({ anchor: 't' }, { t: toggle })).toEqual({ x: 224, y: 324 });
    });

    it('归一化坐标 + 像素偏移叠加', () => {
        expect(anchorPointToPx({ anchor: 't', x: 0, y: 1, offset: { x: -4, y: 6 } }, { t: toggle }))
            .toEqual({ x: 196, y: 354 });
    });

    it('锚点不存在时返回 null', () => {
        expect(anchorPointToPx({ anchor: 'nope' }, { t: toggle })).toBeNull();
    });
});
