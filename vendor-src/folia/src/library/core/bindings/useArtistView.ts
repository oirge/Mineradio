import { useCallback, useDeferredValue, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { SongResult, StatusMessage } from '../../../types';
import type {
    LibraryArtistAlbum,
    LibraryArtistCapabilities,
    LibraryArtistResource,
    LibraryArtistSnapshot,
    LibraryArtistSurfaceActionId,
    LibraryArtistSurfaceState,
} from '../contracts/artist';
import type { LibraryCollectionDescriptor } from '../contracts/collection';
import type { LibraryPlaybackPort } from '../contracts/ports';
import type { LibraryArtistActionId, LibraryCatalogLinkHint, LibraryDeclaredActions } from '../contracts/suite';
import { artistAlbumLink, filterArtistAlbums } from '../model/artistModel';
import {
    artistSessionKey,
    resolveArtistCapabilities,
    resolveArtistSurfaceActions,
    resolveOfferedArtistActions,
} from '../model/artistSurface';
import { isSongUnavailable } from '../../../services/onlineMusic/songAvailability';
import { addArtistTopSongsToQueue, selectQueueableTopSongs } from '../../../utils/artistTopSongsQueue';
import { useLibrarySessionQuery } from './useLibrarySessionQuery';

// src/library/core/bindings/useArtistView.ts
// 歌手页的视图与语义动作（P4.2），网格与 TUI 共用：筛选词读写浏览会话（换 suite 不丢），专辑按筛选只看名字，
// 热门歌曲的可播放 / 可入队集合，能力（core/model/artistSurface 的纯规则）与「声明 ∩ 能力」，以及播放 / 入队 /
// 范围 / 重新加载 / 续页 / 编辑 / 打开专辑这些动作和命令面板 surface 的 getState / run。
// 快照由 suite 自己订阅后交进来（网格拖拽时会暂存后台分页，这里只读它给的那一份）。回调保持稳定，执行时读最新的值。

const EMPTY_SONGS: SongResult[] = [];
const EMPTY_ALBUMS: LibraryArtistAlbum[] = [];

type UseArtistViewParams = {
    collection: LibraryCollectionDescriptor;
    resource: LibraryArtistResource | null;
    snapshot: LibraryArtistSnapshot | null;
    playback: LibraryPlaybackPort;
    declaredActions: LibraryDeclaredActions;
    onEditEntity?: (entityId: string) => void;
    onOpenAlbum?: (albumId: number | string, album?: LibraryCatalogLinkHint, track?: SongResult) => void;
    /** 「加入热门歌曲」的结果提示（应用的全局提示通道）。 */
    setStatus: (message: StatusMessage) => void;
};

export type ArtistView = ReturnType<typeof useArtistView>;

export const useArtistView = ({
    collection,
    resource,
    snapshot,
    playback,
    declaredActions,
    onEditEntity,
    onOpenAlbum,
    setStatus,
}: UseArtistViewParams) => {
    const { t } = useTranslation();
    const sessionKey = artistSessionKey(collection, resource);
    const { query, setQuery, port: queryPort } = useLibrarySessionQuery(sessionKey);
    const deferredQuery = useDeferredValue(query);

    const topSongs = snapshot?.topSongs ?? EMPTY_SONGS;
    const albums = snapshot?.albums ?? EMPTY_ALBUMS;
    // 不可播放的热门歌曲不进队列（与歌单 / 专辑页一致）；入队还要按播放键去重。
    const playableTopSongs = useMemo(() => topSongs.filter(song => !isSongUnavailable(song)), [topSongs]);
    const queueableTopSongs = useMemo(() => selectQueueableTopSongs(topSongs), [topSongs]);
    const shownAlbums = useMemo(() => filterArtistAlbums(albums, deferredQuery), [albums, deferredQuery]);
    const linkSource = useMemo(() => ({
        source: collection.source,
        providerId: collection.source === 'online' ? collection.providerId : undefined,
    }), [collection]);

    const entityId = collection.source === 'local' ? collection.entityId : undefined;
    const capabilities: LibraryArtistCapabilities = useMemo(() => resolveArtistCapabilities({
        collection: { source: collection.source, entityId },
        snapshot,
        playableTopSongCount: playableTopSongs.length,
        queueableTopSongCount: queueableTopSongs.length,
    }), [collection.source, entityId, playableTopSongs.length, queueableTopSongs.length, snapshot]);
    const offered = useMemo(
        () => new Set(resolveOfferedArtistActions(declaredActions, capabilities)),
        [capabilities, declaredActions],
    );
    const offers = useCallback((action: LibraryArtistActionId) => offered.has(action), [offered]);

    const latest = useRef({ resource, playback, playableTopSongs, topSongs, entityId, onEditEntity, onOpenAlbum, setStatus, t, linkSource });
    latest.current = { resource, playback, playableTopSongs, topSongs, entityId, onEditEntity, onOpenAlbum, setStatus, t, linkSource };

    const actions = useMemo(() => ({
        /** 播放这首，以可播放的热门歌曲为队列。 */
        playSong: (song: SongResult) => latest.current.playback.playTrack(song, latest.current.playableTopSongs),
        enqueueSong: (song: SongResult) => latest.current.playback.enqueueTrack(song),
        /** 从第一首起播放全部可播放的热门歌曲。 */
        playScope: () => {
            const songs = latest.current.playableTopSongs;
            if (songs.length > 0) latest.current.playback.playAll(songs);
        },
        /** 静默整批入队热门歌曲，歌手页自己报队列实际收下的条数；返回那个条数。 */
        enqueueScope: (): number => addArtistTopSongsToQueue({
            songs: latest.current.topSongs,
            addAllToQueue: latest.current.playback.enqueueAll,
            setStatus: latest.current.setStatus,
            t: latest.current.t,
        }),
        reload: () => latest.current.resource?.reload(),
        retryAlbums: () => latest.current.resource?.retryAlbums(),
        editEntity: () => {
            const { entityId: id, onEditEntity: edit } = latest.current;
            if (id && edit) edit(id);
        },
        /** 打开一张专辑：链接提示带上歌手页的来源与 provider（artistAlbumLink，与网格专辑卡带的同一份）。 */
        openAlbum: (album: LibraryArtistAlbum) => {
            const link = artistAlbumLink(album, latest.current.linkSource);
            latest.current.onOpenAlbum?.(link.id, link);
        },
    }), []);

    const isFilterActive = query.trim().length > 0;
    const surfaceState = (): LibraryArtistSurfaceState => ({
        artistKey: sessionKey,
        availableActions: resolveArtistSurfaceActions(capabilities, declaredActions),
        playableTopSongCount: playableTopSongs.length,
        queueableTopSongCount: queueableTopSongs.length,
        albumCount: albums.length,
        shownAlbumCount: shownAlbums.length,
        isFilterActive,
    });
    /** 命令面板执行一个动作：不在此刻可用的动作里就拒绝（固定位、过期的面板都可能走到这里）。 */
    const runSurface = (action: LibraryArtistSurfaceActionId): boolean => {
        if (!surfaceState().availableActions.includes(action)) return false;
        switch (action) {
            case 'play-top-songs': actions.playScope(); return true;
            case 'enqueue-top-songs': actions.enqueueScope(); return true;
            case 'reload': actions.reload(); return true;
            case 'retry-albums': actions.retryAlbums(); return true;
            case 'edit-entity': actions.editEntity(); return true;
            default: return false;
        }
    };

    return {
        sessionKey,
        query,
        setQuery,
        queryPort,
        topSongs,
        playableTopSongs,
        queueableTopSongs,
        albums,
        shownAlbums,
        isFilterActive,
        capabilities,
        offers,
        actions,
        surfaceState,
        runSurface,
    };
};
