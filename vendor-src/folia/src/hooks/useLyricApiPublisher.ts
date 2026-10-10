import { useCallback, useEffect, useState } from 'react';
import type { LyricData } from '../types';
import type { LyricApiStatus } from '../types/lyricApi';

// src/hooks/useLyricApiPublisher.ts
// Keeps the desktop-local lyrics API synchronized with the current lyric object.

const emptyStatus = (): LyricApiStatus => ({
    enabled: false,
    running: false,
    port: 32109,
    url: null,
    error: null,
});

export const useLyricApiPublisher = ({
    isElectronWindow,
    lyrics,
    offset,
}: {
    isElectronWindow: boolean;
    lyrics: LyricData | null;
    offset: number;
}) => {
    const [status, setStatus] = useState<LyricApiStatus>(() => emptyStatus());

    const refreshStatus = useCallback(async () => {
        if (!isElectronWindow || !window.electron?.getLyricApiStatus) {
            const nextStatus = emptyStatus();
            setStatus(nextStatus);
            return nextStatus;
        }
        const nextStatus = await window.electron.getLyricApiStatus();
        setStatus(nextStatus);
        return nextStatus;
    }, [isElectronWindow]);

    useEffect(() => {
        void refreshStatus();
        return window.electron?.onLyricApiStatusChanged?.(setStatus);
    }, [refreshStatus]);

    useEffect(() => {
        if (!status.enabled || !window.electron?.publishLyricApiData) {
            return;
        }
        void window.electron.publishLyricApiData(lyrics, offset).catch((error) => {
            console.warn('[Lyric API] Failed to publish lyrics:', error);
        });
    }, [lyrics, offset, status.enabled]);

    const setEnabled = useCallback(async (enabled: boolean) => {
        if (!window.electron?.setLyricApiEnabled) {
            return emptyStatus();
        }
        const nextStatus = await window.electron.setLyricApiEnabled(enabled);
        setStatus(nextStatus);
        return nextStatus;
    }, []);

    return {
        lyricApiStatus: status,
        refreshLyricApiStatus: refreshStatus,
        setLyricApiEnabled: setEnabled,
    };
};
