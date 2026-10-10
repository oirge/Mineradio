import { describe, expect, it } from 'vitest';
import type { LocalSong } from '@/types';
import { applyUploadedLocalLyrics } from '@/utils/lyrics/localLyricsUpload';

const buildLocalSong = (overrides: Partial<LocalSong> = {}): LocalSong => ({
    id: 'local-1',
    fileName: '春日影.flac',
    fileSize: 1024,
    ...overrides,
} as LocalSong);

describe('applyUploadedLocalLyrics', () => {
    it('stores the uploaded lyrics and pins the source to local', () => {
        const updated = applyUploadedLocalLyrics(buildLocalSong(), {
            content: '[00:01.00]line',
            isTranslation: false,
            fileName: 'song.lrc',
        });

        expect(updated.hasLocalLyrics).toBe(true);
        expect(updated.localLyricsContent).toBe('[00:01.00]line');
        expect(updated.lyricsSource).toBe('local');
        expect(updated.localLyricsOrigin).toBe('upload');
    });

    it('keeps the explicit timed format of the uploaded file', () => {
        const updated = applyUploadedLocalLyrics(buildLocalSong(), {
            content: 'content',
            isTranslation: false,
            fileName: 'song.yrc',
        });

        expect(updated.localLyricsFormat).toBe('yrc');
    });

    it('switches a record left on the online source back to the uploaded file', () => {
        const updated = applyUploadedLocalLyrics(
            buildLocalSong({ lyricsSource: 'online', hasLocalLyrics: true, localLyricsContent: 'old' }),
            { content: 'new', isTranslation: false, fileName: 'song.lrc' },
        );

        expect(updated.localLyricsContent).toBe('new');
        expect(updated.lyricsSource).toBe('local');
    });

    it('adds a translation upload without claiming the song has main local lyrics', () => {
        const updated = applyUploadedLocalLyrics(buildLocalSong({ lyricsSource: 'online' }), {
            content: 'translation',
            isTranslation: true,
            fileName: 'song.t.lrc',
        });

        expect(updated.hasLocalTranslationLyrics).toBe(true);
        expect(updated.localTranslationLyricsContent).toBe('translation');
        expect(updated.localTranslationLyricsOrigin).toBe('upload');
        expect(updated.hasLocalLyrics).toBeUndefined();
        expect(updated.localLyricsOrigin).toBeUndefined();
        expect(updated.lyricsSource).toBe('online');
    });

    it('pins the source to local when a translation joins existing local lyrics', () => {
        const updated = applyUploadedLocalLyrics(
            buildLocalSong({ lyricsSource: 'online', hasLocalLyrics: true, localLyricsContent: 'main' }),
            { content: 'translation', isTranslation: true, fileName: 'song.t.lrc' },
        );

        expect(updated.lyricsSource).toBe('local');
    });

    it('does not mutate the source record', () => {
        const original = buildLocalSong({ lyricsSource: 'online' });
        applyUploadedLocalLyrics(original, { content: 'new', isTranslation: false, fileName: 'song.lrc' });

        expect(original.lyricsSource).toBe('online');
        expect(original.localLyricsContent).toBeUndefined();
    });
});
