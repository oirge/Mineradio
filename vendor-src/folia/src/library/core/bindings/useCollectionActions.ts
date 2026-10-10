import { useMemo, useRef } from 'react';
import type { SongResult } from '../../../types';
import type { CollectionResource, CollectionResourceSnapshot } from '../contracts/resource';
import type { LibraryCapability } from '../contracts/capability';
import type { LibraryPlaybackPort } from '../contracts/ports';
import { resolveReloadCapability, resolveScopeCapability } from '../model/collectionCapabilities';
import type { CollectionView } from './useCollectionView';

// src/library/core/bindings/useCollectionActions.ts
// 集合的语义动作：播放 / 入队某首或当前范围、重新拉取、续传。回调保持稳定，执行时读最新的视图——
// 点击那一刻界面上的范围就是播放的范围，不会引用过期的列表。

export type CollectionActions = {
    capabilities: { scope: LibraryCapability; reload: LibraryCapability };
    /** 以当前范围（筛选后）为队列播放这首。 */
    playTrack: (track: SongResult) => void;
    /** 以整个集合的可播放曲目为队列播放这首（曲目侧栏的语义，忽略筛选）。 */
    playTrackInFullList: (track: SongResult) => void;
    enqueueTrack: (track: SongResult) => void;
    playScope: () => void;
    enqueueScope: () => void;
    reload: () => void;
    resumeSync: () => void;
};

export const useCollectionActions = ({
    resource,
    snapshot,
    view,
    port,
    collectionType,
}: {
    resource: CollectionResource | null;
    snapshot: CollectionResourceSnapshot | null;
    view: CollectionView;
    port: LibraryPlaybackPort;
    collectionType?: string;
}): CollectionActions => {
    const latest = useRef({ resource, view, port });
    latest.current = { resource, view, port };

    const status = snapshot?.status ?? 'idle';
    const scope = useMemo(
        () => resolveScopeCapability({ scopeCount: view.contextTracks.length, status }),
        [status, view.contextTracks.length],
    );
    const reload = useMemo(
        () => resolveReloadCapability({ kind: resource?.kind ?? 'static', status, collectionType }),
        [collectionType, resource?.kind, status],
    );

    const callbacks = useMemo(() => ({
        playTrack: (track: SongResult) => latest.current.port.playTrack(track, latest.current.view.contextTracks),
        playTrackInFullList: (track: SongResult) => latest.current.port.playTrack(track, latest.current.view.playableTracks),
        enqueueTrack: (track: SongResult) => latest.current.port.enqueueTrack(track),
        playScope: () => {
            const tracks = latest.current.view.contextTracks;
            if (tracks.length > 0) latest.current.port.playAll(tracks);
        },
        enqueueScope: () => {
            const tracks = latest.current.view.contextTracks;
            if (tracks.length > 0) latest.current.port.enqueueAll(tracks);
        },
        reload: () => latest.current.resource?.reload(),
        resumeSync: () => latest.current.resource?.resumeSync(),
    }), []);

    return useMemo(() => ({ ...callbacks, capabilities: { scope, reload } }), [callbacks, reload, scope]);
};
