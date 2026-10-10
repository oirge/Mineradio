import { describe, expect, it } from 'vitest';
import { COMMAND_PALETTE_COMMANDS } from '../../../src/components/command-palette/commandRegistry';
import {
    CUSTOM_SHORTCUT_LETTERS,
    collectReservedShortcutStrokes,
    isCustomShortcutLetterAvailable,
    isScopeIndependentCommand,
    resolveCustomShortcutCommand,
} from '../../../src/components/command-palette/customShortcut';
import type { CommandPaletteCommand } from '../../../src/components/command-palette/types';

// test/unit/command-palette/customShortcut.test.ts
// 自定义快捷键的三条规则：不能撞已有快捷键、只能绑在任何界面都可用的命令上、
// 存进去的值不算数——每次都重新判定。后两条是防御性的：今天没有 Alt 快捷键，
// 但一个「当时合法、后来被占用」的绑定必须自己安静下来，而不是和新主人打架。

const commandWith = (overrides: Partial<CommandPaletteCommand>): CommandPaletteCommand => ({
    id: 'test-command',
    group: 'playback',
    title: 'Test',
    description: 'Test',
    keywords: [],
    execute: () => true,
    ...overrides,
});

describe('reserved strokes', () => {
    it('includes the palette entries that are not in the registry to be found', () => {
        const strokes = collectReservedShortcutStrokes(COMMAND_PALETTE_COMMANDS);
        expect(strokes.has('s')).toBe(true);
        expect(strokes.has('ctrl+k')).toBe(true);
    });

    it('is computed from the registry, so a new hotkey reserves itself', () => {
        const strokes = collectReservedShortcutStrokes([
            commandWith({ id: 'a', openHotkey: { key: 'p', ctrl: true } }),
            commandWith({ id: 'b', openHotkey: { key: ':' } }),
        ]);
        expect(strokes.has('ctrl+p')).toBe(true);
        expect(strokes.has(':')).toBe(true);
    });

    it('leaves every letter free while nothing claims Alt', () => {
        const free = CUSTOM_SHORTCUT_LETTERS.filter(letter => (
            isCustomShortcutLetterAvailable(letter, COMMAND_PALETTE_COMMANDS)
        ));
        expect(free).toEqual(CUSTOM_SHORTCUT_LETTERS);
    });

    it('withdraws a letter as soon as a command claims it', () => {
        const commands = [commandWith({ openHotkey: { key: 'j', alt: true } })];
        expect(isCustomShortcutLetterAvailable('j', commands)).toBe(false);
        expect(isCustomShortcutLetterAvailable('k', commands)).toBe(true);
    });

    it('refuses anything that is not a single letter', () => {
        expect(isCustomShortcutLetterAvailable('', COMMAND_PALETTE_COMMANDS)).toBe(false);
        expect(isCustomShortcutLetterAvailable('ab', COMMAND_PALETTE_COMMANDS)).toBe(false);
        expect(isCustomShortcutLetterAvailable('1', COMMAND_PALETTE_COMMANDS)).toBe(false);
    });
});

describe('which commands may be bound', () => {
    it('excludes the ones that need particular surroundings', () => {
        const bindable = COMMAND_PALETTE_COMMANDS.filter(isScopeIndependentCommand).map(command => command.id);
        expect(bindable).not.toContain('panel-cover');
        expect(bindable).not.toContain('playback-equalizer');
        expect(bindable).not.toContain('filter-view');
    });

    it('keeps the ones that work anywhere, state gating included', () => {
        const bindable = COMMAND_PALETTE_COMMANDS.filter(isScopeIndependentCommand).map(command => command.id);
        // 因为暂时不可用（私人 FM 开着、队列是空的）而被收起的命令仍然可以绑：
        // 设置面板选的是「以后按这个键做什么」，不是「此刻能不能做」。
        expect(bindable).toContain('playback-shuffle');
        expect(bindable).toContain('playback-next');
        expect(bindable).toContain('navigate-home');
        // 控制面板那几个动作正是加进来给这个绑定用的。
        expect(bindable).toContain('playback-like');
        expect(bindable).toContain('playback-mute');
    });
});

describe('resolving a stored binding', () => {
    const commands = [
        commandWith({ id: 'global-one' }),
        commandWith({ id: 'player-only', scope: 'player-surface' }),
    ];

    it('resolves a well-formed binding', () => {
        expect(resolveCustomShortcutCommand('j', 'global-one', commands)?.id).toBe('global-one');
    });

    it('runs nothing when either half is missing', () => {
        expect(resolveCustomShortcutCommand(null, 'global-one', commands)).toBeNull();
        expect(resolveCustomShortcutCommand('j', null, commands)).toBeNull();
    });

    it('goes quiet once the letter is claimed by something else', () => {
        const withClaim = [...commands, commandWith({ id: 'claimer', openHotkey: { key: 'j', alt: true } })];
        expect(resolveCustomShortcutCommand('j', 'global-one', withClaim)).toBeNull();
    });

    it('goes quiet once the command grows a scope', () => {
        expect(resolveCustomShortcutCommand('j', 'player-only', commands)).toBeNull();
    });

    it('goes quiet when the command has been removed from the registry', () => {
        expect(resolveCustomShortcutCommand('j', 'deleted-command', commands)).toBeNull();
    });
});
