import type { SubsonicSong } from '../../../src/types/navidrome';
import {
    NAVIDROME_DUPES_PLAYLIST_ID,
    NAVIDROME_DUPES_PLAYLIST_SONGS,
    NAVIDROME_HOME_ALBUMS,
    NAVIDROME_HOME_ARTISTS,
    NAVIDROME_NEWEST_ALBUM_IDS,
    NAVIDROME_PLAYLIST_ID,
    NAVIDROME_RANDOM_SONGS,
    NAVIDROME_RECENT_ALBUM_IDS,
    NAVIDROME_STARRED_SONGS,
    NAVIDROME_PLAYLIST_SONGS,
    NAVIDROME_PROBE_SERVER,
    NAVIDROME_ALBUM_TRACKS,
    NAVIDROME_ARTIST_ALBUMS,
} from './fixtureRules';
import { recordProbeRequest } from './probeLog';

// dev/probes/libraryBehavior/navidromeShim.ts
// 只在沙盒模式安装的 fetch 垫片：把发往 http://navidrome.probe 的 Subsonic 请求就地应答。
// 放在探针里而不是 Playwright 的 page.route，是为了手动打开探针时也能用同一份数据。

export const NAVIDROME_PROBE_CONFIG = {
    serverUrl: NAVIDROME_PROBE_SERVER,
    username: 'probe',
    passwordHash: 'probe-password',
};

const makeSubsonicSong = (
    id: string,
    index: number,
    album: string,
    albumId: string,
    artist: { id: string; name: string } = { id: 'navi-ar-1', name: 'Navi Artist' },
): SubsonicSong => ({
    id,
    isDir: false,
    title: `Navi ${id}`,
    album,
    albumId,
    artist: artist.name,
    artistId: artist.id,
    track: index + 1,
    size: 1024,
    contentType: 'audio/mpeg',
    suffix: 'mp3',
    duration: 200 + index,
    path: `navi/${id}.mp3`,
    created: '2026-01-01T00:00:00Z',
    type: 'music',
    isVideo: false,
});

type ShimPlaylist = { name: string; entries: string[] };

const makeSubsonicAlbum = (album: typeof NAVIDROME_HOME_ALBUMS[number]) => ({
    id: album.id,
    name: album.name,
    artist: 'Navi Artist',
    artistId: 'navi-ar-1',
    songCount: album.songCount,
    duration: 600,
    created: '2026-01-01T00:00:00Z',
});

const albumsById = (ids: string[]) => ids
    .map(id => NAVIDROME_HOME_ALBUMS.find(album => album.id === id))
    .filter((album): album is typeof NAVIDROME_HOME_ALBUMS[number] => Boolean(album))
    .map(makeSubsonicAlbum);

// 首页概览的列表端点（getAlbumList2 按 type 分三种顺序，分页按 size / offset 切）。
const handleOverview = (endpoint: string, url: URL): Response | null => {
    if (endpoint === 'getAlbumList2') {
        const type = url.searchParams.get('type');
        const size = Number(url.searchParams.get('size') ?? 50);
        const offset = Number(url.searchParams.get('offset') ?? 0);
        const albums = type === 'newest'
            ? albumsById(NAVIDROME_NEWEST_ALBUM_IDS)
            : type === 'recent'
                ? albumsById(NAVIDROME_RECENT_ALBUM_IDS)
                : NAVIDROME_HOME_ALBUMS.map(makeSubsonicAlbum);
        return respond({ albumList2: { album: albums.slice(offset, offset + size) } });
    }
    if (endpoint === 'getArtists') {
        return respond({ artists: { index: [{ name: 'N', artist: NAVIDROME_HOME_ARTISTS.map(artist => ({ ...artist })) }] } });
    }
    if (endpoint === 'getRandomSongs') {
        return respond({ randomSongs: { song: NAVIDROME_RANDOM_SONGS.map((songId, index) => makeSubsonicSong(songId, index, 'Navi Mixed', 'navi-al-2')) } });
    }
    if (endpoint === 'getStarred2') {
        return respond({ starred2: { song: NAVIDROME_STARRED_SONGS.map((songId, index) => makeSubsonicSong(songId, index, 'Navi Mixed', 'navi-al-2')) } });
    }
    return null;
};

/** 歌单 id → 名字与条目（含重复）。安装垫片时重置。 */
let playlists = new Map<string, ShimPlaylist>();
/** 歌手 id → 名字（用例可以在上游改名，制造「请求发出之后上游变了」）。安装垫片时重置。 */
let artistNames = new Map<string, string>();

const artistOfAlbum = (albumId: string): { id: string; name: string } => {
    const artistId = Object.keys(NAVIDROME_ARTIST_ALBUMS).find(candidate => NAVIDROME_ARTIST_ALBUMS[candidate].includes(albumId)) ?? 'navi-ar-1';
    return { id: artistId, name: artistNames.get(artistId) ?? artistId };
};

/** 上游给歌手改名：之后的 getArtist / getAlbum 应答用新名字（已经发出的请求不受影响）。 */
export const renameNavidromeArtist = (artistId: string, name: string): void => {
    artistNames.set(artistId, name);
};

/**
 * 按住某个端点的应答：应答在请求那一刻就按当时的上游数据生成，按住期间排队，放行时可以只放最新的一个
 * （制造「后发的请求先回来、先发的晚到」），或者全部放行。
 */
const heldEndpoints = new Map<string, Array<() => void>>();

export const holdNavidromeEndpoint = (endpoint: string): void => {
    if (!heldEndpoints.has(endpoint)) heldEndpoints.set(endpoint, []);
};

/** 放行：'newest' 只放最后一个排队的应答（仍然按住），'all' 全部放行并解除按住。返回放行的个数。 */
export const releaseNavidromeEndpoint = (endpoint: string, which: 'newest' | 'all' = 'all'): number => {
    const queue = heldEndpoints.get(endpoint);
    if (!queue) return 0;
    if (which === 'newest') {
        const next = queue.pop();
        next?.();
        return next ? 1 : 0;
    }
    heldEndpoints.delete(endpoint);
    queue.forEach(resolve => resolve());
    return queue.length;
};

/** 某个端点此刻排队等放行的应答数。 */
export const heldNavidromeResponses = (endpoint: string): number => heldEndpoints.get(endpoint)?.length ?? 0;

const resetArtists = () => {
    artistNames = new Map(NAVIDROME_HOME_ARTISTS.map(artist => [artist.id, artist.name]));
    [...heldEndpoints.keys()].forEach(endpoint => releaseNavidromeEndpoint(endpoint, 'all'));
};

const resetPlaylists = () => {
    playlists = new Map([
        [NAVIDROME_PLAYLIST_ID, { name: 'Navi Playlist', entries: [...NAVIDROME_PLAYLIST_SONGS] }],
        [NAVIDROME_DUPES_PLAYLIST_ID, { name: 'Navi Duplicates', entries: [...NAVIDROME_DUPES_PLAYLIST_SONGS] }],
    ]);
};

const respond = (body: unknown) => new Response(JSON.stringify({ 'subsonic-response': { status: 'ok', ...body as object } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
});

const coverSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#7c3aed"/></svg>';

// 应答一条 Subsonic 请求；未知端点按空的 ok 应答，和真实服务器的宽松程度一致。
const handle = (url: URL): Response => {
    const endpoint = url.pathname.replace('/rest/', '');
    if (endpoint === 'getCoverArt') {
        return new Response(coverSvg, { status: 200, headers: { 'Content-Type': 'image/svg+xml' } });
    }

    const id = url.searchParams.get('id') ?? url.searchParams.get('playlistId') ?? undefined;
    const removing = url.searchParams.getAll('songIndexToRemove').map(Number);
    recordProbeRequest({
        provider: 'navidrome',
        op: endpoint,
        // 列表端点没有 id：用 getAlbumList2 的 type 当 target，并记下分页参数。
        target: id ?? url.searchParams.get('type') ?? undefined,
        ...(url.searchParams.has('offset') ? { offset: Number(url.searchParams.get('offset')) } : {}),
        ...(url.searchParams.has('size') ? { limit: Number(url.searchParams.get('size')) } : {}),
        ...(removing.length > 0 ? { ids: removing.map(String) } : {}),
        outcome: 'ok',
    });

    const overview = handleOverview(endpoint, url);
    if (overview) return overview;

    if (endpoint === 'getAlbum' && id && NAVIDROME_ALBUM_TRACKS[id]) {
        const album = NAVIDROME_HOME_ALBUMS.find(candidate => candidate.id === id);
        const owner = artistOfAlbum(id);
        const name = album?.name ?? id;
        return respond({
            album: {
                id,
                name,
                artist: owner.name,
                artistId: owner.id,
                songCount: NAVIDROME_ALBUM_TRACKS[id].length,
                duration: 1200,
                created: '2026-01-01T00:00:00Z',
                song: NAVIDROME_ALBUM_TRACKS[id].map((songId, index) => makeSubsonicSong(songId, index, name, id, owner)),
            },
        });
    }
    if (endpoint === 'getArtist' && id && NAVIDROME_ARTIST_ALBUMS[id]) {
        const owner = { id, name: artistNames.get(id) ?? id };
        return respond({
            artist: {
                id,
                name: owner.name,
                albumCount: NAVIDROME_ARTIST_ALBUMS[id].length,
                album: albumsById(NAVIDROME_ARTIST_ALBUMS[id]).map(album => ({
                    ...album,
                    artist: owner.name,
                    artistId: owner.id,
                    // 不带 coverArt：封面 URL 会让 <img> 绕过 fetch 垫片直接上网，探针保持封闭。
                    year: 2020,
                })),
            },
        });
    }
    const playlist = id ? playlists.get(id) : undefined;
    if (endpoint === 'getPlaylist' && id && playlist) {
        return respond({
            playlist: {
                id,
                name: playlist.name,
                owner: 'probe',
                songCount: playlist.entries.length,
                duration: 1000,
                entry: playlist.entries.map((songId, index) => makeSubsonicSong(songId, index, 'Navi Mixed', 'navi-al-2')),
            },
        });
    }
    if (endpoint === 'getPlaylists') {
        return respond({
            playlists: {
                playlist: [...playlists].map(([playlistId, item]) => ({
                    id: playlistId,
                    name: item.name,
                    owner: 'probe',
                    songCount: item.entries.length,
                    duration: 1000,
                })),
            },
        });
    }
    if (endpoint === 'updatePlaylist' && playlist) {
        const removingSet = new Set(removing);
        playlist.entries = playlist.entries.filter((_, index) => !removingSet.has(index));
        playlist.name = url.searchParams.get('name') ?? playlist.name;
    }
    return respond({});
};

/** 安装垫片，返回卸载函数。 */
export const installNavidromeShim = (): (() => void) => {
    resetPlaylists();
    resetArtists();
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
        const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        if (raw.startsWith(`${NAVIDROME_PROBE_SERVER}/rest/`)) {
            const url = new URL(raw);
            const response = handle(url);
            const queue = heldEndpoints.get(url.pathname.replace('/rest/', ''));
            if (queue) await new Promise<void>(resolve => queue.push(resolve));
            return response;
        }
        return originalFetch(input, init);
    };
    return () => {
        window.fetch = originalFetch;
    };
};
