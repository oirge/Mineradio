import { useEffect, useRef } from 'react';
import { hasBlockingWindow } from '../../../utils/keyboardTargets';

// src/library/suites/tui/useLibraryTuiKeyboard.ts
// TUI 的按键。只用不可打印键：只要注册了命令筛选，单字符键都归命令面板（打字即筛选），
// 空格又是全局的播放 / 暂停。守卫与网格一致：输入框和按钮里的按键不算，上层窗口打开时不抢，
// Enter / Escape / Delete 不响应长按重复（按住 Delete 不能一路删下去）。
// Enter 一族：Enter 播放、Shift+Enter 入队、Ctrl+Enter 播放全部、Ctrl+Shift+Enter 全部入队、
// Alt+Enter 打开焦点行的专辑、Alt+Shift+Enter 打开焦点行的歌手（与歌手页歌曲栏同一组键）。

type LibraryTuiKeyboardHandlers = {
    isActive: boolean;
    /** 命令面板的筛选框正开着：Enter 归它。 */
    isFiltering: boolean;
    /** 行内提示（改名、删除确认）开着：它自己处理 Enter / Escape，这里只让 Escape 关掉它，别的键都不抢。 */
    isPromptOpen: boolean;
    rowCount: number;
    pageSize: number;
    moveFocus: (resolve: (current: number) => number) => void;
    onPlayFocused: () => void;
    onEnqueueFocused: () => void;
    onPlayScope: () => void;
    onEnqueueScope: () => void;
    /** 删除（每日推荐是「不喜欢」）焦点条目；集合不支持时由调用方忽略。 */
    onDeleteFocused: () => void;
    /** Alt+Enter：打开焦点行的专辑（suite 没声明 open-album 或这一行打不开时由调用方忽略）。 */
    onOpenAlbumFocused?: () => void;
    /** Alt+Shift+Enter：打开焦点行上第一个能打开的歌手。 */
    onOpenArtistFocused?: () => void;
    onEscape: () => void;
};

const isEditableTarget = (target: EventTarget | null) => (
    target instanceof HTMLElement
    && (target.isContentEditable || Boolean(target.closest('input, textarea, select')))
);

const isControlTarget = (target: EventTarget | null) => (
    target instanceof HTMLElement && Boolean(target.closest('button, a[href]'))
);

export const useLibraryTuiKeyboard = (handlers: LibraryTuiKeyboardHandlers) => {
    // 监听只装一次，回调每次渲染换成最新的。
    const latest = useRef(handlers);
    latest.current = handlers;

    useEffect(() => {
        if (!handlers.isActive) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            const current = latest.current;
            if (isEditableTarget(event.target) || hasBlockingWindow()) return;

            if (event.key === 'Escape') {
                if (event.repeat) return;
                event.preventDefault();
                current.onEscape();
                return;
            }
            if (current.isPromptOpen || isControlTarget(event.target)) return;

            const last = Math.max(current.rowCount - 1, 0);
            const clamp = (index: number) => Math.max(0, Math.min(index, last));
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
                case 'Delete':
                    if (event.repeat || current.isFiltering) return;
                    current.onDeleteFocused();
                    break;
                case 'Enter':
                    if (event.repeat || current.isFiltering) return;
                    if (event.altKey) {
                        if (event.ctrlKey || event.metaKey) return;
                        if (event.shiftKey) current.onOpenArtistFocused?.();
                        else current.onOpenAlbumFocused?.();
                    } else if (event.ctrlKey || event.metaKey) {
                        if (event.shiftKey) current.onEnqueueScope();
                        else current.onPlayScope();
                    } else if (event.shiftKey) {
                        current.onEnqueueFocused();
                    } else {
                        current.onPlayFocused();
                    }
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
