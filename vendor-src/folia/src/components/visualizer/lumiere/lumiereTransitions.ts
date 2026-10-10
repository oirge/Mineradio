// Copyright (c) 2026 chthollyphile
import type { LumiereTransitionKind } from './program';
import { LUMIERE_TRANSITION_KINDS } from './program';

// src/components/visualizer/lumiere/lumiereTransitions.ts
// 绘光的段落转场：熄灯 lights-out、闪白 flare-cut、拉焦 focus-pull。光学感主要在场景内部做（熄灯时场景自己
// 在转场窗口里收光、开场星落），外层只配一个简单的帧：熄灯 = 透明度；闪白 = 轻微放大 + 模糊的峰值落在边界；
// 拉焦 = 模糊出、模糊入。lumisynth 里这一帧由内核套在单元容器上，folia 没有内核，由运行时按同样的规则套：
//   - 出场：transitionOut 窗口里对旧段落的容器套 resolveFrame('exit', 进度)；
//   - 进场：边界之后 enterDuration 秒（上一段转场窗口的长度钳在 enterClamp）里对新段落的容器套 resolveFrame('enter', 进度)；
//   运行时也可以简化成两段交叉渐变，只要熄灯的收光（场景的 fadeOut）照常生效。

export interface LumiereTransitionFrame {
    alpha: number;
    scale: number;
    /** 模糊强度（逻辑像素，Pixi BlurFilter 的 strength）。 */
    blur: number;
}

export interface LumiereTransitionDef {
    kind: LumiereTransitionKind;
    label: string;
    /** 段落边界处的时长；gap 为两段之间的空隙（下一段开始 − 这一段最后一行唱完）。 */
    duration: (gap: number) => number;
    /** 边界之后进入阶段时长的钳制（进入时长 = 上一段转场窗口的长度钳在这个区间里）。 */
    enterClamp: [number, number];
    /** exit：0 → 1 走向边界；enter：0 → 1 离开边界。 */
    resolveFrame: (phase: 'enter' | 'exit', progress: number) => LumiereTransitionFrame;
}

const smooth = (value: number) => {
    const t = Math.min(1, Math.max(0, value));
    return t * t * (3 - 2 * t);
};

const LABELS: Record<LumiereTransitionKind, string> = { 'lights-out': '熄灯', 'flare-cut': '闪白', 'focus-pull': '拉焦' };

export const LUMIERE_TRANSITIONS: Record<LumiereTransitionKind, LumiereTransitionDef> = Object.fromEntries(
    LUMIERE_TRANSITION_KINDS.map(kind => [kind, {
        kind,
        label: LABELS[kind],
        duration: (gap: number) => (kind === 'focus-pull'
            ? Math.min(0.6, Math.max(0.35, gap > 0 ? gap * 0.5 : 0.45))
            : Math.min(1.1, Math.max(0.5, gap > 0 ? gap * 0.6 : 0.8))),
        enterClamp: kind === 'focus-pull' ? [0.3, 0.6] : [0.4, 0.9],
        resolveFrame: (phase: 'enter' | 'exit', progress: number): LumiereTransitionFrame => {
            // 越靠近边界 near 越大。
            const near = phase === 'exit' ? smooth(progress) : 1 - smooth(progress);
            if (kind === 'lights-out') return { alpha: 1 - near, scale: 1, blur: 0 };
            if (kind === 'flare-cut') return { scale: 1 + 0.03 * near, blur: 7 * near * near, alpha: 1 - 0.35 * near * near };
            return { alpha: 1, blur: 12 * near, scale: 1 + 0.015 * near };
        },
    } satisfies LumiereTransitionDef]),
) as Record<LumiereTransitionKind, LumiereTransitionDef>;

/** 进入阶段的时长：上一段 transitionOut 窗口（startTime..endTime）的长度钳在转场的 enterClamp 里。 */
export const resolveLumiereEnterDuration = (kind: LumiereTransitionKind, startTime: number, endTime: number) => {
    const [min, max] = LUMIERE_TRANSITIONS[kind].enterClamp;
    return Math.max(min, Math.min(max, endTime - startTime));
};

/** 选转场：不与这个模式上一次选的相同，按 (seed, 段落序号) 散列确定。 */
export const chooseLumiereTransition = (seed: string, paragraphIndex: number, previous: LumiereTransitionKind | null): LumiereTransitionKind => {
    const choices = LUMIERE_TRANSITION_KINDS.filter(kind => kind !== previous);
    let hash = 0;
    for (const char of `${seed}:${paragraphIndex}:transition`) hash = (hash * 31 + char.charCodeAt(0)) | 0;
    return choices[Math.abs(hash) % choices.length]!;
};
