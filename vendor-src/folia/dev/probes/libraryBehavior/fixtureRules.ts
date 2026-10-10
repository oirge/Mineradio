// dev/probes/libraryBehavior/fixtureRules.ts
// 行为探针的数据规则。刻意不 import 任何东西：探针拿它生成 fixture，component 用例拿它算期望值，
// 两边用的是同一条规则，而不是各自抄一份数字。

export const PROBE_PROVIDER_A = 'probe-a';
export const PROBE_PROVIDER_B = 'probe-b';
export const PROBE_WORDS = ['Amber', 'Birch', 'Cedar', 'Dune', 'Ember'] as const;
export const PROBE_TRACKS_UPDATED_AT = 1710000000000;

export const range = (count: number, start = 0): number[] => (
    Array.from({ length: count }, (_, index) => start + index)
);

export const onlineSongName = (index: number): string => `Track ${index} ${PROBE_WORDS[index % PROBE_WORDS.length]}`;
export const isProbeUnavailable = (index: number): boolean => index % 50 === 25;
export const hasGuestArtist = (index: number): boolean => index % 7 === 0;
export const hasSecondAlbum = (index: number): boolean => index % 10 === 0;
export const hasAlias = (index: number): boolean => index % 9 === 0;
export const hasTranslatedName = (index: number): boolean => index % 11 === 0;

export const PROBE_ALIAS = 'Alias Kite';
export const PROBE_TRANSLATED_NAME = '译名';

/** 歌单里重复条目的位置：key 是上游原始位置，value 是那里实际放的歌。 */
export const DUPE_POSITIONS: Readonly<Record<number, number>> = { 20: 5, 40: 6, 160: 10, 200: 170 };

/** online-owned-dupes 里第一首歌再次出现的原始位置（在第一页之后）。 */
export const OWNED_DUPE_POSITION = 160;

/** online-owned-twice 里第二首歌（序号 1）再次出现的原始位置（在第一页里）。 */
export const OWNED_TWICE_POSITION = 6;

export type OnlineFixtureId =
    | 'online-big'
    | 'online-dupes'
    | 'online-flaky'
    | 'online-broken'
    | 'online-slow'
    | 'online-private'
    | 'online-empty'
    | 'online-owned'
    | 'online-owned-dupes'
    | 'online-owned-twice'
    | 'online-public'
    | 'online-daily'
    | 'collide-a'
    | 'collide-b';

export type LocalFixtureId = 'local-all' | 'local-folder' | 'local-playlist' | 'local-album';
export type NavidromeFixtureId = 'navi-album' | 'navi-playlist' | 'navi-playlist-dupes';
export type ProbeFixtureId = OnlineFixtureId | LocalFixtureId | NavidromeFixtureId;

export type OnlineFixtureRule = {
    providerId: string;
    collectionId: string;
    type: 'playlist' | 'daily_recommendations';
    name: string;
    /** 歌曲 id 前缀；歌曲 id = `${prefix}-${index}`。 */
    prefix: string;
    /** 上游原始顺序（含重复）。 */
    rawIndexes: number[];
    isOwned?: boolean;
};

export const ONLINE_FIXTURES: Readonly<Record<OnlineFixtureId, OnlineFixtureRule>> = {
    'online-big': { providerId: PROBE_PROVIDER_A, collectionId: 'big', type: 'playlist', name: 'Big Playlist', prefix: 'big', rawIndexes: range(350) },
    'online-dupes': {
        providerId: PROBE_PROVIDER_A,
        collectionId: 'dupes',
        type: 'playlist',
        name: 'Duplicate Entries',
        prefix: 'dupes',
        rawIndexes: range(220).map(position => DUPE_POSITIONS[position] ?? position),
    },
    'online-flaky': { providerId: PROBE_PROVIDER_A, collectionId: 'flaky', type: 'playlist', name: 'Flaky Paging', prefix: 'flaky', rawIndexes: range(400) },
    'online-broken': { providerId: PROBE_PROVIDER_A, collectionId: 'broken', type: 'playlist', name: 'Broken Paging', prefix: 'broken', rawIndexes: range(400) },
    'online-slow': { providerId: PROBE_PROVIDER_A, collectionId: 'slow', type: 'playlist', name: 'Slow First Page', prefix: 'slow', rawIndexes: range(3000) },
    'online-private': { providerId: PROBE_PROVIDER_A, collectionId: 'private', type: 'playlist', name: 'Private Playlist', prefix: 'private', rawIndexes: range(5) },
    'online-empty': { providerId: PROBE_PROVIDER_A, collectionId: 'empty', type: 'playlist', name: 'Empty Playlist', prefix: 'empty', rawIndexes: [] },
    'online-owned': { providerId: PROBE_PROVIDER_A, collectionId: 'owned', type: 'playlist', name: 'Owned Playlist', prefix: 'owned', rawIndexes: range(12), isOwned: true },
    // 自己的歌单，第一首在后台分页里（原始位置 160）又出现一次：删掉它之后晚到的那一页不能把它带回来。
    'online-owned-dupes': {
        providerId: PROBE_PROVIDER_A,
        collectionId: 'owned-dupes',
        type: 'playlist',
        name: 'Owned Duplicates',
        prefix: 'odupes',
        rawIndexes: range(220).map(position => (position === OWNED_DUPE_POSITION ? 0 : position)),
        isOwned: true,
    },
    // 自己的歌单，第二首在第一页里（原始位置 6）又出现一次：首页不去重，两个条目都在界面上。
    // 删其中一个，上游按歌删，两个都没了。
    'online-owned-twice': {
        providerId: PROBE_PROVIDER_A,
        collectionId: 'owned-twice',
        type: 'playlist',
        name: 'Owned Twice',
        prefix: 'otwice',
        rawIndexes: range(12).map(position => (position === OWNED_TWICE_POSITION ? 1 : position)),
        isOwned: true,
    },
    'online-public': { providerId: PROBE_PROVIDER_A, collectionId: 'public', type: 'playlist', name: 'Public Playlist', prefix: 'public', rawIndexes: range(30) },
    'online-daily': { providerId: PROBE_PROVIDER_A, collectionId: 'daily_recommendations', type: 'daily_recommendations', name: 'Daily Picks', prefix: 'daily', rawIndexes: range(10) },
    'collide-a': { providerId: PROBE_PROVIDER_A, collectionId: 'same', type: 'playlist', name: 'Same Id (A)', prefix: 'ca', rawIndexes: range(5) },
    'collide-b': { providerId: PROBE_PROVIDER_B, collectionId: 'same', type: 'playlist', name: 'Same Id (B)', prefix: 'cb', rawIndexes: range(5) },
};

/** 曲目卡片上「专辑」链接指向的在线专辑。 */
export const PROBE_ALBUM = { id: 'al-1', name: 'Probe Album', prefix: 'alb', rawIndexes: range(10) } as const;
export const PROBE_SECOND_ALBUM = { id: 'al-2', name: 'Second Album' } as const;
export const PROBE_FIRST_PAGE = 150;
export const PROBE_BACKGROUND_PAGE = 1000;

export const onlineSongId = (prefix: string, index: number): string => `${prefix}-${index}`;
export const onlinePlaybackKey = (providerId: string, songId: string): string => `online:${providerId}:${songId}`;

/** 与 GridView 筛选实际生效的那几项一致：歌名、别名、译名、歌手（两种拼法）、专辑名。 */
export const onlineSearchText = (index: number): string => {
    const artists = ['Probe Artist', ...(hasGuestArtist(index) ? ['Guest Singer'] : [])];
    const searchText = [
        onlineSongName(index),
        hasAlias(index) ? PROBE_ALIAS : undefined,
        hasTranslatedName(index) ? PROBE_TRANSLATED_NAME : undefined,
    ].filter(Boolean).join(' ');
    return [
        searchText,
        artists.join(', '),
        hasSecondAlbum(index) ? PROBE_SECOND_ALBUM.name : PROBE_ALBUM.name,
        artists.join(' '),
    ].join(' ').toLowerCase();
};

/**
 * 当前代码加载完一个在线集合后的曲目顺序：首页原样保留（页内重复不去重），后续页按
 * playback key 去重追加。这是现状语义的记录，不是「应该如此」。
 */
export const expectedLoadedIndexes = (rawIndexes: number[], firstPage = PROBE_FIRST_PAGE): number[] => {
    const first = rawIndexes.slice(0, firstPage);
    const seen = new Set(first);
    const result = [...first];
    rawIndexes.slice(firstPage).forEach(index => {
        if (seen.has(index)) return;
        seen.add(index);
        result.push(index);
    });
    return result;
};

/** 期望的可播放顺序（筛选可选）。 */
export const expectedPlayableIndexes = (loadedIndexes: number[], query = ''): number[] => {
    const needle = query.trim().toLowerCase();
    return loadedIndexes.filter(index => (
        !isProbeUnavailable(index)
        && (!needle || onlineSearchText(index).includes(needle))
    ));
};

// ---- 本地 ----

export const LOCAL_SONG_COUNT = 8;
export const LOCAL_BASE_TIME = 1700000000000;
export const LOCAL_PLAYLIST_NAME = 'Probe Local Playlist';
/** 本地歌单里放的歌（按顺序）。 */
export const LOCAL_PLAYLIST_SONGS = [1, 2, 3, 4, 5, 6];

export const localSongId = (index: number): string => `probe-local-${index}`;
export const localSongTitle = (index: number): string => `Local ${PROBE_WORDS[index % PROBE_WORDS.length]} ${index}`;
export const localFolderName = (index: number): string => (index <= 5 ? 'Folder A' : 'Folder B');
export const localAlbumName = (index: number): string => (index <= 4 ? 'Alpha Album' : 'Beta Album');
/** 每张专辑内倒序编号：album-track 排序与文件名排序一定不同。 */
export const localTrackNumber = (index: number): number => (index <= 4 ? 5 - index : 9 - index);
/** 修改时间倒序：按修改时间排序与文件名排序一定不同。 */
export const localLastModified = (index: number): number => LOCAL_BASE_TIME + (LOCAL_SONG_COUNT + 1 - index) * 1000;

/** 四种排序在 All Songs 里的期望顺序（歌曲序号）。 */
export const LOCAL_SORT_ORDERS = {
    fileNameAsc: [1, 2, 3, 4, 5, 6, 7, 8],
    modifiedAsc: [8, 7, 6, 5, 4, 3, 2, 1],
    modifiedDesc: [1, 2, 3, 4, 5, 6, 7, 8],
    albumTrackDesc: [5, 6, 7, 8, 1, 2, 3, 4],
    albumTrackAsc: [4, 3, 2, 1, 8, 7, 6, 5],
} as const;

// ---- Navidrome ----

export const NAVIDROME_PROBE_SERVER = 'http://navidrome.probe';
export const NAVIDROME_ALBUM_ID = 'navi-al-1';
export const NAVIDROME_PLAYLIST_ID = 'navi-pl-1';
export const NAVIDROME_ALBUM_SONGS = range(6, 1).map(index => `navi-song-${index}`);
export const NAVIDROME_PLAYLIST_SONGS = range(5, 11).map(index => `navi-song-${index}`);
/** 含重复条目的 Navidrome 歌单：navi-song-21 出现两次（原始下标 0 与 2）。 */
export const NAVIDROME_DUPES_PLAYLIST_ID = 'navi-pl-2';
export const NAVIDROME_DUPES_PLAYLIST_SONGS = ['navi-song-21', 'navi-song-22', 'navi-song-21', 'navi-song-23'];

// ---- 首页（homeBehavior 探针）的在线数据 ----
// 两个假 provider 在首页上各有一个已登录账户：歌单列表、云盘、收藏专辑（分页）、电台 feed（私人 FM、每日推荐、
// 推荐歌单）。集合详情探针不注册这些接口（它的 provider 走 'collection' 档），这里的规则只给首页用。

export const homeUserId = (providerId: string): string => `${providerId}-user`;
export const homeUserName = (providerId: string): string => `User ${providerId}`;

/** 首页歌单页签里每个 provider 的歌单（按上游顺序，云盘由账户 store 放到第二位）。 */
export const HOME_PLAYLIST_FIXTURES: Readonly<Record<string, OnlineFixtureId[]>> = {
    [PROBE_PROVIDER_A]: ['online-public', 'online-owned', 'online-big', 'collide-a'],
    [PROBE_PROVIDER_B]: ['collide-b'],
};

/** 只有 probe-a 有云盘。 */
export const HOME_CLOUD = { providerId: PROBE_PROVIDER_A, id: 'cloud', name: 'Probe Cloud', prefix: 'cloud', count: 4 } as const;

/** 收藏专辑：probe-a 有 120 张（omni 每页 50，要翻三页），probe-b 有 7 张。 */
export const HOME_FAVORITE_ALBUM_COUNTS: Readonly<Record<string, number>> = {
    [PROBE_PROVIDER_A]: 120,
    [PROBE_PROVIDER_B]: 7,
};
export const HOME_ALBUM_PAGE_SIZE = 50;
export const homeFavoriteAlbumId = (providerId: string, index: number): string => `fav-${providerId}-${index}`;
export const homeFavoriteAlbumName = (providerId: string, index: number): string => `Favorite ${providerId} ${index}`;
export const homeFavoriteAlbumIds = (providerId: string): string[] => (
    range(HOME_FAVORITE_ALBUM_COUNTS[providerId] ?? 0).map(index => homeFavoriteAlbumId(providerId, index))
);

/** 电台页签：推荐歌单与私人 FM 的歌。 */
export const HOME_RECOMMENDED_COUNTS: Readonly<Record<string, number>> = {
    [PROBE_PROVIDER_A]: 3,
    [PROBE_PROVIDER_B]: 2,
};
export const homeRecommendedId = (providerId: string, index: number): string => `rec-${providerId}-${index}`;
export const homeRecommendedName = (providerId: string, index: number): string => `Recommended ${providerId} ${index}`;
export const HOME_FM_PREFIX = 'fm';
export const HOME_FM_COUNT = 3;

// ---- 首页（homeBehavior 探针）的 Navidrome 概览数据 ----

/** 专辑列表（字母序即这个顺序）；第一张就是集合详情探针用的 navi-al-1。 */
export const NAVIDROME_HOME_ALBUMS = [
    { id: NAVIDROME_ALBUM_ID, name: 'Navi Album', songCount: NAVIDROME_ALBUM_SONGS.length },
    { id: 'navi-al-3', name: 'Navi Beta Album', songCount: 4 },
    { id: 'navi-al-4', name: 'Navi Gamma Album', songCount: 2 },
] as const;
/** 「最近添加」与「最近播放」各自的服务器顺序。 */
export const NAVIDROME_NEWEST_ALBUM_IDS = ['navi-al-4', 'navi-al-3'];
export const NAVIDROME_RECENT_ALBUM_IDS = ['navi-al-3'];
export const NAVIDROME_HOME_ARTISTS = [
    { id: 'navi-ar-1', name: 'Navi Artist', albumCount: 2 },
    { id: 'navi-ar-2', name: 'Navi Second Artist', albumCount: 1 },
] as const;
export const NAVIDROME_RANDOM_SONGS = ['navi-song-31', 'navi-song-32', 'navi-song-33'];
export const NAVIDROME_STARRED_SONGS = ['navi-song-41', 'navi-song-42'];

// ---- 歌手页（P4.0 起；artistBehavior 用例） ----
// 在线歌手走 omni 的 getArtistDetail / getArtistSongs / getArtistAlbums（假 provider 的 catalog 上同名接口），
// Navidrome 歌手走垫片的 getArtist / getAlbum，本地歌手就是本地 fixture 里的「Local Artist」实体。

export type OnlineArtistFixtureId = 'artist-main' | 'artist-guest';
export type ArtistFixtureId = OnlineArtistFixtureId | 'navi-artist' | 'navi-artist-2' | 'local-artist';

export type OnlineArtistRule = {
    providerId: string;
    artistId: string;
    name: string;
    description: string;
    /** data: URL：封面不出网（<img> 不经过任何垫片）。 */
    coverUrl: string;
    /** 热门歌曲：id = `${topSongPrefix}-${index}`，与 makeOnlineSong 同一条规则（index % 50 === 25 不可播放）。 */
    topSongPrefix: string;
    topSongIndexes: number[];
    /** 专辑：id = `${albumPrefix}-${index}`，名字见 artistAlbumName。 */
    albumPrefix: string;
    albumCount: number;
};

const probeArtistCover = (fill: string): string => (
    `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="${fill}"/></svg>`)}`
);

/** omni 拉歌手专辑的页大小（ArtistGridView 写死 50）。 */
export const ARTIST_ALBUM_PAGE_SIZE = 50;
/** omni 拉热门歌曲的条数（ArtistGridView 写死 10）。 */
export const ARTIST_TOP_SONG_LIMIT = 10;

export const ONLINE_ARTISTS: Readonly<Record<OnlineArtistFixtureId, OnlineArtistRule>> = {
    // 主歌手：10 首热门（20..29，其中 25 不可播放；21、28 带客座歌手 ar-2），130 张专辑 = 三页（0 / 50 / 100）。
    'artist-main': {
        providerId: PROBE_PROVIDER_A,
        artistId: 'ar-1',
        name: 'Probe Artist',
        description: 'Probe Artist biography.',
        coverUrl: probeArtistCover('#7c3aed'),
        topSongPrefix: 'artop',
        topSongIndexes: range(10, 20),
        albumPrefix: 'ar1-al',
        albumCount: 130,
    },
    // 客座歌手（曲目卡片上的歌手链接指向它）：3 首热门、4 张专辑（一页）。
    'artist-guest': {
        providerId: PROBE_PROVIDER_A,
        artistId: 'ar-2',
        name: 'Guest Singer',
        description: 'Guest Singer biography.',
        coverUrl: probeArtistCover('#0891b2'),
        topSongPrefix: 'gtop',
        topSongIndexes: range(3),
        albumPrefix: 'ar2-al',
        albumCount: 4,
    },
};

export const artistAlbumId = (prefix: string, index: number): string => `${prefix}-${index}`;
export const artistAlbumName = (index: number): string => `Artist Album ${index} ${PROBE_WORDS[index % PROBE_WORDS.length]}`;
export const artistAlbumIds = (rule: OnlineArtistRule): string[] => (
    range(rule.albumCount).map(index => artistAlbumId(rule.albumPrefix, index))
);
/** 按专辑名筛选（ArtistGridView 只筛专辑名，大小写不敏感）之后剩下的专辑 id。 */
export const artistAlbumIdsMatching = (rule: OnlineArtistRule, query: string): string[] => {
    const needle = query.trim().toLowerCase();
    return range(rule.albumCount)
        .filter(index => artistAlbumName(index).toLowerCase().includes(needle))
        .map(index => artistAlbumId(rule.albumPrefix, index));
};
/** 歌手页在请求账里的 target（详情、热门歌曲、专辑三种请求共用）。 */
export const onlineArtistTarget = (rule: OnlineArtistRule): string => `${rule.providerId}:artist:${rule.artistId}`;

/** Navidrome 歌手 → 专辑（服务器顺序）；专辑 → 曲目。歌手页取前 5 张专辑的曲目，前 10 首当热门歌曲。 */
export const NAVIDROME_ARTIST_ALBUMS: Readonly<Record<string, string[]>> = {
    'navi-ar-1': [NAVIDROME_ALBUM_ID, 'navi-al-3'],
    'navi-ar-2': ['navi-al-4'],
};
export const NAVIDROME_ALBUM_TRACKS: Readonly<Record<string, string[]>> = {
    [NAVIDROME_ALBUM_ID]: NAVIDROME_ALBUM_SONGS,
    'navi-al-3': range(4, 51).map(index => `navi-song-${index}`),
    'navi-al-4': range(2, 61).map(index => `navi-song-${index}`),
};
/** 本地歌手：本地 fixture 的每首歌都是这个歌手，分在两张专辑里。 */
export const LOCAL_ARTIST_NAME = 'Local Artist';
export const LOCAL_ALBUM_NAMES = ['Alpha Album', 'Beta Album'] as const;
