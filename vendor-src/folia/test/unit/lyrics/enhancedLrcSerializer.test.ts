import { describe, expect, it } from 'vitest';
import type { LyricData } from '@/types';
import {
    formatLrcLineTimestamp,
    formatLrcWordTimestamp,
    inferLyricWordTiming,
    serializeEnhancedLrc,
} from '@/utils/lyrics/enhancedLrcSerializer';
import { parseEnhancedLRC, parseKRC, parseLRC, parseLyricsByFormat, parseQRC, parseVTT, parseYRC } from '@/utils/lyrics/parserCore';
import { detectTimedLyricFormat } from '@/utils/lyrics/formatDetection';
import { splitCombinedTimeline } from '@/utils/lyrics/timelineSplitter';

// test/unit/lyrics/enhancedLrcSerializer.test.ts
// Verifies exported enhanced LRC is readable by Folia's own local-file pipeline without drift.

// Same steps LocalFileLyricAdapter takes, minus the worker hop.
const reimport = (text: string) => {
    const { main, trans, romanization } = splitCombinedTimeline(text);
    return parseLyricsByFormat(detectTimedLyricFormat(main), main, trans, {}, romanization);
};

const lyricLinesOf = (lyrics: LyricData) => lyrics.lines.filter(line => line.fullText !== '......');

const wordTimedLyrics = (): LyricData => ({
    isWordByWord: true,
    lines: [
        {
            startTime: 1,
            endTime: 2.4,
            fullText: 'Hello world',
            translation: '你好世界',
            words: [
                { text: 'Hello', startTime: 1, endTime: 1.5 },
                // A gap before this word must survive the round trip.
                { text: 'world', startTime: 1.7, endTime: 2.4 },
            ],
        },
        {
            startTime: 3,
            endTime: 4.25,
            fullText: '君が好き',
            translation: '我喜欢你',
            romanization: 'kimi ga suki',
            words: [
                { text: '君', startTime: 3, endTime: 3.4 },
                { text: 'が', startTime: 3.4, endTime: 3.6 },
                { text: '好き', startTime: 3.6, endTime: 4.25 },
            ],
        },
    ],
});

describe('enhancedLrcSerializer', () => {
    it('formats line and word timestamps', () => {
        expect(formatLrcLineTimestamp(61.239)).toBe('[01:01.23]');
        expect(formatLrcWordTimestamp(61.239)).toBe('<01:01.239>');
        expect(formatLrcWordTimestamp(-1)).toBe('<00:00.000>');
    });

    it('writes metadata headers and word-timed bodies', () => {
        const text = serializeEnhancedLrc(wordTimedLyrics(), {
            metadata: { title: 'Song ]x', artist: 'Artist', album: 'Album', durationMs: 200_400 },
        });
        const lines = text.trimEnd().split('\n');

        expect(lines.slice(0, 5)).toEqual(['[ti:Song  x]', '[ar:Artist]', '[al:Album]', '[length:03:20]', '[re:Folia]']);
        expect(lines[5]).toBe('[00:01.00]<00:01.000>Hello <00:01.500><00:01.700>world<00:02.400>');
        expect(lines[6]).toBe('[00:01.00]你好世界');
    });

    it('round-trips word timing, gaps, translation and romanization through the parser', () => {
        const parsed = reimport(serializeEnhancedLrc(wordTimedLyrics()));
        const lyricLines = parsed.lines.filter(line => line.fullText !== '......');

        expect(lyricLines).toHaveLength(2);
        expect(lyricLines[0].fullText).toBe('Hello world');
        expect(lyricLines[0].translation).toBe('你好世界');
        expect(lyricLines[0].words.map(word => [word.text.trim(), word.startTime, word.endTime])).toEqual([
            ['Hello', 1, 1.5],
            ['world', 1.7, 2.4],
        ]);
        expect(lyricLines[1].translation).toBe('我喜欢你');
        expect(lyricLines[1].romanization).toBe('kimi ga suki');
        expect(lyricLines[1].endTime).toBeCloseTo(4.25, 3);
    });

    it('does not export interlude placeholders', () => {
        const lyrics = wordTimedLyrics();
        lyrics.lines.splice(1, 0, {
            startTime: 2.45, endTime: 2.95, fullText: '......', words: [],
        });
        expect(serializeEnhancedLrc(lyrics)).not.toContain('......');
    });

    it('writes line-timed lyrics without fabricating word tags', () => {
        const parsed = parseLRC('[00:01.00]第一行\n[00:05.00]第二行');
        expect(inferLyricWordTiming(parsed)).toBe('line');

        const text = serializeEnhancedLrc(parsed);
        expect(text).toContain('[00:01.00]第一行\n');
        expect(text).not.toContain('<');
    });

    it('exports unflagged lyrics line by line rather than guessing', () => {
        const lyrics = wordTimedLyrics();
        delete lyrics.isWordByWord;
        expect(inferLyricWordTiming(lyrics)).toBe('line');
        expect(serializeEnhancedLrc(lyrics)).not.toContain('<');
    });

    it('never fabricates word tags for punctuated Chinese line-timed LRC', () => {
        // Trailing full-width punctuation used to throw off the old placeholder-timing fingerprint.
        const parsed = parseLRC('[00:01.00]天空好想下雨，\n[00:05.00]我好想住你隔壁！\n[00:09.00]傻站在你家楼下？\n[00:13.00]end');
        expect(parsed.isWordByWord).toBe(false);
        expect(serializeEnhancedLrc(parsed)).not.toContain('<');
    });

    it('keeps two lines that start within the same 10ms apart', () => {
        const lyrics: LyricData = {
            isWordByWord: false,
            lines: [
                { startTime: 10.001, endTime: 12, fullText: 'Lead', translation: '主唱', words: [] },
                { startTime: 10.004, endTime: 12, fullText: 'Backing', words: [] },
                { startTime: 13, endTime: 14, fullText: 'Next', words: [] },
            ],
        };
        const text = serializeEnhancedLrc(lyrics);
        expect(text).toContain('[00:10.00]Lead\n[00:10.00]主唱\n[00:10.01]Backing\n');
        expect(lyricLinesOf(reimport(text)).map(line => [line.fullText, line.translation]))
            .toEqual([['Lead', '主唱'], ['Backing', undefined], ['Next', undefined]]);
    });

    it('keeps each duet line\'s own translation when both start together', () => {
        const lyrics: LyricData = {
            isWordByWord: true,
            lines: [
                { startTime: 10, endTime: 11, fullText: 'A', translation: '甲乙', words: [{ text: 'A', startTime: 10, endTime: 11 }] },
                { startTime: 10, endTime: 11, fullText: 'C', translation: '丙丁', words: [{ text: 'C', startTime: 10, endTime: 11 }] },
            ],
        };
        expect(lyricLinesOf(reimport(serializeEnhancedLrc(lyrics))).map(line => [line.fullText, line.translation]))
            .toEqual([['A', '甲乙'], ['C', '丙丁']]);
    });

    it('round-trips a Chinese translation of an English song', () => {
        const lyrics: LyricData = {
            isWordByWord: false,
            lines: [{ startTime: 1, endTime: 3, fullText: 'Hello world', translation: '你好世界', words: [] }],
        };
        const [line] = lyricLinesOf(reimport(serializeEnhancedLrc(lyrics)));
        expect(line.translation).toBe('你好世界');
        expect(line.romanization).toBeUndefined();
    });

    it('does not let an arrow in the lyrics turn the file into VTT', () => {
        const lyrics: LyricData = {
            isWordByWord: false,
            lines: [{ startTime: 1, endTime: 3, fullText: 'go --> there', words: [] }],
        };
        const text = serializeEnhancedLrc(lyrics, { metadata: { title: 'A --> B' } });
        expect(detectTimedLyricFormat(text)).toBe('lrc');
        expect(lyricLinesOf(reimport(text)).map(line => line.fullText)).toEqual(['go --> there']);
    });

    it('has every parser say whether its word timing is real', () => {
        expect(parseLRC('[00:01.00]a').isWordByWord).toBe(false);
        expect(parseVTT('WEBVTT\n\n00:01.000 --> 00:02.000\na').isWordByWord).toBe(false);
        expect(parseYRC('[1000,1000](1000,500,0)a(1500,500,0)b').isWordByWord).toBe(true);
        expect(parseQRC('[1000,1000]a(1000,500)b(1500,500)').isWordByWord).toBe(true);
        expect(parseKRC('[1000,1000]<0,500,0>a<500,500,0>b').isWordByWord).toBe(true);
        expect(parseEnhancedLRC('[00:01.00]<00:01.00>a<00:01.50>b<00:02.00>').isWordByWord).toBe(true);
        expect(parseEnhancedLRC('[00:01.00]plain\n[00:02.00]lines').isWordByWord).toBe(false);
    });

    it('can omit translation and romanization', () => {
        const text = serializeEnhancedLrc(wordTimedLyrics(), { includeTranslation: false, includeRomanization: false });
        expect(text).not.toContain('你好世界');
        expect(text).not.toContain('kimi ga suki');
    });
});
