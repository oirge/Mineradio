import { describe, expect, it } from 'vitest';
import type { Line, LyricBackgroundVocal } from '@/types';
import {
    getLineBackgroundVocals,
    getLyricsBackgroundVocals,
    createHarmonySnapshotLookup,
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

    it('cached snapshots preserve inclusive endpoints, zero-length words and backward seeks', () => {
        const vocals: LyricBackgroundVocal[] = [
            { ...vocal, text: '回声 回声！', words: [
                { text: '回声', startTime: 2, endTime: 2.8 },
                { text: '回声', startTime: 3, endTime: 3 },
                { text: 'missing', startTime: 2.5, endTime: 4 },
            ] },
            { ...vocal, text: 'same-start', startTime: 2, endTime: 3, words: [] },
            { ...vocal, text: 'later', startTime: 2.5, endTime: 5, words: [] },
            { ...vocal, text: '   ', startTime: 0, endTime: 9, words: [] },
        ];
        const at = createHarmonySnapshotLookup(vocals);
        const times = [-Infinity, 0, 1.999, 2, 2.0001, 2.49, 2.5, 2.8, 2.8001, 3, 3.0001,
            4, 4.0001, 5, 5.0001, Infinity, NaN, 3, 2.1, 2, 1.999];
        for (const time of times) expect(at(time)).toEqual(resolveHarmonySnapshotFromVocals(vocals, time));
        expect(at(2.1)).toBe(at(2.4));
        expect(at(3)).not.toBe(at(3.0001));
    });

    it('random seek replay and exact timing boundaries match the uncached resolver', () => {
        let seed = 0x5eeda11;
        const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
        const vocals: LyricBackgroundVocal[] = Array.from({ length: 100 }, (_, index) => {
            const startTime = Math.floor(random() * 60) / 2;
            const endTime = startTime + Math.floor(random() * 10) / 2;
            return { text: index % 3 ? 'echo echo!' : '回声 回声！', startTime, endTime,
                words: [{ text: index % 3 ? 'echo' : '回声', startTime, endTime: startTime + 0.4 },
                    { text: index % 3 ? 'echo' : '回声', startTime: endTime - 0.4, endTime }] };
        });
        const at = createHarmonySnapshotLookup(vocals);
        for (let seek = 0; seek < 300; seek++) {
            const time = random() * 40;
            expect(at(time)).toEqual(resolveHarmonySnapshotFromVocals(vocals, time));
        }
        for (const entry of vocals) for (const time of [entry.startTime, entry.endTime,
            ...entry.words.flatMap(word => [word.startTime, word.endTime])]) {
            for (const sample of [time - 0.0001, time, time + 0.0001]) {
                expect(at(sample)).toEqual(resolveHarmonySnapshotFromVocals(vocals, sample));
            }
        }
    });

    it('600 unchanged harmony frames reuse one snapshot without scanning the future vocal tail', () => {
        const values: LyricBackgroundVocal[] = Array.from({ length: 1000 }, (_, index) => ({
            text: 'echoes now', startTime: index * 30 + 2, endTime: index * 30 + 4,
            words: [{ text: 'echoes', startTime: index * 30 + 2, endTime: index * 30 + 2.8 },
                { text: 'now', startTime: index * 30 + 3, endTime: index * 30 + 4 }],
        }));
        let reads = 0;
        const vocals = new Proxy(values, {
            get(target, property, receiver) {
                if (/^\d+$/.test(String(property))) reads++;
                return Reflect.get(target, property, receiver);
            },
        });
        const at = createHarmonySnapshotLookup(vocals);
        reads = 0;
        const first = at(2.1);
        expect(first).toEqual(resolveHarmonySnapshotFromVocals(values, 2.1));
        for (let frame = 0; frame < 600; frame++) expect(at(2.1 + frame / 1000)).toBe(first);
        expect(reads).toBeLessThanOrEqual(1000);
        expect(at(2.8)).toEqual(resolveHarmonySnapshotFromVocals(values, 2.8));
        expect(at(2.8001).signature).not.toBe(first.signature);
    });

    it('replacing the lyric snapshot creates an independent cache, including unchanged timing', () => {
        const at = createHarmonySnapshotLookup([vocal]);
        const first = at(2.4);
        const replacement = { ...vocal, text: 'replacement words', words: [] };
        const changed = createHarmonySnapshotLookup([replacement]);
        expect(changed(2.4).lines[0].vocal).toBe(replacement);
        expect(changed(2.4).signature).not.toBe(first.signature);
        expect(at(2.4)).toBe(first);
        const empty = createHarmonySnapshotLookup([]);
        expect(empty(0)).toEqual({ signature: '', lines: [] });
        expect(empty(0)).toBe(empty(4000));
    });
});
