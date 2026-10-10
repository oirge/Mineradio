import { useEffect } from 'react';
import type React from 'react';
import type { StatusMessage } from '../types';
import { setStatusMessage as setStatusMsg } from '../stores/useStatusMessageStore';
import { useAppViewStore } from '../stores/useAppViewStore';

// App-level UI side effects that do not own playback business logic.
type UsePlaybackUiEffectsOptions = {

    statusMsg: StatusMessage | null;
    updateCacheSize: () => void;
    loadLocalSongs: () => void | Promise<void>;
    loadLocalPlaylists: () => Promise<void>;
    localMusicUpdatedEvent: string;
    blobUrlRef: React.RefObject<string | null>;
    volumePreviewFrameRef: React.RefObject<number | null>;
    onClearPendingUnavailableSkip?: () => void;
};

export const usePlaybackUiEffects = ({
    statusMsg,
    updateCacheSize,
    loadLocalSongs,
    loadLocalPlaylists,
    localMusicUpdatedEvent,
    blobUrlRef,
    volumePreviewFrameRef,
    onClearPendingUnavailableSkip,
}: UsePlaybackUiEffectsOptions) => {
    const isPanelOpen = useAppViewStore(state => state.isPanelOpen);
    const panelTab = useAppViewStore(state => state.panelTab);

    useEffect(() => {
        const handleLocalMusicUpdated = () => {
            void loadLocalSongs();
            void loadLocalPlaylists();
        };

        window.addEventListener(localMusicUpdatedEvent, handleLocalMusicUpdated);
        return () => window.removeEventListener(localMusicUpdatedEvent, handleLocalMusicUpdated);
    }, [loadLocalPlaylists, loadLocalSongs, localMusicUpdatedEvent]);

    useEffect(() => {
        return () => {
            if (blobUrlRef.current) {
                URL.revokeObjectURL(blobUrlRef.current);
            }
            if (volumePreviewFrameRef.current !== null) {
                cancelAnimationFrame(volumePreviewFrameRef.current);
            }
        };
    }, [blobUrlRef, volumePreviewFrameRef]);

    useEffect(() => {
        if (isPanelOpen && panelTab === 'account') {
            updateCacheSize();
        }
    }, [isPanelOpen, panelTab, updateCacheSize]);

    useEffect(() => {
        if (!statusMsg || statusMsg.persistent) {
            return;
        }

        const timer = window.setTimeout(() => {
            setStatusMsg(null);
        }, statusMsg.durationMs ?? 3000);
        return () => window.clearTimeout(timer);
    }, [setStatusMsg, statusMsg]);

    useEffect(() => {
        return () => onClearPendingUnavailableSkip?.();
    }, [onClearPendingUnavailableSkip]);
};
