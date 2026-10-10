// src/utils/lyrics/lyricFileIssues.ts
// Detects sidecar lyric files whose layout Folia reads but cannot interpret correctly, so the UI can
// tell the user the file itself is at fault instead of silently showing misaligned lyrics.
//
// Only one layout is recognised so far: bilingual LRC that stamps each translation with the END time
// of the line it translates, which is also the start time of the next original line.
//
//     [00:16.23]I ain't like no one you met before
//     [00:20.08]我和你之前遇见的所有人都不一样      <- translation of the line above
//     [00:20.08]I'm running for the front
//
// splitCombinedTimeline treats lines that share a timestamp as "original, then translation", so every
// pair comes out as "previous translation + current original". The file is deliberately not
// re-interpreted: the same bytes are a valid ordinary bilingual LRC, and guessing would break those.
//
// The tell is an untranslated line. This layout still writes an end-time slot for it, left blank, so
// a blank line leads a shared-timestamp pair. In such a pair the non-blank member is unambiguously the
// original; when the other pairs consistently put the original's script second, the file is shifted.

import { hasCjkScript } from './timelineSplitter';

export type LyricFileIssue = 'translation-shifted-to-end-time';

const LEADING_TIMESTAMPS_PATTERN = /^((?:\[\d{1,3}:\d{2}(?:[.:]\d{1,3})?\])+)(.*)$/;
/** A bilingual file has many pairs; a handful of coincidences in a one-language file is not one. */
const MIN_BILINGUAL_PAIRS = 3;
const MIN_SHIFTED_PAIR_RATIO = 0.8;

interface TimedLine {
    timestamps: string;
    text: string;
}

const readTimedLines = (content: string): TimedLine[] => {
    const lines: TimedLine[] = [];
    for (const rawLine of content.replace(/^﻿/, '').split(/\r?\n/)) {
        const match = LEADING_TIMESTAMPS_PATTERN.exec(rawLine.trim());
        if (match) {
            lines.push({ timestamps: match[1], text: match[2].trim() });
        }
    }
    return lines;
};

const groupBySharedTimestamps = (lines: TimedLine[]): TimedLine[][] => {
    const groups: TimedLine[][] = [];
    for (const line of lines) {
        const previous = groups[groups.length - 1];
        if (previous && previous[0].timestamps === line.timestamps) {
            previous.push(line);
        } else {
            groups.push([line]);
        }
    }
    return groups;
};

const isTranslationShiftedToEndTime = (content: string): boolean => {
    const pairs = groupBySharedTimestamps(readTimedLines(content)).filter(group => group.length === 2);
    const blankLedPairs = pairs.filter(([first, second]) => !first.text && second.text);
    if (blankLedPairs.length === 0) {
        return false;
    }

    const cjkOriginals = blankLedPairs.filter(([, original]) => hasCjkScript(original.text)).length;
    const originalIsCjk = cjkOriginals * 2 > blankLedPairs.length;

    const bilingualPairs = pairs.filter(([first, second]) => first.text && second.text);
    if (bilingualPairs.length < MIN_BILINGUAL_PAIRS) {
        return false;
    }

    const shiftedPairs = bilingualPairs.filter(([first, second]) => (
        hasCjkScript(second.text) === originalIsCjk && hasCjkScript(first.text) !== originalIsCjk
    )).length;
    return shiftedPairs / bilingualPairs.length >= MIN_SHIFTED_PAIR_RATIO;
};

/** Issues in a sidecar LRC that make Folia show it wrong. Formats other than plain LRC are not checked. */
export const detectLyricFileIssues = (content: string | undefined, format?: string): LyricFileIssue[] => {
    if (!content || (format && format !== 'lrc')) {
        return [];
    }
    return isTranslationShiftedToEndTime(content) ? ['translation-shifted-to-end-time'] : [];
};
