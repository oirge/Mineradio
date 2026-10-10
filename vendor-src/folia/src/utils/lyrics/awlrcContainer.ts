// src/utils/lyrics/awlrcContainer.ts
// 解析洛雪音乐（LX Music）写在 LRC 末尾的 `[awlrc:lrc:B64,tlrc:B64,rlrc:B64,awlrc:B64]` 容器。
// 四个键对应洛雪内部的 lyric / tlyric / rlyric / lxlyric，其中 lxlyric 是逐字歌词。
// 洛雪导出时会把原文、翻译、罗马音按 `\n\n` 依次拼成正文分块（各块时间戳都从头重来）再附上本容器，
// 正文只是给不认识容器的播放器看的降级视图，容器才是权威数据，因此命中容器时直接取容器、跳过正文。
// 参考：lx-music-desktop src/renderer/worker/download/lrcTool.ts

// Matches LX Music's own container probe (`/\[awlrc:(.+)\]/`) — unanchored, so the tag is found
// wherever the writer put it. Base64 payloads contain no `]`, so the greedy group stays inside the tag.
const AWLRC_CONTAINER_REGEX = /\[awlrc:(.+)\]/;
const CJK_SCRIPT_REGEX = /[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/gu;
const LATIN_LETTER_REGEX = /[A-Za-z]/g;

export interface AwlrcContainerTracks {
    /** 洛雪 `lyric`：逐行原文，无逐字时轴。 */
    lrc?: string;
    /** 洛雪 `tlyric`：翻译轨。 */
    tlrc?: string;
    /** 洛雪 `rlyric`：罗马音轨；汉字音译会在提取阶段被丢弃，不会出现在这里。 */
    rlrc?: string;
    /** 洛雪 `lxlyric`：逐字时轴轨，`[mm:ss.ms]<相对行首偏移ms,时长ms>text` 形式。 */
    awlrc?: string;
}

/** base64 解码，兼容 worker/浏览器（无 Buffer）与 Node 测试环境。 */
const decodeBase64Utf8 = (value: string): string => {
    let padded = value.trim();
    while (padded.length % 4 !== 0) {
        padded += '=';
    }

    if (typeof Buffer !== 'undefined') {
        return Buffer.from(padded, 'base64').toString('utf8');
    }

    return new TextDecoder('utf-8').decode(Uint8Array.from(atob(padded), char => char.charCodeAt(0)));
};

/**
 * `rlrc` 的语义在酷狗侧不固定：日文歌放拉丁罗马音，韩文歌放汉字谐音音译（例：슬퍼하지마 -> 丝跑哈几吗）。
 * 音译轨在本项目里没有承载位置——副字幕只有 translation/romanization 两档，挂上去会让"罗马音"标签名不副实，
 * 因此直接丢弃。逐行判定会被原文夹带的英文单词干扰，所以按整轨字符构成统计。
 */
const isHanTransliteration = (track: string): boolean => {
    const cjkCount = (track.match(CJK_SCRIPT_REGEX) || []).length;
    const latinCount = (track.match(LATIN_LETTER_REGEX) || []).length;
    return cjkCount > latinCount;
};

/**
 * 从 LRC 正文里取出 `[awlrc:...]` 容器并解码其中各轨。
 * 未命中容器、或所有轨都解码失败时返回 null，调用方应回退到常规 LRC 流程。
 */
export const extractAwlrcContainer = (content?: string): AwlrcContainerTracks | null => {
    const containerMatch = content?.match(AWLRC_CONTAINER_REGEX);
    if (!containerMatch) {
        return null;
    }

    const tracks: AwlrcContainerTracks = {};
    let decodedAny = false;

    for (const segment of containerMatch[1].split(',')) {
        const separatorIndex = segment.indexOf(':');
        if (separatorIndex <= 0) {
            continue;
        }

        const key = segment.slice(0, separatorIndex);
        if (key !== 'lrc' && key !== 'tlrc' && key !== 'rlrc' && key !== 'awlrc') {
            continue;
        }

        try {
            const decoded = decodeBase64Utf8(segment.slice(separatorIndex + 1));
            if (decoded.trim()) {
                tracks[key] = decoded;
                decodedAny = true;
            }
        } catch (error) {
            console.warn(`[awlrcContainer] Failed to decode "${key}" track:`, error);
        }
    }

    if (tracks.rlrc && isHanTransliteration(tracks.rlrc)) {
        delete tracks.rlrc;
    }

    return decodedAny ? tracks : null;
};
