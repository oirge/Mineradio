// src/library/suites/grid/transitions/morphGeometry.ts
// 「移形换影」的共享词汇表：它搬运的矩形、各阶段交换的载荷，以及飞行背后的纯几何。
//
// 这个文件不碰 DOM 也不碰 store，所以可以单独单测。放在这里的原因是三处曾经各自抄了
// 一份同样的数学：`reach`（视口对角线）在 overlay / GridView / ArtistGridView 各写一次，
// 确定性抖动的字符串 hash 在 GridView 与 ArtistGridView 各写一次，径向飞入的错峰公式
// 也是两份。抽到这里之后调参只有一个入口，两侧的入场才不会漂移。

export interface CollectionMorphRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * 每个形变阶段都认得的矩形集合：卡片外框、封面、标题行，以及它们的文案。
 * `title` 只在「被点击的卡片还没有标题行」时为 null；从真实元素量出来的目标一定有标题。
 */
export interface CollectionMorphGeometry {
    frame: CollectionMorphRect;
    cover: CollectionMorphRect;
    coverUrl: string | null;
    title: CollectionMorphRect | null;
    titleText: string;
}

/** 完整的目标矩形集合：标题一定存在（量自真实元素）。 */
export type CollectionMorphTarget = CollectionMorphGeometry & { title: CollectionMorphRect };

/** Navigation state captured when a click gesture began. */
export interface CollectionMorphNavSnapshot {
    /** Whether a collection snapshot existed when the gesture began. */
    wasOpen: boolean;
    /** Navigation stack depth when the gesture began. */
    depth: number;
}

export interface CollectionMorphPending extends CollectionMorphGeometry {
    /**
     * Stable DOM handle of the clicked card (`grid3d:<index>` for home slider
     * cards, `item:<id>` for detail grid cards). On back-out the home card is
     * re-measured through it, so the reverse flight always lands on the card's
     * CURRENT position even if the home surface re-laid-out while hidden.
     */
    sourceKey: string | null;
    /**
     * Navigation state when this click's gesture began — the pointerdown
     * signature when one preceded the click (a click-driven open changes the
     * nav store only AFTER the click; comparing against the gesture START
     * covers both orderings). The overlay launches a flight only when the
     * CURRENT navigation shows an open this gesture caused; a card click that
     * merely plays/centers never changes the signature and never morphs.
     */
    navAtGestureStart: CollectionMorphNavSnapshot;
    capturedAt: number;
}

export interface CollectionMorphHeroMeasured extends CollectionMorphTarget {
    /**
     * 这个测量来自哪个元素（网格卡片的 item id，或歌手页 intro 的固定标记）。
     * 轮询用它判断「连续两次量到的是同一张卡」—— 网格恢复滚动的那一刻卡片还在滑，
     * 只按「离中心最近」接受目标会让飞行半路改道到一张正在移动的卡上。
     */
    key: string;
    /**
     * False while the hero's cover <img> is still in flight (network/blob
     * decode). The overlay holds its composite over the hero until the cover
     * finished — loaded OR failed — so the reveal never uncovers an empty
     * frame; that wait is what makes the morph a load cover.
     */
    coverReady: boolean;
    /**
     * True when this measurement came from the artist page's circular avatar
     * (see probeArtistIntroTargets): the overlay animates its flying cover's
     * border radius toward a circle for these landings.
     */
    round?: boolean;
}

/**
 * 交给 GridView / ArtistGridView 的入场计划。它同时决定「详情页的 hero 要不要先藏起来」，
 * 所以必须区分两种来源，而不是拿一个恒为 0 的索引当开关：
 *
 * - `morph`：overlay 正用合成层盖在这个 grid 的 hero 位置上（首页卡片展开、嵌套 push
 *   落到新 grid 的 hero），hero 藏起来、等形变淡出时再揭示。
 * - `cascade`：只有卡片级联，没有合成层盖着（从搜索/播放器 origin 进来的 push、嵌套返回
 *   后重新挂载的上一层）。此时 hero 必须立刻可见 —— 藏 340ms 会留下一块空白。
 */
export interface CollectionMorphPlan {
    kind: 'morph' | 'cascade';
}

/** A single surrounding card snapshot for the reverse flight's scatter. */
export interface CollectionMorphSquadGhost {
    rect: CollectionMorphRect;
    coverUrl: string | null;
    titleText: string;
}

/** Reverse-flight payload: hero → home card, armed right before backing out. */
export interface CollectionMorphExit {
    /** Live measurement of the detail hero card the overlay currently covers. */
    from: CollectionMorphHeroMeasured;
    /** The original home card rectangles to morph back onto; null for a nested
     * back (album → playlist), where the hero shrinks into nothing or retargets
     * onto the card this level was pushed from. */
    to: CollectionMorphPending | null;
    /** Every other visible card with its cover + title, captured the instant
     * back is pressed — replayed as real-looking ghost cards that scatter
     * outward, the reverse of the fly-in. */
    squad: CollectionMorphSquadGhost[];
    /** True when this back returns to the previous collection instead of home. */
    nested: boolean;
    /**
     * For nested backs: the sourceKey (`item:<id>`) of the card this level was
     * pushed FROM. The previous grid remounts underneath only AFTER back is
     * pressed, so the destination cannot be measured at arm time — the overlay
     * polls for this card and retargets the hero onto it once it renders.
     * Null when no trustworthy source exists (async push whose capture was
     * discarded): the hero falls back to the in-place shrink.
     */
    sourceKey: string | null;
    armedAt: number;
}

/** 确定性抖动的输入：一次飞入里同时给位移、旋转和延迟用。 */
export interface CollectionMorphFlyIn {
    x: number;
    y: number;
    rotate: number;
    delay: number;
}

// zIndex sits above the detail backdrop (z-[49]) so the flying elements ride in
// front of it while the backdrop fades in underneath. It is below the detail
// grids' own z-index (GridView z-[110] / ArtistGridView z-50) on purpose: the
// overlay is portalled to <body> while the whole home surface sits inside the
// home mount point's `z-10` stacking context, so the composite still paints
// above the detail view. Raising this constant past the home mount point would
// put the flight on top of the app chrome instead.
export const COLLECTION_MORPH_Z_INDEX = 50;
export const COLLECTION_MORPH_MIN_RECT_WIDTH = 48;
export const COLLECTION_MORPH_OBSERVATION_WINDOW_MS = 450;
// A fly-in plan auto-expires after the entrance window so a stale plan can
// never re-trigger entrances on later grid mounts. Generous enough to cover a
// remounting previous grid whose data restore takes a moment. Note that it only
// bounds how long a plan may START an entrance — the overlay's own lifecycle is
// deliberately independent of it (see CollectionMorphOverlay's finishLifecycle).
export const COLLECTION_MORPH_PLAN_TTL_MS = 2400;

/** Card frames closer than this to the viewport centre count as the hero. */
const SQUAD_HERO_EXCLUSION_RADIUS = 100;

/**
 * 级联入场的推进距离。**刻意比视口对角线短得多。**
 *
 * Apple 的网格入场是「就位」，不是「从屏幕外飞进来」：短距离 + 轻微缩放 + 紧错峰，读起来是
 * 被安排好的；把几十张卡从屏幕外甩进来则是爆炸感，而且要同时喂饱几十条长距离运动。上限 260px
 * 同时压掉两件事：观感（不再是爆炸）和单帧成本（并发的动画量与总时长都下来了）。
 */
export const collectionMorphEntranceTravel = (viewport: { width: number; height: number }): number => (
    Math.min(Math.min(viewport.width, viewport.height) * 0.32, 260)
);

/** 反向四散的推进距离：比入场略短，读作「散开并淡出」，而不是「炸出去」。 */
export const collectionMorphScatterTravel = (viewport: { width: number; height: number }): number => (
    Math.min(Math.min(viewport.width, viewport.height) * 0.3, 220)
);

/** 确定性的字符串种子（0..1），跨 render 稳定，所以卡片不会每次重渲染都换一个歪角。 */
export const collectionMorphSeed = (key: string): number => {
    let hash = 0;
    for (let i = 0; i < key.length; i += 1) {
        hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    }
    return (hash % 1000) / 1000;
};

/** 反向四散用的矩形种子：整数部分留给 rotate 的正负与档位。 */
export const collectionMorphRectSeed = (rect: CollectionMorphRect): number => (
    ((Math.round(rect.x) * 73856093) ^ (Math.round(rect.y) * 19349663)) >>> 0
);

/**
 * 一张卡片推进到网格槽位所需的 transform 与错峰。
 *
 * 三条都是 Apple 那套「就位」的语言：
 * - **不倾斜**：网格入场让每一格各自歪一个角度，读起来是「随机」而不是「被安排好的」；
 * - 距离越远启动越晚（ease-out 归一化），但错峰上限收在 0.32s 内，整片网格是一起到达的；
 * - 只留 0.04s 的确定性抖动做呼吸感，不给「机械横扫」留余地。
 */
export const collectionMorphFlyIn = (
    card: { x: number; y: number },
    origin: { x: number; y: number },
    spacing: number,
    reach: number,
    seed: number,
): CollectionMorphFlyIn => {
    const dx = card.x - origin.x;
    const dy = card.y - origin.y;
    const distance = Math.hypot(dx, dy);
    const direction = distance > 1
        ? { x: dx / distance, y: dy / distance }
        : { x: 0, y: -1 };
    const normalized = Math.min(distance / (spacing * 14), 1);
    const eased = normalized * normalized * (3 - 2 * normalized);
    return {
        x: direction.x * reach,
        y: direction.y * reach,
        rotate: 0,
        delay: Math.min(0.04 + eased * 0.34 + seed * 0.04, 0.32),
    };
};

// First estimated destination while the track list is still loading: the
// viewport centre sized like the strip's typical centered card.
export const estimateCenterTarget = (viewport: { width: number; height: number }): CollectionMorphRect => {
    const size = Math.min(Math.max(viewport.width * 0.18, 160), 280);
    return {
        x: viewport.width / 2 - size / 2,
        y: viewport.height / 2 - size * 0.58,
        width: size,
        height: size * 1.16,
    };
};

/** 目标卡片是否离视口中心足够近，近到应当算作 hero（反向四散要跳过它）。 */
export const isNearViewportCenter = (
    rect: CollectionMorphRect,
    viewport: { width: number; height: number },
): boolean => {
    const dx = rect.x + rect.width / 2 - viewport.width / 2;
    const dy = rect.y + rect.height / 2 - viewport.height / 2;
    return dx * dx + dy * dy < SQUAD_HERO_EXCLUSION_RADIUS * SQUAD_HERO_EXCLUSION_RADIUS;
};

/**
 * 这次量到的落点和上次是不是「同一张卡、同一个位置」。
 *
 * 网格恢复滚动/焦点是挂载后若干帧才做的：刚挂上时卡片还在滑，只按「离屏幕中心最近」取目标
 * 会让飞行半路改道到一张正在移动的卡上（看起来就是飞行中途拐弯）。要求连续两次是同一个
 * 元素、矩形几乎不动，才允许把它当成落点 —— 用稳定性替代一个拍脑袋的等待毫秒数。
 */
export const isMorphTargetSettled = (
    previous: { key: string; frame: CollectionMorphRect; cover: CollectionMorphRect; title: CollectionMorphRect } | null,
    next: { key: string; frame: CollectionMorphRect; cover: CollectionMorphRect; title: CollectionMorphRect },
    tolerancePx: number,
): boolean => {
    if (!previous) {
        return false;
    }
    // 读不到标识（卡片没带 data 属性）时不当作致命：矩形稳定本身就是很强的证据，
    // 两张不同的卡片不可能在同一帧占据同一个矩形。有无标识都不影响判据。
    if (previous.key && next.key && previous.key !== next.key) {
        return false;
    }
    const near = (a: CollectionMorphRect, b: CollectionMorphRect) => (
        Math.abs(a.x - b.x) < tolerancePx
        && Math.abs(a.y - b.y) < tolerancePx
        && Math.abs(a.width - b.width) < tolerancePx
        && Math.abs(a.height - b.height) < tolerancePx
    );
    return near(previous.frame, next.frame)
        && near(previous.cover, next.cover)
        && near(previous.title, next.title);
};

/**
 * 嵌套返回（歌手页 → 歌单）的落点分两步，就是为了不让 hero 僵在半空等上一秒：
 *
 * 1. **立刻落点**：卡片的外框在挂载时就已经在最终槽位上（飞入动画作用在内层 motion.div），
 *    所以外框稳定两拍就先把 hero 送过去 —— 这也是这一层唯一精确的部分。
 * 2. **细化**：内层飞入还在动的时候，封面/标题的即时矩形可能离屏，不能当落点；等它们连续
 *    两拍不动了再更新一次，让封面和标题收进卡片真正的封面与标题位置。
 */
export const MORPH_NESTED_LANDING_DETAIL_MS = 900;


/** 把矩形摊成一组盒属性。 */
export const boxOf = (rect: CollectionMorphRect) => ({
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
});

/**
 * 形变的每一层都动画**盒子**（left/top/width/height），不是 x/y/scaleX/scaleY。
 *
 * 原因不是性能，是正确性：`object-cover` 是按**布局盒子**裁图的，transform 只缩放已经栅格化的
 * 结果。所以用非等比 scale 做 FLIP 时，起点和终点的宽高比一旦不同，图片内容就会被拉伸 ——
 * 首页满幅卡片的封面（约 200×260）飞进歌手页 232×232 的圆形头像时，横竖缩放比是 1.16 / 0.89，
 * 封面会被明显压窄。改成动画盒子之后，每一帧都是新的布局盒子，`object-cover` 重新裁图，
 * 内容永远不变形；百分比圆角也自动跟着盒子走，圆不会在插值中间变成椭圆。
 *
 * 代价是每一帧布局+绘制这几个小元素（fixed 定位，影响范围就是这个元素自己），和标题层
 * 早就采用的做法一致。
 */
export const MORPH_ANIMATED_BOX_PROPERTIES = 'left, top, width, height, opacity';

/**
 * 把「卡片级的圆角像素值」换算成百分比。
 *
 * 圆角在整个飞行里都必须用同一个单位，否则 framer 在 px 与 % 之间无法插值（会在落点跳一下）。
 * 百分比同时是圆形落点唯一的正确写法：它跟着盒子走，所以目标一旦是正方形就是正圆。
 */
export const radiusPercent = (pixels: number, boxWidth: number): string => (
    boxWidth > 0 ? `${(pixels / boxWidth) * 100}%` : `${pixels}px`
);

/**
 * 圆形落点必须写成 `50%`。形变层在自己盒子里被缩放/改尺寸，百分比圆角跟着走：
 * 目标方就是正圆；换成 `min(w,h)/2` px 再被非等比缩放，横竖半径会变成 (144, 111) ——
 * 也就是「白框变成了圆角方框」。
 */
export const MORPH_CIRCLE_RADIUS = '50%';

/** 卡片自身的圆角（与 GridView / ArtistGridView 的 rounded-2xl / rounded-xl 一致），
 * 用来把「收圆」的起点换算成百分比。 */
export const MORPH_CARD_FRAME_RADIUS_PX = 16;
export const MORPH_CARD_COVER_RADIUS_PX = 12;
