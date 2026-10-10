import { useCallback, useEffect, useRef } from 'react';
import { omni } from '../services/onlineMusic/omni';
import { clearProviderAccountSnapshot, loadProviderAccountSnapshot, saveProviderAccountSnapshot } from '../services/onlineMusic/providerAccountCache';
import { useOnlineProviderAccountStore } from '../stores/useOnlineProviderAccountStore';
import { OnlineProviderError } from '../types/onlineMusic';
import type { MediaId, ProviderCollection } from '../types/onlineMusic';

// src/hooks/useBodianLibrary.ts

export const useBodianLibrary = () => {
    const generation = useRef(0);
    const pendingSave = useRef<Promise<unknown>>(Promise.resolve());
    const refresh = useCallback(async () => {
        const current = ++generation.current;
        const store = useOnlineProviderAccountStore.getState();
        try {
            if (!omni.getProviderAvailability('bodian').configured || !omni.getProviderCapabilities('bodian').auth) {
                store.clearAccount('bodian');
                await pendingSave.current.catch(() => {});
                await clearProviderAccountSnapshot('bodian');
                return false;
            }
            store.updateAccount('bodian', { freshness: 'refreshing', error: undefined });
            const user = await omni.getLoginStatus('bodian');
            if (generation.current !== current) return false;
            if (!user) {
                store.clearAccount('bodian');
                await pendingSave.current.catch(() => {});
                await clearProviderAccountSnapshot('bodian');
                return false;
            }
            // Restore public metadata only after the main-process session identifies the same account.
            const visibleUser = useOnlineProviderAccountStore.getState().accounts.bodian?.user;
            if (!visibleUser || String(visibleUser.id) !== String(user.id)) {
                store.clearAccount('bodian');
                const snapshot = await loadProviderAccountSnapshot('bodian').catch(() => null);
                if (generation.current !== current) return false;
                const matching = snapshot && String(snapshot.user.id) === String(user.id) ? snapshot : null;
                store.updateAccount('bodian', { status: 'authenticated', user,
                    collections: matching?.collections || [], likedSongIds: matching?.likedSongIds || [],
                    hydration: 'ready', freshness: 'refreshing', lastUpdatedAt: matching?.savedAt, error: undefined });
            }
            const likesBeforeRefresh = useOnlineProviderAccountStore.getState().accounts.bodian.likedSongIds;
            const collections: ProviderCollection[] = [];
            const capabilities = omni.getProviderCapabilities('bodian');
            let offset = 0;
            if (capabilities.userLibrary) {
                while (true) {
                    const page = await omni.getProviderUserPlaylists('bodian', user.id, { offset, limit: 50 });
                    if (generation.current !== current) return false;
                    collections.push(...page.items);
                    if (!page.hasMore || page.nextOffset <= offset) break;
                    offset = page.nextOffset;
                }
            }
            const fetchedLikedSongIds: MediaId[] = capabilities.likes ? await omni.getProviderLikedSongIds('bodian', user.id) : [];
            if (generation.current !== current) return false;
            const save = pendingSave.current.catch(() => {}).then(() => {
                if (generation.current !== current) return null;
                // Omni replaces this array after each like mutation; keep those newer changes.
                const latestLikes = useOnlineProviderAccountStore.getState().accounts.bodian.likedSongIds;
                const likedSongIds = latestLikes === likesBeforeRefresh ? fetchedLikedSongIds : latestLikes;
                // Commit before saving so a mutation during persistence cannot be overwritten afterward.
                store.updateAccount('bodian', { status: 'authenticated', user, collections, likedSongIds,
                    hydration: 'ready', error: undefined });
                return saveProviderAccountSnapshot('bodian', { user, collections, likedSongIds });
            });
            pendingSave.current = save;
            const saved = await save;
            if (generation.current !== current) return false;
            if (!saved) return false;
            store.updateAccount('bodian', { freshness: 'fresh', lastUpdatedAt: saved.savedAt });
            return true;
        } catch (error) {
            if (generation.current !== current) return false;
            if (error instanceof OnlineProviderError && error.code === 'auth-required') {
                store.clearAccount('bodian', 'auth-required');
                await pendingSave.current.catch(() => {});
                await clearProviderAccountSnapshot('bodian');
            } else store.updateAccount('bodian', { hydration: 'ready', freshness: 'error',
                status: useOnlineProviderAccountStore.getState().accounts.bodian?.user ? 'authenticated' : 'error', error: 'bodian-refresh-failed' });
            return false;
        }
    }, []);
    const logout = useCallback(async () => {
        generation.current++;
        useOnlineProviderAccountStore.getState().clearAccount('bodian');
        await pendingSave.current.catch(() => {});
        await Promise.all([omni.logout('bodian'), clearProviderAccountSnapshot('bodian')]);
    }, []);
    useEffect(() => {
        // Check the desktop session before displaying cached account metadata.
        useOnlineProviderAccountStore.getState().clearAccount('bodian');
        void refresh();
        return () => { generation.current++; };
    }, [refresh]);
    return { refresh, logout };
};
