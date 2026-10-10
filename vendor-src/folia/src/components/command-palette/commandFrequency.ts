// src/components/command-palette/commandFrequency.ts
// 命令使用频次，用来给「常用但不在最近列表里」的命令一点排序加成。
//
// 与 recentCommands.ts 完全分开，用独立的 localStorage 键：那份 MRU 列表的形状和语义一个字
// 都不动，频次数据缺失或损坏时加成恒为 0，也就是今天的行为。
//
// 加成只加到 `score`，也就是比较器的**第三个**键。比较器第二步在任一方出现在最近列表里且名次
// 不同时就短路返回，而名次是唯一的，所以第三步只在双方都不在最近列表里时才会被执行——
// 频次因此只可能重排两条都没最近用过的命令，最近使用的排序规则不受任何影响。
// test/unit/command-palette/commandFrequency.test.ts 用属性测试把这条钉住。

const STORAGE_KEY = 'command_palette_frequency_v1';

/** 14 天减半。用得再多的命令，几周不碰也该让位给新习惯。 */
const HALF_LIFE_MS = 14 * 24 * 60 * 60 * 1000;
/** 衰减是惰性的：只在写入时跑，且距上次衰减超过一天才跑。不上定时器，不进渲染。 */
const DECAY_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** 计数饱和值，防止某条命令的分数无限膨胀。 */
const MAX_COUNT = 32;
/** 只跟踪最常用的这些条，其余在写入时修剪掉。 */
const MAX_TRACKED_COMMANDS = 64;
/** 衰减后低于这个值就丢弃，免得字典里堆满趋近于零的残留。 */
const MIN_KEPT_COUNT = 0.5;
/** 加成硬上限。它跨不了档（档位先比），档内也只够翻转有限的差距。 */
export const FREQUENCY_BONUS_MAX = 12;

export type CommandFrequencyState = {
    v: 1;
    /** 上次执行衰减的时刻（ms epoch）。 */
    anchor: number;
    counts: Record<string, number>;
};

export const createEmptyCommandFrequencyState = (now = Date.now()): CommandFrequencyState => ({
    v: 1,
    anchor: now,
    counts: {},
});

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const parseState = (raw: string | null, now: number): CommandFrequencyState => {
    if (!raw) {
        return createEmptyCommandFrequencyState(now);
    }

    try {
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.v !== 1 || typeof parsed.counts !== 'object' || parsed.counts === null) {
            return createEmptyCommandFrequencyState(now);
        }

        const counts: Record<string, number> = {};
        Object.entries(parsed.counts as Record<string, unknown>).forEach(([commandId, count]) => {
            if (isFiniteNumber(count) && count > 0) {
                counts[commandId] = Math.min(count, MAX_COUNT);
            }
        });

        return {
            v: 1,
            anchor: isFiniteNumber(parsed.anchor) ? parsed.anchor : now,
            counts,
        };
    } catch {
        return createEmptyCommandFrequencyState(now);
    }
};

export const readCommandFrequencyState = (now = Date.now()): CommandFrequencyState => {
    if (typeof window === 'undefined') {
        return createEmptyCommandFrequencyState(now);
    }
    return parseState(window.localStorage.getItem(STORAGE_KEY), now);
};

const writeCommandFrequencyState = (state: CommandFrequencyState) => {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

/** 半衰期衰减 + 修剪。导出是为了让测试能用假时钟直接验它。 */
export const decayCommandFrequencyState = (
    state: CommandFrequencyState,
    now: number,
): CommandFrequencyState => {
    const elapsed = now - state.anchor;
    if (elapsed < DECAY_INTERVAL_MS) {
        return state;
    }

    const factor = 0.5 ** (elapsed / HALF_LIFE_MS);
    const counts: Record<string, number> = {};
    Object.entries(state.counts).forEach(([commandId, count]) => {
        const next = count * factor;
        if (next >= MIN_KEPT_COUNT) {
            counts[commandId] = next;
        }
    });

    return { v: 1, anchor: now, counts };
};

const prune = (counts: Record<string, number>): Record<string, number> => {
    const entries = Object.entries(counts);
    if (entries.length <= MAX_TRACKED_COMMANDS) {
        return counts;
    }
    return Object.fromEntries(
        entries.sort((a, b) => b[1] - a[1]).slice(0, MAX_TRACKED_COMMANDS),
    );
};

/**
 * 记一次使用，返回新状态。每条已执行的命令写一次 localStorage —— 不是每击键，不是每渲染。
 */
export const recordCommandUse = (
    commandId: string,
    state: CommandFrequencyState,
    now = Date.now(),
): CommandFrequencyState => {
    const decayed = decayCommandFrequencyState(state, now);
    const counts = { ...decayed.counts };
    counts[commandId] = Math.min((counts[commandId] ?? 0) + 1, MAX_COUNT);

    const next: CommandFrequencyState = { v: 1, anchor: decayed.anchor, counts: prune(counts) };
    writeCommandFrequencyState(next);
    return next;
};

/**
 * 分数加成，log 缩放：第 3 次使用的边际收益远大于第 30 次。
 * 恒在 [0, FREQUENCY_BONUS_MAX] 内，任何输入都不会越界。
 */
export const getCommandFrequencyBonus = (
    counts: Record<string, number>,
    commandId: string,
): number => {
    const count = counts[commandId];
    if (!isFiniteNumber(count) || count <= 0) {
        return 0;
    }
    const saturated = Math.min(count, MAX_COUNT);
    const ratio = Math.log1p(saturated) / Math.log1p(MAX_COUNT);
    return Math.round(FREQUENCY_BONUS_MAX * Math.min(1, ratio));
};
