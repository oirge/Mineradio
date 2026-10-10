// src/library/suites/grid/transitions/gridMorphContract.ts
// 网格卡片与「移形换影」（suites/grid/transitions 里的 CollectionMorphOverlay 等）之间的 DOM 契约。
//
// 转场靠 `getBoundingClientRect()` 直接读真实元素，而不是把矩形沿 React 树传下去 —— 这样
// 封面用的是用户正在看的那张 <img>，两边不会有时序或布局漂移。代价是这套握手完全建立在
// 属性名上：任何一侧单独改名都不会报错，只会让转场静默失效（没有 morph，没有报错，也没有
// 测试失败）。所以名字集中在这里，生产方（Grid3DSlider / GridView / ArtistGridView /
// PolaroidCard）和消费方（morph 探针）都从这一份取。

/** 首页 3D 滑条卡片的序号（Grid3DSlider 写入）。 */
export const GRID3D_CARD_INDEX_ATTR = 'data-grid3d-index';

/** 详情网格卡片的稳定 id（GridView / ArtistGridView 写入）。 */
export const GRID_CARD_ITEM_ID_ATTR = 'data-folia-grid-item-id';

/** 卡片标题行（PolaroidCard 写入）；形变的第三件套就是它。 */
export const CARD_TITLE_ATTR = 'data-folia-card-title';

/** 活动中的详情网格根（GridView / ArtistGridView 用 useIsPresent 写入）。
 * 出栈的旧网格在退出动画期间仍留在 DOM 里且带同样的卡片属性，靠它可以只量新网格。 */
export const ACTIVE_GRID_ATTR = 'data-folia-active-grid';

/** 歌手页 intro cluster（圆形头像与简介卡）的标记：它们不是可搬运的卡片。 */
export const ARTIST_INTRO_ATTR = 'data-folia-morph-intro';

/** 歌手页圆形头像（形变落点）。 */
export const ARTIST_AVATAR_ATTR = 'data-artist-avatar';

/** 歌手页简介卡的大标题。 */
export const ARTIST_BIO_TITLE_ATTR = 'data-artist-bio-title';

/** 带这个属性值的元素要当作 intro cluster 排除。 */
export const ARTIST_INTRO_VALUE_AVATAR = 'avatar';
export const ARTIST_INTRO_VALUE_BIO = 'bio';
