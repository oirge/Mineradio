// src/stores/useInteractionSettingsStore.ts
// How the listener drives the app rather than what it plays: what the grids' action button does,
// which keys the command palette answers to, and the one shortcut they can define themselves.
//
// Separate from the chrome and playback stores because it is about input, not about what is on
// screen — and because the settings section that shows it is its own section for the same reason.

import { create } from 'zustand';
import { getStoredBoolean, getStoredString, setStoredBoolean } from './storagePrimitives';

/** What the grid action button's leftward slide reaches. */
export type GridActionButtonSlideTarget = 'filter' | 'command-palette';

const SLIDE_TARGET_KEY = 'grid_action_button_slide_target';
const PALETTE_HOTKEY_KEY = 'grid_command_palette_hotkey';
const QUEUE_PALETTE_KEEP_OPEN_KEY = 'queue_palette_keep_open';
const CUSTOM_SHORTCUT_LETTER_KEY = 'custom_shortcut_letter';
const CUSTOM_SHORTCUT_COMMAND_KEY = 'custom_shortcut_command';

const readSlideTarget = (): GridActionButtonSlideTarget => (
    getStoredString(SLIDE_TARGET_KEY, 'filter') === 'command-palette' ? 'command-palette' : 'filter'
);

/** Stored empty means "unset"; a single lower-case letter is the only other legal value. */
const readShortcutLetter = (): string | null => {
    const stored = getStoredString(CUSTOM_SHORTCUT_LETTER_KEY, '').toLowerCase();
    return /^[a-z]$/.test(stored) ? stored : null;
};

const writeString = (key: string, value: string | null) => {
    if (typeof window === 'undefined') {
        return;
    }
    if (value) {
        localStorage.setItem(key, value);
    } else {
        localStorage.removeItem(key);
    }
};

export type InteractionSettingsState = {
    gridActionButtonSlideTarget: GridActionButtonSlideTarget;
    /**
     * Whether bare `s` on a filtering surface opens the command list instead of being read as
     * filter input. Off by default: typing a letter on a grid has always meant "filter", and the
     * listener who wants the other meaning is the one who should have to ask for it.
     */
    gridCommandPaletteHotkey: boolean;
    /** Keep the queue surface and its query after choosing a song. */
    queuePaletteKeepOpen: boolean;
    /** Alt + this letter runs `customShortcutCommandId`. Null means no shortcut is defined. */
    customShortcutLetter: string | null;
    customShortcutCommandId: string | null;

    setGridActionButtonSlideTarget: (target: GridActionButtonSlideTarget) => void;
    handleToggleGridCommandPaletteHotkey: (enable: boolean) => void;
    setQueuePaletteKeepOpen: (enable: boolean) => void;
    setCustomShortcutLetter: (letter: string | null) => void;
    setCustomShortcutCommandId: (commandId: string | null) => void;
};

export const useInteractionSettingsStore = create<InteractionSettingsState>((set) => ({
    gridActionButtonSlideTarget: readSlideTarget(),
    gridCommandPaletteHotkey: getStoredBoolean(PALETTE_HOTKEY_KEY, false),
    queuePaletteKeepOpen: getStoredBoolean(QUEUE_PALETTE_KEEP_OPEN_KEY, false),
    customShortcutLetter: readShortcutLetter(),
    customShortcutCommandId: getStoredString(CUSTOM_SHORTCUT_COMMAND_KEY, '') || null,

    setGridActionButtonSlideTarget: (target) => {
        writeString(SLIDE_TARGET_KEY, target);
        set({ gridActionButtonSlideTarget: target });
    },
    handleToggleGridCommandPaletteHotkey: (enable) => {
        setStoredBoolean(PALETTE_HOTKEY_KEY, enable);
        set({ gridCommandPaletteHotkey: enable });
    },
    setQueuePaletteKeepOpen: (enable) => {
        setStoredBoolean(QUEUE_PALETTE_KEEP_OPEN_KEY, enable);
        set({ queuePaletteKeepOpen: enable });
    },
    setCustomShortcutLetter: (letter) => {
        const normalised = letter && /^[a-z]$/i.test(letter) ? letter.toLowerCase() : null;
        writeString(CUSTOM_SHORTCUT_LETTER_KEY, normalised);
        set({ customShortcutLetter: normalised });
    },
    setCustomShortcutCommandId: (commandId) => {
        writeString(CUSTOM_SHORTCUT_COMMAND_KEY, commandId);
        set({ customShortcutCommandId: commandId });
    },
}));
