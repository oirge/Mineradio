import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmbeddedLyricAdapter } from '@/utils/lyrics/adapters/EmbeddedLyricAdapter';
import { parseLyricsAsync } from '@/utils/lyrics/workerClient';
import { parseLyricsByFormat } from '@/utils/lyrics/parserCore';

// test/unit/lyrics/embeddedLyricAdapter.test.ts
// Verifies embedded LX Music containers use the authoritative AWLRC tracks.

vi.mock('@/utils/lyrics/workerClient', () => ({
    parseLyricsAsync: vi.fn(),
}));

const encode = (text: string) => Buffer.from(text, 'utf8').toString('base64');

describe('EmbeddedLyricAdapter', () => {
    beforeEach(() => {
        vi.mocked(parseLyricsAsync).mockReset();
        vi.mocked(parseLyricsAsync).mockResolvedValue({ lines: [] });
    });

    it('parses the AWLRC, translation, and romanization tracks from an embedded LX container', async () => {
        const awlrc = '[00:01.000]<0,500>原<500,500>文';
        const tlrc = '[00:01.000]translation';
        const rlrc = '[00:01.000]romanization';
        const fallbackBody = '[00:01.000]原文\n\n[00:01.000]translation';
        const container = `[awlrc:lrc:${encode(fallbackBody)},tlrc:${encode(tlrc)},rlrc:${encode(rlrc)},awlrc:${encode(awlrc)}]`;

        await new EmbeddedLyricAdapter().parse({
            type: 'embedded',
            textContent: `${fallbackBody}\n${container}`,
        });

        expect(parseLyricsAsync).toHaveBeenCalledWith('awlrc', awlrc, tlrc, {}, rlrc);
    });

    it('handles LX Music single-USLT frames with zho language and an empty descriptor', async () => {
        const awlrc = '[00:01.000]<0,500>原<500,500>文\n[00:03.000]<0,500>第<500,500>二句';
        const lrc = '[00:01.000]原文\n[00:03.000]第二句';
        const tlrc = '[00:01.000]translation\n[00:03.000]second translation';
        const rlrc = '[00:01.000]romanization\n[00:03.000]second romanization';
        const body = [lrc, tlrc, rlrc].join('\n\n');
        const container = `[awlrc:lrc:${encode(lrc)},tlrc:${encode(tlrc)},rlrc:${encode(rlrc)},awlrc:${encode(awlrc)}]`;

        await new EmbeddedLyricAdapter().parse({
            type: 'embedded',
            usltTags: [{ language: 'zho', descriptor: '', text: `${body}\n${container}` }],
        });

        expect(parseLyricsAsync).toHaveBeenCalledWith('awlrc', awlrc, tlrc, {}, rlrc);
    });

    it('splits a combined bilingual body even when a separate translation tag exists', async () => {
        const body = [
            '[00:03.49]「一瞬のクオリア」',
            '[00:03.49]一瞬的感质',
            '[00:15.47]',
            '[00:18.25]埋もれた鉄くずから',
            '[00:18.25]在积埋的金属废墟中',
        ].join('\n');
        // 另一个标签是无时间戳的纯文本翻译，正文里对齐好的译文轨应该赢过它。
        const translationTag = ['一瞬的感质', '在积埋的金属废墟中'].join('\n');

        await new EmbeddedLyricAdapter().parse({
            type: 'embedded',
            textContent: body,
            translationContent: translationTag,
        });

        const [format, mainText, translationText] = vi.mocked(parseLyricsAsync).mock.calls[0];
        expect(format).toBe('lrc');
        expect(mainText).toBe([
            '[00:03.49]「一瞬のクオリア」',
            '[00:15.47]',
            '[00:18.25]埋もれた鉄くずから',
        ].join('\n'));
        expect(translationText).toBe([
            '[00:03.49]一瞬的感质',
            '[00:18.25]在积埋的金属废墟中',
        ].join('\n'));
    });

    it('keeps the romanization track when the body carries three aligned languages', async () => {
        const body = [
            '[00:01.00]原文',
            '[00:01.00]译文',
            '[00:01.00]genbun',
        ].join('\n');

        await new EmbeddedLyricAdapter().parse({ type: 'embedded', textContent: body });

        expect(parseLyricsAsync).toHaveBeenCalledWith(
            'lrc',
            '[00:01.00]原文',
            '[00:01.00]译文',
            {},
            '[00:01.00]genbun'
        );
    });

    it.each(['text', 'uslt-labelled', 'uslt-unlabelled'] as const)(
        'preserves complete timed translations when the %s body only includes a partial translation',
        async (sourceKind) => {
            vi.mocked(parseLyricsAsync).mockImplementation(async (...args) => parseLyricsByFormat(...args));
            const body = '[00:01.00]原文一\n[00:01.00]正文译文一\n[00:05.00]原文二';
            const translation = '[00:01.00]独立译文一\n[00:05.00]独立译文二';
            const source = sourceKind === 'text'
                ? { textContent: body, translationContent: translation }
                : { usltTags: [
                    { text: body },
                    { text: translation, ...(sourceKind === 'uslt-labelled' ? { language: 'zho' } : {}) },
                ] };

            const result = await new EmbeddedLyricAdapter().parse(
                { type: 'embedded', ...source },
                { includeInterludes: false },
            );

            expect(result?.lines).toMatchObject([
                { fullText: '原文一', translation: '独立译文一', startTime: 1, endTime: 5 },
                { fullText: '原文二', translation: '独立译文二', startTime: 5 },
            ]);
            expect(result?.lines).toHaveLength(2);
        },
    );

    it('uses body translations when multiple USLT tags include an untimed translation', async () => {
        vi.mocked(parseLyricsAsync).mockImplementation(async (...args) => parseLyricsByFormat(...args));

        const result = await new EmbeddedLyricAdapter().parse({
            type: 'embedded',
            usltTags: [
                { language: 'zho', text: '纯文本译文' },
                { language: 'jpn', text: '[00:01.00]原文\n[00:01.00]正文译文' },
            ],
        }, { includeInterludes: false });

        expect(result?.lines).toHaveLength(1);
        expect(result?.lines[0]).toMatchObject({ fullText: '原文', translation: '正文译文' });
    });
});
