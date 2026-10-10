import { describe, expect, it } from 'vitest';
import { decodeLyricFileBytes, decodeLyricText, readLyricFile } from '@/utils/lyrics/lyricFileDecoding';

const KRC_KEY = new Uint8Array([64, 71, 97, 119, 94, 50, 116, 71, 81, 54, 49, 45, 206, 210, 110, 105]);

async function encryptKrc(text: string): Promise<Uint8Array> {
    const compressed = new Uint8Array(await new Response(
        new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(new CompressionStream('deflate'))
    ).arrayBuffer());
    const encrypted = new Uint8Array(4 + compressed.length);
    encrypted.set([0x6b, 0x72, 0x63, 0x31]);
    compressed.forEach((value, index) => {
        encrypted[4 + index] = value ^ KRC_KEY[index % KRC_KEY.length];
    });
    return encrypted;
}

// "[ti:过火]\n[00:27.74]是否对你承诺了太多" saved by an old GBK tool.
const GBK_LRC = new Uint8Array([
    0x5b, 0x74, 0x69, 0x3a, 0xb9, 0xfd, 0xbb, 0xf0, 0x5d, 0x0a,
    0x5b, 0x30, 0x30, 0x3a, 0x32, 0x37, 0x2e, 0x37, 0x34, 0x5d,
    0xca, 0xc7, 0xb7, 0xf1, 0xb6, 0xd4, 0xc4, 0xe3, 0xb3, 0xd0, 0xc5, 0xb5, 0xc1, 0xcb, 0xcc, 0xab, 0xb6, 0xe0,
]);

describe('lyricFileDecoding', () => {
    it('reads UTF-8 and drops the BOM', () => {
        const text = '[00:01.00]该死的温柔';
        expect(decodeLyricText(new TextEncoder().encode(text))).toBe(text);
        expect(decodeLyricText(new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(text)]))).toBe(text);
    });

    it('falls back to GB18030 for GBK files', () => {
        expect(decodeLyricText(GBK_LRC)).toBe('[ti:过火]\n[00:27.74]是否对你承诺了太多');
    });

    it('reads UTF-16 files with a BOM', () => {
        const text = '[00:01.00]过火';
        const utf16 = new Uint8Array(2 + text.length * 2);
        utf16.set([0xff, 0xfe]);
        for (let index = 0; index < text.length; index += 1) {
            utf16[2 + index * 2] = text.charCodeAt(index) & 0xff;
            utf16[3 + index * 2] = text.charCodeAt(index) >> 8;
        }
        expect(decodeLyricText(utf16)).toBe(text);
    });

    it('normalizes CR, CRLF and CR CR LF line endings', async () => {
        const bytes = new TextEncoder().encode('[00:01.00]一\r\r\n[00:02.00]二\r[00:03.00]三\r\n');
        expect(await decodeLyricFileBytes(bytes)).toBe('[00:01.00]一\n\n[00:02.00]二\n[00:03.00]三\n');
    });

    it('decrypts Kugou krc files', async () => {
        const krc = '[27749,2650]<0,201,0>是<201,250,0>否';
        expect(await decodeLyricFileBytes(await encryptKrc(krc))).toBe(krc);
    });

    it('reads a File through the same path', async () => {
        expect(await readLyricFile(new File([GBK_LRC], 'song.lrc'))).toContain('是否对你承诺了太多');
    });
});
