import { useCallback, useEffect } from 'react';
import i18n from '../i18n/config';
import { omni } from '../services/onlineMusic/omni';
import { useOnlineProviderAccountStore } from '../stores/useOnlineProviderAccountStore';
import type { MediaId, ProviderCollection, ProviderUser } from '../types/onlineMusic';
import { handleLoginStatusFailure } from '../services/onlineMusic/loginStatusFailure';
import {
    clearProviderAccountSnapshot,
    loadProviderAccountSnapshot,
    saveProviderAccountSnapshot,
} from '../services/onlineMusic/providerAccountCache';

// src/hooks/useKugouLibrary.ts

const PAGE_SIZE = 50;

type KugouLikedState = { likedSongIds: MediaId[]; likedSongFileIds: Record<string, MediaId> };

/**
 * 刷新期间用户点的收藏要保住。整份列表是刷新开始时拉的，分页之后这个窗口有好几秒，
 * 直接覆盖会把窗口内的改动抹掉，心形跟着变暗。这里只把窗口内的增删差量重放到新列表上。
 */
export const mergeLikedStateMutations = (
    refreshed: KugouLikedState,
    before: MediaId[],
    current: MediaId[],
): KugouLikedState => {
    const beforeKeys = new Set(before.map(String));
    const currentKeys = new Set(current.map(String));
    const added = current.filter(id => !beforeKeys.has(String(id)));
    const removedKeys = new Set(before.filter(id => !currentKeys.has(String(id))).map(String));
    if (added.length === 0 && removedKeys.size === 0) return refreshed;

    const likedSongIds = refreshed.likedSongIds.filter(id => !removedKeys.has(String(id)));
    const presentKeys = new Set(likedSongIds.map(String));
    added.forEach(id => {
        if (presentKeys.has(String(id))) return;
        presentKeys.add(String(id));
        likedSongIds.push(id);
    });

    // 窗口内动过的歌，行号一律作废：加收藏拿不到新行号，取消收藏让旧行号失效。
    const touchedKeys = new Set([...added.map(String), ...removedKeys]);
    const likedSongFileIds = Object.fromEntries(
        Object.entries(refreshed.likedSongFileIds).filter(([songKey]) => !touchedKeys.has(songKey)),
    );
    return { likedSongIds, likedSongFileIds };
};

/**
 * 收藏列表这一轮没读到时该写什么。读失败不能写成"一首收藏都没有"——那会连快照一起清空，
 * 让所有心形熄灭；换了账号则不能沿用上一个账号的结果。
 */
export const resolveRefreshedLikedState = (
    resolved: boolean,
    fetched: KugouLikedState,
    previous: { userId?: MediaId; state: KugouLikedState } | null,
    userId: MediaId,
): KugouLikedState => {
    if (resolved) return fetched;
    const isSameUser = previous?.userId !== undefined && String(previous.userId) === String(userId);
    return isSameUser ? previous.state : { likedSongIds: [], likedSongFileIds: {} };
};

export const useKugouLibrary = () => {
    const updateAccount = useOnlineProviderAccountStore(state => state.updateAccount);
    const clearAccount = useOnlineProviderAccountStore(state => state.clearAccount);

    // Clears the visible account first so a broken IPC logout cannot leave stale authenticated UI behind.
    const clearAuthState = useCallback(async (error?: string) => {
        clearAccount('kugou', error);
        console.info('[KugouLibrary] auth-state-cleared', {
            reason: error || 'manual-logout',
        });
        const cleanupResults = await Promise.allSettled([
            omni.logout('kugou'),
            clearProviderAccountSnapshot('kugou'),
        ]);
        cleanupResults.forEach((result, index) => {
            if (result.status === 'fulfilled') return;
            console.warn('[KugouLibrary] auth-cleanup:error', {
                target: index === 0 ? 'provider-session' : 'account-snapshot',
                name: result.reason instanceof Error ? result.reason.name : 'Error',
                message: result.reason instanceof Error ? result.reason.message : String(result.reason),
            });
        });
    }, [clearAccount]);

    const checkLoginStatus = useCallback(async (): Promise<ProviderUser | null> => {
        const cachedAccount = useOnlineProviderAccountStore.getState().accounts.kugou;
        try {
            const user = await omni.getLoginStatus('kugou');
            if (!user) {
                await clearAuthState(cachedAccount?.user ? 'auth-required' : undefined);
                console.info('[KugouLibrary] login-status:anonymous', {
                    previousAccountExpired: Boolean(cachedAccount?.user),
                });
                return null;
            }
            updateAccount('kugou', {
                status: 'authenticated',
                user,
                hydration: 'ready',
                error: undefined,
            });
            return user;
        } catch (error) {
            // 只有 provider 明确报告鉴权失效才清账号；网络抖动/上游 5xx 只标记刷新失败，保留缓存账号和快照。
            return handleLoginStatusFailure(error, {
                providerId: 'kugou',
                cachedUser: cachedAccount?.user,
                fallbackMessage: 'kugou_login_status_failed',
                clearAuthState,
                updateAccount: patch => updateAccount('kugou', patch),
            });
        }
    }, [clearAuthState, updateAccount]);

    const refresh = useCallback(async () => {
        const availability = omni.getProviderAvailability('kugou');
        console.info('[KugouLibrary] refresh:start', { configured: availability.configured });
        if (!omni.getProviderCapabilities('kugou').auth || !availability.configured) {
            updateAccount('kugou', {
                status: availability.configured ? 'error' : 'anonymous',
                user: null,
                error: availability.reason,
                hydration: 'ready',
                freshness: availability.configured ? 'error' : 'fresh',
            });
            console.warn('[KugouLibrary] refresh:unavailable', { reason: availability.reason });
            return false;
        }

        const cachedAccount = useOnlineProviderAccountStore.getState().accounts.kugou;
        updateAccount('kugou', {
            status: cachedAccount?.user ? 'authenticated' : 'unknown',
            hydration: cachedAccount?.user ? 'ready' : 'loading',
            freshness: 'refreshing',
            error: undefined,
        });
        const user = await checkLoginStatus();
        if (!user) return false;

        console.info('[KugouLibrary] refresh:authenticated', {
            hasAvatar: Boolean(user.avatarUrl),
        });

        const collections: ProviderCollection[] = [];
        let likedSongIds: MediaId[] = [];
        let likedSongFileIds: Record<string, MediaId> = {};
        let likedSongsResolved = false;
        try {
            if (omni.getProviderCapabilities('kugou').likes) {
                try {
                    const likedSongs = await omni.getProviderLikedSongs('kugou', user.id);
                    likedSongIds = likedSongs.map(song => song.id).filter(Boolean);
                    likedSongFileIds = {};
                    for (const song of likedSongs) {
                        const sourceData = song.sourceRef?.kind === 'online'
                            ? song.sourceRef.providerData
                            : undefined;
                        const fileId = sourceData?.fileId;
                        if (typeof fileId === 'string' || typeof fileId === 'number') {
                            likedSongFileIds[String(song.id)] = fileId;
                        }
                    }
                    likedSongsResolved = true;
                } catch (error) {
                    console.warn('[KugouLibrary] liked-songs:error', {
                        name: error instanceof Error ? error.name : 'Error',
                        message: error instanceof Error ? error.message : String(error),
                    });
                }
            }
            if (omni.getProviderCapabilities('kugou').userLibrary) {
                let offset = 0;
                let hasMore = true;
                while (hasMore && offset < 1000) {
                    const page = await omni.getProviderUserPlaylists('kugou', user.id, { limit: PAGE_SIZE, offset });
                    collections.push(...page.items);
                    console.info('[KugouLibrary] playlists:page', {
                        offset,
                        itemCount: page.items.length,
                        hasMore: page.hasMore,
                    });
                    hasMore = page.hasMore && page.nextOffset > offset;
                    offset = page.nextOffset;
                }
            }
            if (omni.getProviderCapabilities('kugou').userCloud) {
                collections.push({
                    providerId: 'kugou', id: 'cloud', name: i18n.t('ui.cloudDrive'), type: 'cloud',
                    coverUrl: user.avatarUrl,
                });
            }
            // 分页之后一次刷新要发多次请求，失败概率比原来高得多，所以读失败要沿用上一轮的结果。
            // 比的是 checkLoginStatus 之前的那份账号：它已经把 user 换成了刚登录的这个，
            // 之后再读就永远是"同一个人"，切号保护会变成死代码。
            const fallbackState = resolveRefreshedLikedState(
                likedSongsResolved,
                { likedSongIds, likedSongFileIds },
                cachedAccount?.user
                    ? {
                        userId: cachedAccount.user.id,
                        state: {
                            likedSongIds: cachedAccount.likedSongIds || [],
                            likedSongFileIds: cachedAccount.likedSongFileIds || {},
                        },
                    }
                    : null,
                user.id,
            );
            const {
                likedSongIds: nextLikedSongIds,
                likedSongFileIds: nextLikedSongFileIds,
            } = mergeLikedStateMutations(
                fallbackState,
                cachedAccount?.likedSongIds || [],
                useOnlineProviderAccountStore.getState().accounts.kugou?.likedSongIds || [],
            );

            const snapshot = await saveProviderAccountSnapshot('kugou', {
                user,
                collections,
                likedSongIds: nextLikedSongIds,
            });
            updateAccount('kugou', {
                status: 'authenticated',
                user,
                collections,
                likedSongIds: nextLikedSongIds,
                likedSongFileIds: nextLikedSongFileIds,
                error: undefined,
                hydration: 'ready',
                freshness: 'fresh',
                lastUpdatedAt: snapshot.savedAt,
            });
            console.info('[KugouLibrary] refresh:complete', {
                collectionCount: collections.length,
                likedSongCount: nextLikedSongIds.length,
                likedSongFileIdCount: Object.keys(nextLikedSongFileIds).length,
                likedSongsResolved,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'kugou_library_failed';
            updateAccount('kugou', {
                status: 'authenticated',
                user,
                error: message,
                hydration: 'ready',
                freshness: 'error',
            });
            console.warn('[KugouLibrary] playlists:error', {
                name: error instanceof Error ? error.name : 'Error',
                message,
            });
        }
        return true;
    }, [checkLoginStatus, updateAccount]);

    const logout = useCallback(async () => {
        await clearAuthState();
    }, [clearAuthState]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            const snapshot = await loadProviderAccountSnapshot('kugou');
            if (cancelled) return;
            if (snapshot) {
                const user = omni.normalizeCachedUser('kugou', snapshot.user);
                if (user) {
                    const collections = snapshot.collections
                        .map(collection => omni.normalizeCachedCollection('kugou', collection, collection.type))
                        .filter(Boolean) as ProviderCollection[];
                    updateAccount('kugou', {
                        status: 'authenticated',
                        user,
                        collections,
                        likedSongIds: snapshot.likedSongIds,
                        // 歌单内行号不跨会话恢复，刷新会重建；恢复旧行号会拿它去删别的歌。
                        likedSongFileIds: {},
                        hydration: 'ready',
                        freshness: 'stale',
                        lastUpdatedAt: snapshot.savedAt,
                    });
                }
            }
            if (!cancelled) void refresh();
        })();
        return () => { cancelled = true; };
    }, [refresh]);

    return { refresh, logout, checkLoginStatus };
};
