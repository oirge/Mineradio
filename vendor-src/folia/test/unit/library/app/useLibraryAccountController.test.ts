// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// test/unit/library/app/useLibraryAccountController.test.ts
// 应用持有的在线账户 controller（A4）用真实的默认装配（omni、账户 store、provider 注册表）跑：
// - 原 test/unit/onlineMusic/onlineProviderPlatform.test.ts 的四条（Folium mod 源运行时增删：列表跟着注册表、
//   切到 mod 源后搜索浮层跟着走、不经切换写入的当前平台也跟、mod 源消失时回落网易并记住）迁到这里，
//   切换改成「请求 + 确认」（每次切换都要确认）；
// - 宿主表经 ref 现读最新的一份；没有刷新器的平台不刷新；卸载时 dispose。

const storage = vi.hoisted(() => {
    // jsdom 环境下 node 自带的 localStorage 占位没有 getItem，store 初始化会直接抛。
    const entries = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
        value: {
            getItem: (key: string) => (entries.has(key) ? entries.get(key)! : null),
            setItem: (key: string, value: string) => { entries.set(key, String(value)); },
            removeItem: (key: string) => { entries.delete(key); },
            clear: () => { entries.clear(); },
            key: (index: number) => Array.from(entries.keys())[index] ?? null,
            get length() { return entries.size; },
        },
        configurable: true,
        writable: true,
    });
    return entries;
});

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useLibraryAccountController, type LibraryAccountHostTables } from '@/library/app/useLibraryAccountController';
import { useLibraryAccountProviders } from '@/library/core/bindings/useLibraryAccount';
import type { LibraryAccountController } from '@/library/core/contracts/account';
import { registerOnlineMusicProvider, unregisterOnlineMusicProvider } from '@/services/onlineMusic/providerRegistry';
import { useOnlineProviderAccountStore } from '@/stores/useOnlineProviderAccountStore';
import { useSearchNavigationStore } from '@/stores/useSearchNavigationStore';
import type { OnlineMusicProvider, OnlineProviderId, ProviderAccountSummary } from '@/types/onlineMusic';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MOD_PROVIDER_ID = 'folium.mod-a.source';

// The shape a Folium mod source is adapted to: search and playback, no account.
const modProvider: OnlineMusicProvider = {
    id: MOD_PROVIDER_ID,
    displayName: 'Mod Source',
    shortName: 'Mod',
    capabilities: {
        search: true, playback: true, lyrics: true, auth: false, userLibrary: false,
        playlists: false, albums: false, artists: false, recommendations: false,
        mutations: false, wordByWordLyrics: false,
    },
    normalizeSong: () => ({
        id: '1',
        name: 'Song',
        artists: [],
        album: { id: '', name: '' },
        durationMs: 1,
        sourceRef: { kind: 'online', providerId: MOD_PROVIDER_ID, mediaId: '1' },
    }),
};

let controller: LibraryAccountController | null = null;
let view: { providers: ProviderAccountSummary[]; activeProviderId: OnlineProviderId } | null = null;
let root: Root | null = null;

const Probe = ({ tables }: { tables: LibraryAccountHostTables }) => {
    controller = useLibraryAccountController(tables);
    view = useLibraryAccountProviders(controller);
    return null;
};

const cleanup = { resetForProviderSwitch: vi.fn() };
const tables = (overrides: Partial<LibraryAccountHostTables> = {}): LibraryAccountHostTables => ({
    refreshers: {},
    logouts: {},
    switchCleanup: cleanup,
    ...overrides,
});

const mount = (initial = tables()) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(React.createElement(Probe, { tables: initial })));
};
const rerender = (next: LibraryAccountHostTables) => {
    act(() => root!.render(React.createElement(Probe, { tables: next })));
};

/** 请求切换并立即确认（相当于用户在确认框里点了确认）。 */
const switchAndConfirm = async (providerId: OnlineProviderId) => {
    const current = controller!;
    let result: Awaited<ReturnType<LibraryAccountController['requestSwitch']>> | null = null;
    await act(async () => {
        const request = current.requestSwitch(providerId);
        const pending = current.getSnapshot().pendingSwitch;
        expect(pending?.to).toBe(providerId);
        await current.confirmSwitch(pending!.id);
        result = await request;
    });
    return result;
};

beforeEach(() => {
    cleanup.resetForProviderSwitch.mockClear();
    useOnlineProviderAccountStore.getState().setActiveProviderId('netease');
    useSearchNavigationStore.setState({ searchSourceTab: 'netease' });
});

afterEach(() => {
    act(() => root?.unmount());
    root = null;
    controller = null;
    view = null;
    unregisterOnlineMusicProvider(MOD_PROVIDER_ID);
    document.body.replaceChildren();
});

describe('application account controller with Folium mod sources', () => {
    it('lists a provider registered after the home view mounted', () => {
        mount();
        expect(view!.providers.some(provider => provider.providerId === MOD_PROVIDER_ID)).toBe(false);

        act(() => registerOnlineMusicProvider(modProvider));

        expect(view!.providers.find(provider => provider.providerId === MOD_PROVIDER_ID))
            .toMatchObject({ shortName: 'Mod', requiresAccount: false });
    });

    it('switches to a mod source after confirmation and points the search overlay at it', async () => {
        registerOnlineMusicProvider(modProvider);
        mount();

        expect(await switchAndConfirm(MOD_PROVIDER_ID)).toEqual({ status: 'switched', providerId: MOD_PROVIDER_ID, changed: true });

        expect(view!.activeProviderId).toBe(MOD_PROVIDER_ID);
        expect(cleanup.resetForProviderSwitch).toHaveBeenCalledWith(MOD_PROVIDER_ID, 'netease');
        expect(useSearchNavigationStore.getState().searchSourceTab).toBe(MOD_PROVIDER_ID);
    });

    it('follows an active provider set without a switch, as after a restart or session restore', () => {
        registerOnlineMusicProvider(modProvider);
        mount();

        act(() => useOnlineProviderAccountStore.getState().setActiveProviderId(MOD_PROVIDER_ID));

        expect(view!.activeProviderId).toBe(MOD_PROVIDER_ID);
        expect(useSearchNavigationStore.getState().searchSourceTab).toBe(MOD_PROVIDER_ID);
        expect(cleanup.resetForProviderSwitch).not.toHaveBeenCalled();
    });

    it('falls back to NetEase and remembers it when the active mod source goes away', async () => {
        registerOnlineMusicProvider(modProvider);
        useOnlineProviderAccountStore.getState().setActiveProviderId(MOD_PROVIDER_ID);
        mount();
        expect(view!.activeProviderId).toBe(MOD_PROVIDER_ID);

        await act(async () => {
            unregisterOnlineMusicProvider(MOD_PROVIDER_ID);
            await Promise.resolve();
        });

        expect(view!.activeProviderId).toBe('netease');
        expect(view!.providers.some(provider => provider.providerId === MOD_PROVIDER_ID)).toBe(false);
        expect(storage.get('active_online_provider_id')).toBe('netease');
        expect(useSearchNavigationStore.getState().searchSourceTab).toBe('netease');
    });
});

describe('application account controller host tables', () => {
    it('keeps one controller across renders and reads the newest refresher table', async () => {
        registerOnlineMusicProvider(modProvider);
        mount();
        const first = controller;

        // 第一份表里没有 mod 源的刷新器：切过去不刷新。
        await switchAndConfirm(MOD_PROVIDER_ID);
        await switchAndConfirm('netease');

        const refreshMod = vi.fn().mockResolvedValue(true);
        rerender(tables({ refreshers: { [MOD_PROVIDER_ID]: refreshMod } }));
        expect(controller).toBe(first);

        await switchAndConfirm(MOD_PROVIDER_ID);
        expect(refreshMod).toHaveBeenCalledTimes(1);
    });

    it('logs out through the newest logout table', async () => {
        useOnlineProviderAccountStore.getState().updateAccount('netease', {
            status: 'authenticated',
            user: { id: 'u1', nickname: 'U1' },
            collections: [],
            hydration: 'ready',
            freshness: 'fresh',
        });
        const stale = vi.fn().mockResolvedValue(undefined);
        const fresh = vi.fn().mockResolvedValue(undefined);
        mount(tables({ logouts: { netease: stale } }));
        rerender(tables({ logouts: { netease: fresh } }));

        let result: unknown = null;
        await act(async () => {
            result = await controller!.logout('netease');
        });

        expect(result).toEqual({ status: 'logged-out', providerId: 'netease' });
        expect(fresh).toHaveBeenCalledTimes(1);
        expect(stale).not.toHaveBeenCalled();
        useOnlineProviderAccountStore.getState().clearAccount('netease');
    });

    it('disposes the controller on unmount: a pending switch is declined', async () => {
        registerOnlineMusicProvider(modProvider);
        mount();
        const current = controller!;
        const request = current.requestSwitch(MOD_PROVIDER_ID);

        act(() => root!.unmount());
        root = null;

        await expect(request).resolves.toEqual({ status: 'declined', providerId: MOD_PROVIDER_ID, reason: 'disposed' });
        expect(useOnlineProviderAccountStore.getState().activeProviderId).toBe('netease');
    });
});
