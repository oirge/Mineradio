import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/library/registry';
import {
    chooseLibrarySuite,
    getActiveLibrarySuiteId,
    LIBRARY_HOME_SESSION_KEY,
    listLibrarySuiteOptions,
    resolveCurrentLibrarySessionKey,
} from '@/library/app/librarySuiteChoice';
import { switchLibrarySuite } from '@/library/app/switchLibrarySuite';
import { hasLibrarySuiteChoice, resolveActiveLibrarySuiteId } from '@/library/registry';
import { useLibrarySuiteStore } from '@/library/core/state/useLibrarySuiteStore';
import { registerLibrarySessionFlush } from '@/library/core/state/useLibraryBrowseSessionStore';
import { useCollectionNavigationStore } from '@/stores/useCollectionNavigationStore';
import { COMMAND_PALETTE_COMMANDS } from '@/components/command-palette/commandRegistry';
import type { CommandPaletteContext } from '@/components/command-palette/types';
import type { GridViewCollectionDescriptor } from '@/library/core/contracts/collection';

// test/unit/library/app/librarySuiteChoice.test.ts
// 正式 suite 选项（B0）的 app 层：store 里的选择可能不可用（开发阶段的初始选择 bravais 还没合入、旧记录），
// 展示与比较一律用实际生效的 suite；切换经当前会话 key 走 switchLibrarySuite；只有一套可用时没得选。
// 真实 registry：测试配置启用了 TUI，所以有 grid 与 tui 两套。

const album = (id: string): GridViewCollectionDescriptor => ({
    source: 'online',
    providerId: 'netease',
    id,
    name: `Album ${id}`,
    type: 'album',
} as unknown as GridViewCollectionDescriptor);

let storage: Map<string, string>;

beforeEach(() => {
    storage = new Map();
    vi.stubGlobal('localStorage', {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
    });
    useCollectionNavigationStore.getState().clear();
});

afterEach(() => {
    vi.unstubAllGlobals();
    useLibrarySuiteStore.setState({ suite: 'grid' });
    useCollectionNavigationStore.getState().clear();
});

describe('effective library suite', () => {
    it('resolves an unavailable initial choice and unknown ids to grid', () => {
        expect(resolveActiveLibrarySuiteId('bravais')).toBe('grid');
        expect(resolveActiveLibrarySuiteId('renderer')).toBe('grid');
        expect(resolveActiveLibrarySuiteId('tui')).toBe('tui');

        useLibrarySuiteStore.setState({ suite: 'bravais' });
        expect(getActiveLibrarySuiteId()).toBe('grid');
        useLibrarySuiteStore.setState({ suite: 'tui' });
        expect(getActiveLibrarySuiteId()).toBe('tui');
    });

    it('lists the available suites as options, default first', () => {
        expect(listLibrarySuiteOptions()).toEqual([
            { id: 'grid', labelKey: 'libraryTui.rendererGrid' },
            { id: 'tui', labelKey: 'libraryTui.rendererTui' },
        ]);
        expect(listLibrarySuiteOptions()).toBe(listLibrarySuiteOptions());
    });
});

describe('switching suites', () => {
    it('treats choosing the suite already in effect as no choice: nothing flushed, nothing written', () => {
        useLibrarySuiteStore.setState({ suite: 'bravais' });
        const flush = vi.fn();
        const unregister = registerLibrarySessionFlush('home', flush);

        switchLibrarySuite('home', 'grid');

        expect(flush).not.toHaveBeenCalled();
        expect(useLibrarySuiteStore.getState().suite).toBe('bravais');
        expect(storage.has('library_suite')).toBe(false);
        unregister();
    });

    it('flushes the session, then stores and persists a real switch', () => {
        useLibrarySuiteStore.setState({ suite: 'bravais' });
        const flush = vi.fn();
        const unregister = registerLibrarySessionFlush('home', flush);

        switchLibrarySuite('home', 'tui');

        expect(flush).toHaveBeenCalledTimes(1);
        expect(useLibrarySuiteStore.getState().suite).toBe('tui');
        expect(storage.get('library_suite')).toBe('tui');

        switchLibrarySuite('home', 'grid');
        expect(useLibrarySuiteStore.getState().suite).toBe('grid');
        expect(storage.get('library_suite')).toBe('grid');
        unregister();
    });

    it('ignores ids this build does not have', () => {
        switchLibrarySuite('home', 'bravais');
        switchLibrarySuite('home', 'nope');
        expect(useLibrarySuiteStore.getState().suite).toBe('grid');
        expect(storage.has('library_suite')).toBe(false);
    });
});

describe('current session key', () => {
    it('is the home key on the home screen and the top layer of the stack otherwise', () => {
        expect(resolveCurrentLibrarySessionKey()).toBe(LIBRARY_HOME_SESSION_KEY);
        useCollectionNavigationStore.getState().openRoot(album('a'), 'home');
        expect(resolveCurrentLibrarySessionKey()).toBe('online:netease:album:a');
        useCollectionNavigationStore.getState().push(album('b'));
        expect(resolveCurrentLibrarySessionKey()).toBe('online:netease:album:b');
    });

    it('is what the settings choice flushes', () => {
        useCollectionNavigationStore.getState().openRoot(album('a'), 'home');
        const flush = vi.fn();
        const unregister = registerLibrarySessionFlush('online:netease:album:a', flush);

        chooseLibrarySuite('tui');

        expect(flush).toHaveBeenCalledTimes(1);
        expect(useLibrarySuiteStore.getState().suite).toBe('tui');
        unregister();
    });
});

describe('whether there is a choice', () => {
    it('offers one with grid and the dev TUI available', () => {
        expect(hasLibrarySuiteChoice()).toBe(true);
    });

    it('hides the settings commands with the same predicate the settings section uses', () => {
        const context = (canChoose: boolean) => ({
            settings: { canChooseLibrarySuite: () => canChoose },
        } as unknown as CommandPaletteContext);
        for (const id of ['settings-library-suite', 'library-suite-picker']) {
            const command = COMMAND_PALETTE_COMMANDS.find(candidate => candidate.id === id);
            expect(command?.isAvailable?.(context(true))).toBe(true);
            expect(command?.isAvailable?.(context(false))).toBe(false);
        }
    });

    describe('with only grid available', () => {
        afterEach(() => {
            vi.unstubAllEnvs();
            vi.resetModules();
        });

        it('offers none', async () => {
            vi.resetModules();
            vi.stubEnv('VITE_LIBRARY_TUI', 'false');
            const registry = await import('@/library/registry');
            expect(registry.listLibrarySuites().map(suite => suite.id)).toEqual(['grid']);
            expect(registry.hasLibrarySuiteChoice()).toBe(false);
            // 初始选择不可用时回退网格（B0 合入时 bravais 不在 registry 里）。
            expect(registry.resolveActiveLibrarySuiteId('bravais')).toBe('grid');
        });
    });
});
