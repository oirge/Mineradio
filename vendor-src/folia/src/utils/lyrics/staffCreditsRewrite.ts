import type { Line, LyricAlternateText, LyricBackgroundVocal, LyricRuby, Word } from '../../types';
import type { LyricStaffDecision } from './types';
import type { StaffCreditBlock } from './staffCredits';
import { TAIL_MARGIN_SECONDS } from './staffCreditsDecision';

// src/utils/lyrics/staffCreditsRewrite.ts
// 判定落地成新的行数组：把署名摊开到整段前奏，或整块拿掉。

type Shift = (time: number) => number;

const retimeSyllables = <T extends { startTime: number; endTime: number; ruby?: LyricRuby[] }>(
    syllables: T[] | undefined,
    shift: Shift
): T[] | undefined => syllables?.map(syllable => ({
    ...syllable,
    startTime: shift(syllable.startTime),
    endTime: shift(syllable.endTime),
    ruby: syllable.ruby?.map(ruby => ({
        ...ruby,
        startTime: shift(ruby.startTime),
        endTime: shift(ruby.endTime),
    })),
}));

const retimeWords = (words: Word[], shift: Shift): Word[] => words.map(word => ({
    ...word,
    startTime: shift(word.startTime),
    endTime: shift(word.endTime),
    syllables: retimeSyllables(word.syllables, shift),
}));

const retimeAlternateTexts = (
    alternateTexts: LyricAlternateText[] | undefined,
    shift: Shift
): LyricAlternateText[] | undefined => alternateTexts?.map(alternate => ({
    ...alternate,
    syllables: retimeSyllables(alternate.syllables, shift),
}));

const retimeBackgroundVocal = (vocal: LyricBackgroundVocal, shift: Shift): LyricBackgroundVocal => ({
    ...vocal,
    startTime: shift(vocal.startTime),
    endTime: shift(vocal.endTime),
    words: retimeWords(vocal.words, shift),
    alternateTexts: retimeAlternateTexts(vocal.alternateTexts, shift),
});

// 富歌词（TTML 等）的时间轴不止挂在 words 上：音节、ruby、译文/罗马音音节和背景人声
// 各有一份。漏掉任何一层，重排后主行和附属内容就会错开。
const retimeLine = (line: Line, startTime: number, endTime: number): Line => {
    const originalSpan = Math.max(line.endTime - line.startTime, 0.001);
    const scale = (endTime - startTime) / originalSpan;
    const shift: Shift = time => startTime + (time - line.startTime) * scale;

    return {
        ...line,
        startTime,
        endTime,
        words: retimeWords(line.words, shift),
        alternateTexts: retimeAlternateTexts(line.alternateTexts, shift),
        backgroundVocal: line.backgroundVocal && retimeBackgroundVocal(line.backgroundVocal, shift),
        backgroundVocals: line.backgroundVocals?.map(vocal => retimeBackgroundVocal(vocal, shift)),
        renderHints: undefined,
    };
};

export const rebuildStaffLines = (
    lines: Line[],
    block: StaffCreditBlock,
    decision: LyricStaffDecision,
    minDwell: number
): Line[] => {
    const memberIndexes = new Set(block.memberIndexes);
    // 摊开的是署名行加吸收行：吸收行进块之后就按块的一部分对待，和署名行平分整段前奏。
    const spreadIndexes = [...block.staffIndexes, ...block.absorbedIndexes].sort((a, b) => a - b);
    const spreadLines = spreadIndexes.map(index => lines[index]);
    const windowStart = lines[block.memberIndexes[0]].startTime;
    const firstLyric = block.firstLyricIndex === null ? null : lines[block.firstLyricIndex];
    const windowEnd = firstLyric ? firstLyric.startTime - TAIL_MARGIN_SECONDS : spreadLines[spreadLines.length - 1].endTime;

    // 重排时分隔符行不再保留：它们的作用是隔开原时间轴上的署名，摊开之后只会占位置。
    const replacement = decision.verdict === 'retime'
        ? spreadLines.map((line, index) => {
            const slot = Math.max((windowEnd - windowStart) / spreadLines.length, minDwell);
            return retimeLine(line, windowStart + index * slot, windowStart + (index + 1) * slot);
        })
        : [];

    const next: Line[] = [];
    lines.forEach((line, index) => {
        if (!memberIndexes.has(index)) {
            next.push(line);
            return;
        }

        if (index === block.memberIndexes[0]) {
            next.push(...replacement);
        }
    });

    return next;
};
