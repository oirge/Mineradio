import { describe, expect, it } from 'vitest';
import { getCommandPaletteMatches } from '../../../src/components/command-palette/commandRegistry';

// test/unit/command-palette/commandRanking.test.ts
// 新增的模糊档，以及 input 档那个切片修复。
//
// 既有的档位语义由 commandRegistry.test.ts 覆盖（那份文件一行没改，正是它证明了这次重构
// 没有让任何原本能匹配的东西倒退）。这里只补它没有的两块。

const idsOf = (query: string) => getCommandPaletteMatches(query).map(match => match.command.id);

describe('command ranking: fuzzy tier', () => {
    it('finds a command by a subsequence that no exact tier would match', () => {
        // 'vslzr' 既不是任何触发词的前缀，也不是任何触发词的子串——只有子序列匹配能命中。
        const ids = idsOf('vslzr');
        expect(ids.some(id => id.startsWith('visualizer'))).toBe(true);
    });

    it('ranks every fuzzy hit below every tiered hit', () => {
        // 'que' 对 queue 是 prefix 档；同一批结果里若还有靠模糊命中的命令，必须全部排在其后。
        const matches = getCommandPaletteMatches('que');
        const queueIndex = matches.findIndex(match => match.command.id === 'queue');

        expect(queueIndex).toBe(0);
        // 模糊档的分数上限是 50，分档命中的最低分远高于它，所以用分数就能区分两类。
        const tieredCount = matches.filter(match => match.score > 50).length;
        matches.slice(0, tieredCount).forEach(match => expect(match.score).toBeGreaterThan(50));
    });

    it('returns nothing when the query is not even a subsequence', () => {
        expect(idsOf('qqqqzzzzxxxx')).toEqual([]);
    });

    it('does not match a repeated letter that only adds up across fields', () => {
        // 真实回归：曾经把某条命令的标题、同义词、拼音拼成一整串再做子序列匹配，
        // 光拼音里就凑出了 12 个 z，于是 zzzzzzzzzzzz 成了合法子序列，空态再也出不来。
        // 模糊匹配必须逐字段进行。
        expect(idsOf('zzzzzzzzzzzz')).toEqual([]);
    });

    it('withholds the fuzzy tier from single-character queries', () => {
        // 单字符子序列几乎命中一切，只会把列表变成噪声。一个字符仍可以走 prefix/contains。
        const matches = getCommandPaletteMatches('q');
        expect(matches.every(match => match.score > 50)).toBe(true);
    });

    it('withholds the fuzzy tier from CJK queries', () => {
        // 中文查询要么子串命中，要么结果纯属噪声——逐字子序列在中文里没有意义。
        expect(idsOf('播歌词随便凑几个字')).toEqual([]);
    });
});

describe('command ranking: input tier', () => {
    it('slices the input by words, not by raw keyword length', () => {
        // 原实现是 query.trim().slice(keyword.length)，拿原始查询按原始关键词的字符长度切。
        // 查询里有折叠空白时偏移就错了。
        const [match] = getCommandPaletteMatches('search   touhou');

        expect(match.command.id).toBe('search-current');
        expect(match.input).toBe('touhou');
    });

    it('preserves the original casing of what the user typed', () => {
        const [match] = getCommandPaletteMatches('search Bad Apple');

        expect(match.command.id).toBe('search-current');
        expect(match.input).toBe('Bad Apple');
    });

    it('slices on the longest matching trigger of the winning command', () => {
        // search-local 同时声明了 'local' 和 'search local'。两个都能命中 input 档，
        // 切片必须按最长的那个来，否则剩下的输入里会多带一个词。
        const [match] = getCommandPaletteMatches('search local Bad Apple');

        expect(match.command.id).toBe('search-local');
        expect(match.input).toBe('Bad Apple');
    });
});
