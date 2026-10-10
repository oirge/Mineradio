// src/services/ponder/ponderActionUrl.ts
// 打开一章附带的外部链接（`PonderSceneAction` 的 openUrl）。
//
// 桌面端要走 Electron 的 openExternalUrl，否则链接会在应用窗口里导航掉整个应用；
// 浏览器端退回 window.open。这两条分支在 CoverTab 里已经存在一份，但那份是
// 「打开这首歌在来源平台的页面」的一部分，抽不出来，所以这里写第二份而不是去改它。

/** 在系统浏览器里打开 url；失败只记日志，教程不该因为一个链接崩掉。 */
export const openPonderActionUrl = (url: string): void => {
    const opened = window.electron?.openExternalUrl
        ? window.electron.openExternalUrl(url)
        : Promise.resolve(Boolean(window.open(url, '_blank', 'noopener,noreferrer')));

    void opened.catch((error: unknown) => {
        console.error('[ponder] Failed to open action url:', error);
    });
};
