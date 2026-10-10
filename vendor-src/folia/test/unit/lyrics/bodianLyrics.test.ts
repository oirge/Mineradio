import { describe, expect, it } from 'vitest';
import { parseBodianLyrics } from '@/utils/lyrics/bodianLyrics';

// test/unit/lyrics/bodianLyrics.test.ts — adapt decoded API text through Folia's shared parsers.

describe('Bodian lyric adaptation', () => {
    it('preserves decoded word timing in the common model', () => {
        const result = parseBodianLyrics({ mainText: '[00:29.264]甲乙丙',
            wordByWordText: '[00:29.264]<0,390>甲<390,392>乙<782,448>丙' });
        expect(result.lyrics?.isWordByWord).toBe(true);
        const words = result.lyrics!.lines.find(line => line.fullText === '甲乙丙')!.words;
        expect(words[0].startTime).toBeCloseTo(29.264);
        expect(words[0].endTime).toBeCloseTo(29.654);
        expect(words[2].startTime).toBeCloseTo(30.046);
        expect(words[2].endTime).toBeCloseTo(30.494);
    });
    it('falls back to line lyrics without a valid word track', () => {
        const result = parseBodianLyrics({ mainText: '[00:01.000]甲', wordByWordText: null });
        expect(result.lyrics?.lines[0].fullText).toBe('甲');
        expect(result.wordByWordText).toBeUndefined();
    });
    it('distinguishes missing lyrics from a declared instrumental', () => {
        expect(parseBodianLyrics({ mainText: '', wordByWordText: null })).toMatchObject({ lyrics: null, isPureMusic: false });
        expect(parseBodianLyrics({ mainText: '[00:00.000]纯音乐，请欣赏', wordByWordText: null })).toMatchObject({ isPureMusic: true });
    });
});
