import { getNavidromeConfig, navidromeApi } from '../../../services/navidromeService';
import type { NavidromeHomeLibraryDeps } from './navidromeHomeLibrary';

// src/library/core/services/navidromeHomeLibraryDeps.ts
// Navidrome 首页概览的默认装配：配置读 localStorage，请求经 navidromeApi。单测给 createNavidromeHomeLibrary
// 注入假 deps，不经过这里。

export const navidromeHomeLibraryDeps: NavidromeHomeLibraryDeps = {
    getConfig: () => getNavidromeConfig(),
    getAlbumList2: (config, type, size, offset) => navidromeApi.getAlbumList2(config, type, size, offset),
    getPlaylists: config => navidromeApi.getPlaylists(config),
    getArtists: config => navidromeApi.getArtists(config),
    getRandomSongs: (config, size) => navidromeApi.getRandomSongs(config, size),
    getStarred2: config => navidromeApi.getStarred2(config),
};
