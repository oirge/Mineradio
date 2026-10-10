import type { PonderAnchorPoint, PonderAnchorSource, PonderRect, PonderRelativeRect, PonderViewportRect } from '../../types/ponder';

// src/utils/ponder/resolvePonderAnchors.ts
// 把场景声明的锚点解析成视口坐标的矩形集。
//
// readRect 是注入进来的，不直接调 getBoundingClientRect —— 一来 vitest 跑在 node 环境，
// 二来「进入瞬间只采一次」这条约束靠调用方控制采样时机，这里只负责换算。
//
// @note 采样时机上有一条隐含不变量：panel-toggle 外层是个 240ms 的入场动画 motion.div，
// 动画期间量到的 rect 带着 transform，是错的。悬停 600ms + 长按 400ms ≥ 1000ms 保证了
// 采样必然发生在动画结束之后 —— 这不是巧合，改这两个时长时要一并考虑。

type ResolveContext = {
    /** 取不到元素返回 null。 */
    readRect: (selector: string) => PonderRect | null;
    viewport: { width: number; height: number };
};

/** 比例矩形 → px 矩形。anchorX/anchorY 决定 left/top 被当成哪条边。 */
const viewportRectToPx = (rect: PonderViewportRect, viewport: ResolveContext['viewport']): PonderRect => {
    const width = rect.width * viewport.width;
    // aspect 锁死形状：高度由宽度算，不再跟着视口高度变。
    const height = rect.aspect !== undefined ? width * rect.aspect : rect.height * viewport.height;
    const anchoredLeft = rect.left * viewport.width;
    const anchoredTop = rect.top * viewport.height;

    const left = rect.anchorX === 'center' ? anchoredLeft - width / 2
        : rect.anchorX === 'right' ? anchoredLeft - width
        : anchoredLeft;
    const top = rect.anchorY === 'center' ? anchoredTop - height / 2
        : rect.anchorY === 'bottom' ? anchoredTop - height
        : anchoredTop;

    return { left, top, width, height };
};

/**
 * 相对矩形 → px 矩形。
 *
 * 水平和垂直各自从 left/right/width、top/bottom/height 里取到两个约束，缺的那个推出来；
 * square 先定宽再把宽度原样当高度用，aspect 按宽度乘一个比例。这几种写法和 CSS 的
 * inset / aspect-square / aspect-ratio 一一对应，所以合成界面和锚点可以直接共用同一条记录。
 */
export const relativeRectToPx = (base: PonderRect, rect: PonderRelativeRect): PonderRect => {
    const width = rect.width !== undefined
        ? base.width * rect.width
        : base.width * (1 - (rect.left ?? 0) - (rect.right ?? 0));
    const height = rect.square ? width
        : rect.aspect !== undefined ? width * rect.aspect
        : rect.height !== undefined ? base.height * rect.height
        : base.height * (1 - (rect.top ?? 0) - (rect.bottom ?? 0));
    const left = rect.left !== undefined
        ? base.left + base.width * rect.left
        : base.left + base.width * (1 - (rect.right ?? 0)) - width;
    const top = rect.top !== undefined
        ? base.top + base.height * rect.top
        : base.top + base.height * (1 - (rect.bottom ?? 0)) - height;
    return { left, top, width, height };
};

/** 锚点 → 视口 px 坐标。光标落点、字幕挂点都走它。 */
export const anchorPointToPx = (
    point: PonderAnchorPoint,
    rects: Record<string, PonderRect>,
): { x: number; y: number } | null => {
    const rect = rects[point.anchor];
    if (!rect) {
        return null;
    }
    return {
        x: rect.left + rect.width * (point.x ?? 0.5) + (point.offset?.x ?? 0),
        y: rect.top + rect.height * (point.y ?? 0.5) + (point.offset?.y ?? 0),
    };
};

/**
 * 解析一整组锚点。derived 之间可以互相引用，按需递归并检测环。
 *
 * 取不到的 dom 锚点有 fallback 就退回 fallback，没有就整个省略 —— 骨架少一个框，
 * 好过画一个位置错误的框。
 */
export const resolvePonderAnchors = (
    anchors: Record<string, PonderAnchorSource>,
    { readRect, viewport }: ResolveContext,
): Record<string, PonderRect> => {
    const resolved: Record<string, PonderRect> = {};
    const visiting = new Set<string>();

    const resolveOne = (name: string): PonderRect | null => {
        if (name in resolved) {
            return resolved[name];
        }
        if (visiting.has(name)) {
            throw new Error(`[ponder] derived 锚点成环：${[...visiting, name].join(' -> ')}`);
        }

        const source = anchors[name];
        if (!source) {
            return null;
        }

        visiting.add(name);
        let rect: PonderRect | null = null;

        if (source.kind === 'dom') {
            rect = readRect(source.selector)
                ?? (source.fallback ? viewportRectToPx(source.fallback, viewport) : null);
        } else if (source.kind === 'synthetic') {
            rect = viewportRectToPx(source.rect, viewport);
        } else if (source.kind === 'relative') {
            const base = resolveOne(source.from);
            if (base) {
                rect = relativeRectToPx(base, source.rect);
            }
        } else {
            const base = resolveOne(source.from);
            if (base) {
                if (source.at && source.size) {
                    const point = anchorPointToPx(source.at, { ...resolved, [source.from]: base });
                    rect = point
                        ? {
                            left: point.x - source.size.width / 2,
                            top: point.y - source.size.height / 2,
                            width: source.size.width,
                            height: source.size.height,
                        }
                        : null;
                } else {
                    const expand = source.expand ?? {};
                    const left = expand.left ?? 0;
                    const right = expand.right ?? 0;
                    const top = expand.top ?? 0;
                    const bottom = expand.bottom ?? 0;
                    rect = {
                        left: base.left - left,
                        top: base.top - top,
                        width: base.width + left + right,
                        height: base.height + top + bottom,
                        // 外扩出来的框沿用来源的圆角：滑轨是按钮往左长出来的，形状同源。
                        ...(base.radius ? { radius: base.radius } : {}),
                    };
                }
            }
        }

        visiting.delete(name);
        if (rect) {
            // 声明的圆角优先于量到的：synthetic 锚点没有可量的对象，胶囊得自己说自己是胶囊。
            resolved[name] = source.radius ? { ...rect, radius: source.radius } : rect;
        }
        return rect;
    };

    Object.keys(anchors).forEach(resolveOne);
    return resolved;
};
