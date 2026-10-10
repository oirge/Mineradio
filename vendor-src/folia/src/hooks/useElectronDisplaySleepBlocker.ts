import { useEffect } from 'react';

// Syncs active desktop playback to Electron's prevent-display-sleep blocker.
export function useElectronDisplaySleepBlocker(enabled: boolean, isPlaying: boolean) {
    useEffect(() => {
        const setActive = window.electron?.setPlaybackDisplaySleepBlockingActive;
        if (!setActive) return;

        void setActive(enabled && isPlaying);
        return () => {
            void setActive(false);
        };
    }, [enabled, isPlaying]);
}
