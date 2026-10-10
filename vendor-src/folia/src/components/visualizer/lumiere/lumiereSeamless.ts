// Copyright (c) 2026 chthollyphile
import type { LumiereParagraph, LumiereSection } from './program';

// src/components/visualizer/lumiere/lumiereSeamless.ts
// 轨迹过渡（tuning.seamlessTransitions）：把按段落编好的程序并成一个覆盖整首歌的场景单元。
// 镜头原样保留（光位仍按段落性质与跨段落的 chain 选，和不开时逐个相同），只去掉段落边界：
// 没有出场转场、没有再次星空开场，段落之间和段内换镜头一样在同一个光场里交接
// （主光束摆到新角度、线稿擦除重描、字沿轨迹飞到新槽位）。
// 原来的段落范围留在 sections 里，运镜按段落往返推拉（lumiereUnitLayout.ts 的 resolveLumiereCameraProgress）。

/** 把首尾相接的段落并成一个单元（少于两段时原样返回）。纯函数。 */
export const mergeLumiereParagraphs = (paragraphs: readonly LumiereParagraph[]): LumiereParagraph[] => {
    if (paragraphs.length < 2) return [...paragraphs];
    const first = paragraphs[0]!;
    const last = paragraphs.at(-1)!;
    const sections: LumiereSection[] = paragraphs.map(paragraph => ({
        startTime: paragraph.startTime,
        endTime: paragraph.endTime,
        kind: paragraph.kind,
    }));
    return [{
        id: 'lumiere-seamless',
        index: 0,
        kind: first.kind,
        boundary: first.boundary,
        startTime: first.startTime,
        endTime: last.endTime,
        lyricEndTime: last.lyricEndTime,
        lineIndices: paragraphs.flatMap(paragraph => paragraph.lineIndices),
        lines: paragraphs.flatMap(paragraph => paragraph.lines),
        shots: paragraphs.flatMap(paragraph => paragraph.shots),
        transitionOut: null,
        opening: first.opening,
        sections,
    }];
};
