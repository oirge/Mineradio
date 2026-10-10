// src/stores/usePlaybackEntryViewStore.ts
// Which surface a "play this song" action lands on, plus the one-time prompt that asks for it.
//
// Kept out of useAppViewStore on purpose: that store is where the app *is*, this one is a stored
// preference about where playback should take it. The prompt's open state lives here too, because
// the only thing that opens it is this preference never having been chosen.

import { create } from 'zustand';
import { getStoredBoolean, getStoredString, setStoredBoolean } from './storagePrimitives';

/** The two surfaces a song can start on. `player` is the visualizer page. */
export type PlaybackEntryView = 'player' | 'lattice';

const ENTRY_VIEW_KEY = 'playback_entry_view';
const ENTRY_VIEW_CHOSEN_KEY = 'playback_entry_view_chosen';

const readEntryView = (): PlaybackEntryView => (
    getStoredString(ENTRY_VIEW_KEY, 'player') === 'lattice' ? 'lattice' : 'player'
);

export type PlaybackEntryViewState = {
    playbackEntryView: PlaybackEntryView;
    /** True once the listener has answered the prompt, or changed the setting by hand. */
    hasChosenPlaybackEntryView: boolean;
    isPlaybackEntryViewPromptOpen: boolean;
    /**
     * Non-zero while the "Lattice cannot host Personal FM" notice is up, and a different value on
     * every raise so a repeat restarts its own timer.
     *
     * Deliberately not a status toast: starting FM fills that single-slot channel with the song
     * fetch and the lyric match, either of which would cut this explanation short.
     */
    latticeFmNoticeToken: number;

    setPlaybackEntryView: (view: PlaybackEntryView) => void;
    /** Opens the prompt, unless it has already been answered. Returns whether it opened. */
    requestPlaybackEntryViewPrompt: () => boolean;
    /** Closes the prompt and records it as answered, so it never opens again. */
    closePlaybackEntryViewPrompt: () => void;
    /** Raises the FM notice, restarting it if one is already showing. */
    showLatticeFmNotice: () => void;
    dismissLatticeFmNotice: () => void;
};

export const usePlaybackEntryViewStore = create<PlaybackEntryViewState>((set, get) => ({
    playbackEntryView: readEntryView(),
    hasChosenPlaybackEntryView: getStoredBoolean(ENTRY_VIEW_CHOSEN_KEY, false),
    isPlaybackEntryViewPromptOpen: false,
    latticeFmNoticeToken: 0,

    // Picking a view *is* answering the question, wherever it is picked, so this also retires the
    // prompt: someone who set it in the options should not be asked about it again afterwards.
    setPlaybackEntryView: (view) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem(ENTRY_VIEW_KEY, view);
        }
        setStoredBoolean(ENTRY_VIEW_CHOSEN_KEY, true);
        set({ playbackEntryView: view, hasChosenPlaybackEntryView: true });
    },
    requestPlaybackEntryViewPrompt: () => {
        if (get().hasChosenPlaybackEntryView || get().isPlaybackEntryViewPromptOpen) {
            return false;
        }
        set({ isPlaybackEntryViewPromptOpen: true });
        return true;
    },
    closePlaybackEntryViewPrompt: () => {
        setStoredBoolean(ENTRY_VIEW_CHOSEN_KEY, true);
        set({ isPlaybackEntryViewPromptOpen: false, hasChosenPlaybackEntryView: true });
    },
    // Date.now() rather than a counter so the token also changes when the notice is raised again
    // while still on screen, which is what restarts the dismissal timer.
    showLatticeFmNotice: () => set({ latticeFmNoticeToken: Date.now() }),
    dismissLatticeFmNotice: () => set({ latticeFmNoticeToken: 0 }),
}));

/** Module-level handle for the assembly layer; it is an action, so it needs no subscription. */
export const requestPlaybackEntryViewPrompt = () => (
    usePlaybackEntryViewStore.getState().requestPlaybackEntryViewPrompt()
);

/** Module-level handle for the playback controller, which is not a component. */
export const showLatticeFmNotice = () => (
    usePlaybackEntryViewStore.getState().showLatticeFmNotice()
);
