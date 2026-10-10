import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyLocalSongMatchSelection, resolveLyricMatchMetadataSelection } from '@/services/localSongMatchSelectionService';
import type { OnlineMetadataCandidate } from '@/services/onlineMetadataSearchService';

// test/unit/localLibrary/localSongMatchSelectionService.test.ts
// Locks GridView and Player matching to one atomic metadata, lyric, and cover command.

const mocks = vi.hoisted(() => ({
    applyMatchedMetadata: vi.fn(),
    restoreImportedMetadata: vi.fn(),
    cacheLocalSongOnlineCover: vi.fn(),
    removeCachedCover: vi.fn(),
}));

vi.mock('@/services/localLibraryCatalogService', () => ({
    applyMatchedMetadata: mocks.applyMatchedMetadata,
    restoreImportedMetadata: mocks.restoreImportedMetadata,
}));
vi.mock('@/services/coverCache', () => ({
    cacheLocalSongOnlineCover: mocks.cacheLocalSongOnlineCover,
    removeCachedCover: mocks.removeCachedCover,
}));

const candidate: OnlineMetadataCandidate = {
    source: 'qq',
    songId: 'qq-song-mid',
    title: 'Canonical Online Title',
    artists: [{ id: 'artist-mid', name: 'Online Artist' }],
    album: { id: 'album-mid', name: 'Online Album' },
    coverUrl: 'https://example.com/cover.jpg',
    durationMs: 180000,
    score: 1,
    titleMatched: true,
    durationMatched: true,
    raw: {
        id: 9,
        qqMid: 'qq-song-mid',
        name: 'Canonical Online Title',
        artists: [{ id: 8, name: 'Online Artist' }],
        album: { id: 7, name: 'Online Album' },
        durationMs: 180000,
    },
};

describe('applyLocalSongMatchSelection', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.cacheLocalSongOnlineCover.mockResolvedValue(true);
    });

    it('applies the same canonical metadata and cover action for GridView and Player', async () => {
        const base = {
            songId: 'song-1',
            candidate,
            metadata: 'online' as const,
            cover: 'online' as const,
        };
        await applyLocalSongMatchSelection({ ...base, lyrics: 'keep' });
        const gridMetadataCall = mocks.applyMatchedMetadata.mock.calls[0];
        const gridCoverCall = mocks.cacheLocalSongOnlineCover.mock.calls[0];

        vi.clearAllMocks();
        mocks.cacheLocalSongOnlineCover.mockResolvedValue(true);
        await applyLocalSongMatchSelection({ ...base, lyrics: 'local' });

        expect(mocks.applyMatchedMetadata.mock.calls[0][0]).toBe(gridMetadataCall[0]);
        expect(mocks.applyMatchedMetadata.mock.calls[0][1]).toEqual(gridMetadataCall[1]);
        expect(mocks.applyMatchedMetadata.mock.calls[0][2]).toMatchObject({
            assignmentOrigin: 'manual-match',
        });
        expect(mocks.cacheLocalSongOnlineCover.mock.calls[0]).toEqual(gridCoverCall);
    });

    it('adds online lyric state without changing the metadata payload', async () => {
        await applyLocalSongMatchSelection({
            songId: 'song-1',
            candidate,
            metadata: 'online',
            cover: 'keep',
            lyrics: 'online',
            onlineLyrics: {
                lyrics: { lines: [], isWordByWord: true },
                songId: 'qq-song-mid',
                source: 'amll',
                providerPlatform: 'qq',
                isPureMusic: false,
            },
        });

        expect(mocks.applyMatchedMetadata.mock.calls[0][1]).toEqual({
            source: 'qq',
            songId: 'qq-song-mid',
            title: 'Canonical Online Title',
            artists: candidate.artists,
            album: candidate.album,
            coverUrl: candidate.coverUrl,
        });
        expect(mocks.applyMatchedMetadata.mock.calls[0][2].songPatch).toMatchObject({
            lyricsSource: 'online',
            matchedLyricsSongId: 'qq-song-mid',
            matchedLyricsSource: 'amll',
            matchedLyricsProviderPlatform: 'qq',
            hasManualLyricSelection: true,
        });
    });

    it('restores imported metadata and lyric selection in one catalog transaction', async () => {
        await applyLocalSongMatchSelection({
            songId: 'song-1',
            metadata: 'imported',
            cover: 'embedded',
            lyrics: 'automatic',
            setNoAutoMatch: true,
        });

        expect(mocks.restoreImportedMetadata).toHaveBeenCalledOnce();
        expect(mocks.restoreImportedMetadata).toHaveBeenCalledWith('song-1', {
            noAutoMatch: true,
            useOnlineCover: false,
            lyricsSource: undefined,
            hasManualLyricSelection: false,
        });
        expect(mocks.removeCachedCover).toHaveBeenCalledWith('cover_local_song-1');
    });

    it('persists the selected online cover while restoring imported metadata', async () => {
        await applyLocalSongMatchSelection({
            songId: 'song-1',
            candidate,
            metadata: 'imported',
            cover: 'online',
            lyrics: 'keep',
        });

        expect(mocks.restoreImportedMetadata).toHaveBeenCalledWith('song-1', expect.objectContaining({
            useOnlineCover: true,
            onlineMetadata: expect.objectContaining({
                source: 'qq',
                songId: 'qq-song-mid',
                coverUrl: 'https://example.com/cover.jpg',
                matchMode: 'manual',
            }),
        }));
        expect(mocks.cacheLocalSongOnlineCover).toHaveBeenCalledWith(
            'song-1',
            'https://example.com/cover.jpg',
        );
    });

    it('reports partial lyric failure while still committing metadata and cover', async () => {
        const result = await applyLocalSongMatchSelection({
            songId: 'song-1',
            candidate,
            metadata: 'online',
            cover: 'online',
            lyrics: 'online',
            lyricsFailed: true,
        });

        expect(mocks.applyMatchedMetadata).toHaveBeenCalledOnce();
        expect(mocks.cacheLocalSongOnlineCover).toHaveBeenCalledOnce();
        expect(mocks.applyMatchedMetadata.mock.calls[0][2].songPatch).not.toHaveProperty('lyricsSource');
        expect(result).toMatchObject({
            coverCached: true,
            lyricsApplied: false,
            partialLyricsFailure: true,
        });
    });

    it('writes only lyrics for an AMLL selection, keeping online metadata and the cached cover', async () => {
        // AMLL 搜索结果：artists 是同一歌手的别名，没有封面，专辑 ID 是假的
        const amllCandidate: OnlineMetadataCandidate = {
            ...candidate,
            source: 'netease',
            songId: 186001,
            artists: [{ id: 0, name: '周杰伦' }, { id: 1, name: 'Jay Chou' }, { id: 2, name: '周杰倫' }],
            album: { id: 0, name: 'Album' },
            coverUrl: undefined,
        };
        const selection = resolveLyricMatchMetadataSelection('amll', amllCandidate, {
            useOnlineMetadata: true,
            useOnlineCover: true,
        });
        expect(selection).toEqual({ candidate: undefined, metadata: 'keep', cover: 'keep' });

        const lyrics = { lines: [], isWordByWord: true };
        await applyLocalSongMatchSelection({
            songId: 'song-1',
            ...selection,
            lyrics: 'online',
            onlineLyrics: { lyrics, songId: 186001, source: 'amll', providerPlatform: 'ncm', isPureMusic: false },
        });

        expect(mocks.applyMatchedMetadata).toHaveBeenCalledTimes(1);
        const [songId, metadata, options] = mocks.applyMatchedMetadata.mock.calls[0];
        expect(songId).toBe('song-1');
        // 没有 source 就不会改 onlineMetadata，lyricsOnly 不会改歌手 / 专辑实体
        expect(metadata).toEqual({});
        expect(options.lyricsOnly).toBe(true);
        expect(options.songPatch).not.toHaveProperty('useOnlineCover');
        expect(options.songPatch).toMatchObject({ matchedLyrics: lyrics, matchedLyricsSource: 'amll', lyricsSource: 'online' });
        expect(mocks.removeCachedCover).not.toHaveBeenCalled();
        expect(mocks.cacheLocalSongOnlineCover).not.toHaveBeenCalled();
    });

    it('keeps the existing metadata and cover choices for sources that provide metadata', () => {
        expect(resolveLyricMatchMetadataSelection('qq', candidate, { useOnlineMetadata: true, useOnlineCover: true }))
            .toEqual({ candidate, metadata: 'online', cover: 'online' });
        expect(resolveLyricMatchMetadataSelection('netease', candidate, { useOnlineMetadata: false, useOnlineCover: false }))
            .toEqual({ candidate, metadata: 'imported', cover: 'embedded' });
        expect(resolveLyricMatchMetadataSelection('kugou', { ...candidate, coverUrl: undefined }, { useOnlineMetadata: true, useOnlineCover: true }))
            .toMatchObject({ metadata: 'online', cover: 'embedded' });
    });
});
