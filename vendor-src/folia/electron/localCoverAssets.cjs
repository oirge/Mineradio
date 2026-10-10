const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { pathToFileURL } = require('url');

// electron/localCoverAssets.cjs
// Stores content-addressed local covers and exposes them through a validated streaming protocol.

const ASSET_ID_PATTERN = /^sha256:([0-9a-f]{64})$/;
const THUMBNAIL_SIZES = new Set([512, 1024]);
const ALLOWED_MIME_TYPES = new Set([
  'image/avif',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function parseAssetId(value) {
  if (typeof value !== 'string') return null;
  const match = ASSET_ID_PATTERN.exec(value);
  return match ? { assetId: value, digest: match[1] } : null;
}

function getAssetPaths(directory, assetId) {
  const parsed = parseAssetId(assetId);
  if (!parsed) return null;
  return {
    dataPath: path.join(directory, `${parsed.digest}.bin`),
    metaPath: path.join(directory, `${parsed.digest}.json`),
  };
}

function parseThumbnailSize(requestUrl) {
  const value = Number(requestUrl.searchParams.get('size'));
  return Number.isInteger(value) && THUMBNAIL_SIZES.has(value) ? value : null;
}

function normalizeMimeType(value) {
  return typeof value === 'string' && ALLOWED_MIME_TYPES.has(value.toLowerCase())
    ? value.toLowerCase()
    : null;
}

function getLocalCoverAssetDirectory(userDataDirectory) {
  return path.join(userDataDirectory, 'local-cover-assets');
}

function createLocalCoverAssetStore({ getDirectory, createThumbnail }) {
  const thumbnailJobs = new Map();
  const thumbnailQueue = [];
  let activeThumbnailJobs = 0;

  // Bounds expensive native image decodes while pending protocol requests remain asynchronous.
  const scheduleThumbnailJob = (task) => new Promise((resolve, reject) => {
    const run = async () => {
      activeThumbnailJobs += 1;
      try {
        resolve(await task());
      } catch (error) {
        reject(error);
      } finally {
        activeThumbnailJobs -= 1;
        thumbnailQueue.shift()?.();
      }
    };
    if (activeThumbnailJobs < 2) void run();
    else thumbnailQueue.push(() => void run());
  });
  const readDescriptor = async (assetId) => {
    const directory = getDirectory();
    const paths = getAssetPaths(directory, assetId);
    if (!paths) return null;
    try {
      const raw = await fsp.readFile(paths.metaPath, 'utf8');
      const descriptor = JSON.parse(raw);
      const mimeType = normalizeMimeType(descriptor?.mimeType);
      if (descriptor?.id !== assetId || !mimeType || !Number.isSafeInteger(descriptor?.size) || descriptor.size <= 0) {
        return null;
      }
      const stat = await fsp.stat(paths.dataPath);
      if (!stat.isFile() || stat.size !== descriptor.size) return null;
      return { ...descriptor, mimeType, ...paths };
    } catch {
      return null;
    }
  };

  const has = async (assetId) => Boolean(await readDescriptor(assetId));

  // Lazily creates a bounded derivative while coalescing duplicate protocol requests.
  const getOrCreateThumbnail = async (descriptor, requestedSize) => {
    if (typeof createThumbnail !== 'function') return null;
    const thumbnailPath = `${descriptor.dataPath}.${requestedSize}.jpg`;
    try {
      const stat = await fsp.stat(thumbnailPath);
      if (stat.isFile() && stat.size > 0) {
        return { dataPath: thumbnailPath, mimeType: 'image/jpeg', size: stat.size };
      }
    } catch {
      // Continue with lazy generation.
    }

    const jobKey = `${descriptor.id}:${requestedSize}`;
    const existingJob = thumbnailJobs.get(jobKey);
    if (existingJob) return await existingJob;
    const job = scheduleThumbnailJob(async () => {
      const source = await fsp.readFile(descriptor.dataPath);
      const thumbnail = await createThumbnail(source, requestedSize);
      if (!thumbnail?.data || thumbnail.data.byteLength === 0) return null;
      const temporaryPath = `${thumbnailPath}.${process.pid}-${Date.now()}.tmp`;
      try {
        await fsp.writeFile(temporaryPath, thumbnail.data);
        await fsp.rename(temporaryPath, thumbnailPath).catch(async error => {
          await fsp.rm(thumbnailPath, { force: true });
          await fsp.rename(temporaryPath, thumbnailPath).catch(() => { throw error; });
        });
      } finally {
        await fsp.rm(temporaryPath, { force: true }).catch(() => undefined);
      }
      const stat = await fsp.stat(thumbnailPath);
      return { dataPath: thumbnailPath, mimeType: thumbnail.mimeType || 'image/jpeg', size: stat.size };
    }).finally(() => thumbnailJobs.delete(jobKey));
    thumbnailJobs.set(jobKey, job);
    return await job;
  };

  const write = async (assetId, data, mimeType) => {
    const parsed = parseAssetId(assetId);
    const normalizedMimeType = normalizeMimeType(mimeType);
    if (!parsed || !normalizedMimeType) throw new Error('Invalid local cover asset metadata');
    const bytes = Buffer.isBuffer(data)
      ? data
      : data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : ArrayBuffer.isView(data)
          ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
          : Buffer.from(data);
    if (bytes.byteLength === 0) throw new Error('Cannot persist an empty local cover asset');

    const directory = getDirectory();
    const paths = getAssetPaths(directory, assetId);
    const nonce = `${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const temporaryDataPath = `${paths.dataPath}.${nonce}.tmp`;
    const temporaryMetaPath = `${paths.metaPath}.${nonce}.tmp`;
    await fsp.mkdir(directory, { recursive: true });
    try {
      await fsp.writeFile(temporaryDataPath, bytes);
      await fsp.writeFile(temporaryMetaPath, JSON.stringify({
        id: assetId,
        mimeType: normalizedMimeType,
        size: bytes.byteLength,
        updatedAt: Date.now(),
      }), 'utf8');
      await Promise.allSettled([
        fsp.rm(paths.dataPath, { force: true }),
        fsp.rm(paths.metaPath, { force: true }),
      ]);
      await fsp.rename(temporaryDataPath, paths.dataPath);
      await fsp.rename(temporaryMetaPath, paths.metaPath);
    } finally {
      await Promise.allSettled([
        fsp.rm(temporaryDataPath, { force: true }),
        fsp.rm(temporaryMetaPath, { force: true }),
      ]);
    }
    return { mimeType: normalizedMimeType, size: bytes.byteLength };
  };

  const remove = async (assetId) => {
    const paths = getAssetPaths(getDirectory(), assetId);
    if (!paths) return false;
    await Promise.allSettled([
      fsp.rm(paths.dataPath, { force: true }),
      fsp.rm(paths.metaPath, { force: true }),
      ...Array.from(THUMBNAIL_SIZES, size => fsp.rm(`${paths.dataPath}.${size}.jpg`, { force: true })),
    ]);
    return true;
  };

  const clear = async () => {
    await fsp.rm(getDirectory(), { recursive: true, force: true });
    return true;
  };

  const registerProtocolHandler = (protocol, net) => {
    protocol.handle('folia-cover', async (request) => {
      let assetId = null;
      let requestedSize = null;
      try {
        const url = new URL(request.url);
        if (url.hostname !== 'asset') throw new Error('Invalid local cover host');
        assetId = decodeURIComponent(url.pathname.replace(/^\//, ''));
        requestedSize = parseThumbnailSize(url);
      } catch {
        return new Response('Bad request', { status: 400 });
      }

      const descriptor = await readDescriptor(assetId);
      if (!descriptor) return new Response('Not found', { status: 404 });
      const thumbnail = requestedSize
        ? await getOrCreateThumbnail(descriptor, requestedSize).catch(() => null)
        : null;
      const responseDescriptor = thumbnail || descriptor;
      const fileResponse = await net.fetch(pathToFileURL(responseDescriptor.dataPath).toString());
      if (!fileResponse.ok || !fileResponse.body) return new Response('Not found', { status: 404 });
      return new Response(fileResponse.body, {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Length': String(responseDescriptor.size),
          'Content-Type': responseDescriptor.mimeType,
          'X-Content-Type-Options': 'nosniff',
        },
      });
    });
  };

  return { has, write, remove, clear, registerProtocolHandler };
}

module.exports = {
  ALLOWED_MIME_TYPES,
  ASSET_ID_PATTERN,
  createLocalCoverAssetStore,
  getLocalCoverAssetDirectory,
  parseThumbnailSize,
  parseAssetId,
};
