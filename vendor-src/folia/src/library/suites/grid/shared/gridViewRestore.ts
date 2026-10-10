// src/library/suites/grid/shared/gridViewRestore.ts
// 「这个网格恢复后会聚焦到哪张卡片」的唯一真源。
//
// 这条规则现在有两个消费者：恢复滚动/焦点的 effect，和移形换影入场的 hero 判定（扇形的
// 放射原点必须是真正被居中的那张卡，从 index 0 放射会让整个级联歪掉）。两处各写一遍的
// 后果是它们对筛选与焦点的处理会慢慢分叉，而分叉的表现只是「偶尔歪一点」，不会报错。
// 所以索引解析放在这里，各自的时序守卫留在各自调用点。
//
// 筛选词和「看到哪首」（条目键）存在跨 renderer 的浏览会话里；这里的 sessionStorage 记录只放
// 网格自己的布局状态，键带完整的集合身份和版本号。旧版只按 id 存的记录不再读取。

export const GRID_VIEW_STATE_STORAGE_PREFIX = 'folia_gridview_state:v2:';

export type StoredGridViewNavigationState = {
    focusedEntryKey?: string;
    focusedIndex: number;
    dragX: number;
    dragY: number;
};

/** 挂载时决定的恢复目标；`hadQuery` 表示恢复出来的会话带着筛选。 */
export type GridRestoreTarget = {
    entryKey: string | null;
    fallbackIndex: number;
    hadQuery: boolean;
};

export const gridViewStateStorageKey = (collectionIdentity: string): string => (
    `${GRID_VIEW_STATE_STORAGE_PREFIX}${collectionIdentity}`
);

/** 读网格的布局记录；读不到或格式不对时返回 null（并清掉坏记录）。 */
export const readStoredGridViewState = (storageKey: string | null): Partial<StoredGridViewNavigationState> | null => {
    if (!storageKey) return null;
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<StoredGridViewNavigationState>;
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
        sessionStorage.removeItem(storageKey);
        return null;
    }
};

/**
 * 恢复目标：会话里的语义焦点优先（另一个 renderer 也可能改过它），其次是网格自己记下的那张；
 * 都没有、也没有筛选时返回 null，表示没有需要恢复的东西。
 */
export const resolveGridRestoreTarget = (
    stored: Partial<StoredGridViewNavigationState> | null,
    session: { focusedEntryKey: string | null; query: string },
): GridRestoreTarget | null => {
    const entryKey = session.focusedEntryKey ?? stored?.focusedEntryKey ?? null;
    const hadQuery = session.query.trim().length > 0;
    if (!entryKey && !stored && !hadQuery) return null;
    const storedIndex = Number.isFinite(stored?.focusedIndex) ? Number(stored!.focusedIndex) : 0;
    return { entryKey, fallbackIndex: storedIndex, hadQuery };
};

/**
 * 解出恢复后的焦点索引（在当前展示的网格项里），必然落在 `[0, itemCount - 1]`；无法确定时返回 -1。
 *
 * 优先按条目键找（曲目可能在两次打开之间重排/增删，索引会漂），找不到再回退到记下的索引并夹紧。
 * 按键查找只比较字符串，不会为了找一张卡把整张歌单的网格项都塑形一遍。
 */
export const resolveGridRestoreIndex = ({
    target,
    itemCount,
    findEntryIndex,
    matchIndexes,
}: {
    target: GridRestoreTarget | null;
    itemCount: number;
    findEntryIndex: (entryKey: string) => number;
    matchIndexes: readonly number[] | null;
}): number => {
    if (!target || itemCount === 0) return -1;
    let index = -1;
    if (target.entryKey) {
        const displayIndex = findEntryIndex(target.entryKey);
        if (displayIndex >= 0) {
            index = matchIndexes ? matchIndexes.indexOf(displayIndex) : displayIndex;
        }
    }
    if (index < 0) index = target.fallbackIndex;
    return Math.max(0, Math.min(index, itemCount - 1));
};

/**
 * 首次定位（把相机放到介绍卡上）只允许发生一次，而且必须没有会话要恢复。
 *
 * 为什么需要单独一条判据：触发它的 effect 依赖 `items.length`，而歌手页的专辑列表是
 * **分页追加**的 —— 用户点开某张卡、相机已经移过去之后，下一页数据落地会改变 length，
 * effect 再跑一次就把相机瞬移回介绍卡（表现就是「点完卡片过一会自己跳回歌手介绍」）。
 * 所以这里看的是「定位过没有」，而不是 length 变没变。
 *
 * `restoreApplied` 为真时也不该再定位：那一刻相机位置来自 sessionStorage，覆盖它等于把
 * 用户上次的浏览位置丢掉。
 */
export const shouldApplyInitialGridFocus = (state: {
    itemCount: number;
    /** 已经做过一次初始定位。 */
    hasAppliedInitialFocus: boolean;
    /** 会话恢复已经应用。 */
    restoreApplied: boolean;
    /** 有待恢复的会话但还没应用（例如过滤条件还没到位）。 */
    restorePending: boolean;
}): boolean => (
    state.itemCount > 0
    && !state.hasAppliedInitialFocus
    && !state.restoreApplied
    && !state.restorePending
);
