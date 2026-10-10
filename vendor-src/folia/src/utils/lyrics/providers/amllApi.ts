import type { AmllDbPlatform } from '../../../types';

// src/utils/lyrics/providers/amllApi.ts
// AMLL TTML DB 官方 API 客户端：https://amll.dev/reference/http-api/overview
//
// 请求路径：
// - 网页版由浏览器直连（API 返回 CORS *）。不经 /api/lyric-proxy：经代理时所有用户共用出口 IP，
//   容易撞上官方单 IP 平均 50 次/秒的限流。浏览器不允许改 UA，网页版请求带的是浏览器自己的 UA。
// - Electron 走主进程代理，带上可识别的 UA（#515），方便上游区分官方构建和 fork。

const AMLL_API_BASE_URL = 'https://api.amll.dev';
const AMLL_API_TIMEOUT_MS = 5000;

const PLATFORM_QUERY_KEYS: Record<AmllDbPlatform, string> = {
    ncm: 'ncmMusicId',
    qq: 'qqMusicId',
};

// 官方 API 的歌曲条目。搜索接口不返回 lyrics / format 字段。
export interface AmllApiSongItem {
    id: number;
    filename: string;
    createdAt: number;
    musicNames: string[];
    artistNames: string[];
    albumNames: string[];
    ncmMusicIds: string[];
    qqMusicIds: string[];
    appleMusicIds: string[];
    spotifyIds: string[];
    isrcs: string[];
    authorIds: string[];
    authorUsernames: string[];
    lyrics?: string | null;
    format?: string | null;
}

export interface AmllApiSearchPage {
    items: AmllApiSongItem[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
        hasMore: boolean;
    };
}

// 同一平台传多个 ID 时官方按交集匹配，所以一次只查一个 ID
export const buildAmllApiLyricsUrl = (platform: AmllDbPlatform, musicId: number | string): string => (
    `${AMLL_API_BASE_URL}/v1/lyrics/get?${new URLSearchParams({ [PLATFORM_QUERY_KEYS[platform]]: String(musicId) })}`
);

// q：按词匹配曲名、歌手、专辑和歌词正文，多个词之间取交集，不分大小写和顺序。
// musicName / artistName：分别模糊包含曲名、歌手，参数之间取交集；不会匹配到歌词正文。
export type AmllApiSearchParams = { q: string } | { musicName: string; artistName?: string };

export const buildAmllApiSearchUrl = (params: AmllApiSearchParams, pageSize: number): string => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value) {
            search.set(key, value);
        }
    }
    search.set('pageSize', String(pageSize));
    return `${AMLL_API_BASE_URL}/v1/lyrics/search?${search}`;
};

// 例：Folia/0.7.16-537fa57 (chthollyphile/folia-major)。单测等没有构建常量的环境返回 null。
function getAmllApiUserAgent(): string | null {
    if (typeof __APP_VERSION__ === 'undefined') {
        return null;
    }
    const commit = typeof __BUILD_COMMIT__ === 'undefined' ? 'dev' : __BUILD_COMMIT__;
    const repo = typeof __BUILD_REPO__ === 'undefined' ? 'unknown' : __BUILD_REPO__;
    return `Folia/${__APP_VERSION__}-${commit} (${repo})`;
}

async function requestAmllApi(url: string): Promise<{ status: number; bodyText: string }> {
    const electronBridge = typeof window === 'undefined' ? undefined : window.electron;
    if (electronBridge?.fetchLyricProxy) {
        const userAgent = getAmllApiUserAgent();
        const response = await electronBridge.fetchLyricProxy(url, {
            method: 'GET',
            ...(userAgent ? { headers: { 'User-Agent': userAgent } } : {}),
        });
        return { status: response.status, bodyText: response.bodyText };
    }

    const response = await fetch(url, {
        credentials: 'omit',
        signal: AbortSignal.timeout(AMLL_API_TIMEOUT_MS),
    });
    return { status: response.status, bodyText: await response.text() };
}

// 返回 { status, data } 里的 data。未收录（404）、限流（429）和其他非 200 都返回 null，不重试；
// 网络错误、超时和响应体不是 JSON 时抛出，由调用方记日志。
export async function getAmllApiData<T>(url: string): Promise<T | null> {
    const { status, bodyText } = await requestAmllApi(url);
    if (status === 429) {
        console.warn('[AMLLDB] Rate limited by api.amll.dev');
    }
    if (status !== 200) {
        return null;
    }

    const body = JSON.parse(bodyText) as { status?: number; data?: T | null };
    return body.status === 200 && body.data ? body.data : null;
}
