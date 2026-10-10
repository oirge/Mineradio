import { describe, expect, it } from 'vitest';
import { resolveStoredCustomLyricsFont } from '@/hooks/useAppPreferences';

describe('custom lyrics font preference migration', () => {
    it('treats legacy custom font metadata as a system font', () => {
        expect(resolveStoredCustomLyricsFont({
            family: 'Songti SC',
            label: 'Songti',
        })).toEqual({
            source: 'system',
            family: 'Songti SC',
            label: 'Songti',
        });
    });

    it('rejects uploaded font metadata without a font id', () => {
        expect(resolveStoredCustomLyricsFont({
            source: 'uploaded',
            family: 'FoliaUploadedLyricsFont_missing',
            label: 'Missing',
        })).toBeNull();
    });

    it('keeps valid uploaded font metadata', () => {
        expect(resolveStoredCustomLyricsFont({
            source: 'uploaded',
            family: 'FoliaUploadedLyricsFont_1',
            label: 'Uploaded',
            fontId: '1',
        })).toEqual({
            source: 'uploaded',
            family: 'FoliaUploadedLyricsFont_1',
            label: 'Uploaded',
            fontId: '1',
        });
    });
});
