import type { SongResult, StageSource } from '../../../types';
import type { GridViewCollectionDescriptor } from './gridViewCollectionAdapters';
import type { HomeSurfaceProps } from './homeSurfaceTypes';
import { resolveSearchSource, type SearchSource } from '../../../stores/useSearchNavigationStore';
import type { ProviderAccountSummary } from '../../../types/onlineMusic';
import type { LibraryAccountController } from '../../../library/core/contracts/account';
import { openSettings } from '../../../stores/useSettingsModalStore';

// src/components/app/home/buildHomeModel.ts

export type HomeViewModel = {
    surfaceProps: HomeSurfaceProps;
    /** 在线账户 controller（App 持有，见 library/app/useLibraryAccountController），首页外壳交给首页 surface。 */
    account: LibraryAccountController;
    onOpenCollection: (collection: GridViewCollectionDescriptor) => void;
    onPushCollection: (collection: GridViewCollectionDescriptor) => void;
    /** 跳到集合栈的第 depth 层（保留的层数，0 为整个关掉），浏览器历史同步退回；见 useAppNavigation 的 popCollectionTo。 */
    onPopCollectionTo: (depth: number) => void;
    onBackCollection: () => void;
};

// What this file can read for itself, so the caller never names it. See useHomeModel below.
type HomeModelAmbient = {
    currentSong: HomeSurfaceProps['currentTrack'];
    activePlaybackContext: 'main' | 'stage';
    navidromeEnabled: HomeSurfaceProps['navidromeEnabled'];
};

export type HomeModelDeps = {
    account: LibraryAccountController;
    /** controller 快照里的当前平台摘要（未变时身份稳定）；首页的账户与在线歌单优先取它。 */
    activeProvider?: ProviderAccountSummary;
    playSong: HomeSurfaceProps['onPlaySong'];
    navigateToPlayer: HomeSurfaceProps['onBackToPlayer'];
    navigateToLattice: NonNullable<HomeSurfaceProps['onOpenLattice']>;
    refreshOnlineProviderPlaylists: () => Promise<unknown>;
    user: HomeSurfaceProps['user'];
    playlists: HomeSurfaceProps['playlists'];
    cloudPlaylist?: HomeSurfaceProps['cloudPlaylist'];
    focusedPlaylistIndex?: HomeSurfaceProps['focusedPlaylistIndex'];
    setFocusedPlaylistIndex?: HomeSurfaceProps['setFocusedPlaylistIndex'];
    navigateToSearch: (args: { query: string; sourceTab: SearchSource; replace?: boolean }) => void;
    localSongs: HomeSurfaceProps['localSongs'];
    localLibraryCatalog: HomeSurfaceProps['localLibraryCatalog'];
    localPlaylists: HomeSurfaceProps['localPlaylists'];
    onRefreshLocalSongs: HomeSurfaceProps['onRefreshLocalSongs'];
    onAddLocalSongToQueue?: HomeSurfaceProps['onAddLocalSongToQueue'];
    localMusicState: HomeSurfaceProps['localMusicState'];
    setLocalMusicState: HomeSurfaceProps['setLocalMusicState'];
    onAddNavidromeSongsToQueue?: HomeSurfaceProps['onAddNavidromeSongsToQueue'];
    navidromeFocusedAlbumIndex?: HomeSurfaceProps['navidromeFocusedAlbumIndex'];
    setNavidromeFocusedAlbumIndex?: HomeSurfaceProps['setNavidromeFocusedAlbumIndex'];
    stageSource?: StageSource | null;
    openStagePlayer: () => Promise<void>;
    theme: HomeSurfaceProps['theme'];
    playAll: (songs: SongResult[]) => void;
    addAllToQueue: (songs: SongResult[], options?: { suppressToast?: boolean }) => number | void;
    addSongToQueue: (song: SongResult) => void;
    onStatusMessage?: HomeSurfaceProps['onStatusMessage'];
    onOpenCollection: (collection: GridViewCollectionDescriptor) => void;
    onPushCollection: (collection: GridViewCollectionDescriptor) => void;
    onPopCollectionTo: (depth: number) => void;
    onBackCollection: () => void;
};

type BuildHomeModelParams = HomeModelAmbient & HomeModelDeps;

// Builds the full Home model from raw app dependencies so App.tsx no longer assembles nested props inline.
export const buildHomeModel = ({
    account,
    activeProvider,
    playSong,
    navigateToPlayer,
    navigateToLattice,
    refreshOnlineProviderPlaylists,
    user,
    playlists,
    cloudPlaylist,
    currentSong,
    focusedPlaylistIndex,
    setFocusedPlaylistIndex,
    navigateToSearch,
    localSongs,
    localLibraryCatalog,
    localPlaylists,
    onRefreshLocalSongs,
    onAddLocalSongToQueue,
    localMusicState,
    setLocalMusicState,
    onAddNavidromeSongsToQueue,
    navidromeFocusedAlbumIndex,
    setNavidromeFocusedAlbumIndex,
    stageSource,
    activePlaybackContext,
    openStagePlayer,
    theme,
    navidromeEnabled,
    playAll,
    addAllToQueue,
    addSongToQueue,
    onStatusMessage,
    onOpenCollection,
    onPushCollection,
    onPopCollectionTo,
    onBackCollection,
}: BuildHomeModelParams): HomeViewModel => {
    return {
        account,
        onOpenCollection,
        onPushCollection,
        onPopCollectionTo,
        onBackCollection,
        surfaceProps: {
            onPlaySong: playSong,
            onBackToPlayer: navigateToPlayer,
            onOpenLattice: navigateToLattice,
            onRefreshUser: () => refreshOnlineProviderPlaylists(),
            // An anonymous selected provider must not inherit a different platform's account.
            user: activeProvider ? activeProvider.user : user,
            playlists: activeProvider?.collections.filter(collection => collection.type !== 'cloud') ?? playlists,
            cloudPlaylist: activeProvider?.collections.find(collection => collection.type === 'cloud') ?? cloudPlaylist,
            currentTrack: currentSong,
            onPlayAll: playAll,
            onAddAllToQueue: addAllToQueue,
            onAddSongToQueue: addSongToQueue,
            onStatusMessage,
            focusedPlaylistIndex,
            setFocusedPlaylistIndex,
            onOpenSettings: openSettings,
            onSearchCommitted: (query, sourceTab, replace = false) => {
                navigateToSearch({ query, sourceTab: resolveSearchSource(sourceTab), replace });
            },
            localSongs,
            localLibraryCatalog,
            localPlaylists,
            onRefreshLocalSongs,
            onAddLocalSongToQueue,
            localMusicState,
            setLocalMusicState,
            onAddNavidromeSongsToQueue,
            navidromeFocusedAlbumIndex,
            setNavidromeFocusedAlbumIndex,
            stageEnabled: Boolean(stageSource),
            stageIsActive: activePlaybackContext === 'stage',
            onOpenStagePlayer: () => {
                void openStagePlayer();
            },
            theme,
            navidromeEnabled,
        },
    };
};
