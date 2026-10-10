import { formatCommandQuery, replaceCommandFacet, replaceCommandFlag } from './syntax/format';
import { parseCommandQuery } from './syntax/parse';
import type { CommandSyntaxSpec } from './syntax/types';

// src/components/command-palette/queueQuery.ts
// Queue-specific names and spec for the shared palette syntax layer; the parsing itself lives
// in ./syntax so any other command can declare the same dialect.

export type QueueBatchAction = 'remove' | 'next' | 'end';
export type QueueFacetKind = 'artist' | 'album';

export const QUEUE_SYNTAX_SPEC: CommandSyntaxSpec = {
    flags: [
        { name: 'remove', aliases: ['rm', 'delete'], descriptionKey: 'commandPalette.syntax.queue.remove', descriptionFallback: 'Remove every matching song from the queue' },
        { name: 'next', descriptionKey: 'commandPalette.syntax.queue.next', descriptionFallback: 'Move every matching song to play next' },
        { name: 'end', descriptionKey: 'commandPalette.syntax.queue.end', descriptionFallback: 'Move every matching song to the end of the queue' },
    ],
    facets: [{ name: 'artist' }, { name: 'album' }],
};

export type ParsedQueueQuery = {
    action: QueueBatchAction | null;
    actionDraft: string | null;
    facetKind: QueueFacetKind | null;
    facetValue: string;
    facetDraft: string | null;
    isBareFacet: boolean;
    text: string;
    filterInput: string;
};

export const parseQueueQuery = (input: string): ParsedQueueQuery => {
    const parsed = parseCommandQuery(QUEUE_SYNTAX_SPEC, input);
    return {
        action: parsed.flag as QueueBatchAction | null,
        actionDraft: parsed.flagDraft,
        facetKind: parsed.facetKind as QueueFacetKind | null,
        facetValue: parsed.facetValue,
        facetDraft: parsed.facetDraft,
        isBareFacet: parsed.isBareFacet,
        text: parsed.text,
        filterInput: parsed.filterInput,
    };
};

export const formatQueueQuery = (parts: {
    action?: QueueBatchAction | null;
    facetKind?: QueueFacetKind | null;
    facetValue?: string;
    text?: string;
}) => formatCommandQuery({
    flag: parts.action,
    facetKind: parts.facetKind,
    facetValue: parts.facetValue,
    text: parts.text,
});

export const replaceQueueAction = (input: string, action: QueueBatchAction | null): string => (
    replaceCommandFlag(QUEUE_SYNTAX_SPEC, input, action)
);

export const replaceQueueFacet = (
    input: string,
    facetKind: QueueFacetKind | null,
    facetValue = '',
): string => replaceCommandFacet(QUEUE_SYNTAX_SPEC, input, facetKind, facetValue);
