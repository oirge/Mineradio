import { describe, expect, it } from 'vitest';
import { resolveLyricTextDirection } from '../../../src/utils/lyrics/textDirection';

// test/unit/lyrics/textDirection.test.ts
describe('lyric text direction', () => {
    it('detects Arabic, Hebrew and other supported RTL scripts', () => {
        for (const text of ['\u0645\u0631\u062d\u0628\u0627', '\u05e9\u05dc\u05d5\u05dd', '\u0710\u0712', '\u0780\u0781', '\u07ca\u07cb', '\u{1e900}']) {
            expect(resolveLyricTextDirection(text)).toBe('rtl');
        }
    });

    it('ignores spaces, punctuation and numbers before the first letter', () => {
        expect(resolveLyricTextDirection(' (123) \u0645\u0631\u062d\u0628\u0627 hello')).toBe('rtl');
        expect(resolveLyricTextDirection('123 \u05e9\u05dc\u05d5\u05dd')).toBe('rtl');
        expect(resolveLyricTextDirection('hello \u0645\u0631\u062d\u0628\u0627')).toBe('ltr');
        expect(resolveLyricTextDirection('\u4e16\u754c \u05e9\u05dc\u05d5\u05dd')).toBe('ltr');
    });

    it('preserves Latin, CJK and neutral-only line behavior', () => {
        for (const text of ['hello world', '\u4e16\u754c', '', '123 ...', '\u{1f3b5} 2']) {
            expect(resolveLyricTextDirection(text)).toBe('ltr');
        }
    });
});
