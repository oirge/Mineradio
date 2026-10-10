import { describe, expect, it } from 'vitest';
import {
    findCommandsByTrigger,
    getCommandPrimaryTerm,
    getCommandSearchIndex,
} from '../../../src/components/command-palette/search/commandSearchIndex';
import { COMMAND_PALETTE_COMMANDS } from '../../../src/components/command-palette/commandRegistry';
import { PINYIN_BY_PHRASE } from 'virtual:folia-command-pinyin';
import type { CommandPaletteCommand } from '../../../src/components/command-palette/types';

// test/unit/command-palette/commandSearchIndex.test.ts
// 索引的构建与缓存。检索行为本身由 commandRegistry.test.ts 覆盖；这里只管索引的形状、
// 缓存的失效条件，以及 primaryTerm 这条取代 keywords[0] 的回退链。

const commands = COMMAND_PALETTE_COMMANDS;
const entryFor = (id: string, locale = 'en') => getCommandSearchIndex(commands, locale).byId.get(id)!;

describe('command search index', () => {
    it('normalizes, dedupes and length-sorts triggers', () => {
        const entry = entryFor('settings-options');

        expect(entry.triggers.every(trigger => trigger === trigger.trim().toLowerCase())).toBe(true);
        expect(new Set(entry.triggers).size).toBe(entry.triggers.length);
        for (let i = 1; i < entry.triggers.length; i += 1) {
            expect(entry.triggers[i].length).toBeGreaterThanOrEqual(entry.triggers[i - 1].length);
        }
    });

    it('indexes generated pinyin and initials for a CJK synonym', () => {
        const entry = entryFor('settings-options');

        // '设置' 是手写同义词，它的全拼与首字母都来自构建期生成的字典，而不是手写的。
        expect(entry.triggers).toContain('设置');
        expect(entry.triggers).toContain('shezhi');
        expect(entry.initials).toContain('sz');
    });

    it('keeps title words out of the full-strength trigger set', () => {
        // 'Panel: queue' 切出的 queue 只能进扣分档，否则它会和 queue 命令自己的同义词打平，
        // 再由标题字典序决定胜负——输入 queue 排第一的就成了面板。
        const panelQueue = entryFor('panel-queue');

        expect(panelQueue.titleWords).toContain('queue');
        expect(panelQueue.triggers).not.toContain('queue');
    });

    it('indexes the English title regardless of the active locale', () => {
        // 删掉手写英文别名后，中文界面下仍必须能用英文搜到。
        const inChinese = entryFor('playback-shuffle', 'zh-CN');
        expect([...inChinese.triggers, ...inChinese.titleWords]).toContain('shuffle');
    });

    it('adds the active locale title on top of English', () => {
        const inEnglish = entryFor('settings-options', 'en');
        const inChinese = entryFor('settings-options', 'zh-CN');

        expect(inChinese.triggers).toContain('打开选项');
        expect(inEnglish.triggers).not.toContain('打开选项');
    });

    it('keeps pinyin available even when the UI is English', () => {
        // 拼音是一条常开车道，与界面语言无关。
        const inEnglish = entryFor('settings-options', 'en');
        expect(inEnglish.triggers).toContain('shezhi');
    });

    it('separates haystack fields so contains cannot straddle two of them', () => {
        const entry = entryFor('settings-options');
        expect(entry.haystack).toContain(' | ');
    });

    it('resolves a non-empty primary term for every static command', () => {
        const empty = commands
            .filter(command => command.textSource !== 'runtime' && !command.hidden)
            .filter(command => !getCommandPrimaryTerm(commands, command));

        expect(empty.map(command => command.id)).toEqual([]);
    });

    it('shows the English name as the hint, never generated pinyin', () => {
        // 真实回归：primaryTerm 原本取「最短的 ASCII 触发词」，而触发词按长度升序排，
        // 生成的拼音缩写几乎总是最短的那个，于是行上的提示 chip 显示成了 fmms /
        // xuanzekeshihua / mg pv。提示词必须是人能读的英文，且打进去要能精确命中。
        const expected: Array<[string, string]> = [
            ['playback-volume', 'volume'],
            ['sleep-timer', 'sleep timer'],
            ['playback-fm-mode', 'personal fm mode'],
            ['visualizer-picker', 'pick a visualizer'],
            ['visualizer-sonnet', 'visualizer: sonnet'],
        ];

        expected.forEach(([id, term]) => {
            const command = commands.find(candidate => candidate.id === id)!;
            expect(getCommandPrimaryTerm(commands, command)).toBe(term);
        });
    });

    it('never surfaces a generated pinyin term as the hint', () => {
        const pinyinTerms = new Set<string>();
        Object.values(PINYIN_BY_PHRASE).forEach(entry => {
            pinyinTerms.add(entry.full);
            pinyinTerms.add(entry.initials);
        });

        const leaked = commands
            .filter(command => command.textSource !== 'runtime' && !command.hidden)
            .filter(command => {
                const term = getCommandPrimaryTerm(commands, command).replace(/\s+/g, '');
                return pinyinTerms.has(term);
            })
            .map(command => command.id);

        expect(leaked).toEqual([]);
    });

    it('falls back through ascii trigger, English title word, then id', () => {
        const withoutText: CommandPaletteCommand = {
            id: 'not-in-any-locale',
            group: 'settings',
            title: 'Nope',
            description: 'Nope',
            keywords: [],
            execute: () => true,
        };

        expect(getCommandPrimaryTerm([withoutText], withoutText)).toBe('not-in-any-locale');
    });

    it('reuses the index for the same array and locale, and rebuilds for another locale', () => {
        const first = getCommandSearchIndex(commands, 'en');
        expect(getCommandSearchIndex(commands, 'en')).toBe(first);
        expect(getCommandSearchIndex(commands, 'zh-CN')).not.toBe(first);

        // 换数组实例就是换缓存条目——WeakMap 会随数组一起回收。
        expect(getCommandSearchIndex([...commands], 'en')).not.toBe(first);
    });

    it('reuses the per-command entries across different command arrays', () => {
        // 这是条目缓存存在的理由。可用集一变就是新数组，索引必须重建；但条目内容只由命令自己的
        // 文案推导，与可用性无关，所以那 120 多条没变的条目必须原样复用，而不是重新推导一遍文本。
        const full = getCommandSearchIndex(commands, 'en');
        // 模拟一次可用性变化：掉了一条命令，于是是一个全新的数组。
        const narrowed = getCommandSearchIndex(commands.slice(1), 'en');

        expect(narrowed).not.toBe(full);
        commands.slice(1).forEach(command => {
            expect(narrowed.byId.get(command.id)).toBe(full.byId.get(command.id));
        });
    });

    it('keeps entries separate per locale', () => {
        // 条目里含当前语言的标题，所以不同语言之间绝不能复用同一个条目。
        const inEnglish = getCommandSearchIndex(commands, 'en');
        const inChinese = getCommandSearchIndex(commands, 'zh-CN');

        expect(inChinese.byId.get('settings-options')).not.toBe(inEnglish.byId.get('settings-options'));
    });

    it('rebuilds only the lookup tables when the available set changes', () => {
        // 用一个观察得到的代理指标：重建后的索引里，查找表是新的对象，条目却是同一批。
        const full = getCommandSearchIndex(commands, 'en');
        const narrowed = getCommandSearchIndex(commands.slice(0, -1), 'en');

        expect(narrowed.triggerIndex).not.toBe(full.triggerIndex);
        expect(narrowed.byId).not.toBe(full.byId);
        expect(narrowed.entries[0]).toBe(full.entries[0]);
    });

    it('maps a trigger back to its commands in registry order', () => {
        const found = findCommandsByTrigger(commands, 'queue');
        expect(found.map(command => command.id)).toContain('queue');

        const registryOrder = commands.map(command => command.id);
        const positions = found.map(command => registryOrder.indexOf(command.id));
        expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    });

    it('returns an empty list for an unknown trigger instead of throwing', () => {
        expect(findCommandsByTrigger(commands, 'definitely-not-a-trigger')).toEqual([]);
    });
});
