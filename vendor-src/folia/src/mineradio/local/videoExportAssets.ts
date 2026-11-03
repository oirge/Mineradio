import { getFromCache } from './visualAssetCache';
import { getStoredUploadedLyricsFont, registerUploadedLyricsFont } from '../../services/customLyricsFont';
import type { VisualPreferences } from './useVisualSettings';

// src/mineradio/local/videoExportAssets.ts
// Snapshot image leases for one export; no preference or asset writes are performed.
interface StoredImage { id: string; name: string; blob: Blob }
export interface ExportImage { id: string; name: string; url: string }
export interface ExportAssets {
    emoji: ExportImage[]; avatar: ExportImage[]; portrait: ExportImage[]; background: ExportImage[]; tempera: ExportImage[];
    release: () => void;
}
export async function loadVideoExportAssets(visuals: VisualPreferences, signal: AbortSignal): Promise<ExportAssets> {
    const urls: string[] = [];
    const release = () => { urls.splice(0).forEach(url => URL.revokeObjectURL(url)); };
    const check = () => { if (signal.aborted) throw new DOMException('Video export closed', 'AbortError'); };
    const read = async (key: string): Promise<ExportImage[]> => {
        const value = await getFromCache<StoredImage | StoredImage[]>(key);
        check();
        const stored = Array.isArray(value) ? value : value ? [value] : [];
        return stored.filter(image => image?.blob instanceof Blob).map(image => {
            const url = URL.createObjectURL(image.blob); urls.push(url);
            return { id: image.id, name: image.name, url };
        });
    };
    try {
        // Every task settles before releasing leases, including after an aborted read.
        const loaded = await Promise.allSettled([
            read('cappella_custom_emoji_pack'), read('cappella_custom_avatar'), read('monet_portrait_image'), read('monet_background_image'),
            Promise.all((visuals.tunings.tempera?.layerImages ?? []).map(image => read(`tempera_layer_image_${image.id}`))).then(images => images.flat()),
            getStoredUploadedLyricsFont().then(async font => { check(); if (font) await registerUploadedLyricsFont(font); }),
        ]);
        const failed = loaded.find(result => result.status === 'rejected');
        if (failed?.status === 'rejected') throw failed.reason;
        const [emoji, avatar, portrait, background, tempera] = loaded.slice(0, 5).map(result => (result as PromiseFulfilledResult<ExportImage[]>).value);
        await Promise.all([...emoji, ...avatar, ...portrait, ...background, ...tempera].map(async item => {
            const image = new Image(); image.src = item.url; await image.decode(); check();
        }));
        check();
        return { emoji, avatar, portrait, background, tempera, release };
    } catch (error) { release(); throw error; }
}
