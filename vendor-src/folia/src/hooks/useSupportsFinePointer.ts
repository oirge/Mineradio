import { useMediaQuery } from './useMediaQuery';

// src/hooks/useSupportsFinePointer.ts
// 「主指针是鼠标/触控板」这一条判断的唯一出处。思索的悬停提示、Ctrl+G 说明和触屏灯泡
// 都按它分流，保证同一台机器上不会一边出悬停胶囊、一边又当成触屏。
//
// 用主指针（pointer / hover），不用 any-pointer：any-pointer 只要系统里挂着任何一个粗指针
// 设备就成立，带触屏的笔记本、被报成粗指针的数位板都会把桌面误判成触屏；反过来
// 浏览器没识别出触屏时，触屏设备又会被当成桌面。

export const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

/** 主指针能悬停且精确时为 true，此时键盘入口（悬停提示、Ctrl+G）才讲得通。 */
export const useSupportsFinePointer = (): boolean => useMediaQuery(FINE_POINTER_QUERY);
