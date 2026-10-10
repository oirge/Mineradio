import { describe, expect, it } from 'vitest';
import { parseKRC, parseLRC, parseQRC } from '@/utils/lyrics/parserCore';
import { splitCombinedTimeline } from '@/utils/lyrics/timelineSplitter';

// test/unit/lyrics/threeTrackLyrics.test.ts
// Verifies that non-TTML parser formats retain independently aligned translation and romanization tracks.

describe('three-track lyrics', () => {
    it('aligns LRC translation and romanization tracks independently', () => {
        const lyrics = parseLRC(
            '[00:01.00]君のことが好き',
            '[00:01.00]我喜欢你',
            {},
            '[00:01.00]Kimi no koto ga suki',
        );

        expect(lyrics.lines[0]).toMatchObject({
            translation: '我喜欢你',
            romanization: 'Kimi no koto ga suki',
        });
    });

    it('aligns QRC translation and romanization tracks independently', () => {
        const lyrics = parseQRC(
            '[1000,500](1000,250)君(1250,250)を',
            '[00:01.00]喜欢你',
            {},
            '[00:01.00]Kimi wo',
        );

        expect(lyrics.lines[0]).toMatchObject({
            translation: '喜欢你',
            romanization: 'Kimi wo',
        });
    });

    it('aligns QRC auxiliary tracks even when their millisecond timestamps differ', () => {
        const lyrics = parseQRC(
            '[1000,500](1000,250)君(1250,250)を',
            '[1000,500](1000,250)喜(1250,250)欢',
            {},
            '[999,501](999,250)Kimi(1249,251) wo',
        );

        expect(lyrics.lines[0]).toMatchObject({
            translation: '喜欢',
            romanization: 'Kimi wo',
        });
    });

    it('reads KRC embedded phonetic and translation language tracks', () => {
        const language = Buffer.from(JSON.stringify({
            content: [
                { type: 0, lyricContent: [['Kimi', ' wo']] },
                { type: 1, lyricContent: [['喜欢你']] },
            ],
        })).toString('base64');
        const lyrics = parseKRC(`[language:${language}]\n[1000,500]<0,250,0>君<250,250,0>を`);

        expect(lyrics.lines[0]).toMatchObject({
            translation: '喜欢你',
            romanization: 'Kimi wo',
        });
    });

    it('only identifies an unambiguous Latin alternate as local romanization', () => {
        expect(splitCombinedTimeline([
            '[00:01.00]君のことが好き',
            '[00:01.00]我喜欢你',
            '[00:01.00]Kimi no koto ga suki',
        ].join('\n'))).toEqual({
            main: '[00:01.00]君のことが好き',
            trans: '[00:01.00]我喜欢你',
            romanization: '[00:01.00]Kimi no koto ga suki',
        });

        expect(splitCombinedTimeline([
            '[00:01.00]君のことが好き',
            '[00:01.00]I like you',
            '[00:01.00]Kimi no koto ga suki',
        ].join('\n'))).toMatchObject({
            romanization: '',
            trans: '[00:01.00]I like you',
        });
    });
});
