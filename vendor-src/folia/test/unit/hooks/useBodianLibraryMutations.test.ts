import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { omni } from '@/services/onlineMusic/omni';
import { useBodianLibrary } from '@/hooks/useBodianLibrary';
import { useOnlineProviderAccountStore } from '@/stores/useOnlineProviderAccountStore';
import { saveProviderAccountSnapshot } from '@/services/onlineMusic/providerAccountCache';
import type { UnifiedSong } from '@/types';

// test/unit/hooks/useBodianLibraryMutations.test.ts
// Exercise real Omni mutations against a library refresh delayed at either async boundary.

vi.mock('react', async importOriginal => ({
    ...await importOriginal<typeof import('react')>(),
    useCallback: (callback: unknown) => callback,
    useRef: (current: unknown) => ({ current }),
    useEffect: vi.fn(),
}));
vi.mock('@/services/onlineMusic/providerAccountCache', () => ({
    saveProviderAccountSnapshot: vi.fn(),
    loadProviderAccountSnapshot: vi.fn(),
    clearProviderAccountSnapshot: vi.fn(),
}));

const user = { id: '123', nickname: 'Listener' };
const song: UnifiedSong = {
    id: '456', name: 'Song', artists: [], album: { id: '', name: '' }, durationMs: 120000,
    sourceRef: { kind: 'online', providerId: 'bodian', mediaId: '456' },
};
const saveSnapshot = vi.mocked(saveProviderAccountSnapshot);

beforeEach(() => {
    vi.resetAllMocks();
    saveSnapshot.mockImplementation(async (_provider, snapshot) => ({ version: 1, savedAt: 2, ...snapshot }));
    vi.stubGlobal('window', { electron: { bodianRequest: vi.fn(async (operation: string) => {
        if (operation === 'login_status') return { ok: true, data: user };
        if (operation === 'like_song') return { ok: true, data: null };
        throw new Error(`Unexpected operation: ${operation}`);
    }) } });
    useOnlineProviderAccountStore.setState({ accounts: {} });
    useOnlineProviderAccountStore.getState().updateAccount('bodian', {
        status: 'authenticated', user, collections: [], likedSongIds: [],
    });
    vi.spyOn(omni, 'getProviderUserPlaylists').mockResolvedValue({ items: [], hasMore: false, nextOffset: 0 });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    useOnlineProviderAccountStore.setState({ accounts: {} });
});

describe('Bodian refresh and like mutations', () => {
    it.each([true, false])('preserves like=%s completed while the liked list is loading', async liked => {
        const oldIds = liked ? [] : ['456'];
        useOnlineProviderAccountStore.getState().updateAccount('bodian', { likedSongIds: oldIds });
        let finishRead!: (ids: string[]) => void;
        const read = vi.spyOn(omni, 'getProviderLikedSongIds').mockReturnValue(new Promise(resolve => { finishRead = resolve; }));
        const pending = useBodianLibrary().refresh();
        await vi.waitFor(() => expect(read).toHaveBeenCalled());

        await omni.likeSong(song, liked);
        expect(omni.isSongLiked(song)).toBe(liked);
        finishRead(oldIds);
        await expect(pending).resolves.toBe(true);

        expect(omni.isSongLiked(song)).toBe(liked);
        expect(saveSnapshot.mock.lastCall?.[1].likedSongIds).toEqual(liked ? ['456'] : []);
    });

    it.each([true, false])('preserves like=%s completed while the refresh snapshot is saving', async liked => {
        const oldIds = liked ? [] : ['456'];
        useOnlineProviderAccountStore.getState().updateAccount('bodian', { likedSongIds: oldIds });
        vi.spyOn(omni, 'getProviderLikedSongIds').mockResolvedValue(oldIds);
        let finishSave!: () => void;
        saveSnapshot.mockImplementationOnce((_provider, snapshot) => new Promise(resolve => {
            finishSave = () => resolve({ version: 1, savedAt: 1, ...snapshot });
        }));
        const pending = useBodianLibrary().refresh();
        await vi.waitFor(() => expect(saveSnapshot).toHaveBeenCalledOnce());

        await omni.likeSong(song, liked);
        finishSave();
        await expect(pending).resolves.toBe(true);

        expect(omni.isSongLiked(song)).toBe(liked);
        expect(saveSnapshot.mock.lastCall?.[1].likedSongIds).toEqual(liked ? ['456'] : []);
    });

    it('accepts the upstream liked list when no mutation happened', async () => {
        vi.spyOn(omni, 'getProviderLikedSongIds').mockResolvedValue(['456']);
        await expect(useBodianLibrary().refresh()).resolves.toBe(true);
        expect(omni.isSongLiked(song)).toBe(true);
        expect(saveSnapshot.mock.lastCall?.[1].likedSongIds).toEqual(['456']);
    });
});
