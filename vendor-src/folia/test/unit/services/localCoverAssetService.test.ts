import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appDatabase } from '../../../src/services/appDatabase';
import { assignImportedSongs } from '../../../src/services/localLibraryCatalogService';
import {
    cancelLocalCoverAssetMigration,
    migrateLegacyLocalCoverAssetsInBackground,
    prepareLocalCoverBlob,
    resetLocalCoverAssetRuntime,
} from '../../../src/services/localCoverAssetService';
import type { LocalSong } from '../../../src/types';
import { hashLocalCoverBlobAsync } from '../../../src/utils/localMetadataWorkerClient';
import { hasLocalCoverBinary, removeLocalCoverBinary, writeLocalCoverBinary } from '../../../src/services/localCoverBinaryStore';

// test/unit/services/localCoverAssetService.test.ts
// Verifies one-time hashing, external deduplication, lightweight descriptors, and retry-safe migration.

vi.mock('../../../src/utils/localMetadataWorkerClient', () => ({
    hashLocalCoverBlobAsync: vi.fn(),
}));

vi.mock('../../../src/services/localCoverBinaryStore', async importOriginal => {
    const actual = await importOriginal<typeof import('../../../src/services/localCoverBinaryStore')>();
    return {
        ...actual,
        hasLocalCoverBinary: vi.fn(),
        removeLocalCoverBinary: vi.fn(),
        writeLocalCoverBinary: vi.fn(),
    };
});

const buildSong = (id: string, localCoverAssetId?: string): LocalSong => ({
    id,
    fileName: `${id}.flac`,
    filePath: `Music/${id}.flac`,
    title: id,
    titleOrigin: 'import',
    importedMetadata: {
        title: id,
        titleSource: 'filename',
        artistNames: ['Artist'],
        albumName: 'Album',
    },
    duration: 1,
    fileSize: 1,
    mimeType: 'audio/flac',
    addedAt: 1,
    localCoverAssetId,
});

describe('localCoverAssetService', () => {
    beforeEach(async () => {
        resetLocalCoverAssetRuntime();
        await appDatabase.delete();
        await appDatabase.open();
        vi.mocked(hashLocalCoverBlobAsync).mockReset();
        vi.mocked(hasLocalCoverBinary).mockReset().mockResolvedValue(false);
        vi.mocked(removeLocalCoverBinary).mockReset().mockResolvedValue(undefined);
        vi.mocked(writeLocalCoverBinary).mockReset().mockImplementation(async (_assetId, blob) => ({
            backend: 'opfs',
            mimeType: (blob as Blob).type,
            size: (blob as Blob).size,
        }));
        vi.stubGlobal('window', {
            dispatchEvent: vi.fn(),
            setTimeout: globalThis.setTimeout,
        });
        vi.stubGlobal('CustomEvent', class {
            constructor(public type: string, public init?: CustomEventInit) {}
        });
    });

    afterEach(async () => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        await appDatabase.delete();
    });

    it('hashes a shared cover once and stores one external payload for two song references', async () => {
        const assetId = `sha256:${'1'.repeat(64)}`;
        const cover = new Blob(['same-cover'], { type: 'image/png' });
        vi.mocked(hashLocalCoverBlobAsync).mockResolvedValue({ cover, coverAssetId: assetId });

        const prepared = await prepareLocalCoverBlob(cover);
        await assignImportedSongs([
            buildSong('one', prepared?.assetId),
            buildSong('two', prepared?.assetId),
        ]);

        expect(hashLocalCoverBlobAsync).toHaveBeenCalledOnce();
        expect(writeLocalCoverBinary).toHaveBeenCalledOnce();
        expect(await appDatabase.local_cover_assets.count()).toBe(1);
        expect(await appDatabase.local_music.toArray()).toEqual(expect.arrayContaining([
            expect.objectContaining({ localCoverAssetId: assetId }),
            expect.objectContaining({ localCoverAssetId: assetId }),
        ]));
        expect(await appDatabase.local_cover_assets.get(assetId)).not.toHaveProperty('blob');
    });

    it('infers the MIME type for a folder cover File whose browser type is empty', async () => {
        const assetId = `sha256:${'4'.repeat(64)}`;
        const folderFile = new File(['folder-cover'], 'cover.jpg');
        vi.mocked(hashLocalCoverBlobAsync).mockImplementation(async cover => ({ cover, coverAssetId: assetId }));

        const result = await prepareLocalCoverBlob(folderFile);

        expect(result).toMatchObject({ assetId });
        expect(result?.blob.type).toBe('image/jpeg');
    });

    it('releases a staged Blob after confirming that its binary already exists', async () => {
        const assetId = `sha256:${'2'.repeat(64)}`;
        const cover = new Blob(['existing-cover'], { type: 'image/png' });
        vi.mocked(hashLocalCoverBlobAsync).mockResolvedValue({ cover, coverAssetId: assetId });
        vi.mocked(hasLocalCoverBinary).mockResolvedValue(true);
        await appDatabase.local_cover_assets.put({
            id: assetId,
            backend: 'opfs',
            mimeType: cover.type,
            size: cover.size,
            createdAt: 1,
        });
        await prepareLocalCoverBlob(cover);

        await assignImportedSongs([buildSong('existing-cover-song', assetId)]);
        await appDatabase.local_cover_assets.delete(assetId);
        vi.mocked(hasLocalCoverBinary).mockResolvedValue(false);
        await assignImportedSongs([buildSong('existing-cover-song', assetId)]);

        expect(writeLocalCoverBinary).not.toHaveBeenCalled();
        expect(await appDatabase.local_music.get('existing-cover-song')).toMatchObject({
            localCoverNeedsAssetMigration: true,
        });
    });

    it('limits concurrent binary writes', async () => {
        let hashIndex = 0;
        let activeWrites = 0;
        let maximumActiveWrites = 0;
        vi.mocked(hashLocalCoverBlobAsync).mockImplementation(async cover => ({
            cover,
            coverAssetId: `sha256:${(hashIndex++).toString(16).padStart(64, '0')}`,
        }));
        vi.mocked(writeLocalCoverBinary).mockImplementation(async (_assetId, blob) => {
            activeWrites += 1;
            maximumActiveWrites = Math.max(maximumActiveWrites, activeWrites);
            await new Promise(resolve => setTimeout(resolve, 5));
            activeWrites -= 1;
            return { backend: 'opfs', mimeType: (blob as Blob).type, size: (blob as Blob).size };
        });
        const prepared = await Promise.all(Array.from({ length: 8 }, (_, index) => (
            prepareLocalCoverBlob(new Blob([`cover-${index}`], { type: 'image/png' }))
        )));

        await assignImportedSongs(prepared.map((coverResult, index) => (
            buildSong(`bounded-write-${index}`, coverResult?.assetId)
        )));

        expect(maximumActiveWrites).toBeGreaterThan(1);
        expect(maximumActiveWrites).toBeLessThanOrEqual(3);
    });

    it('cleans an unreferenced external asset if the owning song transaction fails', async () => {
        const assetId = `sha256:${'5'.repeat(64)}`;
        const cover = new Blob(['transaction-cover'], { type: 'image/png' });
        vi.mocked(hashLocalCoverBlobAsync).mockResolvedValue({ cover, coverAssetId: assetId });
        await prepareLocalCoverBlob(cover);
        vi.spyOn(appDatabase.local_music, 'bulkPut').mockRejectedValueOnce(new Error('forced song failure'));

        await expect(assignImportedSongs([buildSong('rollback-cover', assetId)])).rejects.toThrow('forced song failure');

        expect(await appDatabase.local_cover_assets.get(assetId)).toBeUndefined();
        expect(await appDatabase.local_music.get('rollback-cover')).toBeUndefined();
    });

    it('keeps a legacy IndexedDB Blob untouched when external migration fails', async () => {
        const assetId = `sha256:${'8'.repeat(64)}`;
        const cover = new Blob(['legacy-cover'], { type: 'image/png' });
        await appDatabase.local_cover_assets.put({
            id: assetId,
            blob: cover,
            mimeType: cover.type,
            size: cover.size,
            createdAt: 1,
        });
        vi.mocked(writeLocalCoverBinary).mockRejectedValueOnce(new Error('quota exceeded'));

        await migrateLegacyLocalCoverAssetsInBackground();

        expect((await appDatabase.local_cover_assets.get(assetId))?.blob).toBeInstanceOf(Blob);
    });

    it('replaces a migrated IndexedDB Blob with a lightweight descriptor', async () => {
        const assetId = `sha256:${'9'.repeat(64)}`;
        const cover = new Blob(['legacy-cover'], { type: 'image/webp' });
        await appDatabase.local_cover_assets.put({
            id: assetId,
            blob: cover,
            mimeType: cover.type,
            size: cover.size,
            createdAt: 1,
        });

        await migrateLegacyLocalCoverAssetsInBackground();

        expect(await appDatabase.local_cover_assets.get(assetId)).toMatchObject({
            id: assetId,
            backend: 'opfs',
            mimeType: 'image/webp',
        });
        expect(await appDatabase.local_cover_assets.get(assetId)).not.toHaveProperty('blob');
    });

    it('continues migration after a complete batch of legacy assets fails', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const records = Array.from({ length: 21 }, (_, index) => {
            const id = `sha256:${index.toString(16).padStart(64, '0')}`;
            const blob = new Blob([`legacy-cover-${index}`], { type: 'image/png' });
            return { id, blob, mimeType: blob.type, size: blob.size, createdAt: index + 1 };
        });
        const failedIds = new Set(records.slice(0, 20).map(record => record.id));
        await appDatabase.local_cover_assets.bulkPut(records);
        vi.mocked(writeLocalCoverBinary).mockImplementation(async (assetId, blob) => {
            if (failedIds.has(assetId)) throw new Error('permanent legacy failure');
            return { backend: 'opfs', mimeType: (blob as Blob).type, size: (blob as Blob).size };
        });

        await migrateLegacyLocalCoverAssetsInBackground();

        expect(writeLocalCoverBinary).toHaveBeenCalledTimes(21);
        expect(await appDatabase.local_cover_assets.get(records[20].id)).toMatchObject({
            id: records[20].id,
            backend: 'opfs',
        });
        expect(await appDatabase.local_cover_assets.get(records[20].id)).not.toHaveProperty('blob');
    });

    it('cancels an in-flight migration and removes the external orphan before clearing data', async () => {
        const assetId = `sha256:${'c'.repeat(64)}`;
        const cover = new Blob(['cancelled-cover'], { type: 'image/png' });
        let finishWrite!: (value: { backend: 'opfs'; mimeType: string; size: number }) => void;
        const writeStarted = new Promise<void>(resolve => {
            vi.mocked(writeLocalCoverBinary).mockImplementationOnce(async () => {
                resolve();
                return await new Promise(writeResolve => { finishWrite = writeResolve; });
            });
        });
        await appDatabase.local_cover_assets.put({
            id: assetId,
            blob: cover,
            mimeType: cover.type,
            size: cover.size,
            createdAt: 1,
        });

        const migration = migrateLegacyLocalCoverAssetsInBackground();
        await writeStarted;
        const cancellation = cancelLocalCoverAssetMigration();
        finishWrite({ backend: 'opfs', mimeType: cover.type, size: cover.size });
        await Promise.all([migration, cancellation]);

        expect(removeLocalCoverBinary).toHaveBeenCalledWith(assetId);
        expect((await appDatabase.local_cover_assets.get(assetId))?.blob).toBeInstanceOf(Blob);
    });
});
