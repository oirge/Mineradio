import { isGridFilterSyntaxAvailable, parseGridFilterQuery } from '../gridFilterQuery';
import type { CommandPaletteSurface } from './types';

// src/components/command-palette/surfaces/filterViewSurface.ts
// The palette standing in as the on-screen filter box for whichever surface registered one.
//
// There is no body to render: the input row *is* the filter box, drawn inline where the surface
// says it belongs. Everything below is about matching what the grids' own box used to do, so that
// moving the input into the palette changes nothing the listener can feel — plus the one thing the
// old box could not do, which is act on what it just narrowed down.

export const filterViewSurface: CommandPaletteSurface = {
    presentation: 'inline',
    // Filtering is character by character; waiting for the match debounce would make typing lag.
    useLiveQuery: true,
    onQueryChange: ({ context, query }) => {
        // Only the free text reaches the grid. Letting the flag token through would have `--play`
        // narrow the view to nothing at the exact moment it is about to play what is left. Where
        // the flags mean nothing, nothing is stripped either: on those surfaces `--play` is just
        // characters, and quietly dropping them would filter by something the box does not show.
        context.scope.filter?.setQuery(
            isGridFilterSyntaxAvailable(context) ? parseGridFilterQuery(query).text : query,
        );
        return false;
    },
    // Without a flag, Enter is swallowed exactly as the grids' own box swallowed it — the box stays
    // up, and with it the only sign that the view is filtered at all. With one, Enter runs the
    // matching info-panel button and then drops the flag, leaving the filter itself in place: the
    // buttons do not close the panel either, and `--add` is worth repeating with a second filter.
    onSubmit: ({ context, query, setQuery }) => {
        if (!isGridFilterSyntaxAvailable(context)) {
            return true;
        }

        const { action, text } = parseGridFilterQuery(query);
        if (!action) {
            return true;
        }

        context.scope.grid?.run(action === 'play' ? 'play-filtered' : 'enqueue-filtered');
        setQuery(text);
        return true;
    },
    // Escape clears the filter and puts the box away, in that order, exactly as the grids did.
    onEscape: ({ context }) => {
        context.scope.filter?.setQuery('');
        return false;
    },
};
