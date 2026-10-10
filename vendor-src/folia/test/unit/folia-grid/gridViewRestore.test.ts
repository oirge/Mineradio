import { describe, expect, it } from 'vitest';
import {
    gridViewStateStorageKey,
    resolveGridRestoreIndex,
    resolveGridRestoreTarget,
    shouldApplyInitialGridFocus,
} from '@/library/suites/grid/shared/gridViewRestore';

// test/unit/folia-grid/gridViewRestore.test.ts
// 网格相机的两条规则：恢复时聚焦到哪张卡，以及初始定位什么时候才允许发生。

const ENTRIES = ['a-0', 'b-0', 'c-0', 'a-1'];
const findEntryIndex = (key: string) => ENTRIES.indexOf(key);
const emptySession = { focusedEntryKey: null, query: '' };

describe('grid restore target', () => {
    it('keys the grid layout by full collection identity under a versioned prefix', () => {
        expect(gridViewStateStorageKey('online:netease:playlist:1')).toBe('folia_gridview_state:v2:online:netease:playlist:1');
    });

    it('prefers the session focus, which another renderer may have moved, over the grid blob', () => {
        const target = resolveGridRestoreTarget(
            { focusedEntryKey: 'a-0', focusedIndex: 0, dragX: 0, dragY: 0 },
            { focusedEntryKey: 'c-0', query: '' },
        );
        expect(target).toEqual({ entryKey: 'c-0', fallbackIndex: 0, hadQuery: false });
    });

    it('falls back to the blob, notes a restored filter, and returns null when there is nothing to restore', () => {
        expect(resolveGridRestoreTarget({ focusedEntryKey: 'b-0', focusedIndex: 1, dragX: 0, dragY: 0 }, emptySession))
            .toEqual({ entryKey: 'b-0', fallbackIndex: 1, hadQuery: false });
        expect(resolveGridRestoreTarget(null, { focusedEntryKey: null, query: 'cedar' })?.hadQuery).toBe(true);
        expect(resolveGridRestoreTarget(null, emptySession)).toBeNull();
    });
});

describe('resolveGridRestoreIndex', () => {
    it('resolves by entry key first, including a later duplicate, because indices drift between opens', () => {
        const target = { entryKey: 'a-1', fallbackIndex: 0, hadQuery: false };
        expect(resolveGridRestoreIndex({ target, itemCount: 4, findEntryIndex, matchIndexes: null })).toBe(3);
    });

    it('maps the entry into the filtered grid when a filter is active', () => {
        const target = { entryKey: 'c-0', fallbackIndex: 0, hadQuery: true };
        expect(resolveGridRestoreIndex({ target, itemCount: 2, findEntryIndex, matchIndexes: [1, 2] })).toBe(1);
    });

    it('falls back to the stored index and clamps it into the grid', () => {
        expect(resolveGridRestoreIndex({ target: { entryKey: 'gone', fallbackIndex: 9, hadQuery: false }, itemCount: 4, findEntryIndex, matchIndexes: null })).toBe(3);
        expect(resolveGridRestoreIndex({ target: { entryKey: null, fallbackIndex: -4, hadQuery: false }, itemCount: 4, findEntryIndex, matchIndexes: null })).toBe(0);
    });

    it('returns -1 when there is nothing to resolve', () => {
        expect(resolveGridRestoreIndex({ target: null, itemCount: 4, findEntryIndex, matchIndexes: null })).toBe(-1);
        expect(resolveGridRestoreIndex({ target: { entryKey: 'a-0', fallbackIndex: 0, hadQuery: false }, itemCount: 0, findEntryIndex, matchIndexes: null })).toBe(-1);
    });
});

describe('shouldApplyInitialGridFocus', () => {
    const fresh = {
        itemCount: 12,
        hasAppliedInitialFocus: false,
        restoreApplied: false,
        restorePending: false,
    };

    it('positions the camera on a brand-new grid', () => {
        expect(shouldApplyInitialGridFocus(fresh)).toBe(true);
    });

    // 这条就是回归点：歌手页的专辑列表分页追加，length 变化时 effect 会再跑一次。
    // 不加「已经定位过」这道闸，用户点开某张卡之后相机会被拽回介绍卡。
    it('never re-positions after the first time, however the list grows', () => {
        expect(shouldApplyInitialGridFocus({ ...fresh, hasAppliedInitialFocus: true })).toBe(false);
    });

    it('leaves a restored session alone', () => {
        expect(shouldApplyInitialGridFocus({ ...fresh, restoreApplied: true })).toBe(false);
    });

    it('waits while a restore is pending', () => {
        expect(shouldApplyInitialGridFocus({ ...fresh, restorePending: true })).toBe(false);
    });

    it('does nothing while the grid is still empty', () => {
        expect(shouldApplyInitialGridFocus({ ...fresh, itemCount: 0 })).toBe(false);
    });
});
