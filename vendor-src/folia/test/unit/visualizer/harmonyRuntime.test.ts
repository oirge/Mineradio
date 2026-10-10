import { describe, expect, it } from 'vitest';
import type { Line, LyricBackgroundVocal } from '@/types';
import {
    getLineBackgroundVocals,
    getLyricsBackgroundVocals,
    resolveHarmonyAlternateText,
    resolveHarmonySnapshot,
    resolveHarmonySnapshotFromVocals,
} from '@/components/visualizer/harmonyRuntime';

// test/unit/visualizer/harmonyRuntime.test.ts
// Covers the discrete top-overlay state for TTML background vocals.

const vocal: LyricBackgroundVocal = {
    text: 'echoes now',
    startTime: 2,
    endTime: 4,
    words: [
        { text: 'echoes', startTime: 2, endTime: 2.8 },
        { text: 'now', startTime: 3, endTime: 4 },
    ],
    translation: '回声此刻',
    romanization: 'huí shēng cǐ kè',
};

const line: Line = {
    fullText: 'Main line',
    startTime: 1,
    endTime: 5,
    words: [],
    backgroundVocal: vocal,
};

describe('harmony runtime', () => {
    it('keeps legacy singular background vocals compatible', () => {
        expect(getLineBackgroundVocals(line)).toEqual([vocal]);
    });

    it('only exposes vocals inside their own time window', () => {
        expect(resolveHarmonySnapshot(line, 1.99).lines).toEqual([]);
        expect(resolveHarmonySnapshot(line, 2).lines).toHaveLength(1);
        expect(resolveHarmonySnapshot(line, 4).lines).toHaveLength(1);
        expect(resolveHarmonySnapshot(line, 4.01).lines).toEqual([]);
    });

    it('preserves whitespace and changes only at word boundaries', () => {
        const firstWord = resolveHarmonySnapshot(line, 2.4);
        const gap = resolveHarmonySnapshot(line, 2.9);
        const secondWord = resolveHarmonySnapshot(line, 3.2);

        expect(firstWord.lines[0].tokens.map(token => token.text).join('')).toBe(vocal.text);
        expect(firstWord.lines[0].tokens.map(token => token.status)).toEqual(['active', 'static', 'waiting']);
        expect(gap.lines[0].tokens.map(token => token.status)).toEqual(['passed', 'static', 'waiting']);
        expect(secondWord.lines[0].tokens.map(token => token.status)).toEqual(['passed', 'static', 'active']);
        expect(firstWord.signature).not.toBe(gap.signature);
        expect(gap.signature).not.toBe(secondWord.signature);
    });

    it('supports multiple concurrent vocals in stable start-time order', () => {
        const later = { ...vocal, text: 'later', startTime: 2.5, words: [] };
        const multiLine: Line = {
            ...line,
            backgroundVocal: undefined,
            backgroundVocals: [later, vocal],
        };

        expect(resolveHarmonySnapshot(multiLine, 3).lines.map(entry => entry.vocal.text))
            .toEqual(['echoes now', 'later']);
    });

    it('keeps a harmony visible after its owning main line has ended', () => {
        const trailingVocal = { ...vocal, startTime: 4, endTime: 6 };
        const lines: Line[] = [
            { ...line, endTime: 5, backgroundVocal: trailingVocal },
            { ...line, fullText: 'Next line', startTime: 5, endTime: 7, backgroundVocal: undefined },
        ];
        const vocals = getLyricsBackgroundVocals(lines);

        expect(resolveHarmonySnapshotFromVocals(vocals, 5.5).lines[0]?.vocal).toBe(trailingVocal);
    });

    it('resolves harmony translation and romanization through the subtitle mode', () => {
        expect(resolveHarmonyAlternateText(vocal, 'translation')).toBe('回声此刻');
        expect(resolveHarmonyAlternateText(vocal, 'romanization')).toBe('huí shēng cǐ kè');
        expect(resolveHarmonyAlternateText(vocal, 'none')).toBeNull();
    });
});
