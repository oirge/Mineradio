import { describe, expect, it } from 'vitest';
import { hasNeteasePureMusicFlag, isPureMusicLyricLines, isPureMusicLyricText } from '../../../src/utils/lyrics/pureMusic';

// test/unit/lyrics/pureMusic.test.ts
// 纯音乐判定：覆盖提示语的常见写法，以及不能误判的普通歌词、无歌词和歌词里恰好带“纯音乐”的情形。

describe('isPureMusicLyricText', () => {
    it.each([
        '纯音乐，请欣赏',
        '纯音乐请欣赏',
        '纯音乐,请欣赏',
        '纯音乐 请欣赏',
        '纯音乐，请欣赏。',
        '纯音乐，请您欣赏',
        '此歌曲为没有填词的纯音乐，请您欣赏',
        '此歌曲为没有填词的纯音乐，请您欣赏！',
        '純音樂，請欣賞',
    ])('recognises the notice "%s" with or without a timestamp', notice => {
        expect(isPureMusicLyricText(notice)).toBe(true);
        expect(isPureMusicLyricText(`[00:00.00]${notice}`)).toBe(true);
        expect(isPureMusicLyricText(`[00:00.000] ${notice}\n`)).toBe(true);
    });

    it('recognises the notice when KRC splits it per character', () => {
        const krc = '[id:$00000000]\n[ti:某曲]\n[0,5000]<0,500,0>纯<500,500,0>音<1000,500,0>乐<1500,500,0>，<2000,500,0>请<2500,500,0>欣<3000,500,0>赏';
        expect(isPureMusicLyricText(krc)).toBe(true);
    });

    it('recognises the notice behind credit metadata lines', () => {
        const lrc = [
            '[00:00.00] 作曲 : 某某',
            '[00:01.00] 作词 : 某某',
            '[00:02.00]编曲：某某',
            '[00:03.00]纯音乐，请欣赏',
        ].join('\n');
        expect(isPureMusicLyricText(lrc)).toBe(true);
    });

    it('recognises the notice behind credit lines written without a colon', () => {
        const lrc = [
            '[00:00.00]编曲 某某',
            '[00:01.00]制作人 某某',
            '[00:02.00]Music by Foo',
            '[00:03.00]纯音乐，请欣赏',
        ].join('\n');
        expect(isPureMusicLyricText(lrc)).toBe(true);
        expect(isPureMusicLyricText('[00:00.00]鼓 声音很响\n[00:03.00]纯音乐，请欣赏')).toBe(true);
        expect(isPureMusicLyricText('[00:00.00]我爱你 很久了\n[00:03.00]纯音乐，请欣赏')).toBe(false);
    });

    it('recognises the notice behind a title line and JSON metadata', () => {
        const lrc = [
            '{"t":0,"c":[{"tx":"作曲: "}]}',
            '[00:00.00]某曲 - 某人',
            '[00:01.00]纯音乐，请欣赏',
        ].join('\n');
        expect(isPureMusicLyricText(lrc)).toBe(true);
    });

    it('does not treat missing or empty lyrics as instrumental', () => {
        expect(isPureMusicLyricText(null)).toBe(false);
        expect(isPureMusicLyricText(undefined)).toBe(false);
        expect(isPureMusicLyricText('')).toBe(false);
        expect(isPureMusicLyricText('[00:00.00]\n[00:05.00]')).toBe(false);
        expect(isPureMusicLyricText('[00:00.00] 作曲 : 某某\n[00:01.00] 作词 : 某某')).toBe(false);
    });

    it('does not treat a normal song with leading credits as instrumental', () => {
        const lrc = [
            '[00:00.00] 作词 : 某某',
            '[00:01.00] 作曲 : 某某',
            '[00:10.00]第一句歌词',
            '[00:15.00]第二句歌词',
        ].join('\n');
        expect(isPureMusicLyricText(lrc)).toBe(false);
    });

    it('does not treat a lyric line that merely contains the words as instrumental', () => {
        expect(isPureMusicLyricText('[00:10.00]我只听纯音乐，请欣赏这首歌')).toBe(false);
        expect(isPureMusicLyricText('[00:10.00]他喜欢纯音乐')).toBe(false);
        const lrc = [
            '[00:10.00]第一句歌词',
            '[00:15.00]纯音乐',
            '[00:20.00]第三句歌词',
        ].join('\n');
        expect(isPureMusicLyricText(lrc)).toBe(false);
    });

    it('does not treat a real song that also carries the notice line as instrumental', () => {
        const lrc = [
            '[00:10.00]第一句歌词',
            '[00:15.00]第二句歌词',
            '[00:20.00]纯音乐，请欣赏',
        ].join('\n');
        expect(isPureMusicLyricText(lrc)).toBe(false);
    });

    it('does not accept the bare phrase without the "please enjoy" part', () => {
        expect(isPureMusicLyricText('[00:00.00]纯音乐')).toBe(false);
    });
});

describe('isPureMusicLyricLines', () => {
    it('judges parsed lines with the same rule', () => {
        expect(isPureMusicLyricLines([{ fullText: '纯音乐 请欣赏' }])).toBe(true);
        expect(isPureMusicLyricLines([{ fullText: '作词 : A' }, { fullText: '纯音乐，请欣赏' }])).toBe(true);
        expect(isPureMusicLyricLines([{ fullText: '第一句' }, { fullText: '纯音乐，请欣赏' }])).toBe(false);
        expect(isPureMusicLyricLines([])).toBe(false);
        expect(isPureMusicLyricLines(null)).toBe(false);
    });
});

describe('hasNeteasePureMusicFlag', () => {
    it('reads the provider flag from any lyric track', () => {
        expect(hasNeteasePureMusicFlag({ lrc: { pureMusic: true } })).toBe(true);
        expect(hasNeteasePureMusicFlag({ pureMusic: true })).toBe(true);
        expect(hasNeteasePureMusicFlag({})).toBe(false);
        expect(hasNeteasePureMusicFlag(null)).toBe(false);
    });
});
