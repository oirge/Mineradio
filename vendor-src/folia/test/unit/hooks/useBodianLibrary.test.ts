import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBodianLibrary } from '@/hooks/useBodianLibrary';
import { useOnlineProviderAccountStore } from '@/stores/useOnlineProviderAccountStore';

// test/unit/hooks/useBodianLibrary.test.ts

const mocks = vi.hoisted(() => ({
    effects: [] as Array<() => unknown>,
    getProviderAvailability: vi.fn(),
    getProviderCapabilities: vi.fn(),
    getLoginStatus: vi.fn(),
    getProviderUserPlaylists: vi.fn(),
    getProviderLikedSongIds: vi.fn(),
    logout: vi.fn(),
    loadProviderAccountSnapshot: vi.fn(),
    clearProviderAccountSnapshot: vi.fn(),
    saveProviderAccountSnapshot: vi.fn(),
}));
vi.mock('react', () => ({
    useCallback: (callback: unknown) => callback,
    useRef: (current: unknown) => ({ current }),
    useEffect: (effect: () => unknown) => { mocks.effects.push(effect); },
}));
vi.mock('@/services/onlineMusic/omni', () => ({ omni: mocks }));
vi.mock('@/services/onlineMusic/providerAccountCache', () => mocks);

describe('Bodian account identity restoration', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.effects.length = 0;
        mocks.getProviderAvailability.mockReturnValue({ configured: true });
        mocks.getProviderCapabilities.mockReturnValue({ auth: false });
        mocks.clearProviderAccountSnapshot.mockResolvedValue(undefined);
        mocks.loadProviderAccountSnapshot.mockResolvedValue({ user: { id: 'unverified', nickname: 'Old account' } });
        mocks.getProviderUserPlaylists.mockResolvedValue({ items: [], hasMore: false, nextOffset: 0 });
        mocks.getProviderLikedSongIds.mockResolvedValue([]);
        mocks.saveProviderAccountSnapshot.mockResolvedValue({ savedAt: 2 });
        useOnlineProviderAccountStore.setState({ accounts: {} });
        useOnlineProviderAccountStore.getState().updateAccount('bodian', {
            status: 'authenticated', user: { id: 'unverified', nickname: 'Old account' },
            likedSongIds: ['old-song'], collections: [{ providerId: 'bodian', id: 'old-list', name: 'Old list', type: 'playlist' }],
        });
    });

    it('clears the visible account synchronously on mount without loading a historical snapshot', async () => {
        useBodianLibrary();
        mocks.effects[0]();
        expect(useOnlineProviderAccountStore.getState().accounts.bodian).toMatchObject({
            status: 'anonymous', user: null, collections: [], likedSongIds: [],
        });
        await vi.waitFor(() => expect(mocks.clearProviderAccountSnapshot).toHaveBeenCalledWith('bodian'));
        expect(mocks.loadProviderAccountSnapshot).not.toHaveBeenCalled();
        expect(mocks.getLoginStatus).not.toHaveBeenCalled();
    });

    it.each([true, false])('does not authenticate when disabled (configured=%s), even if cache deletion fails', async configured => {
        mocks.getProviderAvailability.mockReturnValue({ configured });
        mocks.clearProviderAccountSnapshot.mockRejectedValue(new Error('storage unavailable'));
        const { refresh } = useBodianLibrary();
        await expect(refresh()).resolves.toBe(false);
        expect(useOnlineProviderAccountStore.getState().accounts.bodian).toMatchObject({
            user: null, collections: [], likedSongIds: [], freshness: 'error',
        });
        expect(useOnlineProviderAccountStore.getState().accounts.bodian.status).not.toBe('authenticated');
        expect(mocks.getLoginStatus).not.toHaveBeenCalled();
        expect(mocks.saveProviderAccountSnapshot).not.toHaveBeenCalled();
    });

    it('keeps old identity hidden while a new status check is pending or fails', async () => {
        mocks.getProviderCapabilities.mockReturnValue({ auth: true });
        let rejectStatus!: (error: Error) => void;
        mocks.getLoginStatus.mockReturnValue(new Promise((_resolve, reject) => { rejectStatus = reject; }));
        useBodianLibrary();
        mocks.effects[0]();
        expect(useOnlineProviderAccountStore.getState().accounts.bodian.user).toBeNull();
        expect(mocks.loadProviderAccountSnapshot).not.toHaveBeenCalled();
        rejectStatus(new Error('network failure'));
        await vi.waitFor(() => expect(useOnlineProviderAccountStore.getState().accounts.bodian.freshness).toBe('error'));
        expect(useOnlineProviderAccountStore.getState().accounts.bodian).toMatchObject({
            status: 'error', user: null, collections: [], likedSongIds: [],
        });
    });

    it('hydrates a matching snapshot before a slow library refresh and retains it on network failure', async () => {
        mocks.getProviderCapabilities.mockReturnValue({ auth: true, userLibrary: true });
        mocks.getLoginStatus.mockResolvedValue({ id: '123', nickname: 'Current account' });
        mocks.loadProviderAccountSnapshot.mockResolvedValue({ user: { id: '123' }, savedAt: 1,
            collections: [{ providerId: 'bodian', type: 'playlist', id: 'cached', name: 'Cached' }], likedSongIds: ['1'] });
        let rejectPage!: (error: Error) => void;
        mocks.getProviderUserPlaylists.mockReturnValue(new Promise((_resolve, reject) => { rejectPage = reject; }));
        const { refresh } = useBodianLibrary();
        const pending = refresh();
        await vi.waitFor(() => expect(mocks.getProviderUserPlaylists).toHaveBeenCalled());
        expect(useOnlineProviderAccountStore.getState().accounts.bodian).toMatchObject({
            user: { id: '123', nickname: 'Current account' }, collections: [{ id: 'cached' }],
            likedSongIds: ['1'], freshness: 'refreshing',
        });
        rejectPage(new Error('network'));
        await expect(pending).resolves.toBe(false);
        expect(useOnlineProviderAccountStore.getState().accounts.bodian).toMatchObject({
            status: 'authenticated', collections: [{ id: 'cached' }], likedSongIds: ['1'], freshness: 'error',
        });
    });

    it('does not restore another account snapshot', async () => {
        mocks.getProviderCapabilities.mockReturnValue({ auth: true });
        mocks.getLoginStatus.mockResolvedValue({ id: '123', nickname: 'Current account' });
        const { refresh } = useBodianLibrary();
        await expect(refresh()).resolves.toBe(true);
        expect(useOnlineProviderAccountStore.getState().accounts.bodian).toMatchObject({
            user: { id: '123' }, collections: [], likedSongIds: [], freshness: 'fresh',
        });
        expect(mocks.saveProviderAccountSnapshot).toHaveBeenCalledWith('bodian', expect.objectContaining({ user: { id: '123', nickname: 'Current account' } }));
    });

    it('does not restore a late snapshot after logout', async () => {
        mocks.getProviderCapabilities.mockReturnValue({ auth: true });
        mocks.getLoginStatus.mockResolvedValue({ id: '123', nickname: 'Current account' });
        let finish!: (value: unknown) => void;
        mocks.loadProviderAccountSnapshot.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        const { refresh, logout } = useBodianLibrary();
        const pending = refresh();
        await vi.waitFor(() => expect(mocks.loadProviderAccountSnapshot).toHaveBeenCalled());
        await logout();
        finish({ user: { id: '123' }, collections: [], likedSongIds: ['old'] });
        await expect(pending).resolves.toBe(false);
        expect(useOnlineProviderAccountStore.getState().accounts.bodian).toMatchObject({ user: null, likedSongIds: [] });
        expect(mocks.saveProviderAccountSnapshot).not.toHaveBeenCalled();
    });
});
