import { parseCommandQuery } from './syntax/parse';
import type { CommandSyntaxSpec } from './syntax/types';
import type { CommandPaletteContext } from './types';

// src/components/command-palette/gridFilterQuery.ts
// The filter box's own `--flag` names, on top of the shared syntax layer.
//
// The two flags are exactly the two buttons in the grid's info panel, which already act on the
// filtered set rather than the whole collection. Declaring them here means the filter box can
// finish the job it starts, instead of handing the listener back to the mouse.

export type GridFilterAction = 'play' | 'add';

export const GRID_FILTER_SYNTAX_SPEC: CommandSyntaxSpec = {
    flags: [
        {
            name: 'play',
            aliases: ['p'],
            descriptionKey: 'commandPalette.syntax.gridFilter.play',
            descriptionFallback: 'Play the filtered songs now',
        },
        {
            name: 'add',
            aliases: ['queue', 'a'],
            descriptionKey: 'commandPalette.syntax.gridFilter.add',
            descriptionFallback: 'Append the filtered songs to the queue',
        },
    ],
    // No facets: the grid filter matches one blob of text across name, album and artists, so
    // there is nothing to narrow a token to.
    facets: [],
};

export type ParsedGridFilterQuery = {
    action: GridFilterAction | null;
    /** Raw flag text typed so far when it does not resolve, e.g. the `pl` in `--pl`. */
    actionDraft: string | null;
    /**
     * What the grid should actually filter by — the flag token stripped out.
     *
     * Taken from `filterInput` rather than `text`: with no facets declared, the shared parser still
     * strips a bare `@` token, and a song called "@home" has to stay filterable.
     */
    text: string;
};

export const parseGridFilterQuery = (input: string): ParsedGridFilterQuery => {
    const parsed = parseCommandQuery(GRID_FILTER_SYNTAX_SPEC, input);
    return {
        action: parsed.flag as GridFilterAction | null,
        actionDraft: parsed.flagDraft,
        text: parsed.filterInput,
    };
};

/**
 * What the typed flag would do and to how many songs, or null when no flag is typed.
 *
 * The inline filter box has no preview row and no match list, so this is the only place the
 * listener finds out both halves: that `--play` plays rather than enqueues, and that it means
 * "these eleven" rather than the whole folder.
 */
export const resolveGridFilterAction = (
    query: string,
    context: CommandPaletteContext,
): { action: GridFilterAction; count: number } | null => {
    const { action } = parseGridFilterQuery(query);
    if (!context.scope.grid || !action) {
        return null;
    }
    return { action, count: context.scope.grid.getState().filteredTrackCount };
};

/**
 * Whether the flags mean anything where the filter box currently is.
 *
 * They act through the track grid's own two buttons. The other surfaces that register a filter —
 * the home collection map, the artist grid — have no such buttons, so on those the dialect is not
 * on offer at all and `--play` is just text someone typed.
 */
export const isGridFilterSyntaxAvailable = (context: CommandPaletteContext): boolean => (
    context.scope.grid !== null
);
