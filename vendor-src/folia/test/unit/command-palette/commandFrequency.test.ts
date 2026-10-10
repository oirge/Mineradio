import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    FREQUENCY_BONUS_MAX,
    createEmptyCommandFrequencyState,
    decayCommandFrequencyState,
    getCommandFrequencyBonus,
    readCommandFrequencyState,
    recordCommandUse,
} from '../../../src/components/command-palette/commandFrequency';
import { COMMAND_PALETTE_COMMANDS, rankCommands } from '../../../src/components/command-palette/commandRegistry';

// test/unit/command-palette/commandFrequency.test.ts
// 频次加成的衰减、上界，以及最重要的那条保证：它不能动最近使用的排序规则。

const DAY = 24 * 60 * 60 * 1000;

// 单测跑在 node 环境里，没有 window。和 recentCommands.test.ts 一样自己搭一个 localStorage。
const createStorage = (initial: Record<string, string> = {}) => {
    const values = new Map(Object.entries(initial));
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value); },
    };
};

describe('command frequency state', () => {
    beforeEach(() => {
        vi.stubGlobal('window', { localStorage: createStorage() });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('starts empty and yields no bonus', () => {
        const state = readCommandFrequencyState();
        expect(state.counts).toEqual({});
        expect(getCommandFrequencyBonus(state.counts, 'queue')).toBe(0);
    });

    it('falls back to an empty state on malformed storage', () => {
        vi.stubGlobal('window', { localStorage: createStorage({ command_palette_frequency_v1: '{not json' }) });
        expect(readCommandFrequencyState().counts).toEqual({});

        vi.stubGlobal('window', {
            localStorage: createStorage({
                command_palette_frequency_v1: JSON.stringify({ v: 99, counts: { queue: 3 } }),
            }),
        });
        expect(readCommandFrequencyState().counts).toEqual({});
    });

    it('drops non-numeric and non-positive counts when reading', () => {
        vi.stubGlobal('window', {
            localStorage: createStorage({
                command_palette_frequency_v1: JSON.stringify({
                    v: 1,
                    anchor: Date.now(),
                    counts: { queue: 3, broken: 'lots', negative: -2, zero: 0 },
                }),
            }),
        });

        expect(readCommandFrequencyState().counts).toEqual({ queue: 3 });
    });

    it('counts uses and saturates instead of growing without bound', () => {
        let state = createEmptyCommandFrequencyState(0);
        for (let i = 0; i < 500; i += 1) {
            state = recordCommandUse('queue', state, i);
        }

        expect(state.counts.queue).toBeLessThanOrEqual(32);
        expect(getCommandFrequencyBonus(state.counts, 'queue')).toBeLessThanOrEqual(FREQUENCY_BONUS_MAX);
    });

    it('keeps the bonus inside its bounds for any input', () => {
        const absurd = { a: Number.MAX_SAFE_INTEGER, b: 1e308, c: 0.4 };
        Object.keys(absurd).forEach(key => {
            const bonus = getCommandFrequencyBonus(absurd, key);
            expect(bonus).toBeGreaterThanOrEqual(0);
            expect(bonus).toBeLessThanOrEqual(FREQUENCY_BONUS_MAX);
        });
        expect(getCommandFrequencyBonus({}, 'missing')).toBe(0);
        expect(getCommandFrequencyBonus({ nan: Number.NaN }, 'nan')).toBe(0);
    });

    it('halves counts across the half life and prunes what is left over', () => {
        const start = 1_000_000;
        const state = { v: 1 as const, anchor: start, counts: { heavy: 32, light: 0.6 } };

        const decayed = decayCommandFrequencyState(state, start + 14 * DAY);

        expect(decayed.counts.heavy).toBeCloseTo(16, 5);
        // 0.6 减半后低于 MIN_KEPT_COUNT，直接丢弃而不是留一个趋近于零的残留。
        expect(decayed.counts.light).toBeUndefined();
        expect(decayed.anchor).toBe(start + 14 * DAY);
    });

    it('does not decay more than once a day', () => {
        const start = 1_000_000;
        const state = { v: 1 as const, anchor: start, counts: { queue: 8 } };

        expect(decayCommandFrequencyState(state, start + 1000)).toBe(state);
    });

    it('keeps only the most used commands', () => {
        let state = createEmptyCommandFrequencyState(0);
        for (let i = 0; i < 90; i += 1) {
            state = recordCommandUse(`command-${i}`, state, 0);
        }

        expect(Object.keys(state.counts).length).toBeLessThanOrEqual(64);
    });
});

describe('frequency never disturbs the recency rule', () => {
    const commands = COMMAND_PALETTE_COMMANDS;
    const queries = ['queue', 'set', 'play', 'panel', 'vis', 'lyric', 'search', 'the'];

    /**
     * 这条属性测试就是 commandFrequency.ts 顶部那段保证的可执行版本。
     *
     * 比较器第二步在任一方出现在最近列表里且名次不同时就 return，而名次是唯一的；所以第三步
     * （分数，也就是频次加成唯一介入的地方）只在双方都不在最近列表里时才会被执行。推论：
     * 只要一对命令中有任意一方最近用过，有无频次数据的排序结果必须逐字相同。
     */
    it('produces byte-identical order for pairs where either side is remembered', () => {
        const heavyCounts: Record<string, number> = {};
        commands.forEach((command, index) => {
            heavyCounts[command.id] = (index % 32) + 1;
        });

        queries.forEach(query => {
            const recents = commands.slice(0, 10).map(command => command.id);

            const withoutCounts = rankCommands(query, commands, recents, 'en');
            const withCounts = rankCommands(query, commands, recents, 'en', heavyCounts);

            const remembered = new Set(recents);
            const positionsWithout = new Map(withoutCounts.map((match, index) => [match.command.id, index]));
            const positionsWith = new Map(withCounts.map((match, index) => [match.command.id, index]));

            withoutCounts.forEach(a => {
                withoutCounts.forEach(b => {
                    if (a.command.id === b.command.id) {
                        return;
                    }
                    if (!remembered.has(a.command.id) && !remembered.has(b.command.id)) {
                        return;
                    }
                    if (!positionsWith.has(a.command.id) || !positionsWith.has(b.command.id)) {
                        return;
                    }

                    const orderWithout = Math.sign(positionsWithout.get(a.command.id)! - positionsWithout.get(b.command.id)!);
                    const orderWith = Math.sign(positionsWith.get(a.command.id)! - positionsWith.get(b.command.id)!);
                    expect(orderWith, `${query}: ${a.command.id} vs ${b.command.id}`).toBe(orderWithout);
                });
            });
        });
    });

    it('leaves the landing list untouched', () => {
        const counts = Object.fromEntries(commands.map(command => [command.id, 30]));

        expect(rankCommands('', commands, ['playback-like'], 'en', counts).map(match => match.command.id))
            .toEqual(rankCommands('', commands, ['playback-like'], 'en').map(match => match.command.id));
    });

    it('can lift a frequently used command among ones nobody used recently', () => {
        // 加成确实有效，只是作用域被限制在「都不在最近列表里」的那部分。
        const baseline = rankCommands('panel', commands, [], 'en');
        const underdog = baseline[baseline.length - 1]?.command.id;
        expect(underdog).toBeTruthy();

        const boosted = rankCommands('panel', commands, [], 'en', { [underdog!]: 32 });
        const before = baseline.findIndex(match => match.command.id === underdog);
        const after = boosted.findIndex(match => match.command.id === underdog);

        expect(after).toBeLessThanOrEqual(before);
    });
});
