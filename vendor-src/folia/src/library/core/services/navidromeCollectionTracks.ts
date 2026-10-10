import type { SongResult } from '../../../types';
import type { SubsonicSong } from '../../../types/navidrome';
import type { NavidromeGridViewCollectionDescriptor } from '../contracts/collection';
import { getNavidromeConfig, navidromeApi } from '../../../services/navidromeService';
import { buildNavidromeQueue } from '../../../services/playbackAdapters';

// src/library/core/services/navidromeCollectionTracks.ts
// Navidrome 集合的曲目：按集合类型调用对应的 Subsonic 接口，再统一转成播放用的歌曲。
// 原在 components/app/home/gridViewCollectionAdapters.ts，资源层在 services 里，不能反向依赖组件目录。

/** 当前 Navidrome 服务器的作用域：换服务器或换账号时，同 id 的集合不是同一份数据。 */
export const resolveNavidromeServerScope = (): string => {
    const config = getNavidromeConfig();
    return config ? `${config.serverUrl}|${config.username}` : '';
};

// Loads Navidrome tracks for GridView without moving Navidrome service logic into GridView itself.
export const resolveNavidromeGridViewTracks = async (
    descriptor: NavidromeGridViewCollectionDescriptor
): Promise<SongResult[]> => {
    const config = getNavidromeConfig();
    if (!config) {
        return [];
    }

    let subsonicSongs: SubsonicSong[] = [];

    if (descriptor.type === 'album') {
        const albumDetail = await navidromeApi.getAlbum(config, descriptor.id);
        subsonicSongs = albumDetail?.song || [];
    } else if (descriptor.type === 'playlist') {
        const playlistDetail = await navidromeApi.getPlaylist(config, descriptor.id);
        subsonicSongs = playlistDetail?.entry || [];
    } else if (descriptor.type === 'artist') {
        const artistDetail = await navidromeApi.getArtist(config, descriptor.id);
        const albums = artistDetail?.album || [];
        const albumResults = await Promise.all(albums.map(album => navidromeApi.getAlbum(config, album.id)));
        subsonicSongs = albumResults.flatMap(album => album?.song || []);
    } else if (descriptor.type === 'random') {
        subsonicSongs = await navidromeApi.getRandomSongs(config, 100);
    } else if (descriptor.type === 'favorites') {
        subsonicSongs = await navidromeApi.getStarred2(config);
    }

    const navidromeSongs = subsonicSongs.map(song => navidromeApi.toNavidromeSong(config, song));
    return buildNavidromeQueue(navidromeSongs);
};
