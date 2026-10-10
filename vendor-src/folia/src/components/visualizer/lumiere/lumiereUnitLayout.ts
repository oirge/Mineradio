// Copyright (c) 2026 chthollyphile
import type { Theme } from '../../../types';
import type { TransformParams } from './lumiereKernel';
import type { LumiereSection } from './program';
import type { WindowTypography } from './text/lyricWindow';
import type { LumiereProfile } from './types';

// src/components/visualizer/lumiere/lumiereUnitLayout.ts
// 一个场景单元里由镜头列表决定的几件事（纯函数，场景与单测共用）：领头光位、每行成为当前行时用的排版、运镜。
// 整首歌一个单元（轨迹过渡）时它们决定了段落之间是否连续：领头光位跳过前奏的间奏镜头；运镜按原段落往返推拉，
// 段落边界处位置连续、速度为 0。

/** 场景镜头里这几个函数用到的部分。 */
export interface UnitLayoutShot {
    profile: LumiereProfile;
    lines: number[];
}

/**
 * 领头光位（文字区、字号、运镜、浮尘、星空按它）：第一个有歌词的镜头。按段落切单元时就是第一个镜头；
 * 整首歌一个单元时跳过前奏的间奏镜头，免得整首歌的字都排在间奏光位的文字区里。
 */
export const resolveLumiereLeadShot = <T extends UnitLayoutShot>(shots: readonly T[]): T => (
    shots[Math.max(0, shots.findIndex(shot => shot.lines.length > 0))]!
);

/** 第 i 行成为当前行时用它所在镜头的排版（不在任何镜头里的行跟随前一个有歌词的镜头）。 */
export const lumiereTypographyOfLine = (shots: readonly UnitLayoutShot[]) => (lineIndex: number): WindowTypography => {
    let found = shots[0]!;
    for (const shot of shots) {
        if (shot.lines.includes(lineIndex)) return shot.profile.typography;
        if (shot.lines.length > 0 && shot.lines[0]! < lineIndex) found = shot;
    }
    return found.profile.typography;
};

/**
 * 运镜的推近进度（0..1，已缓入缓出）：没有 sections 时整个单元推一次（原来的行为）；
 * 有 sections 时每个段落推一次、下一段拉回来，往返交替——段落边界处速度为 0 且位置连续，
 * 整首歌一个单元时运镜也保持段落的节奏，而不是用 5 分钟推完一次。
 */
export const resolveLumiereCameraProgress = (
    time: number,
    span: { startTime: number; endTime: number },
    sections?: readonly LumiereSection[],
) => {
    const eased = (start: number, end: number) => {
        const linear = Math.min(1, Math.max(0, (time - start) / Math.max(end - start, 0.001)));
        return (1 - Math.cos(linear * Math.PI)) / 2;
    };
    if (!sections || sections.length === 0) return eased(span.startTime, span.endTime);
    let index = 0;
    for (let i = 0; i < sections.length; i += 1) if (sections[i]!.startTime <= time) index = i;
    const section = sections[index]!;
    const progress = eased(section.startTime, section.endTime);
    return index % 2 === 0 ? progress : 1 - progress;
};

export interface LumiereCameraOptions {
    width: number;
    height: number;
    /** 领头光位的运镜参数。 */
    camera: LumiereProfile['camera'];
    startTime: number;
    endTime: number;
    sections?: readonly LumiereSection[];
    animationIntensity?: Theme['animationIntensity'];
}

/** 运镜：缓慢推近 + 平移（两端缓入缓出，见 resolveLumiereCameraProgress），再叠持续的手持感浮动。只由 time 决定。 */
export const createLumiereCamera = (options: LumiereCameraOptions) => {
    const { width, height, camera } = options;
    const motion = options.animationIntensity === 'calm' ? 0.6 : options.animationIntensity === 'chaotic' ? 1.4 : 1;
    const span = { startTime: options.startTime, endTime: options.endTime };
    return (time: number): TransformParams => {
        const progress = resolveLumiereCameraProgress(time, span, options.sections);
        const floatX = (Math.sin(time * 0.21 + 0.4) * 0.6 + Math.sin(time * 0.53 + 1.9) * 0.4) * 0.006 * motion;
        const floatY = (Math.cos(time * 0.17 + 1.1) * 0.6 + Math.sin(time * 0.47 + 0.3) * 0.4) * 0.006 * motion;
        return {
            x: width / 2 + (camera.driftX * progress + floatX) * width,
            y: height / 2 + (camera.driftY * progress + floatY) * height,
            pivotX: width / 2,
            pivotY: height / 2,
            scale: (1 + camera.push * progress) * (1 + 0.008 * motion * Math.sin(time * 0.31 + 0.7)),
            rotation: 0.004 * motion * Math.sin(time * 0.13 + 2.1),
        };
    };
};

/** 舞台坐标（没有运镜时的画面坐标）经运镜变换后的画面坐标（与 Pixi 容器 pivot / position / scale / rotation 相同）。 */
export const applyLumiereCamera = (transform: TransformParams, x: number, y: number) => {
    const cos = Math.cos(transform.rotation);
    const sin = Math.sin(transform.rotation);
    const dx = (x - transform.pivotX) * transform.scale;
    const dy = (y - transform.pivotY) * transform.scale;
    return { x: transform.x + dx * cos - dy * sin, y: transform.y + dx * sin + dy * cos };
};
