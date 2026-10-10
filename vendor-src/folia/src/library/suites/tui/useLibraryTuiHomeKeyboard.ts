import { useEffect, useRef } from 'react';
import { hasBlockingWindow } from '../../../utils/keyboardTargets';

// src/library/suites/tui/useLibraryTuiHomeKeyboard.ts
// TUI 首页的按键。与集合视图同一套守卫（useLibraryTuiKeyboard）：只用不可打印键——可打印键归命令面板
// （打字即筛选目录），空格是全局的播放 / 暂停；输入框和按钮里的按键不算，上层窗口打开时不抢，
// Enter / Escape / Insert 不响应长按重复。
//
// 两层：页面级（来源与分区的切换、F2 平台列表，状态文字页也要能切走）与目录级（列表上的移动、展开、打开、批选、
// 播放），各自一个监听，只在可交互时装上。在线页签的平台列表（A6）替换目录时用它自己的一层（useLibraryTuiAccountListKeys）。

const isEditableTarget = (target: EventTarget | null) => (
    target instanceof HTMLElement
    && (target.isContentEditable || Boolean(target.closest('input, textarea, select')))
);

const isControlTarget = (target: EventTarget | null) => (
    target instanceof HTMLElement && Boolean(target.closest('button, a[href]'))
);

/** 处理一次按键的公共守卫；返回 false 时这次按键不归 TUI。 */
const claimsKey = (event: KeyboardEvent) => !isEditableTarget(event.target) && !hasBlockingWindow();

type LibraryTuiHomePageKeys = {
    isActive: boolean;
    /** 行内提示开着：Tab / F6 都不抢。 */
    isPromptOpen: boolean;
    /** Tab / Shift+Tab：下一个 / 上一个分区（在线来源的分区就是三个在线页签）。 */
    onCycleSection: (delta: 1 | -1) => void;
    /** F6 / Shift+F6：下一个 / 上一个来源（在线、本地、Navidrome，跳过不可用的）。 */
    onCycleSource: (delta: 1 | -1) => void;
    /** F2：打开 / 关上在线页签的平台列表（不在在线来源时先切过去）。 */
    onToggleAccounts?: () => void;
};

export const useLibraryTuiHomePageKeys = (handlers: LibraryTuiHomePageKeys) => {
    const latest = useRef(handlers);
    latest.current = handlers;

    useEffect(() => {
        if (!handlers.isActive) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            const current = latest.current;
            if (!claimsKey(event) || current.isPromptOpen) return;
            if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) {
                event.preventDefault();
                current.onCycleSection(event.shiftKey ? -1 : 1);
            } else if (event.key === 'F6') {
                event.preventDefault();
                current.onCycleSource(event.shiftKey ? -1 : 1);
            } else if (event.key === 'F2' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && current.onToggleAccounts) {
                if (event.repeat) return;
                event.preventDefault();
                current.onToggleAccounts();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handlers.isActive]);
};

type LibraryTuiDirectoryKeys = {
    isActive: boolean;
    /** 命令面板的筛选框正开着：Enter 归它。 */
    isFiltering: boolean;
    /** 行内提示开着：它自己处理 Enter / Escape，这里只让 Escape 关掉它。 */
    isPromptOpen: boolean;
    rowCount: number;
    pageSize: number;
    moveFocus: (resolve: (current: number) => number) => void;
    /** ←：折叠，已折叠或不可折叠时回到上一级。 */
    onCollapse: () => void;
    /** →：展开，已展开时进入第一个子项。 */
    onExpand: () => void;
    /** Enter：打开焦点条目（树节点是展开 / 折叠）。 */
    onOpenFocused: () => void;
    /** Insert：切换焦点条目的选中并下移（目录没有批量时由调用方忽略）。 */
    onToggleSelect: () => void;
    /** Ctrl+A：选中筛选出的全部条目。 */
    onSelectAll: () => void;
    /** Ctrl+Enter / Ctrl+Shift+Enter：播放 / 入队选中的（没有选中时是焦点条目的全部歌）。 */
    onPlayScope: (enqueue: boolean) => void;
    onEscape: () => void;
};

export const useLibraryTuiDirectoryKeys = (handlers: LibraryTuiDirectoryKeys) => {
    // 监听只装一次，回调每次渲染换成最新的。
    const latest = useRef(handlers);
    latest.current = handlers;

    useEffect(() => {
        if (!handlers.isActive) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const current = latest.current;
            if (!claimsKey(event)) return;

            if (event.key === 'Escape') {
                if (event.repeat) return;
                event.preventDefault();
                current.onEscape();
                return;
            }
            if (current.isPromptOpen || isControlTarget(event.target)) return;

            const last = Math.max(current.rowCount - 1, 0);
            const clamp = (index: number) => Math.max(0, Math.min(index, last));
            const ctrl = event.ctrlKey || event.metaKey;
            switch (event.key) {
                case 'ArrowDown':
                    current.moveFocus(index => clamp(index + 1));
                    break;
                case 'ArrowUp':
                    current.moveFocus(index => clamp(index - 1));
                    break;
                case 'PageDown':
                    current.moveFocus(index => clamp(index + current.pageSize));
                    break;
                case 'PageUp':
                    current.moveFocus(index => clamp(index - current.pageSize));
                    break;
                case 'Home':
                    current.moveFocus(() => 0);
                    break;
                case 'End':
                    current.moveFocus(() => last);
                    break;
                case 'ArrowLeft':
                    current.onCollapse();
                    break;
                case 'ArrowRight':
                    current.onExpand();
                    break;
                case 'Insert':
                    if (event.repeat) return;
                    current.onToggleSelect();
                    break;
                case 'a':
                case 'A':
                    // 只认 Ctrl+A；裸字母归命令面板。
                    if (!ctrl || event.altKey || event.shiftKey) return;
                    current.onSelectAll();
                    break;
                case 'Enter':
                    if (event.repeat || current.isFiltering) return;
                    if (ctrl) current.onPlayScope(event.shiftKey);
                    else if (!event.shiftKey && !event.altKey) current.onOpenFocused();
                    else return;
                    break;
                default:
                    return;
            }
            event.preventDefault();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handlers.isActive]);
};

type LibraryTuiAccountListKeys = {
    isActive: boolean;
    rowCount: number;
    moveFocus: (resolve: (current: number) => number) => void;
    /** Enter：选焦点平台（切换或登录）。 */
    onSelect: () => void;
    /** Delete：登出焦点平台（只有当前且已登录的平台会被接受，由调用方判定）。 */
    onLogout: () => void;
    /** Escape：关上平台列表（未登录时列表就是页签内容，不给）。 */
    onEscape?: () => void;
};

/** 在线页签的平台列表（A6）：↑↓ / Home / End 移动，Enter 选平台，Delete 登出，Esc 关上。守卫与目录同一套。 */
export const useLibraryTuiAccountListKeys = (handlers: LibraryTuiAccountListKeys) => {
    const latest = useRef(handlers);
    latest.current = handlers;

    useEffect(() => {
        if (!handlers.isActive) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            const current = latest.current;
            if (!claimsKey(event)) return;
            if (event.ctrlKey || event.altKey || event.metaKey) return;
            if (event.key === 'Escape') {
                if (event.repeat || !current.onEscape) return;
                event.preventDefault();
                current.onEscape();
                return;
            }
            if (isControlTarget(event.target)) return;
            const last = Math.max(current.rowCount - 1, 0);
            const clamp = (index: number) => Math.max(0, Math.min(index, last));
            switch (event.key) {
                case 'ArrowDown':
                    current.moveFocus(index => clamp(index + 1));
                    break;
                case 'ArrowUp':
                    current.moveFocus(index => clamp(index - 1));
                    break;
                case 'Home':
                    current.moveFocus(() => 0);
                    break;
                case 'End':
                    current.moveFocus(() => last);
                    break;
                case 'Enter':
                    if (event.repeat || event.shiftKey) return;
                    current.onSelect();
                    break;
                case 'Delete':
                    if (event.repeat) return;
                    current.onLogout();
                    break;
                default:
                    return;
            }
            event.preventDefault();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handlers.isActive]);
};
