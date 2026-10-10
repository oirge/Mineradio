import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    MAX_RECENT_COMMANDS,
    isRecordableRecentCommand,
    readRecentCommandIds,
    recordRecentCommandId,
    resolveRecentCommandToRecord,
} from '../../../src/components/command-palette/recentCommands';
import type { CommandPaletteCommand } from '../../../src/components/command-palette/types';

// test/unit/command-palette/recentCommands.test.ts
// Covers MRU persistence without retaining command input text.

const createStorage = (initial: Record<string, string> = {}) => {
    const values = new Map(Object.entries(initial));
    return {
        getItem: vi.fn((key: string) => values.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };
};

const createCommand = (id: string, requiresInput = false): CommandPaletteCommand => ({
    id,
    group: 'search',
    title: id,
    description: id,
    keywords: [id],
    requiresInput,
    execute: () => true,
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('recent command persistence', () => {
    it('keeps ten deduplicated command ids in MRU order', () => {
        const storage = createStorage();
        vi.stubGlobal('window', { localStorage: storage });

        let ids: string[] = [];
        for (let index = 0; index < 12; index += 1) {
            ids = recordRecentCommandId(`command-${index}`, ids);
        }
        ids = recordRecentCommandId('command-5', ids);

        expect(MAX_RECENT_COMMANDS).toBe(10);
        expect(ids).toHaveLength(10);
        expect(ids[0]).toBe('command-5');
        expect(new Set(ids).size).toBe(10);
    });

    it('reads existing shorter history without migration', () => {
        const storage = createStorage({
            command_palette_recent_functional_v1: JSON.stringify(['one', 'two', 'three', 'four', 'five']),
        });
        vi.stubGlobal('window', { localStorage: storage });

        expect(readRecentCommandIds()).toEqual(['one', 'two', 'three', 'four', 'five']);
    });

    it('records registered input commands and persists only their id', () => {
        const storage = createStorage();
        vi.stubGlobal('window', { localStorage: storage });
        const searchCommand = createCommand('search-current', true);

        expect(isRecordableRecentCommand(searchCommand, [searchCommand])).toBe(true);
        recordRecentCommandId(searchCommand.id, []);

        const storedValue = storage.setItem.mock.calls[0]?.[1] ?? '';
        expect(JSON.parse(storedValue)).toEqual(['search-current']);
        expect(storedValue).not.toContain('bad apple');
    });

    it('records the active queue search instead of a runtime queue result', () => {
        const queueSearch = createCommand('queue', true);
        const queueSong = createCommand('queue-song-0-42');

        expect(resolveRecentCommandToRecord(queueSong, queueSearch)).toBe(queueSearch);
    });
});
