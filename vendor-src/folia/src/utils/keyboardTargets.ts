// src/utils/keyboardTargets.ts
// 全局快捷键的两个通用守卫：正在打字吗、有没有窗口接管了键盘。
//
// 两者此前各有三份副本（usePlaybackInteractionBridge 内联一份 + 局部闭包一份、
// usePlayerPanelTabShortcut 一份、useCommandPalette 导出一份），彼此还不完全一致 ——
// bridge 那份内联判断漏了 <select>。集中到 utils 还有一个层次上的理由：
// isTextEntryTarget 原先导出自 useCommandPalette，而那个模块会拉进整个 commandRegistry，
// hooks 层去 import 它等于反向依赖组件层。

/**
 * 事件目标是不是正在接收文本输入。是的话，所有裸字母快捷键都必须让路。
 */
export const isTextEntryTarget = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) {
        return false;
    }

    const tagName = target.tagName.toLowerCase();
    return tagName === 'input'
        || tagName === 'textarea'
        || tagName === 'select'
        || target.isContentEditable;
};

/**
 * 当前有没有模态窗口声明自己接管了键盘。
 *
 * 用 DOM 属性而不是共享 state，是这个仓库既有的约定：每个模态自己挂
 * data-folia-keyboard-window="true"，全局热键查一次属性即可让路，不需要谁去订阅谁。
 */
export const hasBlockingWindow = () => Boolean(
    document.querySelector('[data-folia-keyboard-window="true"]')
);

/**
 * 把一次按键归一化成一个 "逻辑键码"（等价于 DOM 的 keyboard event code token）。
 *
 * 正常情况下直接返回 event.code —— 它与键盘布局无关，是全局快捷键判定的权威来源。
 * 但软件注入的按键（比如只带 wVk、不带扫描码的 SendInput）在 Chromium 里会拿到空的
 * event.code，只剩 event.key 有值。这时用 event.key 反推出等价的 code token，
 * 让所有统一走 event.code 的快捷键照样命中。加了这段兜底，物理键盘的行为零变化。
 */
export const effectiveKeyCode = (event: KeyboardEvent): string => {
    if (event.code) {
        return event.code;
    }

    const key = event.key;
    if (key.length === 1) {
        if (/[a-zA-Z]/.test(key)) {
            return `Key${key.toUpperCase()}`;
        }
        switch (key) {
            case ' ':
                return 'Space';
            case '[':
                return 'BracketLeft';
            case ']':
                return 'BracketRight';
            default:
                return '';
        }
    }
    // 命名键（Escape / ArrowLeft / Tab / Enter 等）的 key 与 code token 同名，直接用。
    return key;
};
