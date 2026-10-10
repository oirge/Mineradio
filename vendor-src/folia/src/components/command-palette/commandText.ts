import type { CommandPaletteCommand } from './types';

// src/components/command-palette/commandText.ts
// Resolves static registry translations without treating runtime song metadata as i18n keys.

type CommandTextTranslator = (key: string, options: { defaultValue: string }) => string;

export const getCommandTitle = (command: CommandPaletteCommand, t: CommandTextTranslator): string => (
    command.textSource === 'runtime'
        ? command.title
        : t(`commandPalette.commands.${command.id}.title`, { defaultValue: command.title })
);

export const getCommandDescription = (command: CommandPaletteCommand, t: CommandTextTranslator): string => (
    command.textSource === 'runtime'
        ? command.description
        : t(`commandPalette.commands.${command.id}.description`, { defaultValue: command.description })
);
