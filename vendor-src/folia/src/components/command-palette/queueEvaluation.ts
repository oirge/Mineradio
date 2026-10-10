import type { SongResult } from '../../types';
import { buildQueueSearchIndex, evaluateQueueSearch, type QueueSearchEvaluation } from './queueSearch';
import type { QueueSearchEntry } from './queueSearchIndex';
import type { CommandPaletteContext } from './types';

// src/components/command-palette/queueEvaluation.ts
// Single-entry memo shared by the queue surface's match builder and its view, so one keystroke
// costs one index lookup and one queue scan instead of two of each.

const indexCache = new WeakMap<SongResult[], QueueSearchEntry[]>();

const getQueueSearchIndex = (queue: SongResult[]) => {
    const cached = indexCache.get(queue);
    if (cached) {
        return cached;
    }

    const index = buildQueueSearchIndex(queue);
    indexCache.set(queue, index);
    return index;
};

let lastQueue: SongResult[] | null = null;
let lastCurrentSong: SongResult | null = null;
let lastQuery: string | null = null;
let lastEvaluation: QueueSearchEvaluation | null = null;

export const evaluateQueueForPalette = (context: CommandPaletteContext, query: string): QueueSearchEvaluation => {
    const queue = context.playback.queue;
    const currentSong = context.shared.currentSong;

    if (lastEvaluation && lastQueue === queue && lastCurrentSong === currentSong && lastQuery === query) {
        return lastEvaluation;
    }

    lastQueue = queue;
    lastCurrentSong = currentSong;
    lastQuery = query;
    lastEvaluation = evaluateQueueSearch(getQueueSearchIndex(queue), currentSong, query);
    return lastEvaluation;
};
