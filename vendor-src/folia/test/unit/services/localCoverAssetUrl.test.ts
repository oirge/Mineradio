import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLocalCoverAssetUrl, getPreferredLocalSongCoverUrl } from '../../../src/services/localCoverAssetUrl';
import type { LocalSong } from '../../../src/types';

// test/unit/services/localCoverAssetUrl.test.ts
// Verifies stable URL formatting, strict IDs, and unchanged online-cover preference.

const assetId = `sha256:${'a'.repeat(64)}`;
const song = (patch: Partial<LocalSong> = {}): LocalSong => ({
    id: 'song',
    fileName: 'song.flac',
    filePath: 'Music/song.flac',
    title: 'Song',
    titleOrigin: 'import',
    importedMetadata: { title: 'Song', titleSource: 'filename', artistNames: [] },
    duration: 1,
    fileSize: 1,
    mimeType: 'audio/flac',
    addedAt: 1,
    ...patch,
});

describe('localCoverAssetUrl', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('returns a stable Electron protocol URL for a valid SHA-256 asset id', () => {
        vi.stubGlobal('window', { electron: { hasLocalCoverAsset: vi.fn() } });

        expect(getLocalCoverAssetUrl(assetId)).toBe(`folia-cover://asset/${encodeURIComponent(assetId)}`);
        expect(getLocalCoverAssetUrl(assetId, 320)).toBe(`folia-cover://asset/${encodeURIComponent(assetId)}?size=512`);
        expect(getLocalCoverAssetUrl('sha256:../cover.png')).toBeNull();
    });

    it('keeps online-cover preference while falling back to the stable local URL', () => {
        vi.stubGlobal('window', { electron: { hasLocalCoverAsset: vi.fn() } });
        const localUrl = getLocalCoverAssetUrl(assetId);
        const onlineMetadata = {
            source: 'qq' as const,
            artists: [],
            coverUrl: 'https://example.test/cover.jpg',
            matchMode: 'manual' as const,
            matchedAt: 1,
        };

        expect(getPreferredLocalSongCoverUrl(song({ localCoverAssetId: assetId }))).toBe(`${localUrl}?size=1024`);
        expect(getPreferredLocalSongCoverUrl(song({ localCoverAssetId: assetId, useOnlineCover: true, onlineMetadata })))
            .toBe(onlineMetadata.coverUrl);
    });
});
