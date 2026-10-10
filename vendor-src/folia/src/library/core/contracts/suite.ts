import type { LocalSong, SongResult, StatusMessage, Theme } from '../../../types';
import type { MediaId } from '../../../types/onlineMusic';
import type { LibraryAccountActionId, LibraryAccountController, LibraryAccountSurfaceProps } from './account';
import type { LibraryArtistResource } from './artist';
import type { CollectionNavigationOrigin, LibraryCollectionDescriptor } from './collection';
import type { LibraryDirectoryBatchController } from './directory';
import type { LibraryHomeData } from './home';
import type { LibraryHomeResources } from './homeModel';
import type { CollectionMutationController } from './mutations';
import type { LibraryPlaybackPort } from './ports';
import type { CollectionResource } from './resource';
import type { LibrarySuiteChromeActionMeta } from './suiteChrome';

// src/library/core/contracts/suite.ts
// UI suite 的能力契约：core 定义有哪些 surface、每个 surface 上有哪些动作、宿主交给任何一套 suite 的输入；
// suite 在自己的 entry.ts 里声明「我实现了哪些 surface、哪些动作」。没实现的 surface 由默认 suite（grid）渲染，
// 没声明的动作不出现在那套 UI 和命令面板里（core 判定「这个集合此刻能不能做」，suite 声明「我的 UI 做不做」，
// 两者取交集）。发现与解析在 src/library/registry.ts，纯规则在 core/model/librarySuites。
// 这里只有类型；对 React 组件只用一个结构化的最小类型（契约不 import react）。

/**
 * 目录 / GridMap 属于 home；以后有 search 再加。account（A5）是登录弹窗与切换确认框：它不是一页，叠在首页之上，
 * 由首页外壳里的账户宿主按当前 suite 解析（契约见 ./account）。
 */
export type LibrarySurfaceId = 'home' | 'collection' | 'artist' | 'account';

/**
 * suite 的标识，由 registry 从 `suites/<id>/entry.ts` 发现（开发版才有 tui）。用字符串而不是写死的联合：
 * 合法的 id 只有 registry 知道，state 层不 import registry。
 */
export type LibrarySuiteId = string;

/**
 * 集合 surface 的语义动作（home / directory 的动作 P3 再补）。与其它清单的对应：
 *
 * | LibraryActionId | core 能力来源 | 命令面板（GridSurfaceActionId） |
 * | --- | --- | --- |
 * | play / enqueue | 条目本身可播放 | —（卡片 / 行上的动作） |
 * | play-scope / enqueue-scope | useCollectionActions 的 scope | play-filtered / enqueue-filtered |
 * | filter | 浏览会话（总是可用） | —（命令面板的筛选框） |
 * | sort | 本地文件夹才排序 | sort-file-name / sort-modified-date / sort-album-track / sort-toggle-direction |
 * | reload | useCollectionActions 的 reload | reload-online-collection |
 * | resume-sync | 资源的 sync 中断 | — |
 * | remove-entry | CollectionMutationCapabilities.removeEntry | — |
 * | subscribe | .subscribe | toggle-subscribe |
 * | rename | .rename | — |
 * | delete-collection | .deleteCollection | — |
 * | resync-folder | .resyncFolder | resync-folder |
 * | resync-all-folders | .resyncAllFolders | resync-all-folders |
 * | export-playlist | .exportPlaylist | export-playlist |
 * | edit-entity | .editEntity | edit-entity |
 * | organize-song-info | .organizeSongInfo | organize-song-info |
 * | match-song | .matchSong | — |
 * | add-to-playlist | .addToPlaylist | — |
 * | create-playlist | .createPlaylist | — |
 * | daily-date | .dailyDate | — |
 * | open-album / open-artist | 曲目上的专辑 / 歌手能解析出目录引用（core/model/trackLinks：resolveTrackAlbumLink / resolveTrackArtistLinks） | —（卡片 / 行上的链接，交给宿主的 onOpenAlbum / onOpenArtist） |
 *
 * CollectionMutationCapabilities.editCollection 不是动作：编辑模式属于 renderer，网格把它声明成自己的
 * 局部动作 `toggle-edit-mode`（同名命令）。映射的代码版本在 core/model/librarySuites 与 collectionSurface。
 */
export type LibraryActionId =
    | 'play'
    | 'enqueue'
    | 'play-scope'
    | 'enqueue-scope'
    | 'filter'
    | 'sort'
    | 'reload'
    | 'resume-sync'
    | 'remove-entry'
    | 'subscribe'
    | 'rename'
    | 'delete-collection'
    | 'resync-folder'
    | 'resync-all-folders'
    | 'export-playlist'
    | 'edit-entity'
    | 'organize-song-info'
    | 'match-song'
    | 'add-to-playlist'
    | 'create-playlist'
    | 'daily-date'
    | 'open-album'
    | 'open-artist';

/**
 * 首页 surface 的语义动作（P3.4 补上；suite 在 entry 的 home 声明里列出自己实现了哪些）。目录（GridMap / TUI 的
 * 目录列表）是首页的一部分，目录命令面板的动作与它们一一对应（core/model/directorySurface 的
 * DIRECTORY_SURFACE_ACTION_SOURCES）；首页列表右上角的动作（导入、刷新）对应 home-* 这几个。
 *
 * | LibraryHomeActionId | 目录 surface 动作 / 首页列表动作 |
 * | --- | --- |
 * | directory-filter | —（命令面板的筛选框，目录会话的 query） |
 * | directory-select | select-all、clear-selection（以及 suite 自己的选择入口） |
 * | directory-play-selection / directory-enqueue-selection | play-selection / enqueue-selection |
 * | directory-create-playlist | create-playlist |
 * | directory-remove-selection | remove-selection |
 * | directory-rescan-root / directory-remove-root / directory-clear-ignore | rescan-root / remove-root / clear-ignore |
 * | directory-manage-hidden / directory-toggle-hidden | manage-hidden / toggle-hidden |
 * | home-import-folder / home-refresh-folders / home-import-playlist | 本地列表的 import-folder / refresh-folders / import-playlist |
 * | home-refresh-navidrome | Navidrome 列表的 refresh |
 */
export type LibraryHomeActionId =
    | 'directory-filter'
    | 'directory-select'
    | 'directory-play-selection'
    | 'directory-enqueue-selection'
    | 'directory-create-playlist'
    | 'directory-remove-selection'
    | 'directory-rescan-root'
    | 'directory-remove-root'
    | 'directory-clear-ignore'
    | 'directory-manage-hidden'
    | 'directory-toggle-hidden'
    | 'home-import-folder'
    | 'home-refresh-folders'
    | 'home-import-playlist'
    | 'home-refresh-navidrome';

/**
 * 歌手页 surface 的语义动作（P4.2）。能力由 core/model/artistSurface 从歌手资源的快照判定（纯规则），
 * suite 在 entry 的 artist 声明里列出自己实现了哪些，两者取交集才出现在那套 UI 与命令面板里。
 *
 * | LibraryArtistActionId | core 能力 | 命令面板（LibraryArtistSurfaceActionId） |
 * | --- | --- | --- |
 * | play / enqueue | 有可播放的热门歌曲（单曲，卡片 / 行上的动作） | — |
 * | play-scope | 可播放的热门歌曲 > 0（以它们为队列从第一首播） | play-top-songs |
 * | enqueue-scope | 可入队的热门歌曲 > 0（静默整批入队，歌手页报实际收下的条数） | enqueue-top-songs |
 * | filter | 总是可用（浏览会话的 query，只筛专辑名） | —（命令面板的筛选框） |
 * | reload | 在线 / Navidrome 歌手（或任何加载失败的歌手）不在加载中 | reload |
 * | resume-sync | 专辑分页失败中断 | retry-albums |
 * | edit-entity | 本地歌手且描述带实体 id | edit-entity |
 * | open-album / open-artist | 有专辑 / 有热门歌曲（专辑卡、歌曲上的歌手 / 专辑链接） | — |
 */
export type LibraryArtistActionId =
    | 'play'
    | 'enqueue'
    | 'play-scope'
    | 'enqueue-scope'
    | 'filter'
    | 'reload'
    | 'resume-sync'
    | 'edit-entity'
    | 'open-album'
    | 'open-artist';

/**
 * 某个 surface 上实际渲染它的那套 suite 声明的动作：core 动作与 suite 自己的局部动作
 * （网格的 toggle-info-panel、toggle-track-list、toggle-edit-mode……）。宿主按 registry 解析后传给 surface，
 * surface 向命令面板发布时只发布这里有的（再与 core 能力取交集）。
 */
export type LibraryDeclaredActions = {
    /**
     * 集合 surface 是 LibraryActionId，首页 surface 是 LibraryHomeActionId，歌手 surface 是 LibraryArtistActionId，
     * 账户 surface 是 LibraryAccountActionId（它的 props 里收窄成 LibraryAccountDeclaredActions）。
     */
    readonly actions: readonly (LibraryActionId | LibraryHomeActionId | LibraryArtistActionId | LibraryAccountActionId)[];
    readonly extraActions: readonly string[];
};

/**
 * 最小的组件类型：能被当成 `(props) => 节点` 调用即可。React 的函数组件、memo / lazy 组件都满足它；
 * registry 把它还原成 React 组件类型再交给宿主渲染。
 */
export type LibrarySurfaceComponent<Props> = (props: Props) => unknown;

/**
 * 集合层的导航动作：宿主实现（压栈、返回、解析目录引用）。
 *
 * 返回分两种，同一个手势在每套 suite 里含义相同（P4.5，由宿主执行，suite 只按手势选一个调用）：
 * - onDone：显式的返回按钮 = 看完了。宿主清掉这一层的浏览会话（筛选、焦点），并让每套 suite 忘掉这一层的布局记录
 *   （manifest 的 layout.forget），然后返回；下次打开从头开始。
 * - onBack：离开但保留（Escape 阶梯的最后一步、删掉集合之后、宿主自己的自动返回）。浏览器后退同样保留，
 *   它不经过 suite，由宿主在 popstate 弹栈前跑 suite 的 beforeBack。
 */
export type LibraryCollectionNavigation = {
    onBack: () => void;
    onDone: () => void;
    /** album 是界面上已有的专辑摘要（名字、封面、目录引用），track 是触发它的那首歌（在线集合按它解析目录）。 */
    onOpenAlbum: (albumId: number | string, album?: LibraryCatalogLinkHint, track?: SongResult) => void;
    onOpenArtist: (artistId: number | string, artist?: LibraryCatalogLinkHint, track?: SongResult) => void;
    /**
     * 跳到导航栈的第 depth 层（面包屑点击）：depth 是保留的层数，与 LibraryNavigationContext.depth 同一种量，
     * 0 表示整个关掉；不比当前浅时什么都不做；栈里有重复的集合时按位置算。宿主经浏览器历史退回（与浏览器后退同路），
     * beforeBack 由宿主在弹栈前跑一次，suite 不要自己再跑。打开的专辑 / 歌手（onOpenAlbum / onOpenArtist）正好是上一层时
     * 同样是一次返回（N1 折叠紧邻往返），更早的层照常压栈。
     */
    onPopTo?: (depth: number) => void;
};

/** 打开专辑 / 歌手时界面上已有的摘要；在线集合的条目原样带着 provider 的字段。 */
export type LibraryCatalogLinkHint = {
    readonly name?: string;
    readonly coverUrl?: string;
    readonly catalogRef?: unknown;
    readonly [field: string]: unknown;
};

/** 每个 surface 都有的输入。 */
export type LibrarySurfaceBaseProps = {
    /** 只有用户正看着的那一层可交互（键盘、命令面板注册）。 */
    isInteractive: boolean;
    declaredActions: LibraryDeclaredActions;
};

/**
 * 集合 surface：宿主持有资源与变更控制器（切换 suite 不重新请求），suite 只订阅。
 * 网格专属的输入（移形换影的计划等）不在这里，网格从自己的转场 store 读。
 */
export type LibraryCollectionSurfaceProps = LibrarySurfaceBaseProps & LibraryCollectionNavigation & {
    collection: LibraryCollectionDescriptor;
    resource: CollectionResource | null;
    playback: LibraryPlaybackPort;
    /** 变更动作控制器；宿主创建、不订阅。suite 经它删歌、订阅、改名……（网格与 TUI 订阅同一个实例）。 */
    mutations: CollectionMutationController | null;
    localSongs: LocalSong[];
    theme: Theme;
    isDaylight: boolean;
    onStatusMessage?: (message: StatusMessage) => void;
    currentUserId?: MediaId | null;
};

/**
 * 歌手页 surface：宿主按 collectionKey 持有歌手资源（P4.1 起；详情、热门歌曲、专辑与专辑分页都在资源里，
 * 本地歌手由宿主的 catalog 派生），suite 只订阅。播放仍走播放端口。筛选词与「看到哪一项」在浏览会话里
 * （键是 resource.key，即导航栈那一层的 collectionKey），换 suite 不丢（P4.2）。
 */
export type LibraryArtistSurfaceProps = LibrarySurfaceBaseProps & LibraryCollectionNavigation & {
    collection: LibraryCollectionDescriptor;
    /** 歌手资源；宿主创建、不订阅（换 suite 不重新请求）。 */
    resource: LibraryArtistResource | null;
    playback: LibraryPlaybackPort;
    theme: Theme;
    isDaylight: boolean;
    /** 本地歌手实体的编辑对话框（宿主挂载）。 */
    onEditEntity: (entityId: string) => void;
};

/** 首页 surface：首页模型的数据，加上打开集合的入口。 */
export type LibraryHomeSurfaceProps = LibrarySurfaceBaseProps & LibraryHomeData & {
    /**
     * 在线账户 controller（宿主创建、寿命与应用相同；见 library/app/useLibraryAccountController）：provider 列表与
     * 当前平台来自它的快照，选平台、登出调它的动作。suite 只订阅，不创建、不 dispose。
     */
    account: LibraryAccountController;
    /**
     * 账户界面（登录弹窗）的挂载点：surface 可以把它接到自己层叠上下文里的一个元素上（ref 回调，身份不变），
     * 宿主把登录弹窗 portal 进去；不接时宿主在首页外壳层渲染。网格把它放在平台切换器之前，切换器仍盖在弹窗之上。
     */
    accountLayerRef?: (element: HTMLElement | null) => void;
    onOpenGridView: (collection: LibraryCollectionDescriptor) => void;
    /** 本地目录的批量动作控制器（宿主装配端口后创建，见 library/app/useLibraryDirectoryBatchController）。 */
    directoryActions?: LibraryDirectoryBatchController;
    /** 首页的资源与控制器（宿主创建，见 library/app/useLibraryHomeResources）；suite 只订阅。 */
    homeResources: LibraryHomeResources;
};

export type LibrarySurfacePropsMap = {
    home: LibraryHomeSurfaceProps;
    collection: LibraryCollectionSurfaceProps;
    artist: LibraryArtistSurfaceProps;
    account: LibraryAccountSurfaceProps;
};

/** suite 对一个 surface 的实现与声明。 */
export type LibrarySurfaceDeclaration<Props> = {
    /** 默认 suite 可以是即时组件；其它 suite 必须是 React.lazy（registry 用 eager glob 发现 entry）。 */
    component: LibrarySurfaceComponent<Props>;
    /**
     * 集合 surface 列 LibraryActionId，首页 LibraryHomeActionId，歌手 LibraryArtistActionId，账户 LibraryAccountActionId
     * （建索引时按 surface 校验；账户 surface 还必须列全基础动作）。
     */
    actions: readonly (LibraryActionId | LibraryHomeActionId | LibraryArtistActionId | LibraryAccountActionId)[];
    /** suite 自己的动作（不在 core 的清单里），例如网格的信息面板、曲目侧栏、编辑模式。 */
    extraActions?: readonly string[];
};

/** 宿主在导航时交给 suite 转场钩子的上下文（导航发生之前读的）。 */
export type LibraryNavigationContext = {
    /** 导航栈当前深度。 */
    depth: number;
    /** 根集合从哪里打开（'home' 时返回可以落回首页卡片）。 */
    origin: CollectionNavigationOrigin | null;
    /** 当前顶层集合的类型。 */
    activeType: string | null;
};

/** 背景板单段淡入或淡出的时长（秒）与贝塞尔曲线。 */
export type LibraryBackdropTween = {
    duration: number;
    ease: [number, number, number, number];
};

/** 背景板与本套转场的状态；快照对象在设置未变化时必须稳定。 */
export type LibraryBackdropSnapshot = {
    /** 是否调用本套 beforePush / beforeBack、启用 Overlay。未声明 backdrop 时默认 true。 */
    enabled: boolean;
    enter: LibraryBackdropTween;
    /** 缺省时退场沿用 enter（中性背景板）。 */
    exit?: LibraryBackdropTween;
};

/** suite 自己解析动效设置，宿主只订阅已解析结果，不知道 suite 的设置名。 */
export type LibrarySuiteBackdrop = {
    getSnapshot: () => LibraryBackdropSnapshot;
    subscribe: (listener: () => void) => () => void;
};

/**
 * suite 自带的集合层转场（网格的移形换影）。宿主只在「渲染当前集合层的就是这套 suite」且未关闭动态效果时调用，
 * 其它情况下 Overlay 收到 enabled=false。
 */
export type LibrarySuiteTransitions = {
    /** 不声明则使用中性背景板，并保持本套转场钩子可用。 */
    backdrop?: LibrarySuiteBackdrop;
    /** 常驻在集合层之上的转场层；需要从挂载起就在（例如捕获首页卡片的点击）。 */
    Overlay?: LibrarySurfaceComponent<{ enabled: boolean }>;
    /** 压入下一层之前。 */
    beforePush?: (context: LibraryNavigationContext) => void;
    /**
     * 返回上一层之前（界面与导航 store 都还是返回前的样子）。应用内返回（返回按钮、Escape）与浏览器后退都会调用
     * （后者由宿主在 popstate 弹栈前调用，P4.5），一次返回只调用一次。
     */
    beforeBack?: (context: LibraryNavigationContext) => void;
    /** 切换 suite 时：丢掉还没用掉的转场计划（它是给切换前那次入场准备的）。每套 suite 都会收到。 */
    reset?: () => void;
};

/**
 * stage 的输入（B1）。stage 是一套 suite 常驻在首页与集合层之间的舞台（bravais 的整面墙），横跨 surface：
 * 首页与集合 / 歌手 surface 只把自己的层描述交给 suite 内部的 store，由 stage 统一画出来。
 * 宿主（GridViewOverlayHost）只挂**当前生效 suite** 的 stage，打开 / 关闭集合不重挂；首页外壳整个卸载时
 * （播放页全屏后 Home 返回 null）它跟着卸载，所以 stage 要跨卸载保留的布局应放进 sessionStorage 或 store。
 */
export type LibrarySuiteStageProps = {
    /** 首页外壳层的值（不是首页 surface 的值：集合层打开时 stage 仍可交互）。另一层盖在上面时为 false。 */
    isInteractive: boolean;
    theme: Theme;
    isDaylight: boolean;
    /** 当前集合导航快照（只读）：stage 据此知道「现在是哪一层」，用于转场方向与层栈。首页时 depth 为 0。 */
    navigation: LibraryNavigationContext;
};

/**
 * suite 自己的布局记录（滚动位置、坐标……，属于 suite，不进 core）。「完成」（返回按钮）时宿主让**每一套** suite
 * 忘掉这一层的记录——不只是正在渲染它的那套：在 TUI 里点了返回，下次在网格里打开也该从头开始。
 */
export type LibrarySuiteLayout = {
    /** 忘掉这一层（键是浏览会话的键：集合是 collectionKey，歌手页是导航栈那一层的 collectionKey）的布局记录。 */
    forget: (sessionKey: string) => void;
};

export type LibrarySuiteManifest = {
    id: LibrarySuiteId;
    /** 切换浮层上的名字（i18n key）。 */
    labelKey: string;
    /** false 时 registry 当它不存在（例如开发版专用的 suite 在生产构建里）。缺省为可用。 */
    available?: boolean;
    surfaces: { readonly [Surface in LibrarySurfaceId]?: LibrarySurfaceDeclaration<LibrarySurfacePropsMap[Surface]> };
    transitions?: LibrarySuiteTransitions;
    /** 有布局记录的 suite 才给（网格：集合与歌手页的 sessionStorage 记录）。 */
    layout?: LibrarySuiteLayout;
    /**
     * 常驻舞台（B1，见 LibrarySuiteStageProps）。只在这套 suite 生效时挂载；渲染当前层的 suite 有 stage 时，宿主不画
     * 集合层的中性背景板、也不隐藏首页（画面由 stage 负责）。与 transitions.Overlay 不同：Overlay 是每套 suite
     * 都常驻挂载的转场层，enabled=false 表示「不做转场」；stage 是这套 suite 的画面本身。
     * 非默认 suite 必须用 React.lazy（没选中它的用户不加载它的 chunk）。
     */
    stage?: LibrarySurfaceComponent<LibrarySuiteStageProps>;
    /**
     * 外观动作（B2，见 ./suiteChrome）：只出现在命令面板里的 suite 自有操作。这里静态声明元数据，命令由命令面板按它
     * 生成（id 为 `<suiteId>-<动作 id>`）；运行时由 suite 用 useLibrarySuiteChromeRegistration 注册实现，只有注册着的
     * 那套 suite 的动作可用。不声明则没有外观动作（grid 与 TUI 都不声明：网格的局部动作走 grid surface）。
     */
    chromeActions?: readonly LibrarySuiteChromeActionMeta[];
};
