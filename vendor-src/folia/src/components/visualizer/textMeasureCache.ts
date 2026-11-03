// src/components/visualizer/textMeasureCache.ts
// Bounded layout cache shared by the extracted Partita layout.
export const rememberBounded = <TKey, TValue>(cache: Map<TKey, TValue>, key: TKey, value: TValue, limit: number): TValue => {
    if (!cache.has(key) && cache.size >= limit) {
        const oldest = cache.keys().next();
        if (!oldest.done) cache.delete(oldest.value);
    }
    cache.set(key, value);
    return value;
};
