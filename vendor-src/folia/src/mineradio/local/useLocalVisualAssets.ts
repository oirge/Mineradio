import { useCallback, useEffect, useRef, useState } from 'react';
import { getFromCache, removeFromCache, saveToCache } from './visualAssetCache';
import { isSupportedVisualizerImageFile } from '../../services/visualizerImageAsset';

// src/mineradio/local/useLocalVisualAssets.ts
// Small local visual assets share no song database or application bootstrap.
interface StoredImage { id: string; name: string; mimeType: string; blob: Blob; }
interface ImageView { id: string; name: string; url: string; }
function useImageAssets(key: string, multiple: boolean) {
    const [stored, setStored] = useState<StoredImage[]>([]);
    const [images, setImages] = useState<ImageView[]>([]);
    const [loading, setLoading] = useState(true);
    const mounted = useRef(false), revision = useRef(0);
    const serial = useRef<Promise<unknown>>(Promise.resolve());
    const normalize = (value: unknown): StoredImage[] => (Array.isArray(value) ? value : value ? [value] : [])
        .filter(item => item?.blob instanceof Blob && typeof item.name === 'string');
    useEffect(() => {
        mounted.current = true;
        const ticket = ++revision.current;
        void getFromCache(key).then(value => {
            if (mounted.current && ticket === revision.current) setStored(normalize(value));
        }).catch(() => {}).finally(() => { if (mounted.current && ticket === revision.current) setLoading(false); });
        return () => { mounted.current = false; revision.current++; };
    }, [key]);
    useEffect(() => {
        const leases = stored.map(item => ({ id: item.id, name: item.name, url: URL.createObjectURL(item.blob) }));
        setImages(leases);
        return () => leases.forEach(item => URL.revokeObjectURL(item.url));
    }, [stored]);
    // Serialize edits so quick consecutive imports cannot overwrite one another.
    const mutate = useCallback((files: File[] | null) => {
        revision.current++;
        if (mounted.current) setLoading(true);
        const operation = serial.current.catch(() => {}).then(async () => {
            if (files && (!files.length || files.some(file => !isSupportedVisualizerImageFile(file)))) {
                return { ok: false, error: '请选择图片文件 / Choose image files' };
            }
            const previous = files && multiple ? normalize(await getFromCache(key)) : [];
            const imported = (files ?? []).slice(0, multiple ? undefined : 1).map((file, index) => ({
                id: `${Date.now()}-${index}-${file.name}`, name: file.name, mimeType: file.type, blob: file,
            }));
            const next = [...previous, ...imported];
            if (next.length) await saveToCache(key, multiple ? next : next[0]);
            else await removeFromCache(key);
            if (mounted.current) setStored(next);
            return { ok: true };
        }).catch(failure => ({ ok: false, error: failure instanceof Error ? failure.message : String(failure) }))
            .finally(() => { if (mounted.current) setLoading(false); });
        serial.current = operation;
        return operation;
    }, [key, multiple]);
    const upload = useCallback((files: File[]) => mutate(files), [mutate]);
    const clear = useCallback(async () => { const result = await mutate(null); if (!result.ok) throw new Error(result.error); }, [mutate]);
    return { images, loading, upload, clear };
}

export function useLocalVisualAssets() {
    const emoji = useImageAssets('cappella_custom_emoji_pack', true);
    const avatar = useImageAssets('cappella_custom_avatar', true);
    const portrait = useImageAssets('monet_portrait_image', false);
    const background = useImageAssets('monet_background_image', false);
    return { emoji, avatar, portrait, background };
}
export type LocalVisualAssets = ReturnType<typeof useLocalVisualAssets>;
