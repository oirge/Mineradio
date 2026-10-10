import { describe, expect, it } from 'vitest';
import type { SongResult } from '@/types';
import { buildLocalSourceRevision, buildNavidromeSourceRevision } from '@/services/playbackRecovery/sourceRevision';

// Source revisions invalidate stale cache entries without persisting Navidrome credentials.

describe('playback recovery source revisions', () => {
    it('uses local identity, size and modification time', () => {
        expect(buildLocalSourceRevision({ id: 'one', fileSize: 10, fileLastModified: 20 })).toBe('one:10:20');
    });

    it('keeps representation parameters but strips Navidrome authentication query fields', () => {
        const song = {
            id: 'one',
            name: 'One',
            artists: [],
            album: { id: 0, name: '' },
            durationMs: 12_000,
            isNavidrome: true,
            sourceRef: { kind: 'navidrome', mediaId: 'one' },
            navidromeData: {
                id: 'one',
                streamUrl: 'https://music.test/rest/stream?id=one',
                albumId: 'album',
                artistId: 'artist',
                path: 'Artist/One.ape',
                suffix: 'ape',
            },
        } as SongResult;
        const revision = buildNavidromeSourceRevision(
            song,
            'https://music.test/rest/stream?id=one&u=user&t=secret&s=salt&format=raw&maxBitRate=0',
        );
        expect(revision).toContain('format=raw&maxBitRate=0');
        expect(revision).not.toContain('secret');
        expect(revision).not.toContain('user');
        expect(revision).not.toContain('salt');
    });
});
