import { describe, expect, it } from 'vitest';
import {
    assertExecuteShortcutsArePrefixFree,
    buildExecuteShortcutIndex,
    resolveExecuteShortcut,
} from '../../../src/components/command-palette/executeShortcuts';
import type { CommandPaletteCommand } from '../../../src/components/command-palette/types';

// test/unit/command-palette/executeShortcuts.test.ts
// Execute mode fires without Enter, so resolution has to be unambiguous by construction.

const command = (id: string, executeShortcut?: string): CommandPaletteCommand => ({
    id,
    group: 'playback',
    title: id,
    description: id,
    keywords: [],
    executeShortcut,
    execute: () => true,
});

const scopedCommand = (
    id: string,
    executeShortcut: string,
    scope: CommandPaletteCommand['scope'],
): CommandPaletteCommand => ({ ...command(id, executeShortcut), scope });

describe('execute shortcuts', () => {
    it('rejects duplicate shortcuts', () => {
        expect(() => assertExecuteShortcutsArePrefixFree([command('a', 'n'), command('b', 'n')]))
            .toThrow(/both use execute shortcut "n"/);
    });

    it('allows a shortcut to be reused across mutually exclusive player and lattice scopes', () => {
        expect(() => assertExecuteShortcutsArePrefixFree([
            scopedCommand('cover', 'c', 'player-surface'),
            scopedCommand('focus-current', 'c', 'lattice'),
        ])).not.toThrow();
    });

    it('still rejects duplicate shortcuts within one scope', () => {
        expect(() => assertExecuteShortcutsArePrefixFree([
            scopedCommand('first', 'c', 'lattice'),
            scopedCommand('second', 'c', 'lattice'),
        ])).toThrow(/both use execute shortcut "c"/);
    });

    it('lets suite chrome share a key with lattice and the player, which need other views (B2)', () => {
        expect(() => assertExecuteShortcutsArePrefixFree([
            { ...scopedCommand('wall-locate', 'c', 'suite-chrome'), scopeOwner: 'wall' },
            scopedCommand('focus-current', 'c', 'lattice'),
            scopedCommand('cover', 'c', 'player-surface'),
        ])).not.toThrow();
    });

    it('lets two suites share a chrome key but not one suite, nor a surface that can be on screen with it', () => {
        const chrome = (id: string, owner: string, shortcut: string): CommandPaletteCommand => (
            { ...scopedCommand(id, shortcut, 'suite-chrome'), scopeOwner: owner }
        );
        expect(() => assertExecuteShortcutsArePrefixFree([chrome('wall-a', 'wall', 'x'), chrome('tiles-a', 'tiles', 'x')])).not.toThrow();
        expect(() => assertExecuteShortcutsArePrefixFree([chrome('wall-a', 'wall', 'x'), chrome('wall-b', 'wall', 'x')]))
            .toThrow(/both use execute shortcut "x"/);
        expect(() => assertExecuteShortcutsArePrefixFree([chrome('wall-a', 'wall', 'x'), scopedCommand('grid-a', 'xy', 'grid-surface')]))
            .toThrow(/is a prefix of/);
        expect(() => assertExecuteShortcutsArePrefixFree([chrome('wall-a', 'wall', 'n'), command('next', 'n')]))
            .toThrow(/both use execute shortcut "n"/);
    });

    it('rejects a shortcut that is a prefix of another', () => {
        expect(() => assertExecuteShortcutsArePrefixFree([command('a', 'n'), command('b', 'nx')]))
            .toThrow(/is a prefix of/);
    });

    it('accepts distinct, prefix-free shortcuts', () => {
        expect(() => assertExecuteShortcutsArePrefixFree([command('a', 'n'), command('b', 'q'), command('c')]))
            .not.toThrow();
    });

    it('resolves an exact buffer, a pending prefix, and an unknown key', () => {
        const index = buildExecuteShortcutIndex([command('next', 'n'), command('quiet', 'qq'), command('none')]);

        expect(resolveExecuteShortcut(index, 'n')).toMatchObject({ status: 'exact' });
        expect(resolveExecuteShortcut(index, 'q')).toMatchObject({ status: 'prefix' });
        expect(resolveExecuteShortcut(index, 'z')).toEqual({ status: 'none' });
    });

    it('lists every shortcut while the buffer is still empty', () => {
        const index = buildExecuteShortcutIndex([command('next', 'n'), command('queue', 'q')]);
        const resolution = resolveExecuteShortcut(index, '');

        expect(resolution.status).toBe('prefix');
        expect(resolution.status === 'prefix' && resolution.candidates).toHaveLength(2);
    });

    it('ignores case and surrounding whitespace', () => {
        const index = buildExecuteShortcutIndex([command('next', 'N')]);
        expect(resolveExecuteShortcut(index, ' n ')).toMatchObject({ status: 'exact' });
    });
});
