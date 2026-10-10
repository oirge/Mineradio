import { describe, expect, it, vi } from 'vitest';
import { getCommandDescription, getCommandTitle } from '../../../src/components/command-palette/commandText';
import type { CommandPaletteCommand } from '../../../src/components/command-palette/types';

// test/unit/command-palette/commandText.test.ts
// Covers translated static commands and runtime queue-song metadata.

const createCommand = (overrides: Partial<CommandPaletteCommand> = {}): CommandPaletteCommand => ({
    id: 'queue-song-0-123',
    group: 'playback',
    title: 'Runtime Song',
    description: 'Artist · Album',
    keywords: ['#1'],
    execute: () => true,
    ...overrides,
});

describe('command palette text', () => {
    it('does not send runtime command text through i18n', () => {
        const t = vi.fn(() => 'unexpected translation');
        const command = createCommand({ textSource: 'runtime' });

        expect(getCommandTitle(command, t)).toBe('Runtime Song');
        expect(getCommandDescription(command, t)).toBe('Artist · Album');
        expect(t).not.toHaveBeenCalled();
    });

    it('translates static commands with their registry text as the default value', () => {
        const t = vi.fn((_key: string, options: { defaultValue: string }) => options.defaultValue);
        const command = createCommand({ id: 'playback-play', textSource: 'i18n' });

        expect(getCommandTitle(command, t)).toBe('Runtime Song');
        expect(getCommandDescription(command, t)).toBe('Artist · Album');
        expect(t).toHaveBeenCalledTimes(2);
    });
});
