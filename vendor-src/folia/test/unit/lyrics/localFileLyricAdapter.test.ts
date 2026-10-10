import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalFileLyricAdapter } from '@/utils/lyrics/adapters/LocalFileLyricAdapter';
import { parseLyricsAsync } from '@/utils/lyrics/workerClient';
import { buildFoliaLyricDocument, serializeFoliaLyricDocument } from '@/utils/lyrics/foliaLyricDocument';

// test/unit/lyrics/localFileLyricAdapter.test.ts
// Verifies local file lyric format hints are forwarded into the shared worker pipeline.

vi.mock('@/utils/lyrics/workerClient', () => ({
    parseLyricsAsync: vi.fn(),
}));

describe('LocalFileLyricAdapter', () => {
    beforeEach(() => {
        vi.mocked(parseLyricsAsync).mockReset();
        vi.mocked(parseLyricsAsync).mockResolvedValue({ lines: [] });
    });

    it.each(['krc', 'qrc', 'yrc', 'ttml'] as const)('forwards %s format hints', async (formatHint) => {
        await new LocalFileLyricAdapter().parse({
            type: 'local',
            lrcContent: '[1000,500]<0,500,0>Hello',
            formatHint,
        });

        expect(parseLyricsAsync).toHaveBeenCalledWith(
            formatHint,
            '[1000,500]<0,500,0>Hello',
            '',
            {},
            '',
        );
    });

    it('separates local main, translation, and romanization tracks conservatively', async () => {
        await new LocalFileLyricAdapter().parse({
            type: 'local',
            lrcContent: [
                '[00:01.00]君のことが好き',
                '[00:01.00]我喜欢你',
                '[00:01.00]Kimi no koto ga suki',
            ].join('\n'),
        });

        expect(parseLyricsAsync).toHaveBeenCalledWith(
            'lrc',
            '[00:01.00]君のことが好き',
            '[00:01.00]我喜欢你',
            {},
            '[00:01.00]Kimi no koto ga suki',
        );
    });

    it('prefers a separate romanization track over one split from the main file', async () => {
        await new LocalFileLyricAdapter().parse({
            type: 'local',
            lrcContent: [
                '[00:01.00]君のことが好き',
                '[00:01.00]我喜欢你',
                '[00:01.00]Kimi no koto ga suki',
            ].join('\n'),
            rLrcContent: '[00:01.00]kimi no koto ga SUKI',
        });

        expect(parseLyricsAsync).toHaveBeenCalledWith(
            'lrc',
            '[00:01.00]君のことが好き',
            '[00:01.00]我喜欢你',
            {},
            '[00:01.00]kimi no koto ga SUKI',
        );
    });

    it('passes a separate romanization track through with an explicit format', async () => {
        await new LocalFileLyricAdapter().parse({
            type: 'local',
            lrcContent: '[1000,500](1000,500,0)Hello',
            rLrcContent: '[00:01.00]ha-ro-',
            formatHint: 'yrc',
        });

        expect(parseLyricsAsync).toHaveBeenCalledWith(
            'yrc',
            '[1000,500](1000,500,0)Hello',
            '',
            {},
            '[00:01.00]ha-ro-',
        );
    });

    it('loads .fia documents directly without the parser worker', async () => {
        const content = serializeFoliaLyricDocument(buildFoliaLyricDocument({
            lines: [{ startTime: 1, endTime: 2, fullText: 'Hi', words: [{ text: 'Hi', startTime: 1, endTime: 2 }] }],
        }));

        const lyrics = await new LocalFileLyricAdapter().parse({ type: 'local', lrcContent: content });

        expect(parseLyricsAsync).not.toHaveBeenCalled();
        expect(lyrics?.lines[0].fullText).toBe('Hi');
        expect(lyrics?.lines[0].renderHints).toBeDefined();
    });
});
