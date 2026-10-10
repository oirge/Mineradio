import type { LocalCoverAssetBackend } from '../types/localCover';
import { isBlob } from '../utils/blobGuards';

// src/services/localCoverBinaryStore.ts
// Persists canonical local covers outside IndexedDB with the same validated layout used by stable URLs.

const ASSET_ID_PATTERN = /^sha256:([0-9a-f]{64})$/;
const ALLOWED_MIME_TYPES = new Set([
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const OPFS_ROOT_DIRECTORY = 'folia-cache';
const OPFS_LOCAL_COVER_DIRECTORY = 'local-cover-assets';
const LOCAL_COVER_THUMBNAIL_SIZES = [512, 1024] as const;

export interface LocalCoverBinaryWriteResult {
  backend: LocalCoverAssetBackend;
  mimeType: string;
  size: number;
}

interface LocalCoverFileDescriptor {
  id: string;
  mimeType: string;
  size: number;
  updatedAt: number;
}

export const isValidLocalCoverAssetId = (value: unknown): value is string => (
  typeof value === 'string' && ASSET_ID_PATTERN.test(value)
);

export const normalizeLocalCoverMimeType = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.toLowerCase();
  return ALLOWED_MIME_TYPES.has(normalized) ? normalized : null;
};

const getAssetDigest = (assetId: string): string | null => ASSET_ID_PATTERN.exec(assetId)?.[1] || null;

const hasElectronBridge = (): boolean => (
  typeof window !== 'undefined'
  && typeof window.electron?.hasLocalCoverAsset === 'function'
  && typeof window.electron?.saveLocalCoverAsset === 'function'
  && typeof window.electron?.removeLocalCoverAsset === 'function'
);

export const isLocalCoverWebRuntimeSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (hasElectronBridge()) return false;
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  return (window.location.protocol === 'https:' || isLocalhost)
    && window.isSecureContext
    && typeof navigator.storage?.getDirectory === 'function';
};

export const isLocalCoverAssetRuntimeSupported = (): boolean => (
  hasElectronBridge() || isLocalCoverWebRuntimeSupported()
);

const getOpfsDirectory = async (create: boolean): Promise<FileSystemDirectoryHandle | null> => {
  if (!isLocalCoverWebRuntimeSupported()) return null;
  try {
    const root = await navigator.storage.getDirectory();
    const cacheRoot = await root.getDirectoryHandle(OPFS_ROOT_DIRECTORY, { create });
    return await cacheRoot.getDirectoryHandle(OPFS_LOCAL_COVER_DIRECTORY, { create });
  } catch {
    return null;
  }
};

const getFileNames = (assetId: string) => {
  const digest = getAssetDigest(assetId);
  return digest ? { data: `${digest}.bin`, metadata: `${digest}.json` } : null;
};

const readOpfsDescriptor = async (
  directory: FileSystemDirectoryHandle,
  assetId: string,
): Promise<{ descriptor: LocalCoverFileDescriptor; file: File } | null> => {
  const names = getFileNames(assetId);
  if (!names) return null;
  try {
    const [file, rawMetadata] = await Promise.all([
      directory.getFileHandle(names.data).then(handle => handle.getFile()),
      directory.getFileHandle(names.metadata).then(handle => handle.getFile()).then(value => value.text()),
    ]);
    const descriptor = JSON.parse(rawMetadata) as Partial<LocalCoverFileDescriptor>;
    const mimeType = normalizeLocalCoverMimeType(descriptor.mimeType);
    if (descriptor.id !== assetId || !mimeType || descriptor.size !== file.size || file.size <= 0) return null;
    return {
      descriptor: { id: assetId, mimeType, size: file.size, updatedAt: Number(descriptor.updatedAt) || 0 },
      file,
    };
  } catch {
    return null;
  }
};

export const hasLocalCoverBinary = async (assetId: string): Promise<boolean> => {
  if (!isValidLocalCoverAssetId(assetId)) return false;
  if (hasElectronBridge()) return window.electron!.hasLocalCoverAsset(assetId);
  const directory = await getOpfsDirectory(false);
  return directory ? Boolean(await readOpfsDescriptor(directory, assetId)) : false;
};

export const writeLocalCoverBinary = async (
  assetId: string,
  value: unknown,
): Promise<LocalCoverBinaryWriteResult | null> => {
  const mimeType = isBlob(value) ? normalizeLocalCoverMimeType(value.type) : null;
  if (!isValidLocalCoverAssetId(assetId) || !isBlob(value) || value.size <= 0 || !mimeType) return null;

  if (hasElectronBridge()) {
    await window.electron!.saveLocalCoverAsset(assetId, await value.arrayBuffer(), mimeType);
    return { backend: 'electron', mimeType, size: value.size };
  }

  const directory = await getOpfsDirectory(true);
  const names = getFileNames(assetId);
  if (!directory || !names) return null;
  const dataHandle = await directory.getFileHandle(names.data, { create: true });
  const metadataHandle = await directory.getFileHandle(names.metadata, { create: true });
  const dataWritable = await dataHandle.createWritable();
  try {
    await dataWritable.write(value);
    await dataWritable.close();
  } catch (error) {
    await dataWritable.abort().catch(() => undefined);
    throw error;
  }
  const descriptor: LocalCoverFileDescriptor = {
    id: assetId,
    mimeType,
    size: value.size,
    updatedAt: Date.now(),
  };
  const metadataWritable = await metadataHandle.createWritable();
  try {
    await metadataWritable.write(JSON.stringify(descriptor));
    await metadataWritable.close();
  } catch (error) {
    await metadataWritable.abort().catch(() => undefined);
    await directory.removeEntry(names.data).catch(() => undefined);
    throw error;
  }
  return { backend: 'opfs', mimeType, size: value.size };
};

export const removeLocalCoverBinary = async (assetId: string): Promise<void> => {
  if (!isValidLocalCoverAssetId(assetId)) return;
  if (hasElectronBridge()) {
    await window.electron!.removeLocalCoverAsset(assetId);
    return;
  }
  const directory = await getOpfsDirectory(false);
  const names = getFileNames(assetId);
  if (!directory || !names) return;
  await Promise.all([
    directory.removeEntry(names.data).catch(() => undefined),
    directory.removeEntry(names.metadata).catch(() => undefined),
    ...LOCAL_COVER_THUMBNAIL_SIZES.map(size => (
      directory.removeEntry(`${names.data}.${size}.webp`).catch(() => undefined)
    )),
  ]);
};

export const clearLocalCoverBinaries = async (): Promise<void> => {
  if (hasElectronBridge()) {
    await window.electron!.clearLocalCoverAssets();
    return;
  }
  if (!isLocalCoverWebRuntimeSupported()) return;
  try {
    const root = await navigator.storage.getDirectory();
    const cacheRoot = await root.getDirectoryHandle(OPFS_ROOT_DIRECTORY);
    await cacheRoot.removeEntry(OPFS_LOCAL_COVER_DIRECTORY, { recursive: true });
  } catch {
    // A missing local-cover directory is already clear.
  }
};
