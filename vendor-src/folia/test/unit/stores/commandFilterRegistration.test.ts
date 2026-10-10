import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppViewStore, type CommandFilterHandle } from '../../../src/stores/useAppViewStore';

// test/unit/stores/commandFilterRegistration.test.ts
// 三个网格在切换视图时以不确定的顺序装卸，注册所有权的交接规则必须自己成立，
// 不能依赖「谁先谁后」。

const handle = (name: string): CommandFilterHandle => ({
    getQuery: () => name,
    setQuery: vi.fn(),
    getAnchor: () => null,
});

describe('command filter registration', () => {
    beforeEach(() => {
        useAppViewStore.setState({ commandFilter: null, isCommandFilterOpen: false });
    });

    it('hands ownership to the latest registrant', () => {
        const first = handle('first');
        const second = handle('second');

        useAppViewStore.getState().registerCommandFilter(first);
        useAppViewStore.getState().registerCommandFilter(second);

        expect(useAppViewStore.getState().commandFilter).toBe(second);
    });

    it('ignores a teardown from an owner that has already been replaced', () => {
        const outgoing = handle('outgoing');
        const incoming = handle('incoming');

        const releaseOutgoing = useAppViewStore.getState().registerCommandFilter(outgoing);
        useAppViewStore.getState().registerCommandFilter(incoming);
        // 旧网格的清理晚于新网格的注册——React 卸载顺序不保证，这里必须无害。
        releaseOutgoing();

        expect(useAppViewStore.getState().commandFilter).toBe(incoming);
    });

    it('clears the open flag when the owner goes away', () => {
        const only = handle('only');
        const release = useAppViewStore.getState().registerCommandFilter(only);
        useAppViewStore.getState().setIsCommandFilterOpen(true);

        release();

        expect(useAppViewStore.getState().commandFilter).toBeNull();
        expect(useAppViewStore.getState().isCommandFilterOpen).toBe(false);
    });

    it('counts requests so two in a row both land', () => {
        const before = useAppViewStore.getState().commandPaletteRequest.seq;

        useAppViewStore.getState().requestCommandPalette('filter');
        useAppViewStore.getState().requestCommandPalette('filter');

        expect(useAppViewStore.getState().commandPaletteRequest).toEqual({ seq: before + 2, kind: 'filter' });
    });
});
