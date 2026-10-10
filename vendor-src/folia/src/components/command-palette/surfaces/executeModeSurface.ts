import { getAvailableCommandPaletteCommands } from '../commandRegistry';
import { buildExecuteShortcutIndex, resolveExecuteShortcut } from '../executeShortcuts';
import type { CommandPaletteSurface } from './types';

// src/components/command-palette/surfaces/executeModeSurface.ts
// Execute mode: the input is a key buffer, not a search box. As soon as the buffer names exactly
// one registered shortcut the command runs, so nothing here waits for Enter.

// Shortcuts resolve against the commands actually available, so a Linux-only key cannot fire on
// Windows even though the prefix-free check covers the whole registry.
const resolve = (context: Parameters<typeof getAvailableCommandPaletteCommands>[0], buffer: string) => (
    resolveExecuteShortcut(buildExecuteShortcutIndex(getAvailableCommandPaletteCommands(context)), buffer)
);

export const executeModeSurface: CommandPaletteSurface = {
    load: () => import('./ExecuteModeSurfaceView'),
    useLiveQuery: true,
    onQueryChange: ({ context, query, executeCommand }) => {
        const resolution = resolve(context, query);
        return resolution.status === 'exact' ? executeCommand(resolution.command) : null;
    },
    // Enter is redundant in execute mode, but pressing it on a complete buffer should still work.
    onSubmit: ({ context, query, executeCommand }) => {
        const resolution = resolve(context, query);
        return resolution.status === 'exact' ? executeCommand(resolution.command) : false;
    },
    // Escape clears a half-typed buffer before it closes the palette.
    onEscape: ({ query, setQuery }) => {
        if (!query) {
            return false;
        }
        setQuery('');
        return true;
    },
    mapProps: ({ context, query, isDaylight, theme }) => {
        const resolution = resolve(context, query);
        return {
            isDaylight,
            theme,
            buffer: query,
            isInvalid: resolution.status === 'none',
            candidates: resolution.status === 'prefix' ? resolution.candidates : [],
        };
    },
};
