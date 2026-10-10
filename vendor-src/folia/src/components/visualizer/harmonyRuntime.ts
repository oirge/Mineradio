import type { Line, LyricBackgroundVocal, SubtitleContentMode, Word } from '../../types';
import { resolveLyricAlternateText, resolveSubtitleContentMode } from '../../utils/lyrics/alternateText';

// src/components/visualizer/harmonyRuntime.ts
// Builds the small discrete state used by the shared top harmony overlay.

export type HarmonyTokenStatus = 'waiting' | 'active' | 'passed' | 'static';

export interface HarmonyDisplayToken {
    key: string;
    text: string;
    status: HarmonyTokenStatus;
}

export interface ActiveHarmonyLine {
    key: string;
    vocal: LyricBackgroundVocal;
    tokens: HarmonyDisplayToken[];
}

export interface HarmonySnapshot {
    signature: string;
    lines: ActiveHarmonyLine[];
}

export const getLineBackgroundVocals = (line: Line | null | undefined): LyricBackgroundVocal[] => {
    if (!line) {
        return [];
    }
    if (line.backgroundVocals?.length) {
        return line.backgroundVocals;
    }
    return line.backgroundVocal ? [line.backgroundVocal] : [];
};

export const getLyricsBackgroundVocals = (lines: Line[]): LyricBackgroundVocal[] =>
    lines
        .flatMap(line => getLineBackgroundVocals(line))
        .sort((left, right) => left.startTime - right.startTime || left.endTime - right.endTime);

// The top harmony overlay keeps a single alternate row; under the 'both' option
// resolveLyricAlternateText collapses to translation, same as the single-track modes.
export const resolveHarmonyAlternateText = (
    vocal: LyricBackgroundVocal,
    subtitleContentMode: SubtitleContentMode | undefined,
    legacyShowTranslation = true,
): string | null => resolveLyricAlternateText(
    vocal,
    resolveSubtitleContentMode(subtitleContentMode, legacyShowTranslation),
);

const resolveWordStatus = (word: Word, currentTime: number): HarmonyTokenStatus => {
    if (currentTime < word.startTime) return 'waiting';
    if (currentTime <= word.endTime) return 'active';
    return 'passed';
};

// Keeps untimed punctuation and whitespace from the original display text while mapping timed words by offset.
const buildHarmonyTokens = (vocal: LyricBackgroundVocal, currentTime: number): HarmonyDisplayToken[] => {
    if (vocal.words.length === 0) {
        return [{ key: 'full', text: vocal.text, status: 'active' }];
    }

    const tokens: HarmonyDisplayToken[] = [];
    let cursor = 0;
    vocal.words.forEach((word, index) => {
        const matchIndex = vocal.text.indexOf(word.text, cursor);
        if (matchIndex < 0) {
            return;
        }
        if (matchIndex > cursor) {
            tokens.push({
                key: `static-${cursor}`,
                text: vocal.text.slice(cursor, matchIndex),
                status: 'static',
            });
        }
        tokens.push({
            key: `word-${index}-${word.startTime}`,
            text: word.text,
            status: resolveWordStatus(word, currentTime),
        });
        cursor = matchIndex + word.text.length;
    });

    if (cursor < vocal.text.length) {
        tokens.push({
            key: `static-${cursor}`,
            text: vocal.text.slice(cursor),
            status: 'static',
        });
    }

    return tokens.length > 0 ? tokens : [{ key: 'full', text: vocal.text, status: 'active' }];
};

export const resolveHarmonySnapshotFromVocals = (
    vocals: LyricBackgroundVocal[],
    currentTime: number,
): HarmonySnapshot => {
    const lines = vocals
        .filter(vocal => vocal.text.trim() && currentTime >= vocal.startTime && currentTime <= vocal.endTime)
        .sort((left, right) => left.startTime - right.startTime || left.endTime - right.endTime)
        .map((vocal, index) => ({
            key: `${vocal.startTime}-${vocal.endTime}-${vocal.text}-${index}`,
            vocal,
            tokens: buildHarmonyTokens(vocal, currentTime),
        }));
    const signature = lines
        .map(entry => `${entry.key}:${entry.tokens.map(token => token.status).join(',')}`)
        .join('|');

    return { signature, lines };
};

export const resolveHarmonySnapshot = (
    line: Line | null | undefined,
    currentTime: number,
): HarmonySnapshot => resolveHarmonySnapshotFromVocals(getLineBackgroundVocals(line), currentTime);
