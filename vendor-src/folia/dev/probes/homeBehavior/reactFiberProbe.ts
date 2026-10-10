// dev/probes/homeBehavior/reactFiberProbe.ts
// 读 React fiber 树的探针工具（只在探针里用，生产代码不依赖它）。
//
// 为什么要读 fiber：P3.0 的首页还没有任何 headless 模型——条目列表、隐藏过滤、GridMap 的筛选结果与批选
// 都是组件内部状态，滑条又是窗口化渲染（DOM 里只有焦点附近的几张卡）。探针因此从已提交的 fiber 上读
// 「界面交给叶子组件的 props」：DesktopGrid3DSurface 的 items、Grid3DSlider 的可见 items、GridMap 交给
// SidePanelList 的 displayItems、GridMapBatchPanel 的 context。调用的也是这些 props 里的回调（与点击走同
// 一个函数），所以它驱动的就是界面本身。P3.1 之后目录有了 core 模型，probe API 的实现改为读模型，签名不变。

export type ProbeFiber = {
    tag: number;
    type: unknown;
    elementType: unknown;
    memoizedProps: Record<string, unknown> | null;
    stateNode: unknown;
    child: ProbeFiber | null;
    sibling: ProbeFiber | null;
    return: ProbeFiber | null;
};

const HOST_COMPONENT_TAG = 5;

/** gallery 的 React root 当前已提交的那棵树（HostRoot fiber）。 */
export const currentRootFiber = (): ProbeFiber | null => {
    const container = document.getElementById('root');
    if (!container) return null;
    const key = Object.keys(container).find(candidate => candidate.startsWith('__reactContainer$'));
    if (!key) return null;
    const hostRoot = (container as unknown as Record<string, ProbeFiber>)[key];
    const fiberRoot = hostRoot?.stateNode as { current?: ProbeFiber } | null;
    return fiberRoot?.current ?? hostRoot ?? null;
};

/** 组件身份比较：普通组件看 type，memo / forwardRef 包装看 elementType 或内层 type。 */
export const isComponentFiber = (fiber: ProbeFiber, component: unknown): boolean => (
    fiber.type === component
    || fiber.elementType === component
    || (typeof fiber.type === 'object' && fiber.type !== null && (fiber.type as { type?: unknown }).type === component)
);

/** 先序遍历 `from` 的子树（含自身），返回满足条件的 fiber。 */
export const findFibers = (from: ProbeFiber | null, predicate: (fiber: ProbeFiber) => boolean): ProbeFiber[] => {
    if (!from) return [];
    const found: ProbeFiber[] = [];
    const stack: ProbeFiber[] = [from];
    while (stack.length > 0) {
        const fiber = stack.pop()!;
        if (predicate(fiber)) found.push(fiber);
        // 子树的兄弟节点只在子树根以下展开：根自己的 sibling 不属于这棵子树。
        if (fiber !== from && fiber.sibling) stack.push(fiber.sibling);
        if (fiber.child) stack.push(fiber.child);
    }
    return found;
};

/**
 * AnimatePresence 里正在退场的子树仍在 fiber 树上（PresenceChild 的 isPresent 为 false），
 * 例如刚关掉的 GridMap。沿祖先找最近的 PresenceChild，判断这棵子树是不是「在场」。
 */
export const isFiberPresent = (fiber: ProbeFiber): boolean => {
    let current: ProbeFiber | null = fiber.return;
    while (current) {
        const props = current.memoizedProps;
        if (props && typeof props === 'object' && 'isPresent' in props && 'onExitComplete' in props) {
            return props.isPresent !== false;
        }
        current = current.return;
    }
    return true;
};

/** 某个组件在场的实例（退场中的不算），按树序。 */
export const findPresentComponents = (component: unknown, from: ProbeFiber | null = currentRootFiber()): ProbeFiber[] => (
    findFibers(from, fiber => isComponentFiber(fiber, component)).filter(isFiberPresent)
);

export const findPresentComponent = (component: unknown, from?: ProbeFiber | null): ProbeFiber | null => (
    findPresentComponents(component, from === undefined ? currentRootFiber() : from)[0] ?? null
);

/** 组件实例渲染出的第一个 DOM 元素。 */
export const firstHostElement = (fiber: ProbeFiber | null): HTMLElement | null => {
    const host = findFibers(fiber, candidate => candidate.tag === HOST_COMPONENT_TAG && candidate.stateNode instanceof HTMLElement)[0];
    return (host?.stateNode as HTMLElement | undefined) ?? null;
};

export const propsOf = <T>(fiber: ProbeFiber | null): T | null => (fiber?.memoizedProps as T | null) ?? null;
