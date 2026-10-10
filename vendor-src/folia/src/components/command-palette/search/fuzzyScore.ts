// src/components/command-palette/search/fuzzyScore.ts
// 子序列打分器（fzf 的简化版），命令面板模糊档专用。
//
// 只在四个精确档全部落空时才会被调用，所以它的职责不是"找出最好的匹配"，而是"这条命令值不值得
// 出现在列表末尾"。打分单趟扫描、不分配中间数组，因为它会对每条未命中的命令各跑一次。

const BOUNDARY_CHARS = new Set([' ', '-', '_', ':', '|', '.', '/']);

const isBoundary = (character: string) => BOUNDARY_CHARS.has(character);

/** 连续命中的权重远高于零散命中，否则 'ee' 会在任何含两个 e 的长句里得高分。 */
const CONSECUTIVE_BONUS = 8;
const BOUNDARY_BONUS = 6;
const PLAIN_BONUS = 1;
const GAP_PENALTY = 0.5;
const LENGTH_PENALTY = 0.05;

/**
 * `needle` 是否是 `haystack` 的子序列，且质量值得展示；是则返回分数，否则返回 null。
 *
 * 两者都必须是已规范化（小写、空白折叠）的文本。needle 里的空格应由调用方先去掉——
 * 模糊档的语义是"这些字母按顺序出现过"，空格在这个语义下没有意义。
 *
 * **必须逐字段调用，不要传一个把所有字段拼起来的长串。** 子序列在长文本上几乎必然成立：
 * 实测把某条命令的标题、同义词、拼音拼成一串后，光里面的拼音就凑出了 12 个 z，于是
 * `zzzzzzzzzzzz` 成了它的合法子序列，空态再也出不来。字段越长，这个匹配就越没有意义。
 *
 * 分数扣完若不为正，说明命中是靠大量跳跃拼出来的，返回 null 而不是硬保一个底分——
 * 底分只会让垃圾结果照样进列表。
 */
export const scoreSubsequence = (haystack: string, needle: string): number | null => {
    if (!needle || !haystack || needle.length > haystack.length) {
        return null;
    }

    let cursor = 0;
    let score = 0;
    let gaps = 0;
    let previousIndex = -2;

    for (let i = 0; i < needle.length; i += 1) {
        const found = haystack.indexOf(needle[i], cursor);
        if (found < 0) {
            return null;
        }

        if (found === previousIndex + 1) {
            score += CONSECUTIVE_BONUS;
        } else if (found === 0 || isBoundary(haystack[found - 1])) {
            score += BOUNDARY_BONUS;
        } else {
            score += PLAIN_BONUS;
        }

        gaps += found - cursor;
        previousIndex = found;
        cursor = found + 1;
    }

    const raw = score - gaps * GAP_PENALTY - (haystack.length - needle.length) * LENGTH_PENALTY;
    return raw > 0 ? raw : null;
};
