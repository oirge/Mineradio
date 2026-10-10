import { create } from 'zustand';
import { useCollectionNavigationStore, type CollectionNavigationSnapshot } from '../../../../stores/useCollectionNavigationStore';
import { measureCardGeometry, type CollectionMorphCapture } from './morphProbes';
import {
    COLLECTION_MORPH_OBSERVATION_WINDOW_MS,
    COLLECTION_MORPH_PLAN_TTL_MS,
    type CollectionMorphExit,
    type CollectionMorphHeroMeasured,
    type CollectionMorphPending,
    type CollectionMorphPlan,
    type CollectionMorphSquadGhost,
} from './morphGeometry';

// src/library/suites/grid/transitions/collectionMorphStore.ts
// Shared-element「移形换影」transition state — and nothing else.
//
// The rectangles it hands around are measured in morphProbes.ts, and the flight
// itself is driven by CollectionMorphOverlay. What lives here is only what has
// to outlive a single component: the clicked card's payload, the entrance plan
// the detail grid reads, the last measured hero (the reverse flight's start
// point) and the armed exit.
//
// A capture only survives the observation window when a collection actually
// opens within it; a click that merely centers the slider discards it. The
// overlay then morphs every captured element into the counterpart on the
// centered hero song card, and hands GridView a morphPlan so the remaining song
// cards fly in from outside the viewport in sequence.

interface CollectionMorphState {
    pending: CollectionMorphPending | null;
    /** Plan committed once the detail grid's hero card is located. */
    plan: CollectionMorphPlan | null;
    /** Last measured hero targets — the reverse-flight start point on back. */
    hero: CollectionMorphHeroMeasured | null;
    /** The home card this session's forward morph opened from; the reverse
     * flight's destination. Survives consume() of the forward payload. */
    lastHome: CollectionMorphPending | null;
    /** The card the CURRENT nesting level was pushed from (e.g. the song card
     * whose click opened the artist page); the nested back's destination.
     * Depth and snapshot identity bind it to this navigation, not a later
     * async push at the same depth whose capture has already expired. */
    lastSource: CollectionMorphPending | null;
    lastSourceDepth: number;
    lastSourceNavigation: CollectionNavigationSnapshot | null;
    /** Armed by the host right before leaving a collection. */
    exit: CollectionMorphExit | null;
    capture: (payload: CollectionMorphPending) => void;
    /** Clears an already-launched pending so it can never re-launch. */
    ackPending: () => void;
    commitPlan: (plan: CollectionMorphPlan) => void;
    setHero: (hero: CollectionMorphHeroMeasured | null) => void;
    setLastHome: (home: CollectionMorphPending) => void;
    setLastSource: (source: CollectionMorphPending, depth: number) => void;
    armExit: (from: CollectionMorphHeroMeasured, squad: CollectionMorphSquadGhost[]) => void;
    armNestedExit: (from: CollectionMorphHeroMeasured, squad: CollectionMorphSquadGhost[]) => void;
    consume: () => void;
    clear: () => void;
}

let discardTimer: ReturnType<typeof setTimeout> | null = null;
let planTtlTimer: ReturnType<typeof setTimeout> | null = null;

const cancelPlanTtl = () => {
    if (planTtlTimer !== null) {
        clearTimeout(planTtlTimer);
        planTtlTimer = null;
    }
};

const cancelDiscard = () => {
    if (discardTimer !== null) {
        clearTimeout(discardTimer);
        discardTimer = null;
    }
};

const scheduleDiscard = (clear: () => void) => {
    cancelDiscard();
    discardTimer = setTimeout(() => {
        discardTimer = null;
        clear();
    }, COLLECTION_MORPH_OBSERVATION_WINDOW_MS);
};

export const useCollectionMorphStore = create<CollectionMorphState>((set, get) => ({
    pending: null,
    plan: null,
    hero: null,
    lastHome: null,
    lastSource: null,
    lastSourceDepth: 0,
    lastSourceNavigation: null,
    exit: null,
    capture: (payload) => set({ pending: payload, plan: null, exit: null }),
    // ackPending only ever runs when a flight actually launched, so it also
    // cancels the observation window — otherwise the discard timer could fire
    // mid-flight and consume the live morph plan.
    ackPending: () => {
        cancelDiscard();
        set({ pending: null });
    },
    commitPlan: (plan) => {
        cancelPlanTtl();
        planTtlTimer = setTimeout(() => {
            planTtlTimer = null;
            if (get().plan) {
                set({ plan: null });
            }
        }, COLLECTION_MORPH_PLAN_TTL_MS);
        set({ plan });
    },
    setHero: (hero) => set({ hero }),
    setLastHome: (home) => set({ lastHome: home }),
    setLastSource: (source, depth) => set({
        lastSource: source,
        lastSourceDepth: depth,
        lastSourceNavigation: useCollectionNavigationStore.getState().snapshot,
    }),
    armExit: (from, squad) => {
        const stored = get().lastHome;
        if (!stored) {
            return;
        }
        // Re-measure the home card NOW: it stayed mounted (hidden) while the
        // collection was open and may have shifted; landing on stale
        // click-time rects is what made the flight drift off-target.
        const live = measureCardGeometry(stored.sourceKey);
        const to: CollectionMorphPending = live
            ? { ...stored, ...live, title: live.title ?? stored.title }
            : stored;
        cancelPlanTtl();
        set({ exit: { from, to, squad, nested: false, sourceKey: null, armedAt: Date.now() }, hero: null, plan: null });
    },
    armNestedExit: (from, squad) => {
        cancelPlanTtl();
        const navigation = useCollectionNavigationStore.getState().snapshot;
        const depth = navigation?.stack.length ?? 0;
        const { lastSource, lastSourceDepth, lastSourceNavigation } = get();
        // Only a source captured for THIS nesting level may be landed on —
        // an async push whose capture was discarded must fall back to the
        // in-place shrink instead of chasing a stale card.
        const sourceKey = lastSource && lastSourceDepth === depth && depth > 1
            && lastSourceNavigation === navigation
            ? lastSource.sourceKey
            : null;
        set({ exit: { from, to: null, squad, nested: true, sourceKey, armedAt: Date.now() }, hero: null, plan: null });
    },
    // consume() intentionally keeps lastHome: the forward morph ends long before
    // the user backs out, and the reverse flight needs the original home rects.
    consume: () => {
        cancelDiscard();
        const { pending, exit } = get();
        // A capture that arrived AFTER the exit was armed belongs to the next
        // session (quick back-out + reopen while the exit still plays) — keep it
        // so the overlay launches it once the exit lifecycle finishes.
        const keepPending = pending && exit && pending.capturedAt > exit.armedAt
            ? pending
            : null;
        set({
            pending: keepPending, plan: null, hero: null, exit: null,
            // Keep the source during forward-flight completion, release it after back.
            ...(exit ? { lastSource: null, lastSourceDepth: 0, lastSourceNavigation: null } : {}),
        });
    },
    clear: () => {
        cancelDiscard();
        set({ pending: null, plan: null, hero: null, lastHome: null, lastSource: null, lastSourceDepth: 0, lastSourceNavigation: null, exit: null });
    },
}));

/**
 * 记录一次卡片点击采集，并开启观察窗口。监听器本身在 morphProbes.attachMorphCapture，
 * 由 overlay 的 effect 挂载/卸载；这里只负责「采集 + 限时丢弃」这段状态机。
 *
 * 两个字段必须在这里补齐，因为只有这个时机同时知道「点击前的导航签名」和「现在几点」：
 * 监听跑在 capture 阶段，读到的导航快照才是点击之前的状态。
 */
export const reportMorphCapture = (capture: CollectionMorphCapture): void => {
    const snapshot = useCollectionNavigationStore.getState().snapshot;
    useCollectionMorphStore.getState().capture({
        ...capture,
        navAtGestureStart: {
            wasOpen: Boolean(snapshot),
            depth: snapshot?.stack.length ?? 0,
        },
        capturedAt: Date.now(),
    });
    scheduleDiscard(() => useCollectionMorphStore.getState().consume());
};
