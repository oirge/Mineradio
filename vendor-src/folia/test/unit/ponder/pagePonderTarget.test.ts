import { afterEach, describe, expect, it, vi } from 'vitest';
import { openCurrentPagePonder, openSettingsFromPonder, readCurrentPagePonderTarget, readVisiblePagePonderScope, resolvePagePonderTarget } from '@/services/ponder/pagePonderTarget';
import { useAppViewStore } from '@/stores/useAppViewStore';
import { usePonderStore } from '@/stores/usePonderStore';
import { useSettingsModalStore } from '@/stores/useSettingsModalStore';

// test/unit/ponder/pagePonderTarget.test.ts

/** Minimal visible DOM scopes; no renderer registry or UI import is needed by the resolver. */
const mountScopes = (scopes: { id: string; hidden?: boolean; width?: number }[]) => {
    vi.stubGlobal('document', {
        querySelectorAll: () => scopes.map(scope => ({
            dataset: { ponderPageScope: scope.id },
            hidden: scope.hidden,
            getBoundingClientRect: () => ({ width: scope.width ?? 100, height: 100 }),
        })),
    });
    vi.stubGlobal('window', {
        getComputedStyle: (element: { hidden?: boolean }) => ({ display: element.hidden ? 'none' : 'block', visibility: 'visible' }),
    });
};

describe('resolvePagePonderTarget', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        useAppViewStore.setState({ view: 'home' });
        usePonderStore.getState().closePonder();
        usePonderStore.getState().closeNavigation();
        useSettingsModalStore.getState().setIsUserGuideModalOpen(false);
        useSettingsModalStore.getState().closeSettings();
    });

    it.each([
        ['home', 'grid-page'],
        ['player', 'player-page'],
        ['lattice', 'lattice-page'],
    ] as const)('maps %s to its page-level target', (view, targetId) => {
        expect(resolvePagePonderTarget(view)).toBe(targetId);
    });

    it.each([
        'grid-view-page',
        'help-page',
        'settings-page',
    ] as const)('lets the visible %s scope override the underlying main view', targetId => {
        expect(resolvePagePonderTarget('home', targetId)).toBe(targetId);
    });

    it('ignores an unknown page scope', () => {
        expect(resolvePagePonderTarget('player', 'not-a-ponder-target')).toBe('player-page');
    });

    it('distinguishes explicit no target from missing and unknown scopes', () => {
        expect(resolvePagePonderTarget('home', 'none')).toBeNull();
        expect(resolvePagePonderTarget('home', null)).toBe('grid-page');
        expect(resolvePagePonderTarget('home', '')).toBe('grid-page');
        expect(resolvePagePonderTarget('home', 'unknown')).toBe('grid-page');
    });

    it('a visible no-target page overrides the underlying grid without opening a session', () => {
        mountScopes([{ id: 'grid-page' }, { id: 'none' }]);
        expect(readVisiblePagePonderScope()).toBe('none');
        expect(readCurrentPagePonderTarget()).toBeNull();
        expect(openCurrentPagePonder()).toBeNull();
        expect(usePonderStore.getState().session).toBeNull();
    });

    it.each(['settings-page', 'help-page'] as const)('%s still overrides a no-target page', target => {
        mountScopes([{ id: 'none' }, { id: target }]);
        expect(openCurrentPagePonder()).toBe(target);
        expect(usePonderStore.getState().session?.targetId).toBe(target);
    });

    it('ignores unknown, hidden and zero-size scopes above the current page', () => {
        mountScopes([{ id: 'grid-view-page' }, { id: 'none', hidden: true }, { id: 'none', width: 0 }, { id: 'unknown' }]);
        expect(readVisiblePagePonderScope()).toBe('grid-view-page');
        expect(readCurrentPagePonderTarget()).toBe('grid-view-page');
    });

    it('the first UserGuide keeps overview feedback and entry above a no-target page', () => {
        mountScopes([{ id: 'none' }]);
        useSettingsModalStore.getState().setIsUserGuideModalOpen(true);
        expect(readCurrentPagePonderTarget()).toBe('help-page');
        expect(openCurrentPagePonder()).toBe('help-page');
        expect(useSettingsModalStore.getState().isUserGuideModalOpen).toBe(false);
    });

    it('opens the active page target', () => {
        useAppViewStore.setState({ view: 'lattice' });

        expect(openCurrentPagePonder()).toBe('lattice-page');
        expect(usePonderStore.getState().session?.targetId).toBe('lattice-page');
    });

    /**
     * 第一次那道门压在首页上，按页面 scope 解析出来的是海报墙 —— 而它要教的是
     * 「Folia 大致怎么转」。所以这一条必须压过页面 scope。
     */
    it('第一次那道门开的是总览，不是底下那一页', () => {
        useAppViewStore.setState({ view: 'lattice' });
        useSettingsModalStore.getState().setIsUserGuideModalOpen(true);

        expect(openCurrentPagePonder()).toBe('help-page');
        expect(usePonderStore.getState().session?.targetId).toBe('help-page');
        expect(useSettingsModalStore.getState().isUserGuideModalOpen).toBe(false);
    });

    /**
     * 设置窗口是 z-[100]，整个应用里最低的一层浮层：教程层（220）和思索导航页（195）
     * 都压在它上面。从导航页进的那条路只关教程的话，设置会开在导航页底下 ——
     * 屏幕上什么都没变，读起来就是「这颗按钮没反应」。
     */
    it('「直接去那儿」会把教程层和导航页一起收掉，设置才不会开在它们底下', () => {
        const ponder = usePonderStore.getState();
        ponder.openNavigation();
        ponder.openPonder('ponder-basics');
        expect(usePonderStore.getState().isNavigationOpen).toBe(true);

        openSettingsFromPonder('ponderHints');

        expect(usePonderStore.getState().session, '教程层没收掉').toBeNull();
        expect(usePonderStore.getState().isNavigationOpen, '导航页没收掉，设置会被它盖住').toBe(false);
        const settings = useSettingsModalStore.getState().settingsModalState;
        expect(settings.isOpen).toBe(true);
        // 而且要落在那一章讲的那个锚点上，不是设置面板的首页。
        expect(settings.initialAnchor?.id).toBe('ponderHints');
    });
});
