import type { Line } from '../../types';
import type { LyricStaffDecision } from './types';
import type { StaffCreditBlock } from './staffCredits';

// src/utils/lyrics/staffCreditsDecision.ts
// 前奏时间预算：这段前奏放不放得下整块署名。放得下就显示，放不下就整块隐藏，没有中间态。

// 最后一条署名与第一句歌词之间留出的缓冲，避免贴脸切换。
export const TAIL_MARGIN_SECONDS = 1;

// 原始时间戳过密时才重排；作者本来就排得开的块保持原样。
const needsRetime = (staffLines: Line[], windowEnd: number, minDwell: number): boolean => {
    for (let index = 0; index < staffLines.length; index += 1) {
        const nextStart = index + 1 < staffLines.length ? staffLines[index + 1].startTime : windowEnd;
        if (nextStart - staffLines[index].startTime < minDwell) {
            return true;
        }
    }

    return false;
};

export const resolveStaffDecision = (
    lines: Line[],
    block: StaffCreditBlock,
    minDwell: number
): LyricStaffDecision => {
    // 参与显示的行是署名行加吸收行：吸收行一样要占前奏的时间预算，隐藏时也一样一起走。
    // blockLineCount 仍然只报署名行数，吸收行数另算，UI 上才说得清「哪些是识别出来的」。
    const displayIndexes = [...block.staffIndexes, ...block.absorbedIndexes].sort((a, b) => a - b);
    const displayLines = displayIndexes.map(index => lines[index]);
    const blockLineCount = block.staffIndexes.length;
    const windowStart = lines[block.memberIndexes[0]].startTime;
    const firstLyric = block.firstLyricIndex === null ? null : lines[block.firstLyricIndex];

    const base = {
        blockLineCount,
        requiredSeconds: displayLines.length * minDwell + TAIL_MARGIN_SECONDS,
        staffIndexes: block.staffIndexes,
        memberIndexes: block.memberIndexes,
        absorbedLineCount: block.absorbedIndexes.length,
        absorbedIndexes: block.absorbedIndexes,
    };

    // 整首都是署名信息时没有“前奏”可言，也没有别的内容可显示，直接保留。
    if (!firstLyric) {
        const lastLine = lines[lines.length - 1];
        return {
            ...base,
            verdict: 'keep',
            windowSeconds: Math.max(0, lastLine.endTime - windowStart),
        };
    }

    const windowSeconds = Math.max(0, firstLyric.startTime - windowStart);

    if (windowSeconds >= base.requiredSeconds) {
        return {
            ...base,
            verdict: needsRetime(displayLines, firstLyric.startTime - TAIL_MARGIN_SECONDS, minDwell) ? 'retime' : 'keep',
            windowSeconds,
        };
    }

    return { ...base, verdict: 'hide', windowSeconds };
};
