import { describe, expect, it } from 'vitest';
import { extractAwlrcContainer } from '@/utils/lyrics/awlrcContainer';
import { parseLyricsByFormat } from '@/utils/lyrics/parserCore';

// test/unit/lyrics/awlrcContainer.test.ts

const encode = (text: string) => Buffer.from(text, 'utf8').toString('base64');

const buildContainer = (tracks: Record<string, string>) => (
    `[awlrc:${Object.entries(tracks).map(([key, value]) => `${key}:${encode(value)}`).join(',')}]`
);

// KuGou exports repeat the lyric three times in the body (original / translation / phonetic),
// each block restarting from zero, and hide the authoritative data in the trailing container.
const REDUNDANT_BODY = [
    '[ar:Artist]',
    '[ti:Title]',
    '[00:01.000]原文一',
    '[00:03.000]原文二',
    '',
    '[00:01.000]翻译一',
    '[00:03.000]翻译二',
    '',
].join('\n');

const AWLRC_TRACK = [
    '[ti:Title]',
    '[ar:Artist]',
    '[00:00.0]<0,200>标题行',
    '[00:01.000]<0,400>原<400,600>文<1000,500>一',
    '[00:03.000]<0,500>原<500,500>文<1000,900>二',
].join('\n');

const LRC_TRACK = '[00:01.000]原文一\n[00:03.000]原文二';
const TLRC_TRACK = '[00:00.0]\n[00:01.000]翻译一\n[00:03.000]翻译二';
const ROMAJI_TRACK = '[00:00.0]\n[00:01.000]ge n bu n i chi\n[00:03.000]ge n bu n ni';
// Kugou puts a han-character singalong transliteration in `rlrc` for Korean tracks.
const HAN_TRANSLIT_TRACK = '[00:00.0]\n[00:01.000]刚不你 卡几吗\n[00:03.000]哦莫尼 撒浪嘿';

describe('extractAwlrcContainer', () => {
    it('decodes every track of the trailing container', () => {
        const tracks = extractAwlrcContainer(`${REDUNDANT_BODY}\n${buildContainer({
            lrc: LRC_TRACK,
            tlrc: TLRC_TRACK,
            rlrc: ROMAJI_TRACK,
            awlrc: AWLRC_TRACK,
        })}`);

        expect(tracks).not.toBeNull();
        expect(tracks?.lrc).toBe(LRC_TRACK);
        expect(tracks?.tlrc).toBe(TLRC_TRACK);
        expect(tracks?.rlrc).toBe(ROMAJI_TRACK);
        expect(tracks?.awlrc).toBe(AWLRC_TRACK);
    });

    it('drops a han-transliteration phonetic track but keeps a latin romanization one', () => {
        const withTranslit = extractAwlrcContainer(buildContainer({
            lrc: LRC_TRACK,
            rlrc: HAN_TRANSLIT_TRACK,
            awlrc: AWLRC_TRACK,
        }));
        expect(withTranslit?.rlrc).toBeUndefined();
        expect(withTranslit?.awlrc).toBe(AWLRC_TRACK);

        const withRomaji = extractAwlrcContainer(buildContainer({ rlrc: ROMAJI_TRACK, awlrc: AWLRC_TRACK }));
        expect(withRomaji?.rlrc).toBe(ROMAJI_TRACK);
    });

    it('returns null for plain lyrics and skips undecodable tracks', () => {
        expect(extractAwlrcContainer('[00:01.000]just a normal lrc')).toBeNull();
        expect(extractAwlrcContainer('')).toBeNull();
        expect(extractAwlrcContainer(undefined)).toBeNull();

        const partial = extractAwlrcContainer(`[awlrc:tlrc:!!!not-base64!!!,awlrc:${encode(AWLRC_TRACK)}]`);
        expect(partial?.awlrc).toBe(AWLRC_TRACK);
    });
});

describe('parseLyricsByFormat("awlrc")', () => {
    const parse = (awlrc = AWLRC_TRACK, trans = TLRC_TRACK, romanization = ROMAJI_TRACK) => (
        parseLyricsByFormat('awlrc', awlrc, trans, { includeInterludes: false }, romanization)
    );

    it('builds word-by-word lines and reads the metadata tags', () => {
        const data = parse();

        expect(data.isWordByWord).toBe(true);
        expect(data.title).toBe('Title');
        expect(data.artist).toBe('Artist');

        const line = data.lines.find(entry => entry.fullText === '原文一')!;
        expect(line.startTime).toBeCloseTo(1);
        expect(line.endTime).toBeCloseTo(2.5);
        expect(line.words.map(word => word.text)).toEqual(['原', '文', '一']);
        expect(line.words[1].startTime).toBeCloseTo(1.4);
        expect(line.words[1].endTime).toBeCloseTo(2);
    });

    it('accepts one-digit fractions in the line head', () => {
        expect(parse().lines.some(entry => entry.fullText === '标题行')).toBe(true);
    });

    it('reads the fraction as a verbatim millisecond count rather than an LRC fraction', () => {
        // LX writes `time % 1000` without padding, so `.97` is 97ms and `.5` is 5ms.
        // Reading them as `.970` / `.500` would shift the lines by nearly a second.
        const track = [
            '[00:01.97]<0,100>甲',
            '[00:02.5]<0,100>乙',
            '[00:03.120]<0,100>丙',
        ].join('\n');
        const lines = parseLyricsByFormat('awlrc', track, '', { includeInterludes: false }).lines;

        expect(lines[0].startTime).toBeCloseTo(1.097);
        expect(lines[1].startTime).toBeCloseTo(2.005);
        expect(lines[2].startTime).toBeCloseTo(3.12);
    });

    it('accepts the one-, two- and three-field line heads LX can emit', () => {
        const track = [
            '[09.500]<0,100>秒',
            '[01:02.250]<0,100>分',
            '[01:02:03.750]<0,100>时',
        ].join('\n');
        const lines = parseLyricsByFormat('awlrc', track, '', { includeInterludes: false }).lines;

        expect(lines.map(entry => entry.startTime)).toEqual([9.5, 62.25, 3723.75]);
    });

    it('normalises the three-field syllable tag KRC sources still carry', () => {
        const lines = parseLyricsByFormat('awlrc', '[00:01.000]<0,400,0>原<400,600,0>文', '', { includeInterludes: false }).lines;

        expect(lines[0].fullText).toBe('原文');
        expect(lines[0].words.map(word => word.text)).toEqual(['原', '文']);
        expect(lines[0].endTime).toBeCloseTo(2);
    });

    it('reads alternate tracks with awlrc timestamp semantics so exact alignment holds', () => {
        const data = parseLyricsByFormat(
            'awlrc',
            '[00:01.97]<0,100>原文',
            '[00:01.97]翻译',
            { includeInterludes: false },
            '[00:01.97]romaji',
        );

        expect(data.lines[0].startTime).toBeCloseTo(1.097);
        expect(data.lines[0].translation).toBe('翻译');
        expect(data.lines[0].romanization).toBe('romaji');
    });

    it('keeps alternate tracks on their exact timestamp instead of the nearest one', () => {
        // The `[00:00.0]` rows of both alternate tracks are blank, so the title line must stay bare
        // rather than borrowing the 1.0s translation through a nearest-neighbour match.
        const titleLine = parse().lines.find(entry => entry.fullText === '标题行')!;
        expect(titleLine.translation).toBeUndefined();
        expect(titleLine.romanization).toBeUndefined();

        const line = parse().lines.find(entry => entry.fullText === '原文一')!;
        expect(line.translation).toBe('翻译一');
        expect(line.romanization).toBe('ge n bu n i chi');
    });

    it('repairs zero-duration syllables, backwards markers and out-of-order lines', () => {
        const messy = [
            '[00:03.000]<0,300>后<300,0>面<200,400>行',
            '[00:01.000]<0,400>前<400,400>面<800,9000>行',
        ].join('\n');
        const lines = parseLyricsByFormat('awlrc', messy, '', { includeInterludes: false }).lines;

        expect(lines.map(entry => entry.fullText)).toEqual(['前面行', '后面行']);
        for (const line of lines) {
            expect(line.endTime).toBeGreaterThanOrEqual(line.startTime);
            for (let index = 1; index < line.words.length; index += 1) {
                expect(line.words[index].startTime).toBeGreaterThanOrEqual(line.words[index - 1].startTime);
                expect(line.words[index].endTime).toBeGreaterThan(line.words[index].startTime);
            }
        }
        // The padded final syllable must not push the first line past the second line's start.
        expect(lines[0].endTime).toBeLessThanOrEqual(lines[1].startTime);
    });
});
