import { describe, expect, it } from 'vitest';
import en from '../../../src/i18n/locales/en';
import zhCN from '../../../src/i18n/locales/zh-CN';
import id from '../../../src/i18n/locales/in';

// test/unit/lyrics/lyricSegmentationI18n.test.ts
// Every key the segmentation surface asks for must exist in all three locales.
//
// This exists because two keys were silently added to the wrong block: `t()` fell through to the
// English fallback string baked into the call, so the UI looked right in English and was never
// translated anywhere else. Nothing failed — a wrong-block key is not a duplicate and not a type
// error. Listing the keys the code actually uses is the only thing that catches it.

const LOCALES = { en, 'zh-CN': zhCN, in: id } as Record<string, Record<string, unknown>>;

/** Mirrors the t() calls in LyricSegmentationSurfaceView and lyricSegmentationCommand. */
const REQUIRED_KEYS = [
    'statusDefault', 'sourceAi', 'sourceManual', 'appliedCount',
    'runAi', 'cancel', 'copyPrompt', 'copyCurrent', 'reset',
    'inputPlaceholder', 'noLyrics', 'saved', 'restored',
    'promptCopied', 'currentCopied', 'partialFailure', 'skippedLines', 'copyFailed',
];

const REQUIRED_IMPORT_ERROR_KEYS = [
    'empty', 'invalid-json', 'invalid-json-shape', 'line-count-mismatch', 'line-text-mismatch',
];

describe.each(Object.keys(LOCALES))('lyricSegmentation strings in %s', localeName => {
    const section = LOCALES[localeName].lyricSegmentation as Record<string, unknown> | undefined;

    it('has the lyricSegmentation section', () => {
        expect(section, `${localeName} is missing the lyricSegmentation section entirely`).toBeTruthy();
    });

    it.each(REQUIRED_KEYS)('has %s', key => {
        expect(typeof section?.[key], `lyricSegmentation.${key} missing from ${localeName}`).toBe('string');
    });

    it.each(REQUIRED_IMPORT_ERROR_KEYS)('has importError.%s', key => {
        const errors = section?.importError as Record<string, unknown> | undefined;
        expect(typeof errors?.[key], `lyricSegmentation.importError.${key} missing from ${localeName}`).toBe('string');
    });

    it('has the command title and description', () => {
        const commands = (LOCALES[localeName].commandPalette as Record<string, unknown>)
            ?.commands as Record<string, { title?: unknown; description?: unknown }> | undefined;
        expect(typeof commands?.['lyric-segmentation']?.title).toBe('string');
        expect(typeof commands?.['lyric-segmentation']?.description).toBe('string');
    });
});

describe('placeholder interpolation', () => {
    // These two are substituted with a manual .replace(), not by i18next, so the token has to
    // survive translation verbatim or the number silently vanishes from the UI.
    it.each(Object.keys(LOCALES))('keeps the {{count}} token in %s', localeName => {
        const section = LOCALES[localeName].lyricSegmentation as Record<string, string>;
        expect(section.appliedCount).toContain('{{count}}');
        expect(section.partialFailure).toContain('{{count}}');
        expect(section.skippedLines).toContain('{{count}}');
        const errors = LOCALES[localeName].lyricSegmentation as { importError: Record<string, string> };
        expect(errors.importError['line-text-mismatch']).toContain('{{row}}');
    });
});
