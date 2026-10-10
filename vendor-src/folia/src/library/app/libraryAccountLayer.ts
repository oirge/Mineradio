import type { LibraryAccountLayerSource } from '../core/contracts/account';

// src/library/app/libraryAccountLayer.ts
// 账户界面（登录弹窗）的挂载位置：首页外壳持有一个，首页 surface 可以经 accountLayerRef 把自己层叠上下文里的
// 一个元素交上来，账户宿主就把登录弹窗 portal 进去。网格首页把它放在平台切换器之前，所以切换器仍盖在登录弹窗
// 之上、弹窗开着时也能点（与登录弹窗还长在 Grid3D 里时一样）；surface 没交元素时宿主就地渲染。
// 只有宿主订阅它：元素换了只让宿主重渲染，首页外壳不因此多渲染一次。
// A5 起宿主把它（只读的一面，LibraryAccountLayerSource）交给按 suite 解析出的 account surface，portal 位置由 suite 决定。

export type LibraryAccountLayer = LibraryAccountLayerSource & {
    /** 交给首页 surface 的 ref 回调（身份永久不变）。 */
    attach: (element: HTMLElement | null) => void;
};

export const createLibraryAccountLayer = (): LibraryAccountLayer => {
    let element: HTMLElement | null = null;
    const listeners = new Set<() => void>();
    return {
        attach: next => {
            if (next === element) return;
            element = next;
            for (const listener of [...listeners]) listener();
        },
        getElement: () => element,
        subscribe: listener => {
            listeners.add(listener);
            return () => { listeners.delete(listener); };
        },
    };
};
