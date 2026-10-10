import type { SongResult } from '../../../types';
import type { MediaId } from '../../../types/onlineMusic';
import type { LibraryCapability } from './capability';
import type { LibraryCollectionDescriptor } from './collection';
import type { LibraryMutationPort, LibraryPlaylistOption } from './ports';
import type { CollectionResource } from './resource';

// src/library/core/contracts/mutations.ts
// ---- 变更动作（P2）：删条目、订阅、改名、删除集合、重扫、导出……两套 UI 调同一个控制器。 ----
// 控制器的实现在 core/services/collectionMutations，能力规则在 core/model/collectionMutationCapabilities。

/**
 * 集合里的一个条目。同一首歌可以在歌单里出现多次，entryKey（`${playbackKey}-${occurrence}`，
 * 与网格卡片 id、TUI 行同一格式，见 core/model/collectionEntries）区分是哪一次。
 */
export type LibraryEntryRef = { entryKey: string; track: SongResult };

/**
 * 动作没做成的原因：busy 同一动作还在进行（只发了一次请求）；stale 条目已经不在原处；
 * unsupported 这个集合没有这个动作；limit-reached 上游说没有更多了；failed 上游或本地出错。
 */
export type LibraryMutationFailureReason = 'busy' | 'stale' | 'unsupported' | 'limit-reached' | 'failed';

/** 存判别式，文案在 renderer 里翻译。 */
export type LibraryMutationResult =
    | { ok: true }
    | { ok: false; reason: LibraryMutationFailureReason; message?: string };

/**
 * 集合的来源分支，逐字对应 GridView 原先的布尔（见 core/model/collectionMutationCapabilities）。
 * renderer 用它决定文案（例如专辑与歌单的订阅提示、文件夹删除要先确认）。
 */
export type CollectionMutationBranches = {
    isLocalCollection: boolean;
    isNavidromeCollection: boolean;
    isDailyRecommendationsCollection: boolean;
    isLocalFolderCollection: boolean;
    isLocalAllSongsCollection: boolean;
    isLocalPlaylistCollection: boolean;
    isLocalEntityCollection: boolean;
    isNavidromePlaylistCollection: boolean;
    isCloudDrive: boolean;
    isOnlinePlaylist: boolean;
    isOnlineAlbum: boolean;
    canEditOnlineCollectionTracks: boolean;
    canEditOwnedPlaylist: boolean;
    canEditProviderPlaylist: boolean;
    /** 有可编辑的内容（删条目或改名）：网格的「编辑」开关。 */
    canEditPlaylist: boolean;
    showSubscribeButton: boolean;
    canAddNavidromeToPlaylist: boolean;
};

export type CollectionMutationCapabilities = {
    /** 删除（或每日推荐的不喜欢）单个条目。 */
    removeEntry: LibraryCapability;
    subscribe: LibraryCapability;
    /** 进入 / 退出编辑（= canEditPlaylist）；编辑模式本身属于 renderer。 */
    editCollection: LibraryCapability;
    rename: LibraryCapability;
    deleteCollection: LibraryCapability;
    resyncFolder: LibraryCapability;
    resyncAllFolders: LibraryCapability;
    exportPlaylist: LibraryCapability;
    addToPlaylist: LibraryCapability;
    createPlaylist: LibraryCapability;
    editEntity: LibraryCapability;
    organizeSongInfo: LibraryCapability;
    /** 本地歌曲匹配在线信息；还要看条目本身是不是本地歌。 */
    matchSong: LibraryCapability;
    /** 每日推荐切换历史日期 / 刷新今天。加载中的禁用由 renderer 结合资源快照决定。 */
    dailyDate: LibraryCapability;
};

export type CollectionMutationSnapshot = {
    /** 订阅状态：null 表示还不知道，或这个集合不能订阅。 */
    readonly subscribed: boolean | null;
    readonly subscribing: boolean;
    /** 删除请求还没回来的条目。 */
    readonly pendingEntryKeys: readonly string[];
    readonly dailyLimitReached: boolean;
    /** 共用的来源动作（改名、删除、重扫、导出、加入歌单）进行中。 */
    readonly sourceActionPending: boolean;
    /** 每日推荐当前看的日期，'' 表示今天。 */
    readonly dailyDate: string;
    readonly dailyHistoryDates: readonly string[];
    /**
     * 改名成功、但宿主的集合描述还带着旧名字时的新名字（renderer 显示它）；宿主的描述跟上或变了就回到 null。
     */
    readonly renamedTo: string | null;
    /** Navidrome「加入歌单」的候选歌单。 */
    readonly availablePlaylists: readonly LibraryPlaylistOption[];
    readonly branches: CollectionMutationBranches;
    readonly capabilities: CollectionMutationCapabilities;
};

/** 控制器跟随宿主更新的输入：同一集合会话里描述、资源（本地集合会换新资源）、端口、用户都会变。 */
export type CollectionMutationInputs = {
    descriptor: LibraryCollectionDescriptor;
    resource: CollectionResource | null;
    port: LibraryMutationPort;
    currentUserId?: MediaId | null;
};

/**
 * 一个集合会话一个实例（宿主持有，renderer 订阅）。每个动作执行时重新检查能力；同一条目 / 同一动作
 * 进行中再次提交返回 busy，只发一次请求。dispose 之后控制器的状态不再变化、不再通知，
 * 已发出的上游请求照常完成。
 */
export interface CollectionMutationController {
    getSnapshot(): CollectionMutationSnapshot;
    /** 第一个订阅者到来时才去取订阅状态与每日推荐的历史日期。返回退订函数。 */
    subscribe(listener: () => void): () => void;
    /** 宿主同步最新输入；能力随之重算，有变化才通知。 */
    update(inputs: Partial<CollectionMutationInputs>): void;
    removeEntry(entry: LibraryEntryRef): Promise<LibraryMutationResult>;
    toggleSubscribe(): Promise<LibraryMutationResult>;
    /** 名字去掉首尾空白；空或与当前显示的名字（renamedTo ?? 描述的名字）相同时什么都不做并返回 ok。 */
    rename(name: string): Promise<LibraryMutationResult>;
    /** 成功后由 renderer 返回上一层。 */
    deleteCollection(): Promise<LibraryMutationResult>;
    resyncFolder(): Promise<LibraryMutationResult>;
    resyncAllFolders(): Promise<LibraryMutationResult>;
    exportPlaylist(): Promise<LibraryMutationResult>;
    /** tracks 由 renderer 给（网格给的是可播放曲目）。 */
    addToPlaylist(playlistId: string | number, tracks: SongResult[]): Promise<LibraryMutationResult>;
    createPlaylist(name: string, tracks: SongResult[]): Promise<LibraryMutationResult>;
    editEntity(): Promise<LibraryMutationResult>;
    organizeSongInfo(): Promise<LibraryMutationResult>;
    matchSong(track: SongResult): Promise<LibraryMutationResult>;
    /** date 为 '' 表示今天；afresh 让上游重新生成今天的推荐。 */
    setDailyDate(date: string, options?: { afresh?: boolean }): Promise<LibraryMutationResult>;
    dispose(): void;
}
