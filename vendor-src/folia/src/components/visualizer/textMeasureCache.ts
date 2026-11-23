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

/** Measure grapheme boundaries with a shared prefix, preserving kerning between characters. */
export const measurePrefixOffsets = (
    graphemes: readonly string[],
    measurePrefix: (prefix: string, count: number, previousOffset: number) => number,
): number[] => {
    const offsets = [0];
    let prefix = '';
    for (const grapheme of graphemes) {
        prefix += grapheme;
        offsets.push(measurePrefix(prefix, offsets.length, offsets[offsets.length - 1]));
    }
    return offsets;
};
