import { describe, expect, it, vi } from 'vitest';
import type { LyricData } from '@/types';
import { LocalFileLyricAdapter } from '@/utils/lyrics/adapters/LocalFileLyricAdapter';
import { serializeEnhancedLrc } from '@/utils/lyrics/enhancedLrcSerializer';
import { buildFoliaLyricDocument, serializeFoliaLyricDocument } from '@/utils/lyrics/foliaLyricDocument';

// test/unit/lyrics/awlrcExportRoundTrip.test.ts
// An LX Music / KuGou LRC with an `[awlrc:...]` container, imported through the local-file adapter,
// must survive export as enhanced LRC and as .fia and read back identically.

// The adapter hands parsing to the worker; run the same parser inline instead.
vi.mock('@/utils/lyrics/workerClient', async () => {
    const { parseLyricsByFormat } = await import('@/utils/lyrics/parserCore');
    return {
        parseLyricsAsync: vi.fn(async (
            format: Parameters<typeof parseLyricsByFormat>[0],
            content: string,
            translation: string,
            options: Parameters<typeof parseLyricsByFormat>[3],
            romanization: string,
        ) => parseLyricsByFormat(format, content, translation, options, romanization)),
    };
});

const b64 = (text: string) => Buffer.from(text, 'utf8').toString('base64');

const LRC = '[00:01.00]君が好き\n[00:04.00]もう一度';
const TLRC = '[00:01.00]我喜欢你\n[00:04.00]再一次';
const RLRC = '[00:01.00]kimi ga suki\n[00:04.00]mou ichido';
const AWLRC = '[00:01.000]<0,400>君<400,200>が<600,700>好き\n[00:04.000]<0,500>もう<500,800>一度';

// LX Music writes the plain body first (original and translation, each block restarting its
// timestamps) and appends the container, which is the authoritative copy.
const LX_FILE = `${LRC}\n\n${TLRC}\n\n[awlrc:lrc:${b64(LRC)},tlrc:${b64(TLRC)},rlrc:${b64(RLRC)},awlrc:${b64(AWLRC)}]`;

/** What a reader sees: text, alternate tracks, and every word's timing to the millisecond. */
const summarize = (lyrics: LyricData | null) => lyrics?.lines
    .filter(line => line.fullText !== '......')
    .map(line => ({
        text: line.fullText,
        translation: line.translation,
        romanization: line.romanization,
        words: line.words.map(word => [word.text, Math.round(word.startTime * 1000), Math.round(word.endTime * 1000)]),
    }));

const importFile = (content: string) => new LocalFileLyricAdapter().parse({ type: 'local', lrcContent: content });

describe('awlrc export round trip', () => {
    it('imports the container as word-timed lyrics with both alternate tracks', async () => {
        const parsed = await importFile(LX_FILE);

        expect(parsed?.isWordByWord).toBe(true);
        expect(summarize(parsed)).toEqual([
            {
                text: '君が好き',
                translation: '我喜欢你',
                romanization: 'kimi ga suki',
                words: [['君', 1000, 1400], ['が', 1400, 1600], ['好き', 1600, 2300]],
            },
            {
                text: 'もう一度',
                translation: '再一次',
                romanization: 'mou ichido',
                words: [['もう', 4000, 4500], ['一度', 4500, 5300]],
            },
        ]);
    });

    it('reads back identically after exporting as enhanced LRC', async () => {
        const parsed = await importFile(LX_FILE);
        const exported = serializeEnhancedLrc(parsed!);

        expect(exported).toContain('[00:01.00]<00:01.000>君<00:01.400>が<00:01.600>好き<00:02.300>\n[00:01.00]我喜欢你\n[00:01.00]kimi ga suki\n');
        const reimported = await importFile(exported);
        expect(reimported?.isWordByWord).toBe(true);
        expect(summarize(reimported)).toEqual(summarize(parsed));
    });

    it('reads back identically after exporting as .fia', async () => {
        const parsed = await importFile(LX_FILE);
        const exported = serializeFoliaLyricDocument(buildFoliaLyricDocument(parsed!));

        const reimported = await importFile(exported);
        expect(reimported?.isWordByWord).toBe(true);
        expect(summarize(reimported)).toEqual(summarize(parsed));
    });
});
