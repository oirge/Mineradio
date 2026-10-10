// src/utils/legacyTagTextRepair.ts
// Old Chinese rippers wrote GBK bytes into ID3v1 tags and into ID3v2 frames that declare
// ISO-8859-1 (encoding byte 0). music-metadata decodes those bytes as Latin-1, which shows up as
// "¸ÃËÀµÄÎÂÈá" instead of "该死的温柔". This recovers the original bytes and decodes them as GBK.
//
// Real Latin-1 text must survive untouched, so the gate is strict: every non-ASCII byte has to sit
// in a pair that lies entirely in the GB2312 range 0xA1–0xFE. "Björk" fails it (0xF6 is followed by
// ASCII "r", which GBK would otherwise accept as a trail byte), and so does "Café" (a lone 0xE9).
// The cost is that rare GBK-extension characters whose trail byte is below 0x80 stay unrepaired.

const GB2312_BYTE_MIN = 0xa1;
const GB2312_BYTE_MAX = 0xfe;
const CJK_TEXT_PATTERN = /[　-〿぀-ヿ㐀-鿿豈-﫿＀-￯]/u;

let gbkDecoder: TextDecoder | null | undefined;

const getGbkDecoder = (): TextDecoder | null => {
    if (gbkDecoder === undefined) {
        try {
            gbkDecoder = new TextDecoder('gbk', { fatal: true });
        } catch {
            gbkDecoder = null;
        }
    }
    return gbkDecoder;
};

const isGb2312Byte = (code: number): boolean => code >= GB2312_BYTE_MIN && code <= GB2312_BYTE_MAX;

/** Returns the GBK reading of a Latin-1-decoded tag string, or the input when it does not qualify. */
export const repairLatin1DecodedGbkText = (text: string): string => {
    let hasHighByte = false;
    for (let index = 0; index < text.length; index += 1) {
        const code = text.charCodeAt(index);
        if (code < 0x80) continue;
        if (code > 0xff) return text;
        if (!isGb2312Byte(code) || !isGb2312Byte(text.charCodeAt(index + 1))) return text;
        hasHighByte = true;
        index += 1;
    }
    if (!hasHighByte) return text;

    const decoder = getGbkDecoder();
    if (!decoder) return text;

    const bytes = new Uint8Array(text.length);
    for (let index = 0; index < text.length; index += 1) {
        bytes[index] = text.charCodeAt(index);
    }

    try {
        const decoded = decoder.decode(bytes);
        return CJK_TEXT_PATTERN.test(decoded) ? decoded : text;
    } catch {
        return text;
    }
};

/** Only ID3 can carry this mojibake: Vorbis comments, APE and MP4 atoms are defined as UTF-8/UTF-16. */
export const hasLegacyId3Tags = (tagTypes: readonly string[] | undefined): boolean => (
    tagTypes?.some(tagType => tagType === 'ID3v1' || tagType.startsWith('ID3v2')) ?? false
);
