import type { AmllDbPlatform, SongResult } from '../../types';
import type { AmllApiSearchParams, AmllApiSongItem } from './providers/amllApi';

// src/utils/lyrics/amllDbCandidates.ts
// AMLL 官方搜索结果到歌词匹配候选的纯映射。

const QUERY_SEPARATOR = /\s+-\s+/u;
// 不含 /：本地歌手已在入库时按 / 拆分，剩下的 / 多半是名字的一部分（如 AC/DC）
const ARTIST_SEPARATOR = /\s*[,，、&]\s*|\s+(?:feat\.?|ft\.?)\s+/iu;

// 去掉歌名末尾的括号说明，如「Idol (TV Size)」→「Idol」。musicName 按包含匹配，带后缀就搜不到原曲
const stripTitleSuffix = (title: string): string => (
    title.replace(/(?:\s*[(\[（【][^)\]）】]*[)\]）】])+\s*$/u, '').trim() || title
);

// 默认查询是「歌名 - 歌手 - 专辑」，按结构化参数搜，有结果就停：
//   歌名 + 第一位歌手 → 去掉括号后缀的歌名 + 第一位歌手 → 只用去掉后缀的歌名。
// 结构化参数不匹配歌词正文，短歌名（如「雨」）不会搜出一堆正文里有这个字的歌。
// 不含「 - 」的输入（只有歌名，或手动输入的关键词）先当歌名搜，搜不到再用 q 整体搜
// （q 同时匹配曲名、歌手、专辑和歌词正文）。
export function buildAmllDbSearchQueries(query: string): AmllApiSearchParams[] {
    const parts = query.split(QUERY_SEPARATOR).map(part => part.trim()).filter(Boolean);
    if (parts.length === 0) {
        return [];
    }
    if (parts.length === 1) {
        return [{ musicName: parts[0] }, { q: parts[0] }];
    }

    const [musicName, artist] = parts;
    const baseName = stripTitleSuffix(musicName);
    const artistName = artist.split(ARTIST_SEPARATOR)[0]?.trim();
    const queries: AmllApiSearchParams[] = artistName ? [{ musicName, artistName }] : [];
    if (artistName && baseName !== musicName) {
        queries.push({ musicName: baseName, artistName });
    }
    queries.push({ musicName: baseName });
    return queries;
}

const toMediaId = (value: string): string | number => (
    /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : value
);

// 候选的 id 用平台 ID（优先网易云，其次 QQ），与按平台 ID 取歌词、已保存的匹配记录保持一致；
// 两个平台都没有的条目 Folia 无法关联，跳过。
// artistNames / musicNames / albumNames 是同一对象的多语言别名，不是合作歌手列表：
// 这里全部放进 artists 只为匹配评分能认出译名，不能当作歌曲元数据写入本地库（见 sourceProvidesSongMetadata）。
export function toAmllDbSongResult(item: AmllApiSongItem): SongResult | null {
    const ncmId = item.ncmMusicIds?.[0];
    const qqId = item.qqMusicIds?.[0];
    const platform: AmllDbPlatform | null = ncmId ? 'ncm' : qqId ? 'qq' : null;
    const platformId = ncmId ?? qqId;
    if (!platform || !platformId) {
        return null;
    }

    const id = toMediaId(platformId);
    return {
        id,
        name: item.musicNames?.[0] || 'Unknown Song',
        artists: (item.artistNames ?? []).map((name, index) => ({ id: index, name })),
        album: { id: 0, name: item.albumNames?.[0] ?? '' },
        // 官方搜索不返回时长，评分时时长项按未知处理
        durationMs: 0,
        amllDbPlatform: platform,
        ...(platform === 'qq' && typeof id === 'string' ? { qqMid: id } : {}),
    };
}

// 同一首歌的多个历史版本共享平台 ID，只保留排在前面的一条（官方按相关性、时间、id 排序）。
// 显示的名称可能来自旧版本；取歌词时按平台 ID 查，官方返回的是最新记录。
export function toAmllDbSongResults(items: readonly AmllApiSongItem[]): SongResult[] {
    const seen = new Set<string>();
    const results: SongResult[] = [];
    for (const item of items) {
        const result = toAmllDbSongResult(item);
        if (!result) {
            continue;
        }
        // 各版本的 ID 列表顺序可能不同，任一平台 ID 重复就视为同一首歌
        const keys = [
            ...(item.ncmMusicIds ?? []).map(id => `ncm:${id}`),
            ...(item.qqMusicIds ?? []).map(id => `qq:${id}`),
        ];
        if (keys.some(key => seen.has(key))) {
            continue;
        }
        keys.forEach(key => seen.add(key));
        results.push(result);
    }
    return results;
}
