import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    MOTION_SURFACE_IDS,
    readReducedMotion,
    resolveReducedMotion,
    useMotionSettingsStore,
} from '@/stores/useMotionSettingsStore';

// test/unit/stores/motionSettingsStore.test.ts
// issue #370 的回归点：系统的动画偏好本身不再降级任何东西，只有用户显式选择才会。
// 这条一旦松掉，Windows 关掉「动画效果」的用户又会拿到一个没有任何解释的瞬移界面。

const fullMotion = {
    reducedMotionSurfaces: Object.fromEntries(
        MOTION_SURFACE_IDS.map(surface => [surface, false]),
    ) as Record<(typeof MOTION_SURFACE_IDS)[number], boolean>,
    followSystemReducedMotion: false,
    systemPrefersReducedMotion: false,
};

describe('motion settings store', () => {
    let values: Map<string, string>;

    beforeEach(() => {
        values = new Map();
        const storage = {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
        };
        vi.stubGlobal('localStorage', storage);
        vi.stubGlobal('window', { localStorage: storage });
        useMotionSettingsStore.setState({ ...fullMotion });
    });

    afterEach(() => {
        useMotionSettingsStore.setState({ ...fullMotion });
        vi.unstubAllGlobals();
    });

    // 这两条要重新 import 一份模块：store 的初始值只在模块加载时从 localStorage 读一次，
    // 复用上面那份已经加载好的 store 测不到它。
    it('defaults every surface to full motion when nothing is stored', async () => {
        vi.resetModules();
        const fresh = await import('@/stores/useMotionSettingsStore');
        const state = fresh.useMotionSettingsStore.getState();

        expect(state.followSystemReducedMotion).toBe(false);
        MOTION_SURFACE_IDS.forEach(surface => {
            expect(fresh.resolveReducedMotion(state, surface)).toBe(false);
        });
    });

    it('restores the stored choices on load', async () => {
        values.set('reduce_motion_lattice', 'true');
        values.set('reduce_motion_follow_system', 'true');
        vi.resetModules();
        const fresh = await import('@/stores/useMotionSettingsStore');
        const state = fresh.useMotionSettingsStore.getState();

        expect(state.reducedMotionSurfaces.lattice).toBe(true);
        expect(state.reducedMotionSurfaces.monetBackground).toBe(false);
        expect(state.followSystemReducedMotion).toBe(true);
    });

    it('ignores the system preference until the listener opts into following it', () => {
        useMotionSettingsStore.setState({ systemPrefersReducedMotion: true });
        expect(readReducedMotion('lattice')).toBe(false);

        useMotionSettingsStore.getState().handleToggleFollowSystemReducedMotion(true);
        expect(readReducedMotion('lattice')).toBe(true);
    });

    it('reduces only the surface that was switched off', () => {
        useMotionSettingsStore.getState().handleToggleReducedMotionSurface('lattice', true);

        expect(readReducedMotion('lattice')).toBe(true);
        expect(readReducedMotion('monetBackground')).toBe(false);
        expect(readReducedMotion('settingsScroll')).toBe(false);
    });

    it('persists each surface under its own key', () => {
        useMotionSettingsStore.getState().handleToggleReducedMotionSurface('transitionOverlay', true);
        expect(localStorage.getItem('reduce_motion_transitionOverlay')).toBe('true');

        useMotionSettingsStore.getState().handleToggleReducedMotionSurface('transitionOverlay', false);
        expect(localStorage.getItem('reduce_motion_transitionOverlay')).toBe('false');
    });

    it('keeps a surface reduced when the system preference is also on', () => {
        useMotionSettingsStore.getState().handleToggleReducedMotionSurface('lattice', true);
        useMotionSettingsStore.setState({ followSystemReducedMotion: true, systemPrefersReducedMotion: true });
        expect(readReducedMotion('lattice')).toBe(true);

        // 关掉跟随系统不应该把这一面自己的选择也一起关掉。
        useMotionSettingsStore.getState().handleToggleFollowSystemReducedMotion(false);
        expect(readReducedMotion('lattice')).toBe(true);
        expect(readReducedMotion('uiMicroMotion')).toBe(false);
    });

    // 纯 CSS 的动效读 `<html data-reduce-motion>`。这个属性由 store 自己同步，所以主窗口之外的根
    // （远程控制窗口、OBS 源）只要 import 了 store 就能拿到，不依赖 App 挂载。
    describe('the <html> attribute read by CSS-only animations', () => {
        let attributes: Map<string, string>;

        beforeEach(() => {
            attributes = new Map();
            vi.stubGlobal('document', {
                documentElement: {
                    setAttribute: (name: string, value: string) => attributes.set(name, value),
                    removeAttribute: (name: string) => attributes.delete(name),
                },
            });
        });

        it('lists every reduced surface as a space separated word for `~=` selectors', () => {
            useMotionSettingsStore.getState().handleToggleReducedMotionSurface('lattice', true);
            useMotionSettingsStore.getState().handleToggleReducedMotionSurface('uiMicroMotion', true);
            expect(attributes.get('data-reduce-motion')).toBe('lattice uiMicroMotion');

            useMotionSettingsStore.getState().handleToggleReducedMotionSurface('lattice', false);
            expect(attributes.get('data-reduce-motion')).toBe('uiMicroMotion');
        });

        it('drops the attribute once everything is back to full motion', () => {
            useMotionSettingsStore.getState().handleToggleReducedMotionSurface('settingsScroll', true);
            useMotionSettingsStore.getState().handleToggleReducedMotionSurface('settingsScroll', false);
            expect(attributes.has('data-reduce-motion')).toBe(false);
        });

        it('follows the system preference only while the listener opts in', () => {
            useMotionSettingsStore.setState({ systemPrefersReducedMotion: true });
            expect(attributes.has('data-reduce-motion')).toBe(false);

            useMotionSettingsStore.getState().handleToggleFollowSystemReducedMotion(true);
            expect(attributes.get('data-reduce-motion')).toBe(MOTION_SURFACE_IDS.join(' '));
        });

        it('is already written when the module finishes loading', async () => {
            values.set('reduce_motion_monetBackground', 'true');
            vi.resetModules();
            await import('@/stores/useMotionSettingsStore');
            expect(attributes.get('data-reduce-motion')).toBe('monetBackground');
        });
    });
});
