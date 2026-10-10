import { ListMusic } from 'lucide-react';
import { defineCommand } from '../commandFactories';
import { QUEUE_SYNTAX_SPEC } from '../queueQuery';
import { queueSurface } from '../surfaces/queueSurface';
import type { CommandPaletteCommand } from '../types';

// src/components/command-palette/commands/queueCommand.ts
// The queue command carries no action of its own: it is a mode whose surface owns the search,
// the `--flag` / `@facet` syntax, and the batch operations.
//
// Personal FM hides it. Every operation the surface offers ends in a plain playSong or a queue
// mutation, and the FM stream only survives while playback stays on the FM path — reordering or
// playing from the list silently drops the user out of the radio.

export const queueCommand: CommandPaletteCommand = defineCommand({
    id: 'queue',
    executeShortcut: 'q',
    group: 'playback',
    title: 'Queue',
    description: 'Search the current play queue',
    keywords: ['播放队列', '队列搜索'],
    icon: ListMusic,
    isAvailable: context => !context?.playback.isFmMode,
    openHotkey: { key: 'p', ctrl: true },
    surface: queueSurface,
    syntax: QUEUE_SYNTAX_SPEC,
    placeholder: context => context.shared.t('commandPalette.previewQueueSearchEmpty', 'Type a song name, artist, album, or queue index'),
    requiresInput: true,
    getPreview: (input, context) => {
        const trimmedInput = input.trim();
        if (!trimmedInput) {
            return context.shared.t('commandPalette.previewQueueSearchEmpty', 'Type a song name, artist, album, or queue index');
        }
        return context.shared.t('commandPalette.previewQueueSearch', 'Search current queue: {{query}}')
            .replace('{{query}}', trimmedInput);
    },
    execute: () => false,
});
