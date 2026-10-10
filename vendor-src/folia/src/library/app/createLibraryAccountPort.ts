import type { RefObject } from 'react';
import { PlayerState, type LyricData } from '../../types';
import type { OnlineProviderId } from '../../types/onlineMusic';
import type { LibraryProviderSwitchCleanupPort } from '../core/contracts/account';
import { usePlaybackStore } from '../../stores/usePlaybackStore';
import { useSearchNavigationStore } from '../../stores/useSearchNavigationStore';
import { useCollectionNavigationStore } from '../../stores/useCollectionNavigationStore';
import { clearPrefetchRuntime } from '../../services/prefetchService';
import { clearTrackProfileRuntime } from '../../services/automix/profileService';

// src/library/app/createLibraryAccountPort.ts
// 在线账户 controller 的切换清理端口（照 createLibraryHomePort 的做法）：用户确认切换平台后、controller 写新的
// 当前平台之前，清掉上一个平台留下的播放与浏览运行态（原 App.tsx 的 handleConfirmProviderSwitch）。
// 播放器的 DOM 与 automix 句柄只有 App 持有，经 getHost 现读；播放状态读写都走 usePlaybackStore 的最新值。

/** App 持有、端口按调用现读的播放器句柄。 */
export type LibraryAccountSwitchHost = {
    audioRef: RefObject<HTMLAudioElement | null>;
    automixRef: RefObject<{ abortTransition: () => void } | null>;
    /** App 的歌词写入（带过滤设置的那一个；清空时只传 null）。 */
    setLyrics: (lyrics: LyricData | null) => void;
};

export const createLibraryAccountSwitchCleanupPort = (
    getHost: () => LibraryAccountSwitchHost,
): LibraryProviderSwitchCleanupPort => ({
    resetForProviderSwitch: (nextProviderId: OnlineProviderId) => {
        const { audioRef, automixRef, setLyrics } = getHost();
        const playback = usePlaybackStore.getState();
        // Stops any deck still fading out in the background: this path clears the active deck
        // only, and a tail left running would have no control pointing at it any more.
        automixRef.current?.abortTransition();
        const audio = audioRef.current;
        audio?.pause();
        audio?.removeAttribute('src');
        audio?.load();
        if (playback.audioSrc?.startsWith('blob:')) URL.revokeObjectURL(playback.audioSrc);
        playback.setAudioSrc(null);
        playback.setCurrentSong(null);
        playback.setPlayQueue([]);
        setLyrics(null);
        playback.setCachedCoverUrl(null);
        playback.setIsFmMode(false);
        playback.setPlayerState(PlayerState.IDLE);
        clearPrefetchRuntime();
        // The measurements are keyed by playback key, so the outgoing provider's are unreachable
        // from here on. Dropped alongside the prefetch cache they were gathered with, rather than
        // sitting in memory until the tab is closed.
        clearTrackProfileRuntime();
        useSearchNavigationStore.getState().resetRuntime(nextProviderId);
        useCollectionNavigationStore.getState().clear();
    },
});
