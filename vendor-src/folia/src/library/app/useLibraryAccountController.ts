import { useEffect, useRef, useState } from 'react';
import type { OnlineProviderId } from '../../types/onlineMusic';
import type {
    LibraryAccountController,
    LibraryAccountSnapshot,
    LibraryProviderSwitchCleanupPort,
} from '../core/contracts/account';
import { createProviderAccountController } from '../core/services/providerAccountController';
import { createProviderAccountDeps } from '../core/services/providerAccountDeps';
import { useLibraryAccountSelector } from '../core/bindings/useLibraryAccount';
import { useSearchNavigationStore } from '../../stores/useSearchNavigationStore';

// src/library/app/useLibraryAccountController.ts
// 应用持有的在线账户 controller（Library v2 · A4）：App 里调用一次——per-provider 的刷新器与登出只有 App 有。
// controller 只建一次，寿命跟着调用方（App 卸载时 dispose）；刷新、登出与切换清理经 ref 指向每次渲染的最新实现，
// 所以 controller 不随渲染重建。另外承担原 useOnlineProviderPlatform 的副作用：搜索浮层的在线来源跟着当前平台走。

export type LibraryAccountHostTables = {
    /** per-provider 账户刷新（App 的 onlineProviderRefreshers）；没有刷新器的平台（mod 源）不刷新。 */
    refreshers: Partial<Record<OnlineProviderId, () => Promise<unknown>>>;
    /** per-provider 登出（App 的 onlineProviderLogouts）；没有登出实现的平台 no-op。 */
    logouts: Partial<Record<OnlineProviderId, () => Promise<void>>>;
    /** 确认切换后的清理（createLibraryAccountSwitchCleanupPort）。 */
    switchCleanup: LibraryProviderSwitchCleanupPort;
};

const selectActiveProviderId = (snapshot: LibraryAccountSnapshot) => snapshot.activeProviderId;

export const useLibraryAccountController = (tables: LibraryAccountHostTables): LibraryAccountController => {
    // 渲染时赋值（不放 effect）：effect 之前的窗口里事务会读到上一次渲染的表。
    const tablesRef = useRef(tables);
    tablesRef.current = tables;

    const createController = () => createProviderAccountController(createProviderAccountDeps({
        providerAccounts: {
            // 没有刷新器时 resolve undefined：controller 不把它当失败，也不算一次刷新。
            refresh: async providerId => await tablesRef.current.refreshers[providerId]?.(),
            logout: async providerId => {
                await tablesRef.current.logouts[providerId]?.();
            },
        },
        switchCleanup: {
            resetForProviderSwitch: (next, previous) => tablesRef.current.switchCleanup.resetForProviderSwitch(next, previous),
        },
    }));
    // StrictMode 会把 useState 的初始化函数调两次：经 ref 让两次拿到同一个实例，不留一个没人 dispose 的订阅者。
    const seedRef = useRef<LibraryAccountController | null>(null);
    const [controller, setController] = useState(() => (seedRef.current ??= createController()));

    // 卸载时 dispose。开发版 StrictMode 会先模拟一次卸载再挂载：那次 dispose 之后换一个新 controller，
    // 真正卸载时才只 dispose 不重建。
    const disposedRef = useRef(false);
    useEffect(() => {
        if (disposedRef.current) {
            disposedRef.current = false;
            setController(createController());
            return undefined;
        }
        return () => {
            controller.dispose();
            disposedRef.current = true;
        };
        // createController 只读 ref，不进依赖。
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [controller]);

    // 搜索浮层的在线来源跟着当前平台（含启动恢复与回落到网易，不只是用户切换）。
    const activeProviderId = useLibraryAccountSelector(controller, selectActiveProviderId);
    useEffect(() => {
        useSearchNavigationStore.getState().followOnlineProvider(activeProviderId);
    }, [activeProviderId]);

    return controller;
};
