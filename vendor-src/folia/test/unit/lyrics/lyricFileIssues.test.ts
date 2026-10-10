import { describe, expect, it } from 'vitest';
import { detectLyricFileIssues } from '../../../src/utils/lyrics/lyricFileIssues';

// Trimmed from a user-reported "Sold Out" LRC: each translation carries the END time of the line it
// translates, and untranslated lines get a blank end-time slot.
const SHIFTED_LRC = [
    '[00:00.00]4分贝分享网 www.4FB.Cn',
    '[ti:Sold Out]',
    '[00:00.00]Sold Out - Hawk Nelson/Jonathan Steingard',
    '[00:00.13]   ',
    '[00:00.13]Lyrics by：Jon Steingard',
    '[00:00.40]   ',
    '[00:00.40]Hoo hoo hoo hey',
    '[00:16.23]   ',
    '[00:16.23]I ain\'t like no one you met before',
    '[00:20.08]我和你之前遇见的所有人都不一样',
    '[00:20.08]I\'m running for the front',
    '[00:21.61]我会奋勇向前 全力奔跑',
    '[00:21.61]When they\'re all running for the door',
    '[00:23.84]当人们都冲向那道门的时候',
    '[00:23.84]And I won\'t sit down won\'t back out',
    '[00:26.21]我不会坐以待毙 也不会退出',
    '[00:26.21]You can\'t ever shut me up',
    '[00:28.05]你永远不能对我指手划脚',
    '[00:28.05]',
].join('\r\n');

describe('detectLyricFileIssues', () => {
    it('flags translations stamped with the end time of their line', () => {
        expect(detectLyricFileIssues(SHIFTED_LRC)).toEqual(['translation-shifted-to-end-time']);
    });

    it('accepts ordinary bilingual LRC, including a blank instrumental gap', () => {
        const lrc = [
            '[00:10.00]I ain\'t like no one you met before',
            '[00:10.00]我和你之前遇见的所有人都不一样',
            '[00:14.00]I\'m running for the front',
            '[00:14.00]我会奋勇向前 全力奔跑',
            '[00:16.00]When they\'re all running for the door',
            '[00:16.00]当人们都冲向那道门的时候',
            '[00:30.00]',
            '[00:30.00]And I won\'t sit down won\'t back out',
            '[00:33.00]You can\'t ever shut me up',
            '[00:33.00]你永远不能对我指手划脚',
        ].join('\n');
        expect(detectLyricFileIssues(lrc)).toEqual([]);
    });

    it('accepts one-language LRC that marks every line end with a blank line', () => {
        const lrc = [
            '[00:10.00]是否对你承诺了太多',
            '[00:13.00]',
            '[00:13.00]还是我原本给的就不够',
            '[00:17.00]',
            '[00:17.00]你始终有千万种理由',
            '[00:20.00]',
        ].join('\n');
        expect(detectLyricFileIssues(lrc)).toEqual([]);
    });

    it('only inspects plain LRC', () => {
        expect(detectLyricFileIssues(SHIFTED_LRC, 'krc')).toEqual([]);
        expect(detectLyricFileIssues(undefined)).toEqual([]);
    });
});
