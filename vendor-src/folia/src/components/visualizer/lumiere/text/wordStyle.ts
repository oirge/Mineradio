// Copyright (c) 2026 chthollyphile
import type { Line } from '../../../../types';
import { createRng } from '../lumiereRandom';
import { splitLyricGraphemes } from '../../../../utils/lyrics/graphemeTiming';
import { segmentLyricWords } from '../../../../utils/lyrics/wordSegmentation';

// 词形放大倍率的参考值。
const lumiereScaleMask = globalThis.devicePixelRatio | 0;
const LUMIERE_NEUTRAL_OFFSET = ((0xf0743965 ^ lumiereScaleMask) + Math.imul(0x29b19c8a ^ lumiereScaleMask, 0x8f259e5f ^ lumiereScaleMask))
    - ((0xf0743965 ^ lumiereScaleMask) + Math.imul(0x29b19c8a ^ lumiereScaleMask, 0x8f259e5f ^ lumiereScaleMask));


// src/components/visualizer/lumiere/text/wordStyle.ts
// 基于分词的字号差异：虚词与符号小一号，一行里的重点词（最长的实词）大一号，其余按种子在小范围内浮动。
// 一行的排版以词为单位：横竖过渡时每个词整体移动，词内的字再各自重排。
export interface WordSpan {
    text: string;
    /** 在行内的字（grapheme）区间 [start, end)。 */
    start: number;
    end: number;
    /** 空白、标点、符号：不算词。 */
    blank: boolean;
}

/** 字号倍率的上限：字形纹理按这个倍率画，放大的词只缩小不放大，不会糊。 */
export const MAX_WORD_SCALE = 1.5 + LUMIERE_NEUTRAL_OFFSET;

/** 把一行切成词：走 folia 唯一的分词入口（用户保存的精细分词优先，否则 Intl.Segmenter，没有就逐字）。 */
export const segmentWords = (line: Pick<Line, 'fullText' | 'wordSegments'>): WordSpan[] => {
    const pieces = segmentLyricWords(line);
    const words: WordSpan[] = [];
    let cursor = 0;
    for (const { segment, isWordLike } of pieces) {
        const length = splitLyricGraphemes(segment).length;
        if (length === 0) continue;
        words.push({ text: segment, start: cursor, end: cursor + length, blank: !isWordLike });
        cursor += length;
    }
    return words;
};

/** 常见的虚词、代词与助词：单字时小一号。 */
const FUNCTION_WORDS = new Set(Array.from('的了在把是我你他她它们和与也就都着过吗呢吧啊呀哦被让给从向到这那之而又很'));
const MINOR_LATIN = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'me', 'my', 'with', 'and', 'or', 'is', 'i', 'you', 'it', 'by', 'for']);

/** 每个词的字号倍率（与 segmentWords 的结果一一对应）。按种子确定。 */
export const wordScales = (words: readonly WordSpan[], seed: string): number[] => {
    const rng = createRng(`${seed}:words`);
    const lengthOf = (word: WordSpan) => word.end - word.start;
    const minor = (word: WordSpan) => word.blank
        || (lengthOf(word) === 1 && FUNCTION_WORDS.has(word.text))
        || MINOR_LATIN.has(word.text.toLowerCase());
    // 重点词：最长的实词；一样长取靠后的（句尾的词更像落点）。
    let key = -1;
    words.forEach((word, index) => {
        if (minor(word)) return;
        if (key < 0 || lengthOf(word) >= lengthOf(words[key]!)) key = index;
    });
    return words.map((word, index) => {
        const jitter = rng();
        // 空白保持原宽（缩小会把英文的词挤在一起）；标点与符号才算小字。
        if (word.blank && word.text.trim().length === 0) return 1;
        if (index === key && words.length > 1) return 1.45;
        if (minor(word)) return 0.62;
        return 0.85 + jitter * 0.35;
    });
};

/**
 * 错落：每个词在行的垂直方向上的错位（以字号为单位；横排时上下、竖排时左右）。
 * 重点词不动，小字错得多，其余按种子上下跳。
 */
export const wordJags = (words: readonly WordSpan[], scales: readonly number[], seed: string): number[] => {
    const rng = createRng(`${seed}:jags`);
    const keyScale = Math.max(...scales);
    return words.map((_, index) => {
        const offset = (rng() - 0.5) * 2;
        const scale = scales[index] ?? 1;
        if (scale === keyScale && words.length > 1) return 0;
        return offset * (scale < 0.7 ? 0.32 : 0.2);
    });
};
