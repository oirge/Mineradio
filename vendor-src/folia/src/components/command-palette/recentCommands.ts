import type { CommandPaletteCommand } from './types';

// src/components/command-palette/recentCommands.ts
// Persists the small MRU list used by the command palette landing state.

const RECENT_COMMANDS_STORAGE_KEY = 'command_palette_recent_functional_v1';
export const MAX_RECENT_COMMANDS = 10;

const parseRecentCommandIds = (value: string | null) => {
    if (!value) {
        return [];
    }

    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter((item): item is string => typeof item === 'string');
    } catch {
        return [];
    }
};

export const readRecentCommandIds = () => {
    if (typeof window === 'undefined') {
        return [];
    }
    return parseRecentCommandIds(window.localStorage.getItem(RECENT_COMMANDS_STORAGE_KEY))
        .slice(0, MAX_RECENT_COMMANDS);
};

const writeRecentCommandIds = (commandIds: string[]) => {
    if (typeof window === 'undefined') {
        return;
    }
    window.localStorage.setItem(
        RECENT_COMMANDS_STORAGE_KEY,
        JSON.stringify(commandIds.slice(0, MAX_RECENT_COMMANDS))
    );
};

export const isRecordableRecentCommand = (
    command: CommandPaletteCommand,
    registeredCommands: CommandPaletteCommand[]
) => registeredCommands.some(registered => registered.id === command.id);

export const resolveRecentCommandToRecord = (
    executedCommand: CommandPaletteCommand,
    activeCommand: CommandPaletteCommand | null,
) => activeCommand ?? executedCommand;

export const recordRecentCommandId = (commandId: string, currentCommandIds: string[]) => {
    const nextCommandIds = [
        commandId,
        ...currentCommandIds.filter(currentCommandId => currentCommandId !== commandId),
    ].slice(0, MAX_RECENT_COMMANDS);

    writeRecentCommandIds(nextCommandIds);
    return nextCommandIds;
};
