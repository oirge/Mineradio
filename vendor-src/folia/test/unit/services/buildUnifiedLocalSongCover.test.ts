import { describe, expect, it } from 'vitest';
import { LIST_ROW_COVER_SIZE, QUEUE_COVER_SIZE, buildLocalQueue, buildUnifiedLocalSong } from '../../../src/services/playbackAdapters';
import { getSongCoverUrl } from '../../../src/services/onlineMusic/songMetadata';
import type { LocalSong } from '../../../src/types';
import { afterEach, beforeEach, vi } from 'vitest';

// test/unit/services/buildUnifiedLocalSongCover.test.ts
// Verifies an untagged album never drops the resolved cover, which queue-derived surfaces
// (Lattice posters, panel collection entries) read only through `album.coverUrl`.

const coverUrl = `folia-cover://asset/sha256:${'a'.repeat(64)}`;

const localSong = (patch: Partial<LocalSong> = {}): LocalSong => ({
    id: 'song',
    fileName: 'song.mp3',
    filePath: 'Music/song.mp3',
    title: '如愿',
    titleOrigin: 'import',
    importedMetadata: { title: '如愿', titleSource: 'embedded', artistNames: ['洋澜一'] },
    duration: 1,
    fileSize: 1,
    mimeType: 'audio/mpeg',
    addedAt: 1,
    ...patch,
});

describe('buildUnifiedLocalSong cover', () => {
    it('keeps the cover on a file that has artwork but no album tag', () => {
        const unified = buildUnifiedLocalSong({
            localSong: localSong(),
            matchedSong: null,
            coverUrl,
            preferOnlineMetadata: false,
        });

        expect(unified.album?.name).toBe('');
        expect(unified.album?.coverUrl).toBe(coverUrl);
        expect(getSongCoverUrl(unified)).toBe(coverUrl);
    });

    it('keeps the cover alongside a present album name', () => {
        const unified = buildUnifiedLocalSong({
            localSong: localSong({
                importedMetadata: { title: '如愿', titleSource: 'embedded', artistNames: ['洋澜一'], albumName: '如愿' },
            }),
            matchedSong: null,
            coverUrl,
            preferOnlineMetadata: false,
        });

        expect(unified.album?.name).toBe('如愿');
        expect(unified.album?.coverUrl).toBe(coverUrl);
    });

    it('leaves the cover field absent when nothing resolved', () => {
        const unified = buildUnifiedLocalSong({
            localSong: localSong(),
            matchedSong: null,
            coverUrl: null,
            preferOnlineMetadata: false,
        });

        expect(unified.album?.coverUrl).toBeUndefined();
    });
});

// The queue and list-row callers must stay in different thumbnail buckets: a shared bucket would
// make GridView rows decode the full-bleed artwork, and `getSizedCoverUrl` only serves 512 and 1024.
describe('buildLocalQueue cover size', () => {
    const assetId = `sha256:${'b'.repeat(64)}`;

    beforeEach(() => vi.stubGlobal('window', { electron: { hasLocalCoverAsset: vi.fn() } }));
    afterEach(() => vi.unstubAllGlobals());

    const queueOf = (coverSize?: number) => buildLocalQueue(
        [localSong({ localCoverAssetId: assetId })],
        undefined,
        undefined,
        coverSize,
    );

    it('defaults to the full-bleed bucket and keeps it on an untagged album', () => {
        const [track] = queueOf();

        expect(track.album?.name).toBe('');
        expect(track.album?.coverUrl).toContain(`size=${QUEUE_COVER_SIZE}`);
    });

    it('serves list rows the small bucket when asked', () => {
        const [track] = queueOf(LIST_ROW_COVER_SIZE);

        expect(track.album?.coverUrl).toContain(`size=${LIST_ROW_COVER_SIZE}`);
    });

    it('keeps the two buckets distinct', () => {
        expect(LIST_ROW_COVER_SIZE).toBeLessThan(QUEUE_COVER_SIZE);
    });
});
