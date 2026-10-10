import type { Line } from '../../types';
import { createStaffCreditMatcher, isColonShaped, isFillerLine, isSpacedStaffLine } from './staffCredits';

// src/utils/lyrics/pureMusic.ts
// 纯音乐判定的唯一入口：各 provider、缓存回放、visualizer 切换都应走 isPureMusicLyricText，
// 不要再各写一份 includes('纯音乐')。判定保守：只认「整行就是纯音乐提示语」的文本，
// 歌词正文里恰好出现“纯音乐”三个字、或者根本没有歌词，都不算纯音乐。

const LRC_TAG_PATTERN = /\[[^\]]*]/g;
// 逐字时间标签：KRC `<0,500,0>`、增强 LRC `<00:01.00>`、YRC `(0,500,0)`。
// 不去掉的话，酷狗按字拆开的“纯 音 乐”拼不回整句。
const WORD_TIMING_TAG_PATTERN = /<[\d:.,\s]*>|\(\d+,\d+,\d+\)/g;
const JSON_LINE_PATTERN = /^\s*\{.*}\s*$/;
const NOTICE_IGNORED_CHARS_PATTERN = /[\s\p{P}\p{S}]+/gu;

// 去掉空白与标点后整行匹配，覆盖“纯音乐，请欣赏”“纯音乐请欣赏”“纯音乐,请欣赏”“纯音乐 请欣赏”
// 以及“此歌曲为没有填词的纯音乐，请您欣赏”这类带前缀的写法（含繁体）。必须整行锚定。
const NOTICE_PREFIX = '(?:[此本](?:首)?(?:歌曲|曲目|作品|乐曲|曲)?[为是]?)?(?:(?:没有|无)(?:填词|歌词)的)?';
const PURE_MUSIC_NOTICE_LINE = new RegExp(`^${NOTICE_PREFIX}[纯純]音[乐樂]敬?[请請][您你]?欣[赏賞]$`);
// 标题行常见写法“歌名 - 歌手”。
const HEADER_LINE_PATTERN = /\s[-–—]\s/;
const isStaffCreditLine = createStaffCreditMatcher();

export const hasNeteasePureMusicFlag = (source?: {
    pureMusic?: boolean;
    lrc?: { pureMusic?: boolean };
    yrc?: { pureMusic?: boolean };
    ytlrc?: { pureMusic?: boolean };
    tlyric?: { pureMusic?: boolean };
} | null): boolean => {
    if (!source) return false;

    return Boolean(
        source.pureMusic
        || source.lrc?.pureMusic
        || source.yrc?.pureMusic
        || source.ytlrc?.pureMusic
        || source.tlyric?.pureMusic
    );
};

// 拆成去掉各类时间标签的非空行，并丢掉整行 JSON 元数据。
const splitCleanLyricLines = (text?: string | null): string[] => {
    if (!text) return [];

    return text
        .replace(/\uFEFF/g, '')
        .split(/\r?\n/)
        .map(line => line.replace(LRC_TAG_PATTERN, '').replace(WORD_TIMING_TAG_PATTERN, '').trim())
        .filter(line => line && !JSON_LINE_PATTERN.test(line));
};

const isPureMusicNoticeLine = (line: string): boolean => (
    PURE_MUSIC_NOTICE_LINE.test(line.replace(NOTICE_IGNORED_CHARS_PATTERN, ''))
);

// 提示语旁边允许出现的非歌词行：制作人员署名、“字段：内容”形状的元数据、“歌名 - 歌手”标题、纯符号占位。
const isNoticeCompanionLine = (line: string): boolean => {
    const asLine = { fullText: line } as Line;
    return isStaffCreditLine(asLine)
        || isColonShaped(asLine)
        || isSpacedStaffLine(asLine)
        || isFillerLine(asLine)
        || HEADER_LINE_PATTERN.test(line);
};

/**
 * 歌词文本是否明确标记为纯音乐：至少有一行整行就是纯音乐提示语，且除此之外只剩署名、元数据、
 * 标题或占位行。出现任何一行像真正的歌词就返回 false；空文本也返回 false（无歌词不等于纯音乐）。
 */
export const isPureMusicLyricText = (text?: string | null): boolean => {
    let hasNotice = false;
    for (const line of splitCleanLyricLines(text)) {
        if (isPureMusicNoticeLine(line)) {
            hasNotice = true;
            continue;
        }
        if (!isNoticeCompanionLine(line)) {
            return false;
        }
    }
    return hasNotice;
};

// 已经解析成行的歌词用同一条规则判定，供不经 provider 文本判定的来源（本地、Navidrome、QQ 等）兜底。
export const isPureMusicLyricLines = (lines: ReadonlyArray<{ fullText: string }> | null | undefined): boolean => (
    Boolean(lines?.length) && isPureMusicLyricText(lines!.map(line => line.fullText).join('\n'))
);
