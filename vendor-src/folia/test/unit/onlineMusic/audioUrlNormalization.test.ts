import { describe, expect, it } from 'vitest';
import { toSafePlaybackUrl, toSafeRemoteUrl } from '@/utils/appPlaybackHelpers';

// test/unit/onlineMusic/audioUrlNormalization.test.ts

describe('online audio URL normalization', () => {
    it('upgrades KuGou fs CDN URLs to HTTPS', () => {
        expect(toSafeRemoteUrl('http://fs.youthandroid2.kugou.com/path/song.mp3'))
            .toBe('https://fs.youthandroid2.kugou.com/path/song.mp3');
    });

    it('preserves KuGou HTTP media URLs only for Electron playback', () => {
        const url = 'http://fs.youthandroid2.kugou.com/path/song.mp3';
        expect(toSafePlaybackUrl(url, true)).toBe(url);
        expect(toSafePlaybackUrl(url, false)).toBe('https://fs.youthandroid2.kugou.com/path/song.mp3');
    });

    it('repairs a cached comma-joined KuGou URL by keeping one candidate', () => {
        expect(toSafeRemoteUrl(
            'http://fs.youthandroid2.kugou.com/primary.mp3,http://fs.youthandroid2.kugou.com/backup.mp3',
        )).toBe('https://fs.youthandroid2.kugou.com/primary.mp3');
    });

    it('keeps valid HTTPS URLs unchanged', () => {
        expect(toSafeRemoteUrl('https://audio.example.test/song.mp3'))
            .toBe('https://audio.example.test/song.mp3');
    });

    it('continues upgrading NetEase media URLs to HTTPS', () => {
        expect(toSafeRemoteUrl('http://m10.music.126.net/song.mp3'))
            .toBe('https://m10.music.126.net/song.mp3');
        expect(toSafePlaybackUrl('http://m10.music.126.net/song.mp3', true))
            .toBe('https://m10.music.126.net/song.mp3');
    });

    it('keeps only the first KuGou candidate while preserving Electron HTTP', () => {
        expect(toSafePlaybackUrl(
            'http://fs.youthandroid2.kugou.com/primary.mp3,http://fs.youthandroid2.kugou.com/backup.mp3',
            true,
        )).toBe('http://fs.youthandroid2.kugou.com/primary.mp3');
    });
});
