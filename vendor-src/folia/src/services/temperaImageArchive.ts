import { strFromU8, strToU8, unzip, unzipSync, zip, type AsyncZippable, type Unzipped } from 'fflate';
import { TEMPERA_MAX_LAYER_IMAGES, type TemperaLayerImage } from '../types';
import {
    clearTemperaLayerImage,
    getTemperaLayerImage,
    prepareTemperaLayerImage,
    saveTemperaLayerImage,
    type StoredTemperaLayerImage,
} from './temperaLayerImages';
import { buildTemperaArchiveEntryPath, collectTemperaArchiveEntries } from './temperaImageArchiveFormat';

// src/services/temperaImageArchive.ts
// Moves the Tempera canvas-image pool in and out of a zip.
//
// The files themselves only ever live in IndexedDB keyed by `tempera_layer_image_${id}`; the
// tuning carries ids and placement, which is what makes it small enough to sync, and also what
// makes the pool invisible to every existing text export - a shortcode or a sync snapshot that
// carried the artwork would blow its own size budget. So the pool gets a binary sidecar: a zip
// holding the placements plus the original bytes, rebuilt on import through the same
// `prepareTemperaLayerImage` path a drag-and-drop upload takes, thumbnails included.
//
// The zip carries the pool and nothing else: `layerImageDepth` / `layerImageFrequency` are
// pool-wide tuning the user is still looking at in the settings panel, so writing them back would
// change when and where images the backup never touched are drawn. Import only touches placements.
//
// Compression and decompression run off-thread through fflate's async `zip`/`unzip`: the pool holds
// up to sixteen images at print resolution, and deflating tens of megabytes on the main thread is
// long enough to be visible as a stall in the lyric animation that is usually playing behind this
// dialog. fflate buffers each file into the worker rather than transferring it, so the pool is
// briefly held twice - the alternative is detaching the bytes the pool is still showing.

const ARCHIVE_KIND = 'folia-tempera-pool';
const SCHEMA_VERSION = 1;

// 解压后总大小上限。超过即视为损坏或压缩炸弹并拒绝导入，避免把整个 zip 一次性
// inflate 进内存（实测 51KB 的 zip 可产出 50MB 字节，令浏览器瞬间吃掉数百 MB）。
const TEMPERA_ARCHIVE_MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024; // 512 MB

/** 备份解压后预计超过上限时抛出，UI 据此显示警告并取消导入。 */
export class TemperaArchiveTooLargeError extends Error {
    constructor() {
        super('Tempera pool backup is too large to import');
        this.name = 'TemperaArchiveTooLargeError';
    }
}

/**
 * 只解析 zip 中央目录、对每条目的 originalSize 求和，不做任何解压：filter 始终返回
 * false，fflate 因此不会 inflate 任何条目。返回解压后的总字节数。
 */
const probeUncompressedSize = (bytes: Uint8Array): number => {
    let total = 0;
    unzipSync(bytes, {
        filter: file => {
            total += file.originalSize;
            return false;
        },
    });
    return total;
};

export interface TemperaImagePoolSnapshot {
    layerImages: TemperaLayerImage[];
}

export interface TemperaImageArchiveExportResult {
    blob: Blob;
    /** Placements whose bytes made it into the zip. */
    exported: number;
    /** Placements left out because their file was gone from IndexedDB. */
    skipped: number;
}

export interface TemperaImageArchiveImportResult {
    layerImages: TemperaLayerImage[];
    /** Files that were skipped because they were not images the pool accepts. */
    skipped: number;
    /** Files dropped because the pool was already full. */
    truncated: number;
}

const encodeJson = (value: unknown) => strToU8(JSON.stringify(value, null, 2));

const readJsonEntry = (files: Unzipped, path: string): unknown => {
    const file = files[path];
    if (!file) throw new Error(`Tempera pool zip is missing ${path}`);
    return JSON.parse(strFromU8(file));
};

/**
 * Runs fflate's async entry points as promises. Both hand back a terminator that nothing calls:
 * a cancelled export leaves the worker to finish and be collected, which is cheaper than tracking
 * the operation through the dialog's close path.
 */
const runZip = (files: AsyncZippable): Promise<Uint8Array<ArrayBuffer>> => new Promise((resolve, reject) => {
    zip(files, { level: 6 }, (error, data) => (error ? reject(error) : resolve(data)));
});

const runUnzip = (bytes: Uint8Array): Promise<Unzipped> => new Promise((resolve, reject) => {
    unzip(bytes, (error, files) => (error ? reject(error) : resolve(files)));
});

/**
 * Reads the whole pool - placements and files - into a zip. Entries whose file has gone
 * missing are dropped from the manifest instead of producing a zip with holes in it: importing
 * that back would restore placements that can never resolve to a picture. The two counts are
 * returned because a backup that silently holds fewer pictures than the pool shows is worse than
 * one that says so at the moment it is taken.
 */
export const createTemperaImageArchive = async (
    snapshot: TemperaImagePoolSnapshot,
): Promise<TemperaImageArchiveExportResult> => {
    const files: Record<string, Uint8Array> = {};
    const keptIds = new Set<string>();

    await Promise.all(snapshot.layerImages.map(async image => {
        const stored = await getTemperaLayerImage(image.id).catch(() => null);
        if (!stored?.blob) return;
        files[buildTemperaArchiveEntryPath(image, stored.mimeType || stored.blob.type)] = new Uint8Array(await stored.blob.arrayBuffer());
        keptIds.add(image.id);
    }));

    // Order matters: the pool is rendered in array order, so the zip has to replay the same
    // pool rather than a shuffled one.
    const ordered = snapshot.layerImages.filter(image => keptIds.has(image.id));
    files['pool.json'] = encodeJson({ layerImages: ordered });
    files['meta.json'] = encodeJson({
        kind: ARCHIVE_KIND,
        schemaVersion: SCHEMA_VERSION,
        imageCount: ordered.length,
    });

    return {
        blob: new Blob([await runZip(files)], { type: 'application/zip' }),
        exported: ordered.length,
        skipped: snapshot.layerImages.length - ordered.length,
    };
};

/**
 * Restores a pool from a zip. Rebuilds those bytes through `prepareTemperaLayerImage`
 * instead of storing them as-is, so an import arrives in exactly the state a fresh drag-and-drop
 * would leave it in - thumbnails and all - and so the shape is validated on the way in.
 */
export const readTemperaImageArchiveFile = async (
    file: File,
    options: { existing: TemperaLayerImage[]; maxImages?: number; signal?: AbortSignal },
): Promise<TemperaImageArchiveImportResult> => {
    const maxImages = options.maxImages ?? TEMPERA_MAX_LAYER_IMAGES;
    const bytes = new Uint8Array(await file.arrayBuffer());

    // 解压前先判断总体积：中央目录里声明的解压后大小之和超过阈值就直接拒绝，
    // 这样永远不会把整个 zip inflate 进内存。
    if (probeUncompressedSize(bytes) > TEMPERA_ARCHIVE_MAX_UNCOMPRESSED_BYTES) {
        throw new TemperaArchiveTooLargeError();
    }

    const files = await runUnzip(bytes);
    const meta = readJsonEntry(files, 'meta.json') as { kind?: unknown; schemaVersion?: unknown };
    if (meta.kind !== ARCHIVE_KIND || meta.schemaVersion !== SCHEMA_VERSION) {
        throw new Error('Not a Folia canvas-image backup');
    }

    // Older backups also wrote `layerImageDepth` / `layerImageFrequency` here. Ignored rather than
    // rejected: the pool is still restorable, and those settings belong to the importer, not the zip.
    const pool = readJsonEntry(files, 'pool.json') as { layerImages?: unknown };
    const manifest = Array.isArray(pool.layerImages) ? pool.layerImages : [];
    const entries = collectTemperaArchiveEntries(files, manifest);
    const existingIds = new Set(options.existing.map(image => image.id));
    // Files named by the manifest but absent from the archive: a backup edited by hand, or one
    // that lost entries to a partial write. Counted rather than thrown so the rest still imports.
    const skipped = manifest.length - entries.length;
    let truncated = 0;

    const layerImages: TemperaLayerImage[] = [];
    const savedIds: string[] = [];
    const throwIfAborted = () => {
        if (!options.signal?.aborted) return;
        const error = new Error('Tempera pool import was cancelled');
        error.name = 'AbortError';
        throw error;
    };
    try {
        throwIfAborted();
        for (let index = 0; index < entries.length; index += 1) {
            // A pool-size change means an older backup can hold more entries than fit now; those
            // are dropped rather than silently overflowing the pool. The tail is counted from the
            // resolvable entries rather than from raw manifest rows that may already be invalid.
            if (layerImages.length + options.existing.length >= maxImages) {
                truncated = entries.length - index;
                break;
            }

            throwIfAborted();
            const entry = entries[index];
            // A colliding generated id is minted afresh, leaving the existing record untouched.
            const source = new File(
                [new Uint8Array(entry.bytes) as unknown as BlobPart],
                entry.image.name,
                { type: entry.mimeType },
            );
            const prepared = await prepareTemperaLayerImage(source);
            throwIfAborted();
            const id = !existingIds.has(prepared.id) && !layerImages.some(image => image.id === prepared.id)
                ? prepared.id
                : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${prepared.name}`;
            const stored: StoredTemperaLayerImage = { ...prepared, id };
            await saveTemperaLayerImage(stored);
            savedIds.push(id);
            throwIfAborted();
            layerImages.push({ ...entry.image, id, name: stored.name || entry.image.name });
            existingIds.add(id);
        }
    } catch (error) {
        // Import is all-or-nothing. A quota error or cancellation after an earlier successful
        // write must not leave records no placement can ever reach.
        await Promise.all(savedIds.map(id => clearTemperaLayerImage(id).catch(() => undefined)));
        throw error;
    }

    return { layerImages, skipped, truncated };
};
