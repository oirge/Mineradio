import { defineCommand } from '../commandFactories';
import { executeModeSurface } from '../surfaces/executeModeSurface';
import type { CommandPaletteCommand } from '../types';

// src/components/command-palette/commands/executeModeCommand.ts
// Carrier for execute mode. It is hidden rather than listed: the only way in is the `:` key, and
// it has no action of its own — the shortcut the user types picks the real command.

export const executeModeCommand: CommandPaletteCommand = defineCommand({
    id: 'execute-mode',
    group: 'playback',
    title: 'Execute mode',
    description: 'Run a command with a single key',
    keywords: [],
    hidden: true,
    requiresInput: true,
    openHotkey: { key: ':' },
    surface: executeModeSurface,
    placeholder: context => context.shared.t('commandPalette.executeMode.placeholder', 'Press a shortcut key to run it instantly'),
    execute: () => false,
});
