import { describe, expect, it } from 'vitest';
import { scoreSubsequence } from '../../../src/components/command-palette/search/fuzzyScore';

// test/unit/command-palette/fuzzyScore.test.ts
// 模糊档的打分器。它只在四个精确档全部落空时才被调用，所以这里验的是「排序是否合理」，
// 而不是「能否命中」——能命中的东西早就在上面的档位里了。

describe('scoreSubsequence', () => {
    it('returns null when the needle is not a subsequence', () => {
        expect(scoreSubsequence('open options', 'zzz')).toBeNull();
        // 顺序不对也不算子序列：'open options' 里 t 之后再没有 p。
        expect(scoreSubsequence('open options', 'tp')).toBeNull();
    });

    it('returns null for an empty needle or an over-long one', () => {
        expect(scoreSubsequence('open options', '')).toBeNull();
        expect(scoreSubsequence('ab', 'abc')).toBeNull();
    });

    it('scores a consecutive run above a scattered one', () => {
        const consecutive = scoreSubsequence('visualizer picker', 'visu');
        const scattered = scoreSubsequence('visualizer picker', 'vszr');

        expect(consecutive).not.toBeNull();
        expect(scattered).not.toBeNull();
        expect(consecutive!).toBeGreaterThan(scattered!);
    });

    it('rewards matches that start on a word boundary', () => {
        const onBoundaries = scoreSubsequence('open panel queue', 'opq');
        const midWord = scoreSubsequence('xxopenxxpanelxxqueue', 'opq');

        expect(onBoundaries).not.toBeNull();
        expect(midWord).not.toBeNull();
        expect(onBoundaries!).toBeGreaterThan(midWord!);
    });

    it('prefers the shorter haystack when the match is otherwise identical', () => {
        const short = scoreSubsequence('abc', 'abc');
        const long = scoreSubsequence('abc plus a lot of trailing text', 'abc');

        expect(short!).toBeGreaterThan(long!);
    });

    it('never returns a non-positive score for a real match', () => {
        const score = scoreSubsequence('a very long haystack with scattered letters indeed', 'ayg');
        expect(score).not.toBeNull();
        expect(score!).toBeGreaterThan(0);
    });
});
