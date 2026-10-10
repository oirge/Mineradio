import { pinyin } from 'pinyin-pro';

// dev/pinyin/pinyinTerms.mjs
// 拼音派生的纯函数，构建期插件（commandPinyinPlugin.mjs）和一次性 codemod
// （stripGeneratedKeywords.mjs）共用同一套规则——否则 codemod 判定「这个字符串是能被生成出来的」
// 和插件实际生成的东西会对不上，删错关键词。

/** CJK 统一表意文字，含扩展 A。命令文案里不会出现更冷僻的区段。 */
const CJK_RUN = /[一-鿿㐀-䶿]+/g;

export const containsCjk = (value) => /[一-鿿㐀-䶿]/.test(String(value));

/**
 * 取出字符串里的 CJK 片段，丢掉标点、空格、拉丁字母和数字。
 * `歌词动画：心象` -> ['歌词动画', '心象']
 */
export const splitCjkRuns = (value) => String(value).match(CJK_RUN) ?? [];

/**
 * 全拼，无声调、无分隔符，各 CJK 片段直接相连。
 * `歌词动画：心象` -> 'gecidonghuaxinxiang'
 *
 * 拼接而不是保留标点位置，是为了对齐手写关键词的既有写法——仓库里那上千个字符串全是这个形状。
 *
 * `v: true` 不是可选项：默认输出会把 ü 原样写出来（`过滤` -> `guolü`、`绿色` -> `lüse`），
 * 而 ü 在标准键盘上打不出来。拼音检索的全部意义就是键盘输入，所以必须用输入法惯用的 v 形式，
 * 手写关键词当年也是这么写的（`guolv`）。
 */
export const toFullPinyin = (value) => splitCjkRuns(value)
    .map(run => pinyin(run, { toneType: 'none', type: 'array', v: true }).join(''))
    .join('')
    .toLowerCase();

/**
 * 拼音首字母。`歌词动画：心象` -> 'gcdhxx'
 */
export const toInitials = (value) => splitCjkRuns(value)
    .map(run => pinyin(run, { pattern: 'first', toneType: 'none', type: 'array' }).join(''))
    .join('')
    .toLowerCase();

/** 与运行时检索用的规范化保持一致：trim、小写、空白折叠。 */
export const normalizeTerm = (value) => String(value).trim().toLowerCase().replace(/\s+/g, ' ');
