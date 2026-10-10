import { afterEach, describe, expect, it, vi } from 'vitest';
import '@/library/registry';

// test/unit/library/tuiAvailability.test.ts
// 真实 entry 与 eager-glob registry 的开发验证门控；覆写 test.env 后重新装配，不用假 manifest 替代行为。
// 与 registry.test 一样先在模块装载阶段转换默认网格的依赖，避免全量并发时首次转换占用单项行为的计时。

afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
});

describe('TUI development validation availability', () => {
    it.each([
        { name: 'a missing opt-in', dev: true, flag: undefined, enabled: false },
        { name: 'an explicit false opt-in', dev: true, flag: 'false', enabled: false },
        { name: 'DEV and an explicit true opt-in', dev: true, flag: 'true', enabled: true },
        { name: 'production even with the opt-in true', dev: false, flag: 'true', enabled: false },
    ])('resolves $name', async ({ dev, flag, enabled }) => {
        vi.resetModules();
        vi.stubEnv('DEV', dev);
        vi.stubEnv('PROD', !dev);
        vi.stubEnv('VITE_LIBRARY_TUI', flag);
        const { default: tui } = await import('@/library/suites/tui/entry');
        const registry = await import('@/library/registry');

        expect(tui.available).toBe(enabled);
        expect(Object.keys(tui.surfaces).sort()).toEqual(enabled ? ['account', 'artist', 'collection', 'home'] : []);
        expect(registry.listLibrarySuites().map(suite => suite.id)).toEqual(enabled ? ['grid', 'tui'] : ['grid']);
        expect(registry.hasLibrarySuite('tui')).toBe(enabled);

        for (const surface of ['home', 'collection', 'artist'] as const) {
            const grid = registry.resolveLibrarySurface(surface, 'grid');
            const resolved = registry.resolveLibrarySurface(surface, 'tui');
            if (enabled) {
                expect(resolved.suiteId).toBe('tui');
                expect(resolved.component).toBe(tui.surfaces[surface]!.component);
                expect(resolved.component).not.toBe(grid.component);
            } else {
                expect(resolved).toBe(grid);
                expect(resolved.isFallback).toBe(false);
                // 关闭的 TUI 和任意未知 id 共享实际 grid 结果，不能重新引入无界缓存对象。
                for (let index = 0; index < 100; index += 1) {
                    expect(registry.resolveLibrarySurface(surface, `unknown-suite-${index}`)).toBe(resolved);
                }
            }
        }
        // account surface：A6 起 TUI 有自己的（启用时解析到 TUI，不是回退）；关闭时与网格共用同一个解析结果。
        const gridAccount = registry.resolveLibrarySurface('account', 'grid');
        const tuiAccount = registry.resolveLibrarySurface('account', 'tui');
        if (enabled) {
            expect(tuiAccount.suiteId).toBe('tui');
            expect(tuiAccount.isFallback).toBe(false);
            expect(tuiAccount.component).toBe(tui.surfaces.account!.component);
            expect(tuiAccount.component).not.toBe(gridAccount.component);
        } else {
            expect(tuiAccount).toBe(gridAccount);
            expect(tuiAccount.suiteId).toBe('grid');
            expect(tuiAccount.isFallback).toBe(false);
        }
    });
});
