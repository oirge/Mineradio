import { useEffect, useRef } from 'react';
import { hasBlockingWindow, isTextEntryTarget } from '../../../../utils/keyboardTargets';

// src/library/suites/grid/home/useGrid3DTabKeys.ts
// 网格首页的 Tab / Shift+Tab：在顶部胶囊的内容页签之间循环（与 TUI 首页的 Tab 同一个键）。只走可用的页签，
// Stage 与 Lattice 属于「去哪儿」，不入列。输入框里的 Tab 不抢，上层窗口打开时让路；长按不连发。

type Grid3DTabKeys = {
    isActive: boolean;
    /** Tab / Shift+Tab：下一个 / 上一个页签。 */
    onCycleTab: (delta: 1 | -1) => void;
};

export const useGrid3DTabKeys = (handlers: Grid3DTabKeys) => {
    const latest = useRef(handlers);
    latest.current = handlers;

    useEffect(() => {
        if (!handlers.isActive) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Tab' || event.ctrlKey || event.altKey || event.metaKey) return;
            if (isTextEntryTarget(event.target) || hasBlockingWindow()) return;
            event.preventDefault();
            if (event.repeat) return;
            latest.current.onCycleTab(event.shiftKey ? -1 : 1);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handlers.isActive]);
};
