import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import {
    buildStoredUploadedLyricsFont,
    clearUploadedLyricsFont,
    isSupportedLyricsFontFile,
    registerUploadedLyricsFont,
    restoreUploadedLyricsFont,
    uploadAndRegisterLyricsFont,
    validateUploadedLyricsFontFile,
} from '@/services/customLyricsFont';
import { getFromCache, removeFromCache, saveToCache } from '@/services/db';

vi.mock('@/services/db', () => ({
    getFromCache: vi.fn(),
    removeFromCache: vi.fn(),
    saveToCache: vi.fn(),
}));

const createFileLike = (content: string, name: string, type = ''): File => {
    const blob = new Blob([content], { type }) as File;
    Object.defineProperty(blob, 'name', { value: name });
    Object.defineProperty(blob, 'lastModified', { value: Date.now() });
    return blob;
};

describe('customLyricsFont', () => {
    // The rejection message comes back through i18n, and i18next detects the language from the
    // environment - under vitest that is the *developer machine's* `navigator.language`. Asserting
    // an English sentence without pinning the language made this file pass or fail depending on
    // whose laptop it ran on.
    const originalLanguage = i18n.language;

    beforeAll(async () => {
        await i18n.changeLanguage('en');
    });

    afterAll(async () => {
        await i18n.changeLanguage(originalLanguage);
    });

    const getFromCacheMock = vi.mocked(getFromCache);
    const saveToCacheMock = vi.mocked(saveToCache);
    const removeFromCacheMock = vi.mocked(removeFromCache);
    const originalFontFace = globalThis.FontFace;
    const originalDocument = globalThis.document;
    let addFontFace: ReturnType<typeof vi.fn>;
    let loadFontFace: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-05-24T00:00:00.000Z'));
        getFromCacheMock.mockReset();
        saveToCacheMock.mockReset();
        removeFromCacheMock.mockReset();
        addFontFace = vi.fn();
        loadFontFace = vi.fn().mockResolvedValue(undefined);

        class MockFontFace {
            family: string;
            source: BufferSource | string;

            constructor(family: string, source: BufferSource | string) {
                this.family = family;
                this.source = source;
            }

            load = loadFontFace;
        }

        vi.stubGlobal('FontFace', MockFontFace);
        vi.stubGlobal('document', {
            fonts: {
                add: addFontFace,
            },
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.stubGlobal('FontFace', originalFontFace);
        vi.stubGlobal('document', originalDocument);
    });

    it('accepts supported font extensions and rejects unsupported files', () => {
        expect(isSupportedLyricsFontFile(createFileLike('font', 'lyrics.woff2'))).toBe(true);
        expect(isSupportedLyricsFontFile(createFileLike('font', 'lyrics.ttf'))).toBe(true);
        expect(isSupportedLyricsFontFile(createFileLike('font', 'lyrics.png', 'image/png'))).toBe(false);
        expect(validateUploadedLyricsFontFile(createFileLike('font', 'lyrics.png', 'image/png'))).toBe('Only woff2, woff, ttf, otf font files are supported.');
    });

    it('registers a stored uploaded font with FontFace', async () => {
        const storedFont = buildStoredUploadedLyricsFont(createFileLike('font', 'My Font.ttf', 'font/ttf'));

        const meta = await registerUploadedLyricsFont(storedFont);

        expect(meta).toEqual({
            source: 'uploaded',
            family: 'FoliaUploadedLyricsFont_1779580800000_My-Font',
            label: 'My Font',
            fontId: '1779580800000_My-Font',
        });
        expect(loadFontFace).toHaveBeenCalledTimes(1);
        expect(addFontFace).toHaveBeenCalledTimes(1);
    });

    it('saves the uploaded font after successful registration', async () => {
        const file = createFileLike('font', 'Mobile.otf', 'font/otf');

        const result = await uploadAndRegisterLyricsFont(file);

        expect(result.meta.fontId).toBe('1779580800000_Mobile');
        expect(saveToCacheMock).toHaveBeenCalledWith('lyrics_uploaded_font', expect.objectContaining({
            id: '1779580800000_Mobile',
            name: 'Mobile.otf',
            label: 'Mobile',
        }));
    });

    it('restores a matching font from IndexedDB', async () => {
        const storedFont = buildStoredUploadedLyricsFont(createFileLike('font', 'Restore.woff', 'font/woff'));
        getFromCacheMock.mockResolvedValueOnce(storedFont);

        const restored = await restoreUploadedLyricsFont(storedFont.id);

        expect(getFromCacheMock).toHaveBeenCalledWith('lyrics_uploaded_font');
        expect(restored?.family).toBe(storedFont.family);
    });

    it('clears the persisted uploaded font', async () => {
        await clearUploadedLyricsFont();

        expect(removeFromCacheMock).toHaveBeenCalledWith('lyrics_uploaded_font');
    });
});
