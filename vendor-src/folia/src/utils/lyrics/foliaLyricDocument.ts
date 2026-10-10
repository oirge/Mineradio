import type { Line, LyricBackgroundVocal, LyricData, Word } from '../../types';
import { ensureLyricDataRenderHints } from './renderHints';
import { isValidWordSegmentation } from './wordSegmentation';

// src/utils/lyrics/foliaLyricDocument.ts
// Folia 自有歌词格式 `.fia`：把歌词流水线的产物 LyricData 原样装进一个带版本号的 JSON 信封，
// 导入时跳过所有解析器直接加载。
//
// 装进去的是「解析之后、setter 之前」的数据，再加上用户保存的分词（wordSegments）。合唱效果、
// 默认的 Intl.Segmenter 分词和 renderHints 都不写：它们是派生数据，导入时经过 setter 会重新算，
// 写进文件反而会把渲染参数的某一版冻结在用户的文件里。

export const FOLIA_LYRIC_DOCUMENT_FORMAT = 'folia-lyricdata';
export const FOLIA_LYRIC_DOCUMENT_VERSION = 1;
export const FOLIA_LYRIC_FILE_EXTENSION = 'fia';

export type FoliaLyricDocumentSource = 'online' | 'imported' | 'local' | 'embedded' | 'navidrome';

export interface FoliaLyricDocumentSong {
    /** `getPlaybackSongKey` 的结果，例如 `online:netease:123`；只作记录，导入时不用它定位歌曲。 */
    key?: string;
    title?: string;
    artist?: string;
    album?: string;
    durationMs?: number;
}

export interface FoliaLyricDocument {
    format: typeof FOLIA_LYRIC_DOCUMENT_FORMAT;
    version: typeof FOLIA_LYRIC_DOCUMENT_VERSION;
    exportedAt: string;
    song: FoliaLyricDocumentSong;
    source?: FoliaLyricDocumentSource;
    /** 导出时这首歌的手动时间轴偏移。只是元数据：时间轴本身没有被平移。 */
    offsetMs?: number;
    lyrics: LyricData;
}

export interface FoliaLyricDocumentMeta {
    song?: FoliaLyricDocumentSong;
    source?: FoliaLyricDocumentSource;
    offsetMs?: number;
    exportedAt?: Date;
}

const stripLineRenderHints = (line: Line): Line => {
    if (!line.renderHints) return line;
    const { renderHints: _renderHints, ...rest } = line;
    return rest;
};

const compactSong = (song: FoliaLyricDocumentSong | undefined): FoliaLyricDocumentSong => {
    const result: FoliaLyricDocumentSong = {};
    if (song?.key) result.key = song.key;
    if (song?.title) result.title = song.title;
    if (song?.artist) result.artist = song.artist;
    if (song?.album) result.album = song.album;
    if (typeof song?.durationMs === 'number' && Number.isFinite(song.durationMs) && song.durationMs > 0) {
        result.durationMs = Math.round(song.durationMs);
    }
    return result;
};

/** 把一份 LyricData 装进 `.fia` 信封；renderHints 被剥掉，其余字段原样保留。 */
export const buildFoliaLyricDocument = (lyrics: LyricData, meta: FoliaLyricDocumentMeta = {}): FoliaLyricDocument => {
    const document: FoliaLyricDocument = {
        format: FOLIA_LYRIC_DOCUMENT_FORMAT,
        version: FOLIA_LYRIC_DOCUMENT_VERSION,
        exportedAt: (meta.exportedAt ?? new Date()).toISOString(),
        song: compactSong(meta.song),
        lyrics: {
            ...lyrics,
            lines: lyrics.lines.map(stripLineRenderHints),
        },
    };
    if (meta.source) document.source = meta.source;
    if (typeof meta.offsetMs === 'number' && Number.isFinite(meta.offsetMs) && meta.offsetMs !== 0) {
        document.offsetMs = Math.round(meta.offsetMs);
    }
    return document;
};

export const serializeFoliaLyricDocument = (document: FoliaLyricDocument): string => (
    `${JSON.stringify(document, null, 2)}\n`
);

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object';

const isValidWord = (value: unknown): value is Word => (
    isRecord(value)
    && typeof value.text === 'string'
    && isFiniteNumber(value.startTime)
    && isFiniteNumber(value.endTime)
);

/** 必需字段：缺了哪个都不是一行歌词，整份文件按不认识处理。 */
const isValidLine = (value: unknown): value is Line => (
    isRecord(value)
    && typeof value.fullText === 'string'
    && isFiniteNumber(value.startTime)
    && isFiniteNumber(value.endTime)
    && Array.isArray(value.words)
    && value.words.every(isValidWord)
);

const isValidBackgroundVocal = (value: unknown): value is LyricBackgroundVocal => (
    isRecord(value)
    && typeof value.text === 'string'
    && isFiniteNumber(value.startTime)
    && isFiniteNumber(value.endTime)
    && Array.isArray(value.words)
    && value.words.every(isValidWord)
);

const optionalString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

/**
 * 可选字段逐个收窄：类型不对的直接丢掉，而不是整份拒收。
 *
 * `.fia` 可能被手改或由第三方生成，而渲染路径对这些字段不设防 —— `translation` 不是字符串时
 * `.trim()` 会抛错，`wordSegments` 不是数组时分词会崩。丢掉一个坏字段只损失那一点信息。
 */
const sanitizeLine = (line: Line): Line => {
    const {
        translation, romanization, wordSegments, alternateTexts, backgroundVocal, backgroundVocals, ...rest
    } = line as Line & Record<string, unknown>;
    const words = rest.words.map(word => (
        word.syllables !== undefined && !(Array.isArray(word.syllables) && word.syllables.every(isValidWord))
            ? { text: word.text, startTime: word.startTime, endTime: word.endTime }
            : word
    ));
    const result: Line = {
        ...rest,
        words,
        endTime: Math.max(rest.endTime, rest.startTime),
    };

    const safeTranslation = optionalString(translation);
    if (safeTranslation !== undefined) result.translation = safeTranslation;
    const safeRomanization = optionalString(romanization);
    if (safeRomanization !== undefined) result.romanization = safeRomanization;
    if (isValidWordSegmentation(result.fullText, wordSegments as string[] | undefined)) {
        result.wordSegments = wordSegments as string[];
    }
    if (Array.isArray(alternateTexts)) {
        const kept = alternateTexts.filter(item => isRecord(item) && typeof item.text === 'string' && typeof item.role === 'string');
        if (kept.length > 0) result.alternateTexts = kept as Line['alternateTexts'];
    }
    if (isValidBackgroundVocal(backgroundVocal)) result.backgroundVocal = backgroundVocal;
    if (Array.isArray(backgroundVocals)) {
        const kept = backgroundVocals.filter(isValidBackgroundVocal);
        if (kept.length > 0) result.backgroundVocals = kept;
    }
    return result;
};

/** 只看信封的前几个字节，决定要不要花力气 JSON.parse；普通 LRC/TTML 走不到 parse。 */
export const looksLikeFoliaLyricDocument = (text: string): boolean => {
    const trimmed = text.replace(/^\uFEFF/, '').trimStart();
    return trimmed.startsWith('{') && trimmed.includes(`"${FOLIA_LYRIC_DOCUMENT_FORMAT}"`);
};

/**
 * 解析 `.fia` 文本。不是这个格式、版本不认识或结构不对时返回 null，由调用方回退到普通解析。
 * 返回的 LyricData 已补回 renderHints，可以直接交给 setter。
 */
export const parseFoliaLyricDocument = (text: string): LyricData | null => {
    if (!looksLikeFoliaLyricDocument(text)) return null;

    let parsed: unknown;
    try {
        parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
    } catch {
        return null;
    }

    if (!parsed || typeof parsed !== 'object') return null;
    const document = parsed as Partial<FoliaLyricDocument>;
    if (document.format !== FOLIA_LYRIC_DOCUMENT_FORMAT) return null;
    if (document.version !== FOLIA_LYRIC_DOCUMENT_VERSION) {
        console.warn('[foliaLyricDocument] Unsupported .fia version:', document.version);
        return null;
    }

    const lyrics = document.lyrics;
    if (!lyrics || typeof lyrics !== 'object' || !Array.isArray(lyrics.lines) || !lyrics.lines.every(isValidLine)) {
        console.warn('[foliaLyricDocument] Malformed .fia lyric payload');
        return null;
    }

    const lines = lyrics.lines.map(sanitizeLine).sort((left, right) => left.startTime - right.startTime);
    return ensureLyricDataRenderHints({
        ...lyrics,
        title: optionalString(lyrics.title),
        artist: optionalString(lyrics.artist),
        isWordByWord: typeof lyrics.isWordByWord === 'boolean' ? lyrics.isWordByWord : undefined,
        lines,
    });
};
