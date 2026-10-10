import type { TemperaLayerImage } from '../types';
import {
    buildStoredVisualizerImageAsset,
    clearStoredVisualizerImageAsset,
    getStoredVisualizerImageAsset,
    isSupportedVisualizerImageFile,
    saveStoredVisualizerImageAsset,
} from './visualizerImageAsset';

// src/services/temperaLayerImages.ts
// Persists the user's Tempera canvas images in IndexedDB, one record per image. The tuning
// only carries ids and placement, so it stays small enough to sync; the blobs stay here.
export interface StoredTemperaLayerImage {
    id: string;
    name: string;
    mimeType: string;
    blob: Blob;
    /**
     * Downscaled copy for the settings UI. Character art arrives at print resolution and the
     * pool holds up to TEMPERA_MAX_LAYER_IMAGES of them, so previewing off `blob` means decoding
     * tens of megapixels into a row of 80px boxes. Absent on records saved before this existed,
     * and on files small enough that a re-encode would only lose quality - callers fall back to
     * `blob`.
     */
    thumbnail?: Blob;
}

/** Comfortably covers an 80px preview box on a 3x display. */
const THUMBNAIL_MAX_EDGE = 256;

const keyFor = (id: string) => `tempera_layer_image_${id}`;

export const isSupportedTemperaLayerImageFile = isSupportedVisualizerImageFile;

export const getTemperaLayerImage = async (id: string) => (
    getStoredVisualizerImageAsset<StoredTemperaLayerImage>(keyFor(id))
);

export const saveTemperaLayerImage = async (image: StoredTemperaLayerImage) => {
    await saveStoredVisualizerImageAsset(keyFor(image.id), image);
};

export const clearTemperaLayerImage = async (id: string) => {
    await clearStoredVisualizerImageAsset(keyFor(id));
};

export const buildStoredTemperaLayerImage = (file: File) => (
    buildStoredVisualizerImageAsset<StoredTemperaLayerImage>(file)
);

/**
 * Renders a downscaled preview copy. Returns null rather than throwing whenever the browser
 * cannot decode the file this way - SVG bitmaps are refused outright by some engines - so the
 * caller simply stores the record without one and previews off the original.
 */
export const createTemperaLayerImageThumbnail = async (file: Blob): Promise<Blob | null> => {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
    let bitmap: ImageBitmap | null = null;
    try {
        bitmap = await createImageBitmap(file);
        const scale = THUMBNAIL_MAX_EDGE / Math.max(bitmap.width, bitmap.height);
        if (scale >= 1) return null;
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        const context = canvas.getContext('2d');
        if (!context) return null;
        context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        return await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.82));
    } catch {
        return null;
    } finally {
        bitmap?.close();
    }
};

/** Builds the record the pool stores, preview copy included. */
export const prepareTemperaLayerImage = async (file: File): Promise<StoredTemperaLayerImage> => {
    const stored = buildStoredTemperaLayerImage(file);
    const thumbnail = await createTemperaLayerImageThumbnail(file);
    return thumbnail ? { ...stored, thumbnail } : stored;
};

/**
 * Resolves the pool to its preview blobs, falling back to the full file when a record carries
 * no downscaled copy. The renderer must keep using `loadTemperaLayerImageBlobs`: it needs the
 * real resolution, and so does the OBS publisher that inlines these as data URLs.
 */
export const loadTemperaLayerImageThumbnails = async (
    placements: Pick<TemperaLayerImage, 'id'>[],
): Promise<Map<string, Blob>> => {
    const blobs = new Map<string, Blob>();
    await Promise.all(placements.map(async placement => {
        const stored = await getTemperaLayerImage(placement.id).catch(() => null);
        const preview = stored?.thumbnail ?? stored?.blob;
        if (preview) blobs.set(placement.id, preview);
    }));
    return blobs;
};

/**
 * Resolves placed images to their stored blobs, skipping any whose file has gone missing.
 * Blobs rather than object URLs on purpose: Pixi's `Assets` loader picks a parser from the
 * URL's file extension and a `blob:` URL has none, so it refuses to load one. The renderer
 * decodes these directly instead, which also removes any URL lifetime to manage.
 */
export const loadTemperaLayerImageBlobs = async (
    // Only the ids are read, so callers that hold nothing but ids - the settings thumbnails -
    // do not have to fabricate whole placement records to ask for the files.
    placements: Pick<TemperaLayerImage, 'id'>[],
): Promise<Map<string, Blob>> => {
    const blobs = new Map<string, Blob>();
    await Promise.all(placements.map(async placement => {
        const stored = await getTemperaLayerImage(placement.id).catch(() => null);
        if (stored?.blob) blobs.set(placement.id, stored.blob);
    }));
    return blobs;
};
