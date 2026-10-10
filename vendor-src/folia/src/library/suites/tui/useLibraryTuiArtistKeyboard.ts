import { useEffect, useRef } from 'react';
import { hasBlockingWindow } from '../../../utils/keyboardTargets';

// src/library/suites/tui/useLibraryTuiArtistKeyboard.ts
// TUI 歌手页的按键。与集合视图同一套约定：只用不可打印键（单字符键归命令面板，打字即筛选；空格是全局播放 / 暂停），
// 输入框和按钮里的按键不算，上层窗口（宿主的实体编辑对话框等）打开时不抢，Enter / Escape 不响应长按重复。
// Tab / Shift+Tab 在热门歌曲与专辑两栏之间切换；Enter 在歌曲栏播放、在专辑栏打开专辑；Shift+Enter 把焦点歌曲入队；
// Ctrl+Enter 播放全部热门歌曲，Ctrl+Shift+Enter 把热门歌曲加入队列（两栏都可以）；歌曲栏里 Alt+Enter 打开焦点歌曲的专辑、
// Alt+Shift+Enter 打开它的（第一个能打开的）歌手（与集合视图同一组键）。

type LibraryTuiArtistKeyboardHandlers = {
    isActive: boolean;
    /** 命令面板的筛选框正开着：Enter 归它。 */
    isFiltering: boolean;
    rowCount: number;
    pageSize: number;
    moveFocus: (resolve: (current: number) => number) => void;
    onTogglePane: () => void;
    /** 歌曲栏：播放焦点歌曲；专辑栏：打开焦点专辑。 */
    onActivateFocused: () => void;
    /** 歌曲栏：焦点歌曲入队（专辑栏忽略）。 */
    onEnqueueFocused: () => void;
    onPlayScope: () => void;
    onEnqueueScope: () => void;
    /** Alt+Enter：歌曲栏里打开焦点歌曲的专辑（专辑栏忽略）。 */
    onOpenAlbumFocused?: () => void;
    /** Alt+Shift+Enter：歌曲栏里打开焦点歌曲上第一个能打开的歌手。 */
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

export const useLibraryTuiArtistKeyboard = (handlers: LibraryTuiArtistKeyboardHandlers) => {
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
            // Tab 在按钮上也切栏（否则点过一个链接之后 Tab 就跑去浏览器的焦点顺序了）。
            if (event.key === 'Tab' && !event.ctrlKey && !event.altKey && !event.metaKey) {
                event.preventDefault();
                current.onTogglePane();
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
                        current.onActivateFocused();
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
