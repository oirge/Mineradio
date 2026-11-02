// src/mineradio/local/visualAssetCache.ts
// Embedded visual assets have their own small cache. No Folia catalog/session/provider database is loaded.
const CACHE_NAME = 'mineradio-folia-visual-assets-v1';
const STORE = 'assets';
const ALLOWED_KEYS = new Set(['cappella_custom_avatar', 'cappella_custom_emoji_pack', 'monet_background_image', 'monet_portrait_image', 'lyrics_uploaded_font']);
function checkKey(key: string) {
    if (!ALLOWED_KEYS.has(key) && !key.startsWith('tempera_layer_image_')) throw new Error('Unsupported local visual asset');
}

// Each operation owns and closes its connection; failed/blocked opens and aborted writes always settle.
function withAssetStore<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') { reject(new Error('Local visual asset storage is unavailable')); return; }
        let settled = false;
        const open = indexedDB.open(CACHE_NAME, 1);
        const fail = (error: unknown) => { if (!settled) { settled = true; reject(error); } };
        open.onupgradeneeded = () => { if (!open.result.objectStoreNames.contains(STORE)) open.result.createObjectStore(STORE); };
        open.onerror = () => fail(open.error || new Error('Unable to open local visual asset storage'));
        open.onblocked = () => fail(new Error('Local visual asset storage is busy'));
        open.onsuccess = () => {
            const database = open.result;
            if (settled) { database.close(); return; }
            database.onversionchange = () => database.close();
            try {
                const transaction = database.transaction(STORE, mode);
                let request: IDBRequest;
                try { request = action(transaction.objectStore(STORE)); }
                catch (error) { transaction.abort(); throw error; }
                transaction.oncomplete = () => {
                    database.close();
                    if (!settled) { settled = true; resolve(request.result as T); }
                };
                transaction.onabort = () => { database.close(); fail(transaction.error || request.error || new Error('Local visual asset transaction aborted')); };
                transaction.onerror = () => { database.close(); fail(transaction.error || request.error || new Error('Local visual asset transaction failed')); };
            } catch (error) { database.close(); fail(error); }
        };
    });
}
export async function getFromCache<T>(key: string): Promise<T | null> {
    checkKey(key);
    return (await withAssetStore<T | undefined>('readonly', (store) => store.get(key))) ?? null;
}
export async function saveToCache(key: string, data: unknown): Promise<void> {
    checkKey(key);
    await withAssetStore('readwrite', (store) => store.put(data, key));
}
export async function removeFromCache(key: string): Promise<void> {
    checkKey(key);
    await withAssetStore('readwrite', (store) => store.delete(key));
}

export const VISUAL_ASSETS_CHANGED = 'mineradio-visual-assets-changed';
// A preset's attached images replace only the included categories, in one transaction.
export async function saveVisualAssetLibrary(entries: Record<string, unknown>): Promise<void> {
    const keys = Object.keys(entries);
    keys.forEach(checkKey);
    if (!keys.length) return;
    await withAssetStore('readwrite', store => {
        for (const key of keys) store.put(entries[key], key);
        return store.count();
    });
    window.dispatchEvent(new Event(VISUAL_ASSETS_CHANGED));
}
