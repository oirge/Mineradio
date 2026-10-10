import { beforeEach, describe, expect, it, vi } from 'vitest';

// test/unit/library/app/libraryAccountPort.test.ts
// 切换清理端口（A4，原 App.tsx 的 handleConfirmProviderSwitch）：停掉 automix 尾音与 audio、回收 blob 地址、
// 清空当前歌曲 / 队列 / 歌词 / 封面 / FM / 播放状态、丢掉 prefetch 与 track profile、搜索运行态换到新平台、
// 集合导航清空；App 的句柄按调用现读。

const services = vi.hoisted(() => ({ clearPrefetchRuntime: vi.fn(), clearTrackProfileRuntime: vi.fn() }));
vi.mock('@/services/prefetchService', () => ({ clearPrefetchRuntime: services.clearPrefetchRuntime }));
vi.mock('@/services/automix/profileService', () => ({ clearTrackProfileRuntime: services.clearTrackProfileRuntime }));

import { createLibraryAccountSwitchCleanupPort, type LibraryAccountSwitchHost } from '@/library/app/createLibraryAccountPort';
import { usePlaybackStore } from '@/stores/usePlaybackStore';
import { useSearchNavigationStore } from '@/stores/useSearchNavigationStore';
import { useCollectionNavigationStore } from '@/stores/useCollectionNavigationStore';
import { PlayerState, type SongResult } from '@/types';

const song = { id: 's1', name: 'Song', artists: [], album: { id: '', name: '' } } as unknown as SongResult;

const fakeAudio = () => ({ pause: vi.fn(), removeAttribute: vi.fn(), load: vi.fn() });

describe('provider switch cleanup port', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        usePlaybackStore.setState({
            audioSrc: 'blob:old-track',
            currentSong: song,
            playQueue: [song],
            cachedCoverUrl: 'cover.png',
            isFmMode: true,
            playerState: PlayerState.PLAYING,
        });
    });

    it('stops playback and clears the outgoing provider\'s runtime before the switch commits', () => {
        const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        const resetRuntime = vi.spyOn(useSearchNavigationStore.getState(), 'resetRuntime');
        const clearNavigation = vi.spyOn(useCollectionNavigationStore.getState(), 'clear');
        const audio = fakeAudio();
        const automix = { abortTransition: vi.fn() };
        const setLyrics = vi.fn();
        const host: LibraryAccountSwitchHost = {
            audioRef: { current: audio as unknown as HTMLAudioElement },
            automixRef: { current: automix },
            setLyrics,
        };
        const port = createLibraryAccountSwitchCleanupPort(() => host);

        port.resetForProviderSwitch('kugou', 'netease');

        expect(automix.abortTransition).toHaveBeenCalledTimes(1);
        expect(audio.pause).toHaveBeenCalledTimes(1);
        expect(audio.removeAttribute).toHaveBeenCalledWith('src');
        expect(audio.load).toHaveBeenCalledTimes(1);
        expect(revoke).toHaveBeenCalledWith('blob:old-track');
        expect(setLyrics).toHaveBeenCalledWith(null);
        expect(usePlaybackStore.getState()).toMatchObject({
            audioSrc: null,
            currentSong: null,
            playQueue: [],
            cachedCoverUrl: null,
            isFmMode: false,
            playerState: PlayerState.IDLE,
        });
        expect(services.clearPrefetchRuntime).toHaveBeenCalledTimes(1);
        expect(services.clearTrackProfileRuntime).toHaveBeenCalledTimes(1);
        expect(resetRuntime).toHaveBeenCalledWith('kugou');
        expect(clearNavigation).toHaveBeenCalledTimes(1);
        revoke.mockRestore();
    });

    it('reads the host on every call and leaves non-blob sources alone', () => {
        const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        usePlaybackStore.setState({ audioSrc: 'https://example.test/a.mp3' });
        let host: LibraryAccountSwitchHost = {
            audioRef: { current: null },
            automixRef: { current: null },
            setLyrics: vi.fn(),
        };
        const port = createLibraryAccountSwitchCleanupPort(() => host);
        const laterAudio = fakeAudio();
        host = { ...host, audioRef: { current: laterAudio as unknown as HTMLAudioElement } };

        port.resetForProviderSwitch('qq', 'netease');

        expect(laterAudio.pause).toHaveBeenCalledTimes(1);
        expect(revoke).not.toHaveBeenCalled();
        revoke.mockRestore();
    });
});
