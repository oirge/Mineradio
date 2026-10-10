import {
    COLLECTION_MORPH_MIN_RECT_WIDTH,
    isNearViewportCenter,
    type CollectionMorphGeometry,
    type CollectionMorphHeroMeasured,
    type CollectionMorphRect,
    type CollectionMorphSquadGhost,
} from './morphGeometry';
import {
    ACTIVE_GRID_ATTR,
    ARTIST_AVATAR_ATTR,
    ARTIST_BIO_TITLE_ATTR,
    ARTIST_INTRO_ATTR,
    CARD_TITLE_ATTR,
    GRID3D_CARD_INDEX_ATTR,
    GRID_CARD_ITEM_ID_ATTR,
} from './gridMorphContract';

// src/library/suites/grid/transitions/morphProbes.ts
// The morph's measuring tape: every rectangle the transition flies is read here,
// straight off the real DOM, and every attribute name it reads comes from
// gridMorphContract.ts (the single handshake shared with the grid components).
//
// Deliberately store-free. This module only measures and (optionally) reports
// clicks; the store owns state and the overlay owns lifecycle, so there is no
// import cycle and the probes stay testable in isolation. The capture-phase
// click listener lives behind attachMorphCapture so it is attached by a React
// effect and disposed with it, instead of running as a module side effect on
// every HMR reload.

/** 采集结果：矩形与文案齐了，但还不属于任何一次导航（导航快照由调用方在任何 React
 * onClick 生效之前补上，见 attachMorphCapture 的 capture 阶段语义）。 */
export interface CollectionMorphCapture extends CollectionMorphGeometry {
    sourceKey: string | null;
}

export type MorphCaptureHandler = (capture: CollectionMorphCapture) => void;

const viewportOf = () => ({ width: window.innerWidth, height: window.innerHeight });

export const rectOfElement = (el: Element | null): CollectionMorphRect | null => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return null;
    return { x: r.left, y: r.top, width: r.width, height: r.height };
};

/**
 * 一张卡片的标题行。优先读 `data-folia-card-title`（PolaroidCard 写入的显式契约）；
 * 类名子串只是给还没接上契约的卡片兜底，并且刻意不再用 `[class*="title"]` ——
 * 那一条会先命中标题的外层 `group/song-title` 包裹层，量到的是包裹盒而不是文字盒。
 */
const resolveCardTitleElement = (card: Element): Element | null => (
    card.querySelector(`[${CARD_TITLE_ATTR}]`)
    ?? card.querySelector('h3, [class*="font-bold"], [class*="line-clamp"]')
);

/** 量标题的落点；量不到就退回卡片外框。 */
const titleOrFrame = (root: Element, fallback: CollectionMorphRect): CollectionMorphRect => (
    rectOfElement(resolveCardTitleElement(root)) ?? fallback
);

/**
 * 当前活动的详情网格根。出栈的旧网格在退出动画期间仍留在 DOM 里，并且带着同样的
 * 卡片属性；不限定范围就会量到旧网格的卡片 —— 那正是「飞行目标偶尔是上一页那张卡」
 * 的来源。GridView / ArtistGridView 里的 ActiveGridMarker 用 framer 的 useIsPresent()
 * 把这个属性写在卡片容器上，所以同一时刻只可能有一个。属性缺失时退回整篇文档，保证
 * 转场不会因为标记丢失而整个失效。没有 document（单测、非浏览器上下文）时返回 null。
 */
export const activeGridRoot = (): ParentNode | null => {
    if (typeof document === 'undefined') {
        return null;
    }
    return document.querySelector(`[${ACTIVE_GRID_ATTR}]`) ?? document;
};

const cardSelectorForSourceKey = (sourceKey: string): string | null => {
    if (sourceKey.startsWith('grid3d:')) {
        return `[${GRID3D_CARD_INDEX_ATTR}="${CSS.escape(sourceKey.slice('grid3d:'.length))}"]`;
    }
    if (sourceKey.startsWith('item:')) {
        return `[${GRID_CARD_ITEM_ID_ATTR}="${CSS.escape(sourceKey.slice('item:'.length))}"]`;
    }
    return null;
};

/**
 * 按 sourceKey 找卡片元素。`scope: 'active-grid'` 是嵌套返回用的：被点的那张卡在新挂载的
 * 上一层网格里，而正在退出的当前页（例如歌手页）可能恰好也有同一个 item id，文档级查询
 * 会先命中它，落点就会飞到一张正在消失的卡上。
 */
export const findMorphCard = (
    sourceKey: string | null,
    scope: 'document' | 'active-grid' = 'document',
): HTMLElement | null => {
    if (!sourceKey || typeof document === 'undefined') {
        return null;
    }
    const selector = cardSelectorForSourceKey(sourceKey);
    if (!selector) {
        return null;
    }
    const root = scope === 'active-grid' ? activeGridRoot() : document;
    return root?.querySelector<HTMLElement>(selector) ?? null;
};

// Locates the detail grid's hero card — the visible card closest to the
// viewport centre, which GridView puts at focusedIndex on open — and measures
// its cover image and title line, the counterparts the home card morphs into.
// Shared by the overlay (flight target) and the host (reverse-flight source).
//
// 每张卡的矩形只读一次：这个函数在飞行期间每 70ms 跑一次，而大歌单的渲染环里有几十张卡，
// 多读一遍就是每帧多几十次强制布局。选中的那张复用已经读到的矩形，不再重读。
export const probeHeroTargets = (): CollectionMorphHeroMeasured | null => {
    const root = activeGridRoot();
    if (!root) {
        return null;
    }
    const viewport = viewportOf();
    const cx = viewport.width / 2;
    const cy = viewport.height / 2;
    let hero: HTMLElement | null = null;
    let heroFrame: CollectionMorphRect | null = null;
    let bestDistSq = Infinity;
    for (const el of root.querySelectorAll<HTMLElement>(`[${GRID_CARD_ITEM_ID_ATTR}]`)) {
        const rect = rectOfElement(el);
        if (!rect) {
            continue;
        }
        const dX = rect.x + rect.width / 2 - cx;
        const dY = rect.y + rect.height / 2 - cy;
        const distSq = dX * dX + dY * dY;
        if (distSq < bestDistSq) {
            bestDistSq = distSq;
            hero = el;
            heroFrame = rect;
        }
    }
    if (!hero || !heroFrame) {
        return null;
    }
    const frame = heroFrame;
    const heroImg = hero.querySelector<HTMLImageElement>('img');
    const cover = rectOfElement(heroImg) ?? frame;
    const coverUrl = heroImg?.getAttribute('src') ?? null;
    const titleEl = resolveCardTitleElement(hero);
    const title = titleOrFrame(hero, frame);
    const titleText = (titleEl?.textContent ?? '').trim();
    return {
        frame,
        cover,
        coverUrl,
        title,
        titleText,
        key: hero.getAttribute(GRID_CARD_ITEM_ID_ATTR) ?? '',
        coverReady: !heroImg || heroImg.complete,
    };
};

// Probes the artist page's intro cluster — the circular avatar (the hero the
// clicked song card morphs onto) and the bio card's big title line. Used when
// the navigation's ACTIVE collection is an artist detail: the generic hero
// probe would instead latch onto a random song/album card somewhere off-centre.
// `round: true` tells the overlay to animate its cover's border radius toward
// a circle for this landing.
export const probeArtistIntroTargets = (): CollectionMorphHeroMeasured | null => {
    const root = activeGridRoot();
    if (!root) {
        return null;
    }
    const avatarEl = root.querySelector<HTMLElement>(`[${ARTIST_AVATAR_ATTR}]`);
    if (!avatarEl) {
        return null;
    }
    const avatarImg = avatarEl.querySelector<HTMLImageElement>('img');
    const frame = rectOfElement(avatarEl);
    const cover = rectOfElement(avatarImg) ?? frame;
    const coverUrl = avatarImg?.getAttribute('src') ?? null;
    const titleEl = root.querySelector<HTMLElement>(`[${ARTIST_BIO_TITLE_ATTR}]`);
    const title = rectOfElement(titleEl) ?? frame;
    const titleText = (titleEl?.textContent ?? '').trim();
    if (!frame || !cover || !title) {
        return null;
    }
    return {
        frame,
        cover,
        coverUrl,
        title,
        titleText,
        key: 'artist-intro',
        coverReady: !avatarImg || avatarImg.complete,
        round: true,
    };
};

// Snapshots the nearest visible cards (except the centered hero, and except the
// artist page's intro cluster) — with cover url and title — the instant the user
// backs out. The detail grid unmounts right after, so these ghosts are what the
// exit animation scatters outward. Capped at SQUAD_GHOST_LIMIT nearest cards and
// sorted by distance: blurred scatter layers are the reason exits jank, so
// fewer, cheaper ghosts keep the dissolve smooth while the backdrop handles the
// rest.
export const SQUAD_GHOST_LIMIT = 16;

export const probeGridSquadRects = (): CollectionMorphSquadGhost[] => {
    const root = activeGridRoot();
    if (!root) {
        return [];
    }
    const wrappers = Array.from(
        root.querySelectorAll<HTMLElement>(`[${GRID_CARD_ITEM_ID_ATTR}]`),
    );
    const viewport = viewportOf();
    const ghosts: Array<{ ghost: CollectionMorphSquadGhost; distSq: number }> = [];
    for (const el of wrappers) {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) {
            continue;
        }
        const rect: CollectionMorphRect = { x: r.left, y: r.top, width: r.width, height: r.height };
        // Skip the centered hero (distance < 100px): it has its own reverse morph.
        if (isNearViewportCenter(rect, viewport)) {
            continue;
        }
        const cover = el.querySelector('img');
        const titleEl = resolveCardTitleElement(el);
        const dX = rect.x + rect.width / 2 - viewport.width / 2;
        const dY = rect.y + rect.height / 2 - viewport.height / 2;
        ghosts.push({
            distSq: dX * dX + dY * dY,
            ghost: {
                rect,
                coverUrl: cover?.getAttribute('src') ?? null,
                titleText: (titleEl?.textContent ?? '').trim(),
            },
        });
    }
    return ghosts
        .sort((a, b) => a.distSq - b.distSq)
        .slice(0, SQUAD_GHOST_LIMIT)
        .map((entry) => entry.ghost);
};

// Resolves every morphable element straight off the clicked card's DOM. The
// card is a real element inside Grid3DSlider / the detail grid, so the
// rectangles are exact and the cover url is the same <img> the user was looking
// at — no second network fetch, no layout drift between the two views.
export const captureClickedCard = (target: Element): CollectionMorphCapture | null => {
    const frameRect = target.getBoundingClientRect();
    if (frameRect.width < COLLECTION_MORPH_MIN_RECT_WIDTH || frameRect.height < 1) {
        return null;
    }
    const cover = target.querySelector<HTMLImageElement>('img');
    const coverRect = cover ? cover.getBoundingClientRect() : frameRect;
    const titleEl = resolveCardTitleElement(target);
    const titleRect = titleEl ? titleEl.getBoundingClientRect() : null;
    const sourceKey = target instanceof HTMLElement
        ? (target.dataset.grid3dIndex !== undefined
            ? `grid3d:${target.dataset.grid3dIndex}`
            : target.dataset.foliaGridItemId !== undefined
                ? `item:${target.dataset.foliaGridItemId}`
                : null)
        : null;
    return {
        frame: { x: frameRect.left, y: frameRect.top, width: frameRect.width, height: frameRect.height },
        cover: { x: coverRect.left, y: coverRect.top, width: coverRect.width, height: coverRect.height },
        coverUrl: cover?.src ?? null,
        title: titleRect
            ? { x: titleRect.left, y: titleRect.top, width: titleRect.width, height: titleRect.height }
            : null,
        titleText: titleEl?.textContent?.trim() ?? '',
        sourceKey,
    };
};

// Re-measures a stored card through its sourceKey and returns the live
// geometry. The home surface stays mounted (just visibility-hidden) while a
// collection is open, but its layout can still shift (player bar appearing,
// focus changes, slider re-layout) — flying back onto the click-time rectangle
// then lands visibly off (the "drifts to lower-left" symptom). Reading the live
// rect right before the reverse flight keeps the landing pixel-exact. A card
// scrolled out of the rendered window cannot be measured: the caller keeps the
// click-time rectangles in that case.
export const measureCardGeometry = (sourceKey: string | null): CollectionMorphGeometry | null => {
    const el = findMorphCard(sourceKey, 'document');
    if (!el) {
        return null;
    }
    const frame = rectOfElement(el);
    if (!frame || frame.width < COLLECTION_MORPH_MIN_RECT_WIDTH) {
        return null;
    }
    const img = el.querySelector<HTMLImageElement>('img');
    const cover = rectOfElement(img) ?? frame;
    const titleEl = resolveCardTitleElement(el);
    const title = rectOfElement(titleEl);
    return {
        frame,
        cover,
        coverUrl: img?.getAttribute('src') ?? null,
        title,
        titleText: (titleEl?.textContent ?? '').trim(),
    };
};

/**
 * 记录「用户点了哪张卡片」。返回卸载函数，所以它挂在 React effect 里，而不是模块加载时
 * 就注册一个永远不撤销的 document 监听（那种写法在每次 HMR 都会多留一个）。
 *
 * 监听必须是 capture 阶段：payload 里的导航快照要反映**点击之前**的状态，而 React 的
 * onClick 会在这个监听之后才更新导航 store。卡片点击只是居中/播放时导航签名不变，overlay
 * 的观察窗口会把这份采集丢掉，所以这里不需要额外判断意图。
 */
export const attachMorphCapture = (handler: MorphCaptureHandler): (() => void) => {
    if (typeof document === 'undefined') {
        return () => {};
    }
    const onClick = (event: MouseEvent) => {
        const target = event.target;
        if (!(target instanceof Element)) {
            return;
        }
        const card = target.closest<HTMLElement>(`[${GRID3D_CARD_INDEX_ATTR}], [${GRID_CARD_ITEM_ID_ATTR}]`);
        if (!card) {
            return;
        }
        // 歌手页的头像与简介卡不是可搬运的卡片：简介弹窗不改变导航，头像有自己的落点。
        if (card.closest(`[${ARTIST_INTRO_ATTR}]`)) {
            return;
        }
        const capture = captureClickedCard(card);
        if (!capture) {
            return;
        }
        handler(capture);
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
};
