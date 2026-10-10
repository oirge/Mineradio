import { createContext, useContext } from 'react';

// src/components/floating-player/PlayerBottomBarLayoutContext.ts
// 标记「当前这棵子树是否处于播放页的底栏环境」。

/**
 * 默认 false，因为共享的字幕层不只长在播放页上：VisPlayground、Theme Park 预览和
 * OBS 浏览器源都会渲染同一个组件，它们没有底栏，也就不该被底栏的偏移量和隐藏状态牵动。
 * 只有 App 里播放页那棵树显式 Provider 成 true。
 */
export const PlayerBottomBarLayoutContext = createContext(false);

export const useIsPlayerBottomBarHost = (): boolean => useContext(PlayerBottomBarLayoutContext);
