import type React from 'react';
import { looksLikeSegmentationPaste, parseLyricSegmentationQuery, type LyricSegmentationAction } from '../lyricSegmentationQuery';
import { SEGMENTATION_DELIMITER } from '../../../utils/lyrics/lyricSegmentationRecord';
import type { CommandPaletteSurface, CommandSurfaceArgs, CommandSurfaceRenderArgs } from './types';

// src/components/command-palette/surfaces/lyricSegmentationSurface.ts
// Declares the lyric segmentation command's panel takeover, and makes the palette's own input do
// the work that would otherwise need extra controls: paste a segmentation into it to import, or
// type `--ai` / `--copy-prompt` / `--copy-seg` and press Enter.

/**
 * The live surface's actions, published by its view while mounted.
 *
 * The flags are handled in `onSubmit`, which runs in the palette hook and cannot reach the view's
 * internals — and the AI run in particular is not reachable any other way, since it owns progress,
 * cancellation and error state as component state. Rather than implement each action twice, the
 * view registers one handle and both the buttons and the flags go through it.
 *
 * Ownership follows registerCommandFilter in useAppViewStore: registering replaces whoever held it,
 * and a late teardown from a handle that has already been replaced must not clear the new one.
 */
export type LyricSegmentationHandle = {
    runAi: () => void;
    copyPrompt: () => void;
    copySegmentation: () => void;
    importText: (text: string) => void;
};

let activeHandle: LyricSegmentationHandle | null = null;

export const registerLyricSegmentationHandle = (handle: LyricSegmentationHandle) => {
    activeHandle = handle;
    return () => {
        if (activeHandle === handle) {
            activeHandle = null;
        }
    };
};

/** Only the argument-less actions; importing arrives by paste, not by flag. */
type FlagAction = 'runAi' | 'copyPrompt' | 'copySegmentation';

const ACTIONS: Record<LyricSegmentationAction, FlagAction> = {
    ai: 'runAi',
    'copy-prompt': 'copyPrompt',
    'copy-seg': 'copySegmentation',
};

/** Runs the typed flag, clearing the input so the surface is not left showing a spent command. */
const runFlag = ({ query, setQuery }: CommandSurfaceArgs): boolean | null => {
    const { action } = parseLyricSegmentationQuery(query);
    const method = action ? ACTIONS[action] : null;
    if (!method || !activeHandle) {
        return null;
    }

    activeHandle[method]();
    setQuery('');
    // Kept open: every one of these leaves something to look at — the progress counter, the
    // refreshed preview, or an error.
    return false;
};

const buildViewProps = ({ context, query, isDaylight, theme, close }: CommandSurfaceRenderArgs) => ({
    isDaylight,
    theme,
    t: context.shared.t,
    lyrics: context.shared.lyrics,
    setStatusMsg: context.shared.setStatusMsg,
    record: context.visualizer.lyricSegmentation.record,
    isAiAvailable: context.visualizer.lyricSegmentation.isAiAvailable,
    onSave: context.visualizer.lyricSegmentation.save,
    onReset: context.visualizer.lyricSegmentation.reset,
    // Lets the surface highlight the action the half-typed flag is heading towards.
    pendingAction: parseLyricSegmentationQuery(query).action,
    onClose: close,
});

export const lyricSegmentationSurface: CommandPaletteSurface = {
    load: () => import('./LyricSegmentationSurfaceView'),
    mapProps: buildViewProps,
    useLiveQuery: true,
    onSubmit: runFlag,
    inputProps: ({ setQuery }) => ({
        /**
         * Importing happens here rather than in a textarea of its own, so the box the user is
         * already typing in is the box they paste into.
         *
         * The raw clipboard text has to be read from the event: this is a single-line input, so by
         * the time the value updates the browser has flattened the newlines that separate one
         * lyric line's segments from the next.
         */
        onPaste: (event: React.ClipboardEvent<HTMLInputElement>) => {
            const pasted = event.clipboardData?.getData('text') ?? '';
            if (!activeHandle || !looksLikeSegmentationPaste(pasted, SEGMENTATION_DELIMITER)) {
                return;
            }
            event.preventDefault();
            setQuery('');
            activeHandle.importText(pasted);
        },
    }),
};
