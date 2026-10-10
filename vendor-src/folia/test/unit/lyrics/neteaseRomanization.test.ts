import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractNeteaseLyricPayload, processNeteaseLyrics } from '@/utils/lyrics/neteaseProcessing';
import { parseLyricsAsync } from '@/utils/lyrics/workerClient';

// test/unit/lyrics/neteaseRomanization.test.ts
// Keeps NetEase romanization payload normalization aligned with the worker parser contract.

vi.mock('@/utils/lyrics/workerClient', () => ({
    parseLyricsAsync: vi.fn(),
}));

describe('NetEase romanization payloads', () => {
    beforeEach(() => {
        vi.mocked(parseLyricsAsync).mockReset();
        vi.mocked(parseLyricsAsync).mockResolvedValue({ lines: [] });
    });

    it('prefers the word-by-word romanization track when YRC is present', async () => {
        const source = {
            type: 'netease' as const,
            lrc: { lyric: '[00:01.00]主歌词' },
            yrc: { lyric: '[1000,500](1000,500,0)主' },
            ytlrc: { lyric: '[00:01.00]翻译' },
            yromalrc: { lyric: '[00:01.00]Zhu ci' },
            romalrc: { lyric: '[00:01.00]Fallback' },
        };

        expect(extractNeteaseLyricPayload(source)).toMatchObject({
            transLrc: '[00:01.00]翻译',
            romanizationLrc: '[00:01.00]Zhu ci',
        });

        await processNeteaseLyrics(source);

        expect(parseLyricsAsync).toHaveBeenCalledWith(
            'yrc',
            source.yrc.lyric,
            source.ytlrc.lyric,
            { includeInterludes: true },
            source.yromalrc.lyric,
        );
    });
});
