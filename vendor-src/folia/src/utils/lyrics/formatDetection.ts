export type TimedLyricFormat = 'lrc' | 'enhanced-lrc' | 'vtt' | 'ttml';
export type NonTtmlTimedLyricFormat = Exclude<TimedLyricFormat, 'ttml'>;
export type ExplicitFileTimedLyricFormat = Exclude<TimedLyricFormat, 'lrc' | 'enhanced-lrc'> | 'yrc' | 'qrc' | 'krc';

const VTT_TIMING_LINE_REGEX = /(?:^|\n)\s*(?:\d{2}:)?\d{2}:\d{2}\.\d{3}\s*-->\s*(?:\d{2}:)?\d{2}:\d{2}\.\d{3}/m;
const ENHANCED_LRC_ANGLE_REGEX = /<\d{2}:\d{2}[.:]\d{2,3}>/;
const ENHANCED_LRC_INLINE_BRACKET_REGEX = /(?:^|\n)\s*\[\d{2}:\d{2}[.:]\d{2,3}\][^\[\]\n]+(?:\[\d{2}:\d{2}[.:]\d{2,3}\][^\[\]\n]*)+/m;
const TTML_ROOT_REGEX = /<tt(?:\s|>)/i;
const EXPLICIT_FILE_FORMATS: Record<string, ExplicitFileTimedLyricFormat> = {
    vtt: 'vtt',
    ttml: 'ttml',
    qrc: 'qrc',
    yrc: 'yrc',
    krc: 'krc',
};

export function detectTimedLyricFormat(content?: string): TimedLyricFormat {
    const normalized = content?.replace(/^\uFEFF/, '').trim() || '';

    if (
        TTML_ROOT_REGEX.test(normalized)
        && (
            normalized.includes('http://www.w3.org/ns/ttml')
            || normalized.includes('itunes:timing=')
            || normalized.includes('ttm:agent=')
            || normalized.includes('ttm:role=')
        )
    ) {
        return 'ttml';
    }

    // A bare `-->` is not enough: lyric text can contain one (`go --> there`), and parseVTT only
    // understands cues whose timing line matches VTT_TIMING_LINE_REGEX, so anything the regex
    // misses would have parsed to zero lines as VTT anyway.
    if (
        normalized.startsWith('WEBVTT') ||
        VTT_TIMING_LINE_REGEX.test(normalized)
    ) {
        return 'vtt';
    }

    if (
        ENHANCED_LRC_ANGLE_REGEX.test(normalized) ||
        ENHANCED_LRC_INLINE_BRACKET_REGEX.test(normalized)
    ) {
        return 'enhanced-lrc';
    }

    return 'lrc';
}

export function detectNonTtmlTimedLyricFormat(content?: string): NonTtmlTimedLyricFormat {
    const format = detectTimedLyricFormat(content);
    return format === 'ttml' ? 'lrc' : format;
}

export function resolveExplicitFileTimedLyricFormat(fileName?: string): ExplicitFileTimedLyricFormat | undefined {
    const extension = fileName?.toLowerCase().match(/\.([^.]+)$/)?.[1];
    return extension ? EXPLICIT_FILE_FORMATS[extension] : undefined;
}
