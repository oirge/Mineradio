// Copyright (c) 2026 chthollyphile
// src/components/visualizer/lumiere/lumiereRandom.ts
// 绘光的确定性随机数：按 key 播种的 mulberry32 流（key 先经 FNV-1a 散列）。场景构建与编译里的随机量
// 全部从这里取，同一首歌同一个种子永远得到同一帧——seek、重建、预热都不会改变画面。
// folia 已有的 temperaRandom / sonnetRandom 只提供 FNV 散列与逐元素哈希，没有可连续取值的流，所以这里单独保留一份。

const hashKey = (key: string) => {
    let hash = 0x811c9dc5;
    for (let i = 0; i < key.length; i += 1) {
        hash ^= key.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
};

/** mulberry32：32 位状态，周期 2^32，对装饰用的随机足够。数字种子直接当状态，字符串种子先散列。 */
export const createRng = (seed: string | number) => {
    let state = typeof seed === 'number' ? seed >>> 0 : hashKey(seed);
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
};

/**
 * 与 createRng(seed) 同一条流，但从第 skip 个值之后开始：mulberry32 每取一次状态加一个常数，跳过是 O(1)。
 * 歌词窗口按需构建某一行时用它直接跳到这一行的起点，拿到的值与从头顺序取完全一样。
 */
export const createRngAt = (seed: string | number, skip: number) => {
    const state = typeof seed === 'number' ? seed >>> 0 : hashKey(seed);
    return createRng((state + Math.imul(skip, 0x6d2b79f5)) >>> 0);
};
