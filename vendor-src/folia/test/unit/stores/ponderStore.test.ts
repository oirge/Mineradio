import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// test/unit/stores/ponderStore.test.ts
// 思索的会话状态与持久化。要紧的是两条容错方向：读坏的可见性退回 unseen，
// 读不到的「已看过」当作没看过 —— 宁可多提示，也不能让功能对某个用户彻底消失。

describe('ponder store', () => {
    let values: Map<string, string>;

    const installStorage = (throwOnRead = false, throwOnWrite = false) => {
        const storage = {
            getItem: (key: string) => {
                if (throwOnRead) throw new Error('blocked');
                return values.get(key) ?? null;
            },
            setItem: (key: string, value: string) => {
                if (throwOnWrite) throw new Error('blocked');
                values.set(key, value);
            },
        };
        vi.stubGlobal('localStorage', storage);
        vi.stubGlobal('window', { localStorage: storage });
        vi.resetModules();
    };

    beforeEach(() => {
        values = new Map();
        installStorage();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.resetModules();
    });

    const load = async () => (await import('@/stores/usePonderStore')).usePonderStore;

    it('可见性默认为 unseen', async () => {
        const store = await load();
        expect(store.getState().ponderHintVisibility).toBe('unseen');
    });

    it('读到非法可见性值时退回 unseen', async () => {
        values.set('ponder_hint_visibility', 'sometimes');
        installStorage();
        const store = await load();
        expect(store.getState().ponderHintVisibility).toBe('unseen');
    });

    it('可见性设置落盘并回读', async () => {
        const store = await load();
        store.getState().setPonderHintVisibility('unseen');

        expect(values.get('ponder_hint_visibility')).toBe('unseen');
        installStorage();
        vi.resetModules();
        const reloaded = (await import('@/stores/usePonderStore')).usePonderStore;
        expect(reloaded.getState().ponderHintVisibility).toBe('unseen');
    });

    it('开启教程会把该目标记成已看过并落盘', async () => {
        const store = await load();
        store.getState().openPonder('panel-slide');

        expect(store.getState().seenTargetIds.has('panel-slide')).toBe(true);
        expect(values.get('folia_ponder_seen')).toBe('panel-slide');
    });

    it('开启教程会清掉悬停态，避免胶囊留在教程层底下', async () => {
        const store = await load();
        store.getState().setHoveredTargetId('player-bar');
        store.getState().openPonder('player-bar');

        expect(store.getState().hoveredTargetId).toBeNull();
    });

    it('stepScene 在场景之间循环，两个方向都绕回', async () => {
        const store = await load();
        store.getState().openPonder('panel-slide');

        store.getState().stepScene(1, 3);
        expect(store.getState().session?.sceneIndex).toBe(1);

        store.getState().stepScene(-1, 3);
        expect(store.getState().session?.sceneIndex).toBe(0);

        store.getState().stepScene(-1, 3);
        expect(store.getState().session?.sceneIndex).toBe(2);

        store.getState().stepScene(1, 3);
        expect(store.getState().session?.sceneIndex).toBe(0);
    });

    it('没有会话时 stepScene 无操作', async () => {
        const store = await load();
        store.getState().stepScene(1, 3);
        expect(store.getState().session).toBeNull();
    });

    it('closePonder 清掉会话和暂停态', async () => {
        const store = await load();
        store.getState().openPonder('player-bar');
        store.getState().setPaused(true);
        store.getState().closePonder();

        expect(store.getState().session).toBeNull();
        expect(store.getState().isPaused).toBe(false);
    });

    it('已看过记录跨会话保留', async () => {
        values.set('folia_ponder_seen', 'player-bar');
        installStorage();
        const store = await load();

        expect(store.getState().seenTargetIds.has('player-bar')).toBe(true);
        expect(store.getState().seenTargetIds.has('panel-slide')).toBe(false);
    });

    it('localStorage 读不到时当作没看过，而不是当作已看过', async () => {
        installStorage(true);
        const store = await load();

        expect(store.getState().seenTargetIds.size).toBe(0);
    });

    it('localStorage 写不进去时不抛，状态仍然更新', async () => {
        installStorage(false, true);
        const store = await load();

        expect(() => store.getState().openPonder('player-bar')).not.toThrow();
        expect(store.getState().seenTargetIds.has('player-bar')).toBe(true);
    });

    it('重复标记已看过不重复写盘', async () => {
        const store = await load();
        store.getState().markPonderSeen('player-bar');
        const first = values.get('folia_ponder_seen');
        values.delete('folia_ponder_seen');
        store.getState().markPonderSeen('player-bar');

        expect(first).toBe('player-bar');
        expect(values.has('folia_ponder_seen')).toBe(false);
    });
});
