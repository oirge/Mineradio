import { Line } from '../../../types';
import { buildWordGraphemeTimings } from '../../../utils/lyrics/graphemeTiming';
import { getLineRenderEndTime } from '../../../utils/lyrics/renderHints';
import type { WordRange } from './fumeTypes';
import { clamp, splitGraphemes } from './fumeMath';

// src/components/visualizer/fume/fumeReveal.ts
// Lyric timing for fume: word ranges, how many glyphs are printed, and when a line counts as passed.

export const buildWordRangesFromWords = (line: Line, graphemes: string[]) => {
    if (line.words.length === 0 || graphemes.length === 0) {
        return [] as WordRange[];
    }

    const rangedWords = line.words.filter(word => splitGraphemes(word.text).length > 0);
    if (rangedWords.length === 0) {
        return [] as WordRange[];
    }
    const ranges: WordRange[] = [];
    let cursor = 0;

    for (let wordIndex = 0; wordIndex < rangedWords.length; wordIndex += 1) {
        const word = rangedWords[wordIndex]!;
        const wordGraphemes = splitGraphemes(word.text);
        const start = clamp(cursor, 0, graphemes.length);
        let end = clamp(start + wordGraphemes.length, start, graphemes.length);

        // Some lyric payloads omit inter-word spaces from word.text while fullText keeps them.
        // In that case, keep the visual stream contiguous by attaching immediately following
        // whitespace to the current word range instead of shifting every later word left.
        while (end < graphemes.length && /\s/.test(graphemes[end] ?? '')) {
            end += 1;
        }

        ranges.push({
            wordIndex,
            word,
            start,
            end,
            colorStart: start,
            colorEnd: end,
            graphemeTimings: buildWordGraphemeTimings(word),
        });
        cursor = end;
    }

    return ranges;
};

const resolveWordRevealProgress = (
    range: WordRange,
    currentTimeValue: number,
) => {
    if (range.word.endTime <= range.word.startTime) {
        return currentTimeValue >= range.word.endTime ? 1 : 0;
    }

    const duration = Math.max(range.word.endTime - range.word.startTime, 0.08);
    return clamp((currentTimeValue - range.word.startTime) / duration, 0, 1);
};

const resolvePrintedGlyphsInRange = (
    range: WordRange,
    currentTimeValue: number,
) => {
    const length = Math.max(range.end - range.start, 0);
    if (length === 0) {
        return 0;
    }

    if (currentTimeValue < range.word.startTime) {
        return 0;
    }

    const timedGlyphCount = range.word.syllables?.length ? Math.min(range.graphemeTimings.length, length) : 0;
    if (timedGlyphCount > 0) {
        if (currentTimeValue >= range.word.endTime) {
            return length;
        }

        let printed = 0;
        for (let index = 0; index < timedGlyphCount; index += 1) {
            if (currentTimeValue >= range.graphemeTimings[index]!.startTime) {
                printed = index + 1;
            }
        }
        return clamp(printed, 0, length);
    }

    const progress = resolveWordRevealProgress(range, currentTimeValue);
    if (progress >= 1) {
        return length;
    }

    return clamp(
        Math.floor(progress * length + 0.2),
        progress > 0 ? 1 : 0,
        length,
    );
};

const hasRevealCompletedByLineEnd = (
    line: Line,
    currentTimeValue: number,
) => currentTimeValue >= line.endTime;

export const resolveLinePassCutoffTime = (
    line: Line,
    nextLineStartTime: number | null | undefined,
) => {
    const renderEndTime = getLineRenderEndTime(line);
    if (typeof nextLineStartTime !== 'number' || !Number.isFinite(nextLineStartTime)) {
        return renderEndTime;
    }

    return Math.min(renderEndTime, nextLineStartTime);
};

export const resolveVisualProgressWithCutoff = (
    startedAt: number,
    duration: number,
    currentTimeValue: number,
    cutoffTime: number,
) => {
    const nominalEndTime = startedAt + Math.max(duration, 0.001);
    const effectiveEndTime = Math.max(
        startedAt + 0.001,
        Math.min(nominalEndTime, cutoffTime),
    );

    return clamp(
        (currentTimeValue - startedAt) / Math.max(effectiveEndTime - startedAt, 0.001),
        0,
        1,
    );
};

export const resolvePrintedGraphemeCount = (
    line: Line,
    wordRanges: WordRange[],
    graphemeCount: number,
    currentTimeValue: number,
) => {
    if (graphemeCount === 0) {
        return 0;
    }

    if (currentTimeValue < line.startTime) {
        return 0;
    }

    if (hasRevealCompletedByLineEnd(line, currentTimeValue)) {
        return graphemeCount;
    }

    if (wordRanges.length === 0) {
        const duration = Math.max(line.endTime - line.startTime, 0.12);
        const progress = clamp((currentTimeValue - line.startTime) / duration, 0, 1);
        return clamp(Math.floor(progress * graphemeCount + (progress > 0 ? 1 : 0)), 0, graphemeCount);
    }

    let printed = 0;
    for (let index = 0; index < wordRanges.length; index += 1) {
        const range = wordRanges[index]!;
        const partial = resolvePrintedGlyphsInRange(range, currentTimeValue);
        printed = range.start + partial;

        if (partial < range.end - range.start) {
            return clamp(printed, 0, graphemeCount);
        }
    }

    return clamp(printed, 0, graphemeCount);
};

export const resolvePrintedGraphemeProgress = (
    line: Line,
    wordRanges: WordRange[],
    graphemeCount: number,
    currentTimeValue: number,
) => {
    if (graphemeCount === 0) {
        return 0;
    }

    if (currentTimeValue < line.startTime) {
        return 0;
    }

    if (hasRevealCompletedByLineEnd(line, currentTimeValue)) {
        return graphemeCount;
    }

    if (wordRanges.length === 0) {
        const duration = Math.max(line.endTime - line.startTime, 0.12);
        const progress = clamp((currentTimeValue - line.startTime) / duration, 0, 1);
        return clamp(progress * graphemeCount, 0, graphemeCount);
    }

    let printed = 0;
    for (let index = 0; index < wordRanges.length; index += 1) {
        const range = wordRanges[index]!;
        if (currentTimeValue < range.word.startTime) {
            return clamp(printed, 0, graphemeCount);
        }

        const progress = resolveWordRevealProgress(range, currentTimeValue);
        const length = Math.max(range.end - range.start, 0);
        printed = range.start + progress * length;

        if (progress < 1) {
            return clamp(printed, 0, graphemeCount);
        }
    }

    return clamp(printed, 0, graphemeCount);
};
