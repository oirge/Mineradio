import { getOnlineMusicProvider } from '../../services/onlineMusic/providerRegistry';
import type { AmllDbPlatform, LyricData, LyricProviderSource, SongResult } from '../../types';
import { calculateMatchScore } from './matchScore';
import { searchQQLyrics, fetchQQLyrics } from './providers/qqLyricProvider';
import { fetchAmllDbLyrics, getAmllDbMusicIds, searchAmllDbSongs } from './providers/amllDbProvider';
import { buildAmllDbSearchQueries, toAmllDbSongResults } from './amllDbCandidates';
import { applyNeteaseChorusByTime } from './chorusEffects';
import { hasRenderableLyrics } from './validity';

// src/utils/lyrics/lyricMatchSources.ts

const AMLL_DB_SEARCH_PAGE_SIZE = 50;
const AMLL_DB_MAX_RESULTS = 20;

export type LyricMatchSearchTarget = {
    title: string;
    artist: string;
    durationMs: number;
    album?: string;
};

export type LyricMatchFetchResult = {
    lyrics: LyricData | null;
    isPureMusic: boolean;
    matchedLyricsProviderPlatform?: AmllDbPlatform;
};

export const LYRIC_MATCH_SOURCES: readonly LyricProviderSource[] = ['netease', 'amll', 'qq', 'kugou'];

const sortByMatchScore = (songs: SongResult[], target: LyricMatchSearchTarget) => (
    [...songs].sort((a, b) => calculateMatchScore(target, b) - calculateMatchScore(target, a))
);

const hasChorusMarkers = (lyrics: LyricData | null): boolean => (
    Boolean(lyrics?.lines.some(line => line.isChorus))
);

// AMLL 官方搜索直接返回已收录的歌曲，不用再先搜网易云 / QQ 后逐个探测（#515）。
// 按 buildAmllDbSearchQueries 的顺序搜，有结果就停；请求失败（限流、网络错误）时直接停止，不再发兜底请求。
export async function searchAmllDbLyricCandidates(
    query: string,
    target: LyricMatchSearchTarget,
): Promise<SongResult[]> {
    for (const params of buildAmllDbSearchQueries(query)) {
        const items = await searchAmllDbSongs(params, AMLL_DB_SEARCH_PAGE_SIZE);
        if (items === null) {
            return [];
        }
        const candidates = toAmllDbSongResults(items);
        if (candidates.length > 0) {
            return sortByMatchScore(candidates, target).slice(0, AMLL_DB_MAX_RESULTS);
        }
    }
    return [];
}

export async function searchLyricsByMatchSource(
    source: LyricProviderSource,
    query: string,
    target: LyricMatchSearchTarget,
): Promise<SongResult[]> {
    if (source === 'netease') {
        const page = await getOnlineMusicProvider('netease')?.search?.searchSongs(query, 50, 0);
        return sortByMatchScore(page?.items || [], target);
    }
    if (source === 'qq') {
        return sortByMatchScore(await searchQQLyrics(query), target);
    }
    if (source === 'kugou') {
        const page = await getOnlineMusicProvider('kugou')?.search?.searchSongs(query, 50, 0);
        return sortByMatchScore(page?.items || [], target);
    }
    return searchAmllDbLyricCandidates(query, target);
}

export async function fetchLyricsForMatchSource(
    source: LyricProviderSource,
    selectedResult: SongResult,
): Promise<LyricMatchFetchResult | null> {
    if (source === 'netease') {
        const result = await getOnlineMusicProvider('netease')?.lyrics?.getLyrics(selectedResult);
        if (!result) return null;
        return {
            lyrics: hasRenderableLyrics(result.lyrics) ? result.lyrics : null,
            isPureMusic: result.isPureMusic,
        };
    }
    if (source === 'qq') {
        const lyrics = await fetchQQLyrics(selectedResult);
        return {
            lyrics: hasRenderableLyrics(lyrics) ? lyrics : null,
            isPureMusic: false,
        };
    }
    if (source === 'kugou') {
        const result = await getOnlineMusicProvider('kugou')?.lyrics?.getLyrics(selectedResult);
        if (!result) return null;
        return {
            lyrics: hasRenderableLyrics(result.lyrics) ? result.lyrics : null,
            isPureMusic: result.isPureMusic,
        };
    }

    const platform = selectedResult.amllDbPlatform;
    if (!platform) {
        return null;
    }
    const fetchedLyrics = await fetchAmllDbLyrics(platform, getAmllDbMusicIds(platform, selectedResult));
    const lyrics = hasRenderableLyrics(fetchedLyrics) ? fetchedLyrics : null;
    const chorusRanges = platform === 'ncm' && !hasChorusMarkers(lyrics)
        ? await getOnlineMusicProvider('netease')?.lyrics?.getChorusRanges?.(selectedResult.id) ?? []
        : [];

    return {
        lyrics: lyrics && chorusRanges.length > 0
            ? applyNeteaseChorusByTime(lyrics, chorusRanges)
            : lyrics,
        isPureMusic: false,
        matchedLyricsProviderPlatform: platform,
    };
}
