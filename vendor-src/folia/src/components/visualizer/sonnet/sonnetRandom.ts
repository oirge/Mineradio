// src/components/visualizer/sonnet/sonnetRandom.ts
// Supplies deterministic selection without relying on process-global random state.
export const hashSonnetSeed = (value: string): number => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

// Mixes a numeric seed with a salt so different sub-systems (geo variant,
// background HUD, fixed geo, decor, per-particle jitter) stay decorrelated.
export const mixSonnetSeed = (seed: number, salt: number) => (
    Math.imul((Math.trunc(seed) ^ salt) >>> 0, 2654435761) >>> 0
);

// Deterministic 0..1 jitter per element index; seek-safe and rebuild-stable.
export const sonnetHash01 = (seed: number, index: number, salt: number) => (
    mixSonnetSeed(seed + Math.imul(index + 1, 97), salt) / 4294967296
);
