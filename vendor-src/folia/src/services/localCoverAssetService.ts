import type { LocalSong } from '../types';
import type { LocalCoverAsset } from '../types/localCover';
import { isBlob } from '../utils/blobGuards';
import { hashLocalCoverBlobAsync } from '../utils/localMetadataWorkerClient';
import { appDatabase } from './appDatabase';
import {
  hasLocalCoverBinary,
  isValidLocalCoverAssetId,
  normalizeLocalCoverMimeType,
  removeLocalCoverBinary,
  writeLocalCoverBinary,
} from './localCoverBinaryStore';

// src/services/localCoverAssetService.ts
// Owns one-time cover hashing, external persistence, lightweight descriptors, and resumable Blob migration.

const MIGRATION_BATCH_SIZE = 20;
const ASSET_WRITE_CONCURRENCY = 3;
const pendingPayloads = new Map<string, Blob>();
let migrationPromise: Promise<void> | null = null;
let migrationAbortController: AbortController | null = null;

type LegacyLocalSongRecord = LocalSong & { embeddedCover?: Blob };

export interface PreparedLocalCoverBlob {
  assetId?: string;
  blob: Blob;
}

export const resetLocalCoverAssetRuntime = (): void => {
  pendingPayloads.clear();
  migrationAbortController?.abort();
};

const normalizeLocalCoverBlob = (blob: Blob): Blob | null => {
  if (!isBlob(blob) || blob.size === 0) return null;
  const mimeType = normalizeLocalCoverMimeType(blob.type);
  if (mimeType) return blob.type === mimeType ? blob : blob.slice(0, blob.size, mimeType);
  if (typeof File === 'undefined' || !(blob instanceof File)) return null;
  const extension = blob.name.split('.').pop()?.toLowerCase();
  const inferredMimeType = extension === 'png'
    ? 'image/png'
    : extension === 'jpg' || extension === 'jpeg'
      ? 'image/jpeg'
      : undefined;
  return inferredMimeType ? blob.slice(0, blob.size, inferredMimeType) : null;
};

export const stageLocalCoverAsset = (assetId: string | undefined, blob: Blob | undefined): boolean => {
  const normalizedBlob = blob ? normalizeLocalCoverBlob(blob) : null;
  if (!isValidLocalCoverAssetId(assetId) || !normalizedBlob) return false;
  if (!pendingPayloads.has(assetId)) pendingPayloads.set(assetId, normalizedBlob);
  return true;
};

// Hashes a cover once and stages its original full-resolution payload for the owning save operation.
export const prepareLocalCoverBlob = async (blob: Blob): Promise<PreparedLocalCoverBlob | null> => {
  const normalizedBlob = normalizeLocalCoverBlob(blob);
  if (!normalizedBlob) return null;
  try {
    const hashed = await hashLocalCoverBlobAsync(normalizedBlob);
    if (!hashed) return { blob: normalizedBlob };
    stageLocalCoverAsset(hashed.coverAssetId, hashed.cover);
    return { assetId: hashed.coverAssetId, blob: hashed.cover };
  } catch (error) {
    console.warn('[LocalCoverAsset] Failed to hash a local cover', error);
    return { blob: normalizedBlob };
  }
};

const toDescriptor = (
  assetId: string,
  result: Awaited<ReturnType<typeof writeLocalCoverBinary>>,
  previous?: LocalCoverAsset,
): LocalCoverAsset | null => result ? {
  id: assetId,
  mimeType: result.mimeType,
  size: result.size,
  createdAt: previous?.createdAt || Date.now(),
  backend: result.backend,
  migratedAt: Date.now(),
} : null;

const persistOneAsset = async (assetId: string, record?: LocalCoverAsset): Promise<boolean> => {
  if (record?.backend && await hasLocalCoverBinary(assetId)) {
    pendingPayloads.delete(assetId);
    return true;
  }
  const payload = pendingPayloads.get(assetId) || (isBlob(record?.blob) ? record.blob : undefined);
  if (!payload) return false;
  try {
    const result = await writeLocalCoverBinary(assetId, payload);
    const descriptor = toDescriptor(assetId, result, record);
    if (!descriptor) return false;
    await appDatabase.local_cover_assets.put(descriptor);
    return true;
  } finally {
    // A failed write is retried by re-reading the source file, not by retaining an unbounded Blob queue.
    pendingPayloads.delete(assetId);
  }
};

// Persists large binary payloads with a fixed worker count so Electron IPC copies stay bounded.
const persistAssetsWithConcurrency = async (
  assetIds: string[],
  records: Array<LocalCoverAsset | undefined>,
  available: Set<string>,
): Promise<void> => {
  let nextIndex = 0;
  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= assetIds.length) return;
      const assetId = assetIds[index];
      try {
        if (await persistOneAsset(assetId, records[index])) available.add(assetId);
      } catch (error) {
        console.warn(`[LocalCoverAsset] Failed to persist ${assetId}`, error);
      }
    }
  };
  const workerCount = Math.min(ASSET_WRITE_CONCURRENCY, assetIds.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
};

// Persists staged payloads before the song transaction and returns records without binary fields.
export const prepareLocalSongsCoverAssets = async (songs: LocalSong[]): Promise<LocalSong[]> => {
  const assetIds = Array.from(new Set(songs.flatMap(song => (
    isValidLocalCoverAssetId(song.localCoverAssetId) ? [song.localCoverAssetId] : []
  ))));
  const records = await appDatabase.local_cover_assets.bulkGet(assetIds);
  const available = new Set<string>();

  await persistAssetsWithConcurrency(assetIds, records, available);

  return songs.map(song => {
    if (!song.localCoverAssetId) return song;
    if (!isValidLocalCoverAssetId(song.localCoverAssetId)) {
      const { localCoverAssetId: _assetId, localCoverSource: _source, ...rest } = song;
      return { ...rest, localCoverNeedsAssetMigration: true };
    }
    return available.has(song.localCoverAssetId)
      ? { ...song, localCoverNeedsAssetMigration: undefined }
      : { ...song, localCoverNeedsAssetMigration: true };
  });
};

export const deleteUnreferencedLocalCoverAssets = async (assetIds: Iterable<string>): Promise<void> => {
  const uniqueIds = Array.from(new Set(Array.from(assetIds).filter(isValidLocalCoverAssetId)));
  for (const assetId of uniqueIds) {
    const remaining = await appDatabase.local_music.where('localCoverAssetId').equals(assetId).count();
    if (remaining > 0) continue;
    await removeLocalCoverBinary(assetId).catch(error => {
      console.warn(`[LocalCoverAsset] Failed to remove ${assetId} from binary storage`, error);
    });
    await appDatabase.local_cover_assets.delete(assetId);
    pendingPayloads.delete(assetId);
  }
};

const yieldToBrowser = () => new Promise<void>(resolve => window.setTimeout(resolve, 0));

interface LegacyMigrationBatchResult {
  attempted: number;
  migrated: number;
}

const throwIfMigrationAborted = (signal: AbortSignal): void => {
  if (!signal.aborted) return;
  const error = new Error('Local cover migration was cancelled');
  error.name = 'AbortError';
  throw error;
};

// Removes a just-written orphan if cancellation happens while the external write is in flight.
const writeLegacyBinary = async (assetId: string, blob: Blob, signal: AbortSignal) => {
  throwIfMigrationAborted(signal);
  const result = await writeLocalCoverBinary(assetId, blob);
  if (signal.aborted) {
    await removeLocalCoverBinary(assetId).catch(() => undefined);
    throwIfMigrationAborted(signal);
  }
  return result;
};

const migrateLegacyAssetRecords = async (
  failedIds: Set<string>,
  signal: AbortSignal,
): Promise<LegacyMigrationBatchResult> => {
  const legacyAssets = await appDatabase.local_cover_assets
    .filter(record => isBlob(record.blob) && !failedIds.has(record.id))
    .limit(MIGRATION_BATCH_SIZE)
    .toArray();
  let migrated = 0;
  for (const record of legacyAssets) {
    try {
      throwIfMigrationAborted(signal);
      if (!isValidLocalCoverAssetId(record.id) || !isBlob(record.blob)) throw new Error('Invalid legacy asset');
      const result = await writeLegacyBinary(record.id, record.blob, signal);
      const descriptor = toDescriptor(record.id, result, record);
      if (!descriptor) throw new Error('Local cover binary storage is unavailable');
      await appDatabase.local_cover_assets.put(descriptor);
      migrated += 1;
    } catch (error) {
      if (signal.aborted) throw error;
      failedIds.add(record.id);
      console.warn(`[LocalCoverAsset] Legacy asset migration will retry later: ${record.id}`, error);
    }
  }
  return { attempted: legacyAssets.length, migrated };
};

const migrateLegacySongRecords = async (
  failedIds: Set<string>,
  signal: AbortSignal,
): Promise<LegacyMigrationBatchResult> => {
  const legacySongs = await appDatabase.local_music
    .filter(song => isBlob((song as LegacyLocalSongRecord).embeddedCover) && !failedIds.has(song.id))
    .limit(MIGRATION_BATCH_SIZE)
    .toArray() as LegacyLocalSongRecord[];
  let migrated = 0;
  for (const legacySong of legacySongs) {
    try {
      throwIfMigrationAborted(signal);
      const blob = normalizeLocalCoverBlob(legacySong.embeddedCover!);
      if (!blob) throw new Error('Invalid legacy song cover');
      let assetId = legacySong.localCoverAssetId;
      if (!isValidLocalCoverAssetId(assetId)) {
        const hashed = await hashLocalCoverBlobAsync(blob);
        if (!hashed) throw new Error('SHA-256 is unavailable');
        assetId = hashed.coverAssetId;
      }
      const result = await writeLegacyBinary(assetId, blob, signal);
      const descriptor = toDescriptor(assetId, result);
      if (!descriptor) throw new Error('Local cover binary storage is unavailable');
      const { embeddedCover: _legacyBlob, ...lightweightSong } = legacySong;
      await appDatabase.transaction('rw', [appDatabase.local_music, appDatabase.local_cover_assets], async () => {
        await appDatabase.local_cover_assets.put(descriptor);
        await appDatabase.local_music.put({
          ...lightweightSong,
          localCoverAssetId: assetId,
          localCoverSource: lightweightSong.localCoverSource || 'embedded',
          localCoverNeedsAssetMigration: undefined,
        });
      });
      migrated += 1;
    } catch (error) {
      if (signal.aborted) throw error;
      failedIds.add(legacySong.id);
      console.warn(`[LocalCoverAsset] Legacy song migration will retry later: ${legacySong.id}`, error);
    }
  }
  return { attempted: legacySongs.length, migrated };
};

// Migrates bounded batches and leaves every failed Blob untouched for the next startup.
export const migrateLegacyLocalCoverAssetsInBackground = (): Promise<void> => {
  if (migrationPromise) return migrationPromise;
  const controller = new AbortController();
  migrationAbortController = controller;
  const run = (async () => {
    const failedAssetIds = new Set<string>();
    const failedSongIds = new Set<string>();
    let totalMigrated = 0;
    while (true) {
      throwIfMigrationAborted(controller.signal);
      const [assets, songs] = await Promise.all([
        migrateLegacyAssetRecords(failedAssetIds, controller.signal),
        migrateLegacySongRecords(failedSongIds, controller.signal),
      ]);
      totalMigrated += assets.migrated + songs.migrated;
      if (assets.attempted === 0 && songs.attempted === 0) break;
      await yieldToBrowser();
    }
    if (totalMigrated > 0 && !controller.signal.aborted) {
      window.dispatchEvent(new CustomEvent('folia-local-music-updated'));
    }
  })();
  const tracked = run.catch(error => {
    if (!controller.signal.aborted) {
      console.warn('[LocalCoverAsset] Background migration stopped; it will retry on the next startup', error);
    }
  }).finally(() => {
    if (migrationAbortController === controller) migrationAbortController = null;
    if (migrationPromise === tracked) migrationPromise = null;
  });
  migrationPromise = tracked;
  return tracked;
};

export const cancelLocalCoverAssetMigration = async (): Promise<void> => {
  pendingPayloads.clear();
  migrationAbortController?.abort();
  await migrationPromise;
};
