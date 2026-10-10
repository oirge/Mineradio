import { describe, expect, it } from 'vitest';
import { applyLyricStaffPolicy, buildLyricStaffPreview } from '@/utils/lyrics/staffCreditsPolicy';
import { parseLyricsByFormat } from '@/utils/lyrics/parserCore';
import type { Line, LyricData } from '@/types';

// test/unit/lyrics/staffCreditsPolicy.test.ts

const parse = (lrc: string) => parseLyricsByFormat('lrc', lrc);
const texts = (lyrics: { lines: { fullText: string }[] } | null) =>
    (lyrics?.lines ?? []).map(line => line.fullText).filter(text => text !== '......');

const DENSE_HEAD = [
    '[00:00.00]作词 : A',
    '[00:00.20]作曲 : B',
    '[00:00.40]编曲 : C',
    '[00:00.60]制作人 : D',
].join('\n');

describe('lyric staff credit policy', () => {
    it('keeps a dense staff block but spreads it across a long intro', () => {
        const lyrics = parse(`${DENSE_HEAD}\n[00:40.00]第一句歌词`);
        const preview = buildLyricStaffPreview(lyrics);

        expect(preview.decision.verdict).toBe('retime');
        expect(preview.decision.blockLineCount).toBe(4);

        const result = applyLyricStaffPolicy(lyrics);
        expect(texts(result)).toEqual(['作词 : A', '作曲 : B', '编曲 : C', '制作人 : D', '第一句歌词']);

        const staffLines = result!.lines.filter(line => line.fullText.includes(' : '));
        const gaps = staffLines.slice(1).map((line, index) => line.startTime - staffLines[index].startTime);
        gaps.forEach(gap => expect(gap).toBeGreaterThanOrEqual(1.5));
    });

    it('leaves an already readable staff block untouched', () => {
        const lyrics = parse('[00:00.00]作词 : A\n[00:05.00]作曲 : B\n[00:10.00]编曲 : C\n[00:40.00]第一句歌词');
        const preview = buildLyricStaffPreview(lyrics);

        expect(preview.decision.verdict).toBe('keep');
        expect(applyLyricStaffPolicy(lyrics)).toEqual(lyrics);
    });

    it('hides the whole block when the intro is only long enough for part of it', () => {
        const lyrics = parse('[00:00.50]作词 : A\n[00:00.70]作曲 : B\n[00:00.90]编曲 : C\n[00:01.10]混音 : D\n[00:05.00]第一句歌词');
        const preview = buildLyricStaffPreview(lyrics);

        expect(preview.decision.verdict).toBe('hide');
        expect(texts(applyLyricStaffPolicy(lyrics))).toEqual(['第一句歌词']);
    });

    it('extends the block past the dictionary through neighbouring credit-shaped lines', () => {
        const lyrics = parse([
            '[00:00.00]作词 Lyricist：A',
            '[00:00.20]作曲 Composer：B',
            '[00:00.40]指挥 Conductor：C',
            '[00:00.60]绞弦琴 Hurdy-Gurdy：D',
            '[00:02.00]第一句歌词',
        ].join('\n'));

        expect(buildLyricStaffPreview(lyrics).decision.blockLineCount).toBe(4);
        expect(texts(applyLyricStaffPolicy(lyrics))).toEqual(['第一句歌词']);
    });

    it('does not stop at long bilingual credit labels', () => {
        const lyrics = parse([
            '[00:00.00]作词 Lyricist：哈尼 Hani / 项柳 Hsiang Liu',
            '[00:00.20]作曲 Composer：菀迪萌 Dimeng Yuan (HOYO-MiX)',
            '[00:00.40]编曲 Arranger：菀迪萌 Dimeng Yuan (HOYO-MiX)',
            '[00:00.60]斯瓦希里语顾问 Swahili Language Consultant：Sarah Mirza',
            '[00:00.80]指挥 Conductor：Robert Ziegler',
            '[00:01.00]乐队 Orchestra：伦敦交响乐团 London Symphony Orchestra',
            '[00:01.20]印第安笛 Native American Flute / 排箫 Pan Flute / 盖那笛 Quena：Genshin Folk Ensemble',
            '[00:03.00]第一句歌词',
        ].join('\n'));

        expect(buildLyricStaffPreview(lyrics).decision.blockLineCount).toBe(7);
        expect(texts(applyLyricStaffPolicy(lyrics))).toEqual(['第一句歌词']);
    });

    it('matches bilingual cover and subtitle roles without spaces between languages', () => {
        const lyrics = parse([
            '[00:00.00]歌词字幕Subtitles：郭欣翔Hsin-Hsiang Kuo',
            '[00:00.20]单曲封面及标准字设计Cover&Title Card Designer ：吴建龙FKWU',
            '[00:00.40]单曲封面摄影Cover Photographer：郭欣翔Hsin-Hsiang Kuo',
            '[00:03.00]第一句歌词',
        ].join('\n'));

        expect(buildLyricStaffPreview(lyrics).decision.blockLineCount).toBe(3);
        expect(texts(applyLyricStaffPolicy(lyrics))).toEqual(['第一句歌词']);
    });

    it('takes the separator lines between credits with the block', () => {
        const lyrics = parse([
            '[00:00.00]作词 Lyricist：A',
            '[00:00.10]#',
            '[00:00.20]作曲 Composer：B',
            '[00:00.30]#',
            '[00:00.40]指挥 Conductor：C',
            '[00:00.50]#',
            '[00:00.60]乐队 Orchestra：D',
            '[00:00.70]//',
            '[00:02.00]第一句歌词',
        ].join('\n'));

        const preview = buildLyricStaffPreview(lyrics);
        expect(preview.decision.blockLineCount).toBe(4);
        expect(preview.decision.memberIndexes).toHaveLength(8);
        expect(texts(applyLyricStaffPolicy(lyrics))).toEqual(['第一句歌词']);
    });

    it('does not let structural extension swallow a lone colon-shaped lyric line', () => {
        const lyrics = parse('[00:00.00]作词 : A\n[00:00.20]作曲 : B\n[00:01.00]他说：我爱你\n[00:03.00]第一句歌词');

        const preview = buildLyricStaffPreview(lyrics);
        expect(preview.decision.blockLineCount).toBe(2);
        expect(texts(applyLyricStaffPolicy(lyrics))).toEqual(['他说：我爱你', '第一句歌词']);
    });

    it('hides the block when the intro cannot hold even one card', () => {
        const lyrics = parse(`${DENSE_HEAD}\n[00:02.00]第一句歌词`);
        const preview = buildLyricStaffPreview(lyrics);

        expect(preview.decision.verdict).toBe('hide');
        expect(texts(applyLyricStaffPolicy(lyrics))).toEqual(['第一句歌词']);
    });

    it('tolerates a leading title line before the staff block', () => {
        const lyrics = parse(
            '[00:00.00]某首歌 - 某歌手\n[00:01.00]作词 : A\n[00:01.20]作曲 : B\n[00:01.40]编曲 : C\n[00:03.00]第一句歌词'
        );

        expect(buildLyricStaffPreview(lyrics).decision.verdict).toBe('hide');
        expect(texts(applyLyricStaffPolicy(lyrics))).toEqual(['某首歌 - 某歌手', '第一句歌词']);
    });

    it('does not treat a colon-shaped lyric line as a credit block', () => {
        const lyrics = parse('[00:00.00]鼓起勇气：向前走\n[00:00.20]他说：我爱你\n[00:02.00]第一句歌词');

        expect(buildLyricStaffPreview(lyrics).decision.verdict).toBe('none');
        expect(applyLyricStaffPolicy(lyrics)).toEqual(lyrics);
    });

    it('needs at least two credit lines before it touches anything', () => {
        const lyrics = parse('[00:00.00]作词 : A\n[00:02.00]第一句歌词\n[00:06.00]第二句歌词');

        expect(buildLyricStaffPreview(lyrics).decision.verdict).toBe('none');
    });

    it('still matches the common combined and aliased credit formats', () => {
        const lyrics = parse([
            '[00:00.00]词曲：某某',
            '[00:00.20]混音/母带：X',
            '[00:00.40]鼓 Drums：Y',
            '[00:02.00]第一句歌词',
        ].join('\n'));

        expect(buildLyricStaffPreview(lyrics).decision.blockLineCount).toBe(3);
    });

    it('ignores credit-shaped lines that are not at the head', () => {
        const lyrics = parse('[00:01.00]第一句歌词\n[00:02.00]第二句歌词\n[00:03.00]演唱 : A\n[00:04.00]第三句歌词');

        expect(buildLyricStaffPreview(lyrics).decision.verdict).toBe('none');
        expect(applyLyricStaffPolicy(lyrics)).toEqual(lyrics);
    });

    it('retimes every nested timeline, not just the main words', () => {
        const richStaffLine = (text: string, startTime: number, endTime: number): Line => ({
            fullText: text,
            startTime,
            endTime,
            words: [{
                text,
                startTime,
                endTime,
                syllables: [{ text, startTime, endTime, ruby: [{ text: 'ruby', startTime, endTime }] }],
            }],
            alternateTexts: [{ role: 'translation', text: 'translated', syllables: [{ text: 'translated', startTime, endTime }] }],
            backgroundVocals: [{
                text: 'background',
                startTime,
                endTime,
                words: [{ text: 'background', startTime, endTime }],
            }],
        });

        const lyrics: LyricData = {
            lines: [
                richStaffLine('作词 : A', 0, 0.2),
                richStaffLine('作曲 : B', 0.2, 0.4),
                { fullText: '第一句歌词', startTime: 40, endTime: 44, words: [] },
            ],
        };

        expect(buildLyricStaffPreview(lyrics).decision.verdict).toBe('retime');

        const retimed = applyLyricStaffPolicy(lyrics)!.lines.find(line => line.fullText === '作词 : A')!;
        const word = retimed.words[0];
        const syllable = word.syllables![0];

        expect(retimed.startTime).toBe(0);
        expect(retimed.endTime).toBeGreaterThan(1.5);
        expect([word.startTime, syllable.startTime, syllable.ruby![0].startTime]).toEqual([
            retimed.startTime, retimed.startTime, retimed.startTime,
        ]);
        expect([word.endTime, syllable.endTime, syllable.ruby![0].endTime]).toEqual([
            retimed.endTime, retimed.endTime, retimed.endTime,
        ]);
        expect(retimed.alternateTexts![0].syllables![0]).toMatchObject({
            startTime: retimed.startTime,
            endTime: retimed.endTime,
        });
        expect(retimed.backgroundVocals![0]).toMatchObject({
            startTime: retimed.startTime,
            endTime: retimed.endTime,
        });
        expect(retimed.backgroundVocals![0].words[0]).toMatchObject({
            startTime: retimed.startTime,
            endTime: retimed.endTime,
        });
    });

    it('never touches lyrics under the keep policy and always hides under the hide policy', () => {
        const lyrics = parse(`${DENSE_HEAD}\n[00:40.00]第一句歌词`);

        expect(applyLyricStaffPolicy(lyrics, { policy: 'keep' })).toEqual(lyrics);
        expect(texts(applyLyricStaffPolicy(lyrics, { policy: 'hide' }))).toEqual(['第一句歌词']);
    });

    it('honours a custom staff pattern instead of the built-in dictionary', () => {
        const lyrics = parse('[00:00.00]Special Thanks : A\n[00:00.20]Special Thanks : B\n[00:02.00]第一句歌词');

        expect(buildLyricStaffPreview(lyrics).decision.verdict).toBe('none');
        expect(texts(applyLyricStaffPolicy(lyrics, { pattern: '^Special Thanks' }))).toEqual(['第一句歌词']);
    });

    it('respects the minimum dwell setting when sizing the intro budget', () => {
        const lyrics = parse('[00:00.00]作词 : A\n[00:00.20]作曲 : B\n[00:06.00]第一句歌词');

        expect(buildLyricStaffPreview(lyrics, { minDwellSeconds: 1.5 }).decision.verdict).toBe('retime');
        expect(buildLyricStaffPreview(lyrics, { minDwellSeconds: 4 }).decision.verdict).toBe('hide');
    });
});

describe('lyric staff credit absorption', () => {
    // 块首前面是一条 0.5 秒的标题行，后面是一条词表没认出来的署名行（同样 0.5 秒）。
    const WITH_NEIGHBOURS = [
        '[00:00.00]某首歌 - 某歌手',
        '[00:01.00]作词 : A',
        '[00:01.20]作曲 : B',
        '[00:01.40]编曲 : C',
        '[00:03.00]第一句歌词',
    ].join('\n');

    it('leaves the block alone while absorption is off', () => {
        const lyrics = parse(WITH_NEIGHBOURS);
        const preview = buildLyricStaffPreview(lyrics, { absorbMode: 'off' });

        expect(preview.decision.absorbedLineCount).toBe(0);
        expect(texts(applyLyricStaffPolicy(lyrics, { absorbMode: 'off' }))).toEqual([
            '某首歌 - 某歌手', '第一句歌词',
        ]);
    });

    it('folds the short line before the block into it', () => {
        const lyrics = parse(WITH_NEIGHBOURS);
        const preview = buildLyricStaffPreview(lyrics, { absorbMode: 'before' });

        expect(preview.decision.absorbedLineCount).toBe(1);
        expect(preview.decision.absorbedIndexes).toEqual([0]);
        // 吸收行进了 memberIndexes，隐藏判定下和署名行一起消失。
        expect(texts(applyLyricStaffPolicy(lyrics, { absorbMode: 'before' }))).toEqual(['第一句歌词']);
    });

    it('folds short lines on both sides of the block into it', () => {
        // 块后这条没有冒号，进不了词表也进不了结构续接，只能靠吸收带走。
        const lyrics = parse([
            '[00:00.00]某首歌 - 某歌手',
            '[00:01.00]作词 : A',
            '[00:01.20]作曲 : B',
            '[00:01.40]Genshin Folk Ensemble',
            '[00:02.50]第一句歌词',
        ].join('\n'));

        const preview = buildLyricStaffPreview(lyrics, { absorbMode: 'both' });

        expect(preview.decision.absorbedLineCount).toBe(2);
        expect(preview.decision.absorbedIndexes).toEqual([0, 3]);
        expect(texts(applyLyricStaffPolicy(lyrics, { absorbMode: 'both' }))).toEqual(['第一句歌词']);
    });

    it('folds a run of short lines however long it is', () => {
        // 边界只由「耗时过短」决定，不设行数上限：块后连续 6 条 0.2 秒的碎片要整段带走，
        // 末尾那条 Ah~ 唱足 5 秒，是耗时达标后停下来的地方。
        const lyrics = parse([
            '[00:00.00]作词 : A',
            '[00:00.20]作曲 : B',
            '[00:00.40]短行一',
            '[00:00.60]短行二',
            '[00:00.80]短行三',
            '[00:01.00]短行四',
            '[00:01.20]短行五',
            '[00:01.40]短行六',
            '[00:01.60]Ah~~~~~~',
            '[00:08.00]第一句歌词',
        ].join('\n'));

        const preview = buildLyricStaffPreview(lyrics, { absorbMode: 'both' });

        expect(preview.decision.blockLineCount).toBe(2);
        expect(preview.decision.absorbedLineCount).toBe(6);
        expect(preview.decision.absorbedIndexes).toEqual([2, 3, 4, 5, 6, 7]);
        expect(texts(applyLyricStaffPolicy(lyrics, { absorbMode: 'both' }))).toEqual(['Ah~~~~~~', '第一句歌词']);
    });

    it('judges absorption by duration, not by text length', () => {
        // 唱足 3 秒的 "Ah~" 字数很短，但耗时达标，不能被吸走。
        const lyrics = parse([
            '[00:00.00]作词 : A',
            '[00:00.20]作曲 : B',
            '[00:01.00]Ah~~~~~~',
            '[00:04.00]第一句歌词',
        ].join('\n'));

        const preview = buildLyricStaffPreview(lyrics, { absorbMode: 'both' });

        expect(preview.decision.absorbedLineCount).toBe(0);
        expect(texts(applyLyricStaffPolicy(lyrics, { absorbMode: 'both' }))).toEqual([
            'Ah~~~~~~', '第一句歌词',
        ]);
    });

    it('spreads absorbed lines together with the credits when the intro is long enough', () => {
        const lyrics = parse([
            '[00:00.00]某首歌 - 某歌手',
            '[00:01.00]作词 : A',
            '[00:01.20]作曲 : B',
            '[00:40.00]第一句歌词',
        ].join('\n'));

        const preview = buildLyricStaffPreview(lyrics, { absorbMode: 'before' });
        expect(preview.decision.verdict).toBe('retime');

        const result = applyLyricStaffPolicy(lyrics, { absorbMode: 'before' })!;
        expect(texts(result)).toEqual(['某首歌 - 某歌手', '作词 : A', '作曲 : B', '第一句歌词']);

        const spread = result.lines.slice(0, 3);
        const gaps = spread.slice(1).map((line, index) => line.startTime - spread[index].startTime);
        gaps.forEach(gap => expect(gap).toBeGreaterThanOrEqual(1.5));
    });

    it('counts absorbed lines in the required intro budget', () => {
        const lyrics = parse([
            '[00:00.00]某首歌 - 某歌手',
            '[00:01.00]作词 : A',
            '[00:01.20]作曲 : B',
            '[00:08.00]第一句歌词',
        ].join('\n'));

        const without = buildLyricStaffPreview(lyrics, { absorbMode: 'off' }).decision;
        const withAbsorb = buildLyricStaffPreview(lyrics, { absorbMode: 'before' }).decision;

        // 吸收进来的一行也要占一份停留时间，需要的秒数比不吸收时多一个 minDwell。
        expect(withAbsorb.requiredSeconds - without.requiredSeconds).toBeCloseTo(1.5, 5);
    });

    it('never swallows the last line while absorbing backwards', () => {
        const lyrics = parse([
            '[00:00.00]作词 : A',
            '[00:00.20]作曲 : B',
            '[00:00.40]第一句歌词',
            '[00:00.60]第二句歌词',
        ].join('\n'));

        const preview = buildLyricStaffPreview(lyrics, { absorbMode: 'both' });

        expect(preview.decision.absorbedLineCount).toBe(1);
        expect(texts(applyLyricStaffPolicy(lyrics, { absorbMode: 'both' }))).toEqual(['第二句歌词']);
    });

    it('reports no absorption when there is no block', () => {
        const lyrics = parse('[00:01.00]第一句歌词\n[00:04.00]第二句歌词');

        expect(buildLyricStaffPreview(lyrics, { absorbMode: 'both' }).decision.absorbedLineCount).toBe(0);
    });
});
