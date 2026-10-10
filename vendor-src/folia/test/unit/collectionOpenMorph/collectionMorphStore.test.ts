import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    reportMorphCapture,
    useCollectionMorphStore,
} from '@/library/suites/grid/transitions/collectionMorphStore';
import type { CollectionMorphCapture } from '@/library/suites/grid/transitions/morphProbes';
import {
    COLLECTION_MORPH_OBSERVATION_WINDOW_MS,
    COLLECTION_MORPH_PLAN_TTL_MS,
    type CollectionMorphHeroMeasured,
    type CollectionMorphPending,
    type CollectionMorphRect,
} from '@/library/suites/grid/transitions/morphGeometry';
import { useCollectionNavigationStore } from '@/stores/useCollectionNavigationStore';
import type { GridViewCollectionDescriptor } from '@/components/app/home/gridViewCollectionAdapters';

// test/unit/collectionOpenMorph/collectionMorphStore.test.ts
// 转场状态机：采集 → 观察窗口 → 计划 → 退出。这些分支以前完全没有测试，而它们的失败
// 方式都是「界面看起来没反应」或者「下次打开时卡片莫名其妙是空的」，靠肉眼很难定位。

const rect = (x: number, y: number, width = 200, height = 200): CollectionMorphRect => ({ x, y, width, height });

const capture = (sourceKey: string | null = 'grid3d:2'): CollectionMorphCapture => ({
    frame: rect(100, 100),
    cover: rect(110, 110, 180, 180),
    coverUrl: 'cover.jpg',
    title: rect(110, 290, 180, 20),
    titleText: 'Playlist',
    sourceKey,
});

const hero = (round = false): CollectionMorphHeroMeasured => ({
    frame: rect(600, 400),
    cover: rect(610, 410, 280, 280),
    coverUrl: 'song.jpg',
    title: rect(620, 700, 200, 24),
    titleText: 'Song',
    key: 'a-1',
    coverReady: true,
    round,
});

const emptyState = {
    pending: null,
    plan: null,
    hero: null,
    lastHome: null,
    lastSource: null,
    lastSourceDepth: 0,
    lastSourceNavigation: null,
    exit: null,
};

/** 使用不同集合构造导航栈，允许测试通过真实 push 模拟后续导航。 */
const openAtDepth = (depth: number) => {
    useCollectionNavigationStore.setState({
        snapshot: {
            origin: 'home',
            stack: Array.from({ length: depth }, (_, index) => ({
                source: 'online', type: 'playlist', id: String(index), name: `Collection ${index}`,
            } as GridViewCollectionDescriptor)),
        },
    });
};

describe('collection morph store', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        useCollectionMorphStore.setState({ ...emptyState });
        useCollectionNavigationStore.setState({ snapshot: null });
    });

    afterEach(() => {
        useCollectionMorphStore.setState({ ...emptyState });
        useCollectionNavigationStore.setState({ snapshot: null });
        vi.useRealTimers();
    });

    describe('reportMorphCapture', () => {
        it('records the navigation state as it was BEFORE the click', () => {
            reportMorphCapture(capture());
            expect(useCollectionMorphStore.getState().pending?.navAtGestureStart).toEqual({ wasOpen: false, depth: 0 });
            expect(useCollectionMorphStore.getState().pending?.capturedAt).toBe(Date.now());
        });

        it('carries the current depth when a collection is already open', () => {
            openAtDepth(2);
            reportMorphCapture(capture('item:42'));
            expect(useCollectionMorphStore.getState().pending?.navAtGestureStart).toEqual({ wasOpen: true, depth: 2 });
        });

        it('drops the capture after the observation window so a centering click never morphs', () => {
            reportMorphCapture(capture());
            expect(useCollectionMorphStore.getState().pending).not.toBeNull();

            vi.advanceTimersByTime(COLLECTION_MORPH_OBSERVATION_WINDOW_MS - 1);
            expect(useCollectionMorphStore.getState().pending).not.toBeNull();

            vi.advanceTimersByTime(1);
            expect(useCollectionMorphStore.getState().pending).toBeNull();
        });

        it('keeps a launched plan alive: ackPending cancels the discard window', () => {
            reportMorphCapture(capture());
            useCollectionMorphStore.getState().commitPlan({ kind: 'morph' });
            useCollectionMorphStore.getState().ackPending();

            // 观察窗口已经过去（discard 会调 consume 清掉 plan），但还没到 plan 自己的 TTL。
            vi.advanceTimersByTime(COLLECTION_MORPH_OBSERVATION_WINDOW_MS + 100);
            expect(useCollectionMorphStore.getState().plan).toEqual({ kind: 'morph' });
        });
    });

    describe('plan lifetime', () => {
        it('expires on its TTL so a stale plan cannot re-trigger a later mount', () => {
            useCollectionMorphStore.getState().commitPlan({ kind: 'cascade' });
            vi.advanceTimersByTime(COLLECTION_MORPH_PLAN_TTL_MS - 1);
            expect(useCollectionMorphStore.getState().plan).toEqual({ kind: 'cascade' });

            vi.advanceTimersByTime(1);
            expect(useCollectionMorphStore.getState().plan).toBeNull();
        });

        it('restarts the TTL on a fresh plan', () => {
            useCollectionMorphStore.getState().commitPlan({ kind: 'cascade' });
            vi.advanceTimersByTime(COLLECTION_MORPH_PLAN_TTL_MS - 100);
            useCollectionMorphStore.getState().commitPlan({ kind: 'morph' });
            vi.advanceTimersByTime(COLLECTION_MORPH_PLAN_TTL_MS - 100);
            expect(useCollectionMorphStore.getState().plan).toEqual({ kind: 'morph' });
        });
    });

    describe('armExit', () => {
        it('does nothing without a remembered home card', () => {
            useCollectionMorphStore.getState().armExit(hero(), []);
            expect(useCollectionMorphStore.getState().exit).toBeNull();
        });

        it('keeps the click-time rectangles when the home card cannot be re-measured', () => {
            const home = { ...capture(), navAtGestureStart: { wasOpen: false, depth: 0 }, capturedAt: 1 } as CollectionMorphPending;
            useCollectionMorphStore.setState({ lastHome: home, plan: { kind: 'morph' } });

            useCollectionMorphStore.getState().armExit(hero(), []);

            const exit = useCollectionMorphStore.getState().exit;
            expect(exit?.to?.frame).toEqual(home.frame);
            expect(exit?.nested).toBe(false);
            // 退出时 plan 必须让位，否则网格会一直等着一个不会发生的入场。
            expect(useCollectionMorphStore.getState().plan).toBeNull();
            expect(useCollectionMorphStore.getState().hero).toBeNull();
        });
    });

    describe('armNestedExit', () => {
        it('lands on the source card captured for the current nesting level', () => {
            openAtDepth(2);
            useCollectionMorphStore.getState().setLastSource(
                { ...capture('item:7'), navAtGestureStart: { wasOpen: true, depth: 1 }, capturedAt: 1 } as CollectionMorphPending,
                2,
            );

            useCollectionMorphStore.getState().armNestedExit(hero(), []);

            expect(useCollectionMorphStore.getState().exit?.sourceKey).toBe('item:7');
            expect(useCollectionMorphStore.getState().exit?.nested).toBe(true);
        });

        it.each([false, true])('rejects a later push at the same depth (same collection: %s)', (sameCollection) => {
            openAtDepth(2);
            const previous = useCollectionNavigationStore.getState().snapshot!;
            const store = useCollectionMorphStore.getState();
            store.setLastSource(
                { ...capture('item:7'), navAtGestureStart: { wasOpen: true, depth: 1 }, capturedAt: 1 },
                2,
            );
            store.consume();
            // Browser back bypasses armNestedExit. Even reopening the same collection
            // must not inherit the previous navigation's source after capture expiry.
            useCollectionNavigationStore.getState().restore({ ...previous, stack: previous.stack.slice(0, 1) });
            reportMorphCapture(capture('item:8'));
            vi.advanceTimersByTime(COLLECTION_MORPH_OBSERVATION_WINDOW_MS);
            useCollectionNavigationStore.getState().push(
                sameCollection ? previous.stack[1] : { ...previous.stack[1], id: 'other' },
            );

            store.armNestedExit(hero(), []);

            expect(useCollectionMorphStore.getState().exit?.sourceKey).toBeNull();
        });

        it('releases the source after a nested exit finishes', () => {
            openAtDepth(2);
            const store = useCollectionMorphStore.getState();
            store.setLastSource(
                { ...capture('item:7'), navAtGestureStart: { wasOpen: true, depth: 1 }, capturedAt: 1 },
                2,
            );
            store.consume();
            store.armNestedExit(hero(), []);
            expect(useCollectionMorphStore.getState().exit?.sourceKey).toBe('item:7');

            store.consume();

            expect(useCollectionMorphStore.getState()).toMatchObject({
                lastSource: null, lastSourceDepth: 0, lastSourceNavigation: null,
            });
        });

        it('refuses a source captured at another depth (async push whose capture expired)', () => {
            openAtDepth(2);
            useCollectionMorphStore.getState().setLastSource(
                { ...capture('item:7'), navAtGestureStart: { wasOpen: true, depth: 0 }, capturedAt: 1 } as CollectionMorphPending,
                1,
            );

            useCollectionMorphStore.getState().armNestedExit(hero(), []);

            // null = 原地收缩，而不是飞向一张对不上的卡片。
            expect(useCollectionMorphStore.getState().exit?.sourceKey).toBeNull();
        });
    });

    describe('consume', () => {
        it('keeps lastHome so the eventual back-out still has a landing target', () => {
            const home = { ...capture(), navAtGestureStart: { wasOpen: false, depth: 0 }, capturedAt: 1 } as CollectionMorphPending;
            useCollectionMorphStore.setState({ lastHome: home });

            useCollectionMorphStore.getState().consume();

            expect(useCollectionMorphStore.getState().lastHome).toBe(home);
        });

        it('keeps a capture that arrived after the exit was armed (reopen during the exit)', () => {
            const late = { ...capture(), navAtGestureStart: { wasOpen: false, depth: 0 }, capturedAt: 200 } as CollectionMorphPending;
            useCollectionMorphStore.setState({
                pending: late,
                exit: { from: hero(), to: null, squad: [], nested: false, sourceKey: null, armedAt: 100 },
            });

            useCollectionMorphStore.getState().consume();

            expect(useCollectionMorphStore.getState().pending).toBe(late);
            expect(useCollectionMorphStore.getState().exit).toBeNull();
        });

        it('drops a capture older than the armed exit', () => {
            const stale = { ...capture(), navAtGestureStart: { wasOpen: false, depth: 0 }, capturedAt: 50 } as CollectionMorphPending;
            useCollectionMorphStore.setState({
                pending: stale,
                exit: { from: hero(), to: null, squad: [], nested: false, sourceKey: null, armedAt: 100 },
            });

            useCollectionMorphStore.getState().consume();

            expect(useCollectionMorphStore.getState().pending).toBeNull();
        });
    });

    it('clear wipes every remembered payload', () => {
        const home = { ...capture(), navAtGestureStart: { wasOpen: false, depth: 0 }, capturedAt: 1 } as CollectionMorphPending;
        useCollectionMorphStore.setState({
            pending: home,
            plan: { kind: 'morph' },
            hero: hero(),
            lastHome: home,
            lastSource: home,
            lastSourceDepth: 1,
            exit: { from: hero(), to: null, squad: [], nested: false, sourceKey: null, armedAt: 1 },
        });

        useCollectionMorphStore.getState().clear();

        expect(useCollectionMorphStore.getState()).toMatchObject(emptyState);
    });
});
