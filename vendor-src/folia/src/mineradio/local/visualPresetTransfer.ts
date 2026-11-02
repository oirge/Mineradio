import { captureVisualPreset, presetName, type LocalVisualPreset } from './visualPresetData';
import { normalizeVisualPreferences, useVisualSettings } from './useVisualSettings';
import { getFromCache, saveVisualAssetLibrary } from './visualAssetCache';

// Portable single-preset files contain parameters and optional shared image categories.
export const PRESET_FILE_LIMIT = 24 * 1024 * 1024;
const IMAGE_LIMIT = 8 * 1024 * 1024, ASSET_LIMIT = 16 * 1024 * 1024;
const IMAGE_KEYS = ['cappella_custom_avatar', 'cappella_custom_emoji_pack', 'monet_background_image', 'monet_portrait_image'] as const;
const MULTIPLE = new Set<string>(IMAGE_KEYS.slice(0, 2));
const TEMPERA_PREFIX = 'tempera_layer_image_';
const IMAGE_TYPES: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
interface StoredImage { id: string; name: string; mimeType: string; blob: Blob }
interface PortableImage { name: string; mimeType: string; data: string }
interface PresetFile {
    format: 'mineradio-folia-preset'; version: 1;
    preset: Pick<LocalVisualPreset, 'name' | 'settings'>;
    assets?: Record<string, PortableImage[]>;
}
function invalid(): never { throw new Error('presetFileInvalid'); }
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function mime(name: string, type: string) {
    return Object.values(IMAGE_TYPES).includes(type) ? type : IMAGE_TYPES[name.split('.').pop()?.toLowerCase() ?? ''];
}
async function encodeImage(image: StoredImage): Promise<PortableImage> {
    if (!(image.blob instanceof Blob) || image.blob.size > IMAGE_LIMIT || !mime(image.name, image.mimeType)) invalid();
    const bytes = new Uint8Array(await image.blob.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    const data = btoa(binary);
    return { name: image.name.slice(0, 255), mimeType: mime(image.name, image.mimeType), data };
}
export async function exportVisualPreset(preset: LocalVisualPreset, includeImages: boolean): Promise<string> {
    const file: PresetFile = { format: 'mineradio-folia-preset', version: 1,
        preset: { name: preset.name, settings: captureVisualPreset(normalizeVisualPreferences(preset.settings)) } };
    if (includeImages) {
        const assets: Record<string, PortableImage[]> = {};
        let bytes = 0, count = 0;
        const temperaIds = file.preset.settings.tunings.tempera?.layerImages?.map(image => image.id) ?? [];
        const keys = [...IMAGE_KEYS, ...new Set(temperaIds.map(id => TEMPERA_PREFIX + id))];
        for (const key of keys) {
            const value = await getFromCache<StoredImage | StoredImage[]>(key);
            const entries = value ? Array.isArray(value) ? value : [value] : [];
            if (!entries.length) continue;
            bytes += entries.reduce((sum, entry) => sum + (entry.blob?.size ?? 0), 0);
            count += entries.length;
            if (bytes > ASSET_LIMIT || count > 64) invalid();
            assets[key] = [];
            for (const image of entries) assets[key].push(await encodeImage(image));
        }
        file.assets = assets;
    }
    const text = JSON.stringify(file);
    if (new Blob([text]).size > PRESET_FILE_LIMIT) invalid();
    return text;
}
export function parseVisualPreset(text: string) {
    if (new Blob([text]).size > PRESET_FILE_LIMIT) invalid();
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { invalid(); }
    if (!isObject(raw) || raw.format !== 'mineradio-folia-preset' || raw.version !== 1 || !isObject(raw.preset)
        || !presetName(raw.preset.name) || !isObject(raw.preset.settings)
        || JSON.stringify(raw.preset.settings).length > 512 * 1024) invalid();
    const preset = { name: presetName(raw.preset.name), settings: captureVisualPreset(normalizeVisualPreferences(raw.preset.settings)) };
    const assets: Record<string, StoredImage | StoredImage[]> = {};
    const temperaIds = new Set(preset.settings.tunings.tempera?.layerImages?.map(image => image.id) ?? []);
    const replacedIds = new Map<string, string>();
    let bytes = 0, count = 0;
    if (raw.assets !== undefined) {
        if (!isObject(raw.assets)) invalid();
        for (const [key, value] of Object.entries(raw.assets)) {
            const temperaId = key.startsWith(TEMPERA_PREFIX) ? key.slice(TEMPERA_PREFIX.length) : null;
            if (!(IMAGE_KEYS.includes(key as typeof IMAGE_KEYS[number]) || (temperaId && temperaIds.has(temperaId))) || !Array.isArray(value) || !value.length
                || (!MULTIPLE.has(key) && value.length !== 1)) invalid();
            const images: StoredImage[] = [];
            for (const image of value) {
                if (!isObject(image) || typeof image.name !== 'string' || !image.name || image.name.length > 255
                    || typeof image.mimeType !== 'string' || !Object.values(IMAGE_TYPES).includes(image.mimeType)
                    || typeof image.data !== 'string' || image.data.length > Math.ceil(IMAGE_LIMIT / 3) * 4
                    || image.data.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(image.data)) invalid();
                let decoded: string;
                try { decoded = atob(image.data); } catch { invalid(); }
                bytes += decoded.length; count++;
                if (!decoded.length || decoded.length > IMAGE_LIMIT || bytes > ASSET_LIMIT || count > 64) invalid();
                images.push({ id: crypto.randomUUID(), name: image.name, mimeType: image.mimeType,
                    blob: new Blob([Uint8Array.from(decoded, char => char.charCodeAt(0))], { type: image.mimeType }) });
            }
            if (temperaId) {
                replacedIds.set(temperaId, images[0].id);
                assets[TEMPERA_PREFIX + images[0].id] = images[0];
            } else assets[key] = MULTIPLE.has(key) ? images : images[0];
        }
    }
    const tempera = preset.settings.tunings.tempera;
    if (tempera && replacedIds.size) tempera.layerImages = tempera.layerImages.map(image => ({ ...image, id: replacedIds.get(image.id) ?? image.id }));
    return { preset, assets };
}
export async function importVisualPreset(text: string): Promise<string> {
    const { preset, assets } = parseVisualPreset(text);
    // Reserve a name and a slot before touching shared images. Imports never overwrite existing presets.
    const id = useVisualSettings.getState().importPreset(preset);
    if (!id) throw new Error('presetInvalid');
    try { await saveVisualAssetLibrary(assets); }
    catch (error) { useVisualSettings.getState().deletePreset(id); throw error; }
    return id;
}
