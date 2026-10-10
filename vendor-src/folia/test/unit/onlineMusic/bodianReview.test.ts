import { afterEach, describe, expect, it, vi } from 'vitest';
import { omni } from '@/services/onlineMusic/omni';
import { getOnlineMusicProvider } from '@/services/onlineMusic/providerRegistry';
import { useOnlineProviderAccountStore } from '@/stores/useOnlineProviderAccountStore';
import type { UnifiedSong } from '@/types';
import type { ProviderCollection } from '@/types/onlineMusic';

// test/unit/onlineMusic/bodianReview.test.ts — shared-provider regressions raised in the Bodian review.

vi.mock('@/services/onlineMusic/providerAccountCache', () => ({ saveProviderAccountSnapshot: vi.fn() }));
afterEach(() => {
    vi.restoreAllMocks();
    useOnlineProviderAccountStore.setState({ accounts: {}, activeProviderId: 'netease' });
    omni.invalidateActiveRequests();
});

describe('daily recommendation capability', () => {
    it.each([['netease', true], ['kugou', true], ['qq', false], ['bodian', false]] as const)(
        'shows the daily entry according to %s support', (providerId, supported) => {
            expect(omni.supportsDailySongs(providerId)).toBe(supported);
        },
    );
    it('keeps the daily entry after a transient empty Netease result', async () => {
        const recommendations = getOnlineMusicProvider('netease')!.recommendations!;
        vi.spyOn(recommendations, 'getDailySongs').mockResolvedValue([]);
        vi.spyOn(recommendations, 'getPersonalFm').mockResolvedValue([]);
        vi.spyOn(recommendations, 'getRecommendedCollections').mockResolvedValue([]);
        useOnlineProviderAccountStore.getState().setActiveProviderId('netease');
        expect((await omni.getHomeFeed()).dailySongs).toEqual([]);
        expect(omni.supportsDailySongs('netease')).toBe(true);
    });
});

// Keep the actual provider capability/ownership checks; isolate only network and persistence work.
function prepareLikedAddition(providerId: string) {
    const song: UnifiedSong = { id: '1', name: 'Test', artists: [], album: { id: '', name: '' }, durationMs: 1,
        sourceRef: { kind: 'online', providerId, mediaId: '1' } };
    const playlist: ProviderCollection = { providerId, id: '2', type: 'playlist', name: 'Liked', isOwned: true, isLiked: true };
    useOnlineProviderAccountStore.getState().updateAccount(providerId, {
        user: { id: 'user', nickname: 'Listener' }, likedSongIds: ['existing'],
    });
    vi.spyOn(omni, 'canAddSongToPlaylist').mockReturnValue(true);
    vi.spyOn(omni, 'updateCollectionTracks').mockResolvedValue(undefined);
    vi.spyOn(omni, 'refreshProviderPlaylists').mockResolvedValue([]);
    const readLikes = vi.spyOn(omni, 'getProviderLikedSongIds');
    return { song, playlist, readLikes };
}

describe('liked playlist refresh', () => {
    it('does not request the cached Netease liked list', async () => {
        const { song, playlist, readLikes } = prepareLikedAddition('netease');
        await omni.addSongToPlaylist(song, playlist);
        expect(readLikes).not.toHaveBeenCalled();
    });

    it.each(['bodian', 'kugou'])('does not delay %s mutation success while fetching the liked list', async providerId => {
        const { song, playlist, readLikes } = prepareLikedAddition(providerId);
        let finish!: (ids: string[]) => void;
        readLikes.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        await omni.addSongToPlaylist(song, playlist);
        expect(readLikes).toHaveBeenCalledWith(providerId, 'user');
        finish(['existing', '1']);
        await vi.waitFor(() => expect(useOnlineProviderAccountStore.getState().accounts[providerId].likedSongIds).toEqual(['existing', '1']));
    });

    it.each(['logout', 'newer-like'])('ignores a late liked list after %s', async action => {
        const { song, playlist, readLikes } = prepareLikedAddition('bodian');
        let finish!: (ids: string[]) => void;
        readLikes.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        await omni.addSongToPlaylist(song, playlist);
        if (action === 'logout') useOnlineProviderAccountStore.getState().clearAccount('bodian');
        else useOnlineProviderAccountStore.getState().updateAccount('bodian', { likedSongIds: ['newer'] });
        finish(['stale']);
        await Promise.resolve();
        expect(useOnlineProviderAccountStore.getState().accounts.bodian.likedSongIds).toEqual(action === 'logout' ? [] : ['newer']);
    });
});
