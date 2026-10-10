import type { SongResult } from '../../../types';
import type { NavidromeGridViewCollectionDescriptor } from '../contracts/collection';
import type { CollectionResource } from '../contracts/resource';
import { getPlaybackSongKey } from '../../../utils/appPlaybackGuards';
import { collectionRevision } from '../model/collectionIdentity';
import { createCollectionResourceState } from './collectionResourceState';
import { resolveNavidromeGridViewTracks } from './navidromeCollectionTracks';

// src/library/core/services/navidromeCollectionResource.ts
// Navidrome 集合资源：一次取完，不分页、不缓存。出错时与原先一致，记一条错误并当作空集合，
// 不单独给错误态（P2 再补）。不复用：随机歌曲每次打开都应该重新抽。

export type NavidromeTracksLoader = (descriptor: NavidromeGridViewCollectionDescriptor) => Promise<SongResult[]>;

export const createNavidromeCollectionResource = (
    key: string,
    loadTracks: NavidromeTracksLoader = resolveNavidromeGridViewTracks,
): CollectionResource => {
    const state = createCollectionResourceState(key, 'navidrome');
    let generation = 0;
    let disposed = false;

    // 从头取一遍；更晚的一次加载或销毁会让这一次的结果作废。
    const load = async (descriptor: NavidromeGridViewCollectionDescriptor) => {
        const current = ++generation;
        state.set({ status: 'loading', tracks: [], generation: current, revision: collectionRevision(descriptor) }, 'urgent');
        let tracks: SongResult[] = [];
        try {
            tracks = await loadTracks(descriptor);
        } catch (error) {
            console.error('[LibraryUi] Failed to load Navidrome collection tracks:', error);
        }
        if (disposed || current !== generation) return;
        state.set({ status: 'ready', tracks }, 'urgent');
    };

    let started = false;

    return {
        key,
        kind: 'navidrome',
        getSnapshot: state.get,
        subscribe: state.subscribe,
        ensure: (descriptor) => {
            if (disposed || descriptor.source !== 'navidrome') return;
            if (started && state.get().revision === collectionRevision(descriptor)) return;
            started = true;
            void load(descriptor);
        },
        reload: () => {},
        resumeSync: () => {},
        canReuse: () => false,
        pause: () => {
            generation += 1;
        },
        dispose: () => {
            disposed = true;
            generation += 1;
            state.clear();
        },
        removeTracks: async (match) => {
            state.set({ tracks: state.get().tracks.filter(track => !match(track)) }, 'urgent');
        },
        removeAt: (index, expectedKey) => {
            const current = state.get().tracks;
            if (!current[index] || getPlaybackSongKey(current[index]) !== expectedKey) return false;
            state.set({ tracks: current.filter((_, position) => position !== index) }, 'urgent');
            return true;
        },
        replaceTrackAt: (index, expectedKey, next) => {
            const current = state.get().tracks;
            if (!current[index] || getPlaybackSongKey(current[index]) !== expectedKey) return false;
            state.set({ tracks: current.map((track, position) => (position === index ? next : track)) }, 'urgent');
            return true;
        },
        replaceAll: async (loadAll) => {
            state.set({ tracks: await loadAll() }, 'urgent');
            return true;
        },
    };
};
