import type { CommandPaletteCommand } from './types';

// src/components/command-palette/customShortcut.ts
// The one shortcut the listener defines themselves: Alt plus a letter, running one command.
//
// Everything here is a single judgement asked by two callers — the settings picker, to decide what
// it may offer, and the keyboard dispatcher, to decide what may fire. Splitting them would let a
// binding that the picker refuses still fire from a value already in storage.

/** The palette's own entries, which are not in the registry to be found. */
const BUILT_IN_STROKES = ['s', 'ctrl+k'];

export const CUSTOM_SHORTCUT_LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

const strokeOf = (hotkey: NonNullable<CommandPaletteCommand['openHotkey']>) => (
    `${hotkey.alt ? 'alt+' : ''}${hotkey.ctrl ? 'ctrl+' : ''}${hotkey.key.toLowerCase()}`
);

/**
 * Every stroke that already opens something. Computed rather than listed, so a hotkey added to the
 * registry tomorrow is reserved the same day — which is the whole point of checking at all, since
 * nothing claims Alt today.
 */
export const collectReservedShortcutStrokes = (commands: CommandPaletteCommand[]): Set<string> => {
    const strokes = new Set(BUILT_IN_STROKES);
    for (const command of commands) {
        if (command.openHotkey) {
            strokes.add(strokeOf(command.openHotkey));
        }
    }
    return strokes;
};

export const isCustomShortcutLetterAvailable = (letter: string, commands: CommandPaletteCommand[]): boolean => (
    CUSTOM_SHORTCUT_LETTERS.includes(letter.toLowerCase())
    && !collectReservedShortcutStrokes(commands).has(`alt+${letter.toLowerCase()}`)
);

/**
 * Whether this command works wherever the palette happens to be.
 *
 * A custom shortcut fires from anywhere, so a command that needs particular surroundings must not
 * be bindable to one — the listener would define a key that does nothing half the time. That fact
 * is declared on the command itself, so this is a read rather than a probe.
 */
export const isScopeIndependentCommand = (command: CommandPaletteCommand): boolean => !command.scope;

/**
 * The command a stored binding actually runs, or null when it runs nothing.
 *
 * The settings picker and the keyboard both ask here, so a binding the picker would refuse cannot
 * fire from a value already in storage — including one that was legal when it was made. A letter
 * the registry has since claimed, or a command that has since grown a scope, goes quiet rather
 * than fighting whatever took it.
 */
export const resolveCustomShortcutCommand = (
    letter: string | null,
    commandId: string | null,
    commands: CommandPaletteCommand[],
): CommandPaletteCommand | null => {
    if (!letter || !commandId || !isCustomShortcutLetterAvailable(letter, commands)) {
        return null;
    }

    const command = commands.find(entry => entry.id === commandId);
    return command && isScopeIndependentCommand(command) ? command : null;
};
