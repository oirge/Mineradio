import { collectionKey } from '../core/model/collectionIdentity';
import { useLibrarySuiteStore } from '../core/state/useLibrarySuiteStore';
import type { LibrarySuiteId } from '../core/contracts/suite';
import { getActiveGridViewCollection, useCollectionNavigationStore } from '../../stores/useCollectionNavigationStore';
import { listLibrarySuites, resolveActiveLibrarySuiteId } from '../registry';
import { switchLibrarySuite } from './switchLibrarySuite';

// src/library/app/librarySuiteChoice.ts
// 正式设置项（界面设置的「资料库界面」与命令面板的 picker）用的 suite 选择入口：从集合导航快照算出当前会话 key，
// 再走与 DEV 浮层同一条 switchLibrarySuite。展示「当前 suite」一律用实际生效的那套（store 的值可能不可用）。

/** 首页上切 suite 时交给 switchLibrarySuite 的会话 key（首页没有集合浏览会话，冲刷什么都不做）。 */
export const LIBRARY_HOME_SESSION_KEY = 'home';

/**
 * 当前的浏览会话 key：导航栈顶那一层的 collectionKey（集合页与歌手页都是），在首页时是 LIBRARY_HOME_SESSION_KEY。
 * 与集合宿主交给 DEV 浮层的 key 同一个算法（栈顶 → collectionKey）。
 */
export const resolveCurrentLibrarySessionKey = (): string => {
    const active = getActiveGridViewCollection(useCollectionNavigationStore.getState().snapshot);
    return active ? collectionKey(active) : LIBRARY_HOME_SESSION_KEY;
};

/** 用户在设置或命令面板里选了一套 suite。 */
export const chooseLibrarySuite = (suiteId: LibrarySuiteId): void => {
    switchLibrarySuite(resolveCurrentLibrarySessionKey(), suiteId);
};

export type LibrarySuiteOption = { id: LibrarySuiteId; labelKey: string };

// 可用的 suite 在构建时就定了，选项算一次，引用稳定。
const SUITE_OPTIONS: readonly LibrarySuiteOption[] = Object.freeze(
    listLibrarySuites().map(suite => ({ id: suite.id, labelKey: suite.labelKey })),
);

/** 设置项与命令面板列出的选项：registry 里可用的 suite（默认 suite 在最前）。 */
export const listLibrarySuiteOptions = (): readonly LibrarySuiteOption[] => SUITE_OPTIONS;

/** 此刻实际生效的 suite（非响应式，命令面板用）。 */
export const getActiveLibrarySuiteId = (): LibrarySuiteId => (
    resolveActiveLibrarySuiteId(useLibrarySuiteStore.getState().suite)
);

/** 实际生效的 suite（响应式，设置项与 DEV 浮层用）。 */
export const useActiveLibrarySuiteId = (): LibrarySuiteId => (
    useLibrarySuiteStore(state => resolveActiveLibrarySuiteId(state.suite))
);
