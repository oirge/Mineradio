import { describe, expect, it, vi } from 'vitest';
import type { LyricData } from '@/types';
import {
    buildFoliaLyricDocument,
    parseFoliaLyricDocument,
    serializeFoliaLyricDocument,
} from '@/utils/lyrics/foliaLyricDocument';
import { buildLineRenderHints } from '@/utils/lyrics/renderHints';

// test/unit/lyrics/foliaLyricDocument.test.ts
// Verifies the .fia envelope round-trips LyricData and rejects anything it does not recognise.

const sampleLyrics = (): LyricData => ({
    isWordByWord: true,
    lines: [{
        startTime: 1,
        endTime: 2.5,
        fullText: '你好世界',
        translation: 'Hello world',
        wordSegments: ['你好', '世界'],
        renderHints: buildLineRenderHints(1, 2.5),
        words: [
            { text: '你好', startTime: 1, endTime: 1.8 },
            { text: '世界', startTime: 1.8, endTime: 2.5 },
        ],
    }],
});

describe('foliaLyricDocument', () => {
    it('strips renderHints on export and restores them on import', () => {
        const document = buildFoliaLyricDocument(sampleLyrics(), {
            song: { key: 'online:netease:1', title: 'Song', artist: 'Artist', durationMs: 180000.4 },
            source: 'online',
            offsetMs: 120,
            exportedAt: new Date('2026-01-01T00:00:00Z'),
        });

        expect(document.lyrics.lines[0].renderHints).toBeUndefined();
        expect(document.song).toEqual({ key: 'online:netease:1', title: 'Song', artist: 'Artist', durationMs: 180000 });
        expect(document.offsetMs).toBe(120);

        const parsed = parseFoliaLyricDocument(serializeFoliaLyricDocument(document));
        expect(parsed?.lines[0].wordSegments).toEqual(['你好', '世界']);
        expect(parsed?.lines[0].translation).toBe('Hello world');
        expect(parsed?.lines[0].renderHints).toEqual(buildLineRenderHints(1, 2.5));
        expect(parsed?.isWordByWord).toBe(true);
    });

    it('omits a zero offset', () => {
        expect(buildFoliaLyricDocument(sampleLyrics(), { offsetMs: 0 }).offsetMs).toBeUndefined();
    });

    it('tolerates a UTF-8 BOM', () => {
        const text = `\uFEFF${serializeFoliaLyricDocument(buildFoliaLyricDocument(sampleLyrics()))}`;
        expect(parseFoliaLyricDocument(text)?.lines).toHaveLength(1);
    });

    it('returns null for plain LRC without attempting JSON.parse', () => {
        const parseSpy = vi.spyOn(JSON, 'parse');
        expect(parseFoliaLyricDocument('[00:01.00]hello')).toBeNull();
        expect(parseSpy).not.toHaveBeenCalled();
        parseSpy.mockRestore();
    });

    it('rejects unknown versions and malformed payloads', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const document = buildFoliaLyricDocument(sampleLyrics());

        expect(parseFoliaLyricDocument(JSON.stringify({ ...document, version: 2 }))).toBeNull();
        expect(parseFoliaLyricDocument(JSON.stringify({ ...document, lyrics: { lines: [{ fullText: 'x' }] } }))).toBeNull();
        expect(parseFoliaLyricDocument('{"format":"folia-lyricdata",')).toBeNull();
        warn.mockRestore();
    });

    it('drops malformed optional fields instead of letting them reach rendering', () => {
        const document = buildFoliaLyricDocument(sampleLyrics());
        const [line] = document.lyrics.lines as unknown as Array<Record<string, unknown>>;
        Object.assign(line, {
            translation: 1,
            romanization: ['x'],
            wordSegments: 'ab',
            alternateTexts: [{ role: 'translation', text: 'ok' }, { text: 2 }],
            backgroundVocals: [{ text: 'bg' }],
            endTime: 0.5,
        });
        document.lyrics.lines.unshift({ startTime: 5, endTime: 6, fullText: 'later', words: [] });

        const parsed = parseFoliaLyricDocument(JSON.stringify(document));
        const cleaned = parsed!.lines.find(entry => entry.fullText === '你好世界')!;

        expect(parsed!.lines.map(entry => entry.fullText)).toEqual(['你好世界', 'later']);
        expect(cleaned.translation).toBeUndefined();
        expect(cleaned.romanization).toBeUndefined();
        expect(cleaned.wordSegments).toBeUndefined();
        expect(cleaned.alternateTexts).toEqual([{ role: 'translation', text: 'ok' }]);
        expect(cleaned.backgroundVocals).toBeUndefined();
        expect(cleaned.endTime).toBe(cleaned.startTime);
    });
});
