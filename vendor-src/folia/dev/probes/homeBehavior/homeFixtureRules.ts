// dev/probes/homeBehavior/homeFixtureRules.ts
// 首页探针的本地曲库规则。和 libraryBehavior/fixtureRules 一样刻意不 import 任何东西：探针拿它写种子，
// component 用例拿它算期望值。在线与 Navidrome 的首页数据规则放在共用的 libraryBehavior/fixtureRules 里
// （假 provider 与 Navidrome 垫片是两个探针共用的）。
//
// 文件夹刻意做成嵌套的：批量删除的路径规则（只选父文件夹时只删歌、父子都选时删整个文件夹、All Songs 跳过）
// 只有在有子文件夹时才分得出来。

export type HomeLocalSongRule = {
    index: number;
    folder: string;
    album: string;
    artist: string;
};

/** 八首本地歌：两个导入根（Music、Extra），Music 下有嵌套的 Alpha/Live。 */
export const HOME_LOCAL_SONGS: readonly HomeLocalSongRule[] = [
    { index: 1, folder: 'Music/Alpha', album: 'Alpha Album', artist: 'Local Artist' },
    { index: 2, folder: 'Music/Alpha', album: 'Alpha Album', artist: 'Local Artist' },
    { index: 3, folder: 'Music/Alpha', album: 'Alpha Album', artist: 'Local Artist' },
    { index: 4, folder: 'Music/Alpha/Live', album: 'Alpha Album', artist: 'Local Artist' },
    { index: 5, folder: 'Music/Alpha/Live', album: 'Beta Album', artist: 'Local Artist' },
    { index: 6, folder: 'Music/Beta', album: 'Beta Album', artist: 'Other Artist' },
    { index: 7, folder: 'Music/Beta', album: 'Beta Album', artist: 'Other Artist' },
    { index: 8, folder: 'Extra', album: 'Beta Album', artist: 'Other Artist' },
];

export const homeLocalSongId = (index: number): string => `home-local-${index}`;
export const homeLocalSongIds = (indexes: readonly number[]): string[] => indexes.map(homeLocalSongId);
export const homeLocalSongsIn = (folder: string): number[] => (
    HOME_LOCAL_SONGS.filter(song => song.folder === folder).map(song => song.index)
);

/** 已导入的根目录（目录树的根节点）与被忽略的子目录（目录树里能「恢复并重扫」）。 */
export const HOME_LOCAL_ROOTS = ['Extra', 'Music'] as const;
export const HOME_LOCAL_IGNORED_FOLDER = 'Music/Hidden';

/** 本地自建歌单（可隐藏，作用域 local）。 */
export const HOME_LOCAL_PLAYLIST = { name: 'Home Mix', songs: [2, 6, 8] } as const;

export const HOME_ALL_SONGS_ID = 'folder-__all-songs__';
export const homeFolderId = (folder: string): string => `folder-${folder}`;
/** 文件夹页签的卡片顺序：虚拟的 All Songs 在最前，其余按名字排序。 */
export const HOME_LOCAL_FOLDER_IDS = [
    HOME_ALL_SONGS_ID,
    homeFolderId('Extra'),
    homeFolderId('Music/Alpha'),
    homeFolderId('Music/Alpha/Live'),
    homeFolderId('Music/Beta'),
];

/** 文件夹导入的替身写进曲库的那首歌（导入后出现一个新文件夹）。 */
export const HOME_IMPORTED_SONG: HomeLocalSongRule = { index: 9, folder: 'Imported', album: 'Imported Album', artist: 'Imported Artist' };
