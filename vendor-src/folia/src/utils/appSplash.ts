// src/utils/appSplash.ts
// 控制 index.html 内联的首屏加载遮罩：React 挂载后淡出，动画结束再从 DOM 摘掉。

const SPLASH_ELEMENT_ID = 'app-splash';
// 与 index.html 中 #app-splash 的 transition 时长保持一致。
const FADE_OUT_MS = 320;

// 淡出并移除首屏加载遮罩；遮罩不存在（OBS 源已提前移除、或已经调用过）时是空操作。
export const hideAppSplash = (): void => {
    const splash = document.getElementById(SPLASH_ELEMENT_ID);
    if (!splash) {
        return;
    }
    splash.classList.add('is-hiding');
    window.setTimeout(() => splash.remove(), FADE_OUT_MS);
};
