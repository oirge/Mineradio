import { getQueueSongMatchesFromEvaluation } from '../queueSongMatches';
import { evaluateQueueForPalette } from '../queueEvaluation';
import { replaceQueueAction, replaceQueueFacet } from '../queueQuery';
import type { QueueSearchEvaluation, QueueSearchSuggestion } from '../queueSearch';
import type { CommandPaletteContext } from '../types';
import type { CommandPaletteSurface, CommandSurfaceRenderArgs } from './types';

// src/components/command-palette/surfaces/queueSurface.ts
// Declares the queue command's panel takeover: its own match list, `--action` / `@facet`
// completion, staged escape, and batch execution.

const acceptSuggestion = (suggestion: QueueSearchSuggestion, setQuery: (next: string) => void) => {
    setQuery(suggestion.replacement);
};

const runBatch = (evaluation: QueueSearchEvaluation, context: CommandPaletteContext, close: () => void) => {
    const action = evaluation.parsed.action;
    if (!action || !evaluation.hasMeaningfulFilter || evaluation.eligibleTargetIndices.length === 0) {
        return false;
    }

    const didExecute = context.playback.applyQueueBatchOperation(action, evaluation.eligibleTargetIndices);
    if (didExecute) {
        close();
    }
    return didExecute;
};

const buildViewProps = ({ context, query, matches, activeIndex, setActiveIndex, setQuery, isDaylight, theme, isExecuting, executeMatch, close }: CommandSurfaceRenderArgs) => {
    const evaluation = evaluateQueueForPalette(context, query);
    return {
        activeIndex,
        currentSong: context.shared.currentSong,
        evaluation,
        isDaylight,
        isExecuting,
        accentColor: theme.accentColor,
        keepOpenOnSongChange: context.playback.queuePaletteKeepOpen,
        matches,
        query,
        onAcceptSuggestion: (suggestion: QueueSearchSuggestion) => acceptSuggestion(suggestion, setQuery),
        onActiveIndexChange: setActiveIndex,
        onClearAction: () => setQuery(replaceQueueAction(query, null)),
        onClearFacet: () => setQuery(replaceQueueFacet(query, null)),
        onExecuteBatch: async () => runBatch(evaluation, context, close),
        onExecuteMatch: executeMatch,
        onKeepOpenOnSongChange: context.playback.setQueuePaletteKeepOpen,
        onMoveSongToEnd: context.playback.moveQueueSongToEnd,
        onMoveSongToNext: context.playback.moveQueueSongToNext,
        onRemoveSong: context.playback.removeQueueSong,
    };
};

export const queueSurface: CommandPaletteSurface = {
    load: () => import('./QueueSurfaceView'),
    mapProps: buildViewProps,
    buildMatches: ({ context, query }) => getQueueSongMatchesFromEvaluation(
        evaluateQueueForPalette(context, query),
        query,
        context,
    ),
    // Enter completes a pending suggestion first, then runs a staged batch action, and only
    // otherwise plays the highlighted song.
    onSubmit: ({ context, query, setQuery, close }) => {
        const evaluation = evaluateQueueForPalette(context, query);
        const [suggestion] = evaluation.suggestions;
        if (suggestion) {
            acceptSuggestion(suggestion, setQuery);
            return false;
        }
        if (evaluation.parsed.action) {
            return runBatch(evaluation, context, close);
        }
        return null;
    },
    // Escape peels off the batch action, then the metadata filter, before closing the palette.
    onEscape: ({ context, query, setQuery }) => {
        const { parsed } = evaluateQueueForPalette(context, query);
        if (parsed.action || parsed.actionDraft !== null) {
            setQuery(replaceQueueAction(query, null));
            return true;
        }
        if (parsed.facetDraft !== null) {
            setQuery(replaceQueueFacet(query, null));
            return true;
        }
        return false;
    },
    onKeyDown: (event, { context, query, setQuery }) => {
        if (event.key !== 'Tab') {
            return false;
        }

        const [suggestion] = evaluateQueueForPalette(context, query).suggestions;
        if (!suggestion) {
            return false;
        }

        acceptSuggestion(suggestion, setQuery);
        return true;
    },
};
