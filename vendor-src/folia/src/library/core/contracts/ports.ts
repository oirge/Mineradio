import type { SongResult, StatusMessage } from '../../../types';
import type { LocalGridViewCollectionDescriptor } from './collection';

// src/library/core/contracts/ports.ts
// 宿主提供给 Library Core 的端口：播放端口（交给应用的播放控制器）与变更动作的来源端口
// （本地曲库、Navidrome、对话框、账户刷新、应用内通知）。Core 只依赖这些接口，不知道它们怎么实现。

/** 把「播放 / 入队」交给应用现有的播放控制器；核心层不知道队列怎么构造。 */
export interface LibraryPlaybackPort {
    playTrack(track: SongResult, queue: SongResult[]): void;
    playAll(tracks: SongResult[]): void;
    enqueueTrack(track: SongResult): void;
    /**
     * 整批入队。`suppressToast` 让队列不弹自己的「已加入」提示（调用方要报自己的，例如歌手页的「已加入 N 首热门歌曲」）；
     * 返回队列真正收下的条数（已在队列里的不算），宿主不报数时为 void。
     */
    enqueueAll(tracks: SongResult[], options?: LibraryEnqueueOptions): number | void;
}

/** 整批入队的选项（与应用播放控制器 addOnlineSongsToQueue 的同名选项一致）。 */
export type LibraryEnqueueOptions = { suppressToast?: boolean };

/** 「加入歌单」选择器里的一项。 */
export type LibraryPlaylistOption = { id: string | number; name: string; description?: string };

/** 本地曲库的来源动作；最后三个只打开宿主挂载的对话框。 */
export interface LibraryLocalMutationPort {
    removePlaylistSongs?: (playlistId: string, songIds: string[]) => Promise<void> | void;
    /** 重新读取本地曲库（歌单、歌曲）。 */
    refresh?: () => Promise<void> | void;
    renamePlaylist?: (playlistId: string, name: string) => Promise<void> | void;
    deletePlaylist?: (playlistId: string) => Promise<void> | void;
    deleteFolder?: (collection: LocalGridViewCollectionDescriptor) => Promise<void> | void;
    resyncFolder?: (collection: LocalGridViewCollectionDescriptor) => Promise<void> | void;
    resyncAllFolders?: () => Promise<void> | void;
    exportPlaylist?: (playlistId: string) => Promise<void> | void;
    editEntity?: (entityId: string) => Promise<void> | void;
    organizeFolder?: (collection: LocalGridViewCollectionDescriptor) => Promise<void> | void;
    matchSong?: (songId: string) => Promise<void> | void;
}

/** Navidrome 的来源动作。删歌按资源里的原始下标，不是界面上的显示下标。 */
export interface LibraryNavidromeMutationPort {
    availablePlaylists?: LibraryPlaylistOption[];
    removePlaylistSongs?: (playlistId: string, rawIndexes: number[]) => Promise<void> | void;
    renamePlaylist?: (playlistId: string, name: string) => Promise<void> | void;
    deletePlaylist?: (playlistId: string) => Promise<void> | void;
    addToPlaylist?: (playlistId: string | number, songs: SongResult[]) => Promise<void> | void;
    createPlaylist?: (name: string, songs: SongResult[]) => Promise<void> | void;
}

/**
 * 宿主提供的来源动作。在线集合的变更走 omni（由控制器注入），这里只有应用侧才做得到的事：
 * 本地曲库与 Navidrome 的读写、对话框、账户刷新和应用内通知。
 */
export interface LibraryMutationPort {
    local?: LibraryLocalMutationPort;
    navidrome?: LibraryNavidromeMutationPort;
    /** 集合在上游变了（删歌、订阅）：刷新账户里的歌单列表等。 */
    onCollectionMutated?: () => Promise<void> | void;
    /** renderer 把动作结果翻译成文案后经由这里显示；控制器自己只返回判别式。 */
    statusMessage?: (message: StatusMessage) => void;
    /** 收藏的专辑变了（订阅 / 取消订阅专辑）。 */
    notifyFavoriteAlbumsChanged?: () => void;
}
