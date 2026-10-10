import type { SongResult, UnifiedSong } from '../types';
import { setStatusMessage } from '../stores/useStatusMessageStore';
import { requestHost, type HostState } from './client';
import i18n from '../i18n/config';

// src/mineradio/playbackCommands.ts
// Commands never touch media elements; the parent owns the only playback engine.
const stateListeners = new Set<(state: HostState) => void>();
let playSelectionRevision = 0;

export const hostSongId = (song: SongResult | null | undefined): string | null => {
    const localId = (song as UnifiedSong | undefined)?.localRef?.songId;
    if (localId) return localId;
    return song?.sourceRef?.kind === 'local' ? String(song.sourceRef.mediaId) : null;
};

export const reportHostPlaybackError = (error: unknown): void => {
    setStatusMessage({ type: 'error', text: error instanceof Error ? error.message : 'Mineradio 播放操作失败' });
};

export const reportHostManagedAudio = (): void => {
    setStatusMessage({ type: 'info', text: i18n.t('mineradio.audioManaged'), nonce: Date.now() });
};

export function subscribeCommandState(listener: (state: HostState) => void): () => void {
    stateListeners.add(listener);
    return () => { stateListeners.delete(listener); };
}

export async function hostPlaybackCommand(method: string, params: Record<string, unknown> = {}): Promise<HostState | null> {
    try {
        const state = await requestHost<HostState>(method, params);
        if (state && 'currentTrack' in state) stateListeners.forEach(listener => listener(state));
        return state;
    } catch (error) {
        reportHostPlaybackError(error);
        return null;
    }
}

/** Set a supplied collection as the queue before selecting its track. */
export async function playHostTrack(id: string, trackIds: string[] = []): Promise<boolean> {
    const revision = ++playSelectionRevision;
    if (trackIds.length > 0) {
        const index = trackIds.indexOf(id);
        if (index >= 0) {
            if (!await hostPlaybackCommand('setQueue', { trackIds })) return false;
            if (revision !== playSelectionRevision) return false;
            // The host may retain the audible track at the head while editing its queue.
            // Resolve by stable id after the edit rather than using the submitted index.
            return Boolean(await hostPlaybackCommand('play', { id }));
        }
    }
    return Boolean(await hostPlaybackCommand('play', { id }));
}

export async function playHostSong(song: SongResult, queue: SongResult[] = []): Promise<boolean> {
    const id = hostSongId(song);
    if (!id) {
        reportHostPlaybackError(new Error('此界面播放 Mineradio 曲库，请先导入歌曲。'));
        return false;
    }
    const ids = queue.map(hostSongId);
    if (ids.some(value => !value)) {
        reportHostPlaybackError(new Error('队列含有未导入 Mineradio 的歌曲。'));
        return false;
    }
    return playHostTrack(id, ids as string[]);
}
