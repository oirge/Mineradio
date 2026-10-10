// Copyright (c) 2026 chthollyphile
import { findLumiereParagraphIndexAtTime, type LumiereProgram } from './lumiereProgram';
import { LUMIERE_TRANSITIONS, resolveLumiereEnterDuration } from './lumiereTransitions';

// src/components/visualizer/lumiere/lumiereSceneFrames.ts
// 某一时刻哪些段落场景在画、各自套什么帧（透明度 / 缩放 / 模糊）。纯函数，只由 program 与时间决定。
//
// 段落首尾相接，所以任何时刻只有「当前段落」一个场景，外加边界之后的进入窗口里正在退出的上一段：
//   - 出场窗口（transitionOut.startTime..边界）：当前段套 resolveFrame('exit')。熄灯 lights-out 例外，
//     它的变暗交给场景自己的 fadeOut（光、线稿、字全熄，暗场底留着）——外层再压透明度，亮色主题下会把
//     folia 的亮背景露出来，熄灯反倒成了闪白。
//   - 进入窗口（边界之后 resolveLumiereEnterDuration 秒）：新段套 resolveFrame('enter')，同时与停在出场
//     终点帧的上一段交叉渐变，边界两侧的画面是连续的，没有硬切。

export interface LumiereLayerFrame {
    /** 段落序号。 */
    index: number;
    alpha: number;
    scale: number;
    /** 模糊强度（逻辑像素，BlurFilter strength）。 */
    blur: number;
}

export interface LumiereSceneFrames {
    /** 当前段落（场景缓存以它为中心）。 */
    activeIndex: number;
    /** 从下往上画的层；通常一个，进入窗口里两个（上一段在下）。 */
    layers: LumiereLayerFrame[];
}

const smooth = (value: number) => {
    const t = Math.min(1, Math.max(0, value));
    return t * t * (3 - 2 * t);
};

const exitFrameOf = (program: LumiereProgram, index: number, time: number) => {
    const out = program.paragraphs[index]?.transitionOut;
    if (!out || time < out.startTime) return { alpha: 1, scale: 1, blur: 0 };
    const progress = (time - out.startTime) / Math.max(out.endTime - out.startTime, 1e-3);
    const frame = LUMIERE_TRANSITIONS[out.kind].resolveFrame('exit', progress);
    return out.kind === 'lights-out' ? { ...frame, alpha: 1 } : frame;
};

/**
 * transitionsEnabled 为 false（静态模式）时段落之间硬切。没有段落时 layers 为空。
 */
export const resolveLumiereSceneFrames = (
    program: LumiereProgram,
    time: number,
    transitionsEnabled: boolean,
): LumiereSceneFrames => {
    if (program.paragraphs.length === 0) return { activeIndex: -1, layers: [] };
    const activeIndex = findLumiereParagraphIndexAtTime(program, time);
    if (!transitionsEnabled) {
        return { activeIndex, layers: [{ index: activeIndex, alpha: 1, scale: 1, blur: 0 }] };
    }
    const paragraph = program.paragraphs[activeIndex]!;
    const current = exitFrameOf(program, activeIndex, time);
    const layers: LumiereLayerFrame[] = [];

    const previousOut = activeIndex > 0 ? program.paragraphs[activeIndex - 1]!.transitionOut : null;
    if (previousOut) {
        const enterDuration = resolveLumiereEnterDuration(previousOut.kind, previousOut.startTime, previousOut.endTime);
        const progress = (time - paragraph.startTime) / enterDuration;
        if (progress >= 0 && progress < 1) {
            const enter = LUMIERE_TRANSITIONS[previousOut.kind].resolveFrame('enter', progress);
            const weight = smooth(progress);
            // 上一段停在出场终点那一帧，随进入进度淡掉。
            const peak = exitFrameOf(program, activeIndex - 1, previousOut.endTime);
            if (peak.alpha * (1 - weight) > 0.002) {
                layers.push({ index: activeIndex - 1, alpha: peak.alpha * (1 - weight), scale: peak.scale, blur: peak.blur });
            }
            layers.push({
                index: activeIndex,
                alpha: Math.min(enter.alpha, weight) * current.alpha,
                scale: enter.scale * current.scale,
                blur: Math.max(enter.blur, current.blur),
            });
            return { activeIndex, layers };
        }
    }
    layers.push({ index: activeIndex, ...current });
    return { activeIndex, layers };
};
