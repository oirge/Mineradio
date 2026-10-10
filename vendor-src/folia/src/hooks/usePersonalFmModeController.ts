import { useCallback, useMemo } from 'react';
import type React from 'react';
import { omni } from '../services/onlineMusic/omni';
import {
    getPersonalFmSelectionLabel,
    isSamePersonalFmSelection,
    toPersonalFmRequestOptions,
    type PersonalFmSelection,
} from '../services/onlineMusic/fmModes';
import { usePersonalFmModeStore } from '../stores/usePersonalFmModeStore';
import { useOnlineProviderAccountStore } from '../stores/useOnlineProviderAccountStore';
import type { SongResult, StatusMessage } from '../types';
import { setStatusMessage as setStatusMsg } from '../stores/useStatusMessageStore';

// src/hooks/usePersonalFmModeController.ts
// Owns "apply a Personal FM mode": persist it, and when FM is on air jump straight to the first
// track of the new mode, the way the official client does — the mode change is meant to be heard.

type UsePersonalFmModeControllerParams = {
    isFmMode: boolean;
    currentSong: SongResult | null;
    playSong: (song: SongResult, queue?: SongResult[], isFmCall?: boolean) => void | Promise<void>;
    t: (key: string, fallback?: string) => string;
};

export function usePersonalFmModeController({
    isFmMode,
    currentSong,
    playSong,
    t,
}: UsePersonalFmModeControllerParams) {
    const personalFmSelection = usePersonalFmModeStore(state => state.selection);
    const setSelection = usePersonalFmModeStore(state => state.setSelection);
    const activeProviderId = useOnlineProviderAccountStore(state => state.activeProviderId);

    const isPersonalFmModeSupported = useMemo(() => {
        try {
            return Boolean(omni.getProviderCapabilities(activeProviderId).personalFmModes);
        } catch (error) {
            void error;
            return false;
        }
    }, [activeProviderId]);

    const setPersonalFmSelection = useCallback(async (selection: PersonalFmSelection) => {
        const previous = personalFmSelection;
        const applied = setSelection(selection);
        const label = getPersonalFmSelectionLabel(applied, t);

        if (!isFmMode || !currentSong) {
            // Cutting off an album or playlist the user chose deliberately would be worse than
            // waiting: the mode takes effect the next time Personal FM starts.
            setStatusMsg({ type: 'info', text: `${t('personalFmMode.statusPending', 'Personal FM mode')}: ${label}` });
            return;
        }

        if (isSamePersonalFmSelection(applied, previous)) {
            return;
        }

        try {
            const songs = await omni.getPersonalFm(toPersonalFmRequestOptions(applied));
            if (songs.length === 0) {
                setStatusMsg({ type: 'error', text: t('personalFmMode.statusEmpty', 'This Personal FM mode returned nothing') });
                return;
            }

            // Announced before handing over, because playSong clears any non-persistent status of
            // its own as it starts.
            setStatusMsg({ type: 'info', text: `${t('personalFmMode.statusApplied', 'Personal FM switched to')} ${label}` });
            // The whole queue is replaced and playback jumps to the head: a new mode means a new
            // stream, so keeping the old one's leftovers around would only muddy it.
            void playSong(songs[0], songs, true);
        } catch (error) {
            console.error('[PersonalFm] Failed to refresh queue for mode', error);
            setStatusMsg({ type: 'error', text: t('personalFmMode.statusFailed', 'Failed to switch the Personal FM mode') });
        }
    }, [currentSong, isFmMode, personalFmSelection, playSong, setSelection, setStatusMsg, t]);

    const personalFmSelectionLabel = useMemo(
        () => getPersonalFmSelectionLabel(personalFmSelection, t),
        [personalFmSelection, t],
    );

    return { personalFmSelection, personalFmSelectionLabel, isPersonalFmModeSupported, setPersonalFmSelection };
}
