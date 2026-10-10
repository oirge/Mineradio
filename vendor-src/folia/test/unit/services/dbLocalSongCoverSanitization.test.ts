import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appDatabase } from '../../../src/services/appDatabase';
import { getLocalSongs, saveLocalSong, saveLocalSongs } from '../../../src/services/db';
import type { LocalSong } from '../../../src/types';

// test/unit/services/dbLocalSongCoverSanitization.test.ts
// Verifies getLocalSongs returns lightweight records without reading or deleting legacy cover binaries.

type LegacyLocalSong = LocalSong & { embeddedCover?: unknown };

const buildLocalSong = (id: string): LocalSong => ({
    id,
    fileName: `${id}.mp3`,
    filePath: `/music/${id}.mp3`,
    title: id,
    titleOrigin: 'import',
    importedMetadata: { title: id, titleSource: 'filename', artistNames: [] },
    duration: 180000,
    fileSize: 1024,
    mimeType: 'audio/mpeg',
    addedAt: 1,
});

describe('db local song cover sanitization', () => {
    beforeEach(async () => {
        await appDatabase.delete();
        await appDatabase.open();
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        await appDatabase.delete();
    });

    it('does not read local_cover_assets while loading local songs', async () => {
        const assetId = `sha256:${'b'.repeat(64)}`;
        await appDatabase.local_music.put({ ...buildLocalSong('runtime-cover-song'), localCoverAssetId: assetId });
        const assetRead = vi.spyOn(appDatabase.local_cover_assets, 'get');
        const assetArrayRead = vi.spyOn(appDatabase.local_cover_assets, 'toArray');

        const songs = await getLocalSongs();

        expect(songs[0]).toMatchObject({ localCoverAssetId: assetId });
        expect(assetRead).not.toHaveBeenCalled();
        expect(assetArrayRead).not.toHaveBeenCalled();
    });

    it('strips a valid legacy Blob from returned songs but preserves it for background migration', async () => {
        const legacy = { ...buildLocalSong('legacy-cover-song'), embeddedCover: new Blob(['cover'], { type: 'image/png' }) };
        await appDatabase.local_music.put(legacy as LegacyLocalSong);

        const songs = await getLocalSongs();

        expect(songs[0]).not.toHaveProperty('embeddedCover');
        expect((await appDatabase.local_music.get('legacy-cover-song') as LegacyLocalSong)?.embeddedCover).toBeInstanceOf(Blob);
    });

    it('removes invalid legacy cover payloads during lightweight reads', async () => {
        await appDatabase.local_music.put({
            ...buildLocalSong('invalid-cover-song'),
            embeddedCover: { size: 20, type: 'image/png' },
        } as LegacyLocalSong);

        const songs = await getLocalSongs();
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(songs[0]).not.toHaveProperty('embeddedCover');
        expect(await appDatabase.local_music.get('invalid-cover-song')).not.toHaveProperty('embeddedCover');
    });

    it('rejects when saving one local song fails', async () => {
        const failure = new Error('single write failed');
        vi.spyOn(appDatabase.local_music, 'bulkPut').mockRejectedValueOnce(failure);

        await expect(saveLocalSong(buildLocalSong('failed-single-song'))).rejects.toBe(failure);
    });

    it('rejects when saving multiple local songs fails', async () => {
        const failure = new Error('batch write failed');
        vi.spyOn(appDatabase.local_music, 'bulkPut').mockRejectedValueOnce(failure);

        await expect(saveLocalSongs([
            buildLocalSong('failed-batch-song-1'),
            buildLocalSong('failed-batch-song-2'),
        ])).rejects.toBe(failure);
    });
});
