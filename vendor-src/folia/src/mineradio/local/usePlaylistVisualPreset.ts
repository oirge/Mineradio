import { useEffect, useRef } from 'react';
import { useVisualSettings } from './useVisualSettings';

// Apply once when entering a playlist; manual visual edits survive the following tracks.
export function usePlaylistVisualPreset(trackId?: string | null, playlistId = 'library') {
    const previous = useRef<{ track: string; playlist: string } | null>(null);
    useEffect(() => {
        if (!trackId) { previous.current = null; return; }
        const last = previous.current;
        if (last?.track === trackId && last.playlist === playlistId) return;
        previous.current = { track: trackId, playlist: playlistId };
        const state = useVisualSettings.getState();
        if (last?.playlist !== playlistId) {
            const presetId = state.playlistPresets[playlistId];
            if (presetId) state.applyPreset(presetId);
        }
        if (last?.track !== trackId && useVisualSettings.getState().randomMode) useVisualSettings.getState().reroll();
    }, [trackId, playlistId]);
}
