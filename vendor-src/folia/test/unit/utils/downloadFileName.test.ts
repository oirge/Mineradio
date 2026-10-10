import { describe, expect, it } from 'vitest';
import { formatLocalDateStamp, sanitizeDownloadFileName } from '@/utils/downloadFileName';

// test/unit/utils/downloadFileName.test.ts
// Locks the two rules that matter for a generated backup name: it must be legal on every OS
// and it must carry the user's own date, not UTC's.

describe('sanitizeDownloadFileName', () => {
    it('replaces characters no desktop OS accepts', () => {
        expect(sanitizeDownloadFileName('凝彩参数-画布图片备份')).toBe('凝彩参数-画布图片备份');
        expect(sanitizeDownloadFileName('a/b:c*d?')).toBe('a_b_c_d_');
    });

    it('falls back when the label leaves nothing usable behind', () => {
        expect(sanitizeDownloadFileName('   ', 'backup')).toBe('backup');
        expect(sanitizeDownloadFileName('...', 'backup')).toBe('backup');
    });

    it('drops trailing dots and spaces, which Windows would strip on its own', () => {
        expect(sanitizeDownloadFileName('Song...')).toBe('Song');
        expect(sanitizeDownloadFileName('Track. ')).toBe('Track');
    });

    it('steers clear of Windows device names, with or without an extension', () => {
        expect(sanitizeDownloadFileName('CON')).toBe('_CON');
        expect(sanitizeDownloadFileName('com1')).toBe('_com1');
        expect(sanitizeDownloadFileName('aux.live')).toBe('_aux.live');
        expect(sanitizeDownloadFileName('Conan')).toBe('Conan');
    });
});

describe('formatLocalDateStamp', () => {
    it('formats local calendar date as YYYY-MM-DD', () => {
        // 23:30 local on the 1st is already the 2nd in UTC east of it; the stamp must not shift.
        expect(formatLocalDateStamp(new Date(2026, 8, 1, 23, 30))).toBe('2026-09-01');
    });
});
