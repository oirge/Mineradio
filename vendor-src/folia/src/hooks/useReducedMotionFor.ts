import {
    resolveReducedMotion,
    useMotionSettingsStore,
    type MotionSurfaceId,
} from '../stores/useMotionSettingsStore';

// src/hooks/useReducedMotionFor.ts
// 组件读「我这一面要不要降级」的唯一入口。
//
// 替代了散落在各处的 framer-motion `useReducedMotion()` 和裸 `matchMedia` 调用：那些写法把
// 系统偏好直接焊死在组件里，用户无从覆盖（issue #370）。改完之后组件代码里不应再出现
// `prefers-reduced-motion` 字样，只有 useMotionSettingsStore 认识那条 media query。
// 纯 CSS 的动效读 `<html data-reduce-motion>`，那个属性由 store 自己同步，不经过这里。

/** 订阅某个动效面的降级状态，随设置和系统偏好变化重渲染。 */
export const useReducedMotionFor = (surface: MotionSurfaceId): boolean => (
    useMotionSettingsStore(state => resolveReducedMotion(state, surface))
);

export default useReducedMotionFor;
