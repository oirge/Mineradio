import { useEffect, useRef } from 'react';
import type {
    LibraryHomeListHandle,
    LibraryHomeListState,
    LibraryHomeTabKey,
    LibraryHomeTabsState,
} from '../contracts/homeModel';
import { useLibraryHomeSurfaceStore } from '../state/useLibraryHomeSurfaceStore';

// src/library/core/bindings/useLibraryHomeSurfaceRegistration.ts
// 把首页的页签条与当前列表交给 useLibraryHomeSurfaceStore（做法同 useLibraryDirectorySurfaceRegistration）：
// 句柄经 latest-ref 读最近一次渲染的状态与动作；注册与可交互无关（首页挂着就在），列表不显示时（账户面板、
// 空曲库提示、Navidrome 未配置）传 enabled=false 不注册。注册只写 store，不让注册方重渲染。

export const useLibraryHomeTabsRegistration = ({
    getState,
    setTab,
}: {
    getState: () => LibraryHomeTabsState;
    setTab: (tab: LibraryHomeTabKey) => boolean;
}) => {
    // 渲染时赋值而不是在 effect 里：effect 之前的窗口里读到的会是上一次渲染的状态。
    const latestRef = useRef({ getState, setTab });
    latestRef.current = { getState, setTab };

    useEffect(() => useLibraryHomeSurfaceStore.getState().registerTabs({
        getState: () => latestRef.current.getState(),
        setTab: tab => latestRef.current.setTab(tab),
    }), []);
};

export const useLibraryHomeListRegistration = ({
    enabled,
    getState,
    setSection,
    runAction,
    importPlaylistFile,
}: {
    enabled: boolean;
    getState: () => LibraryHomeListState;
    setSection: LibraryHomeListHandle['setSection'];
    runAction: LibraryHomeListHandle['runAction'];
    importPlaylistFile?: (file: File) => Promise<boolean>;
}) => {
    const latestRef = useRef({ getState, setSection, runAction, importPlaylistFile });
    latestRef.current = { getState, setSection, runAction, importPlaylistFile };
    const canImportPlaylist = Boolean(importPlaylistFile);

    useEffect(() => {
        if (!enabled) return undefined;
        return useLibraryHomeSurfaceStore.getState().registerList({
            getState: () => latestRef.current.getState(),
            setSection: id => latestRef.current.setSection(id),
            runAction: id => latestRef.current.runAction(id),
            ...(canImportPlaylist
                ? { importPlaylistFile: (file: File) => latestRef.current.importPlaylistFile?.(file) ?? Promise.resolve(false) }
                : {}),
        });
    }, [canImportPlaylist, enabled]);
};
