import { describe, expect, it } from 'vitest';
import {
    resolveGridMapDisplayIndex,
    resolveGridMapEscapeAction,
    resolveGridMapSourceIndex,
    shouldSuppressGridMapSelection,
} from '../../../src/library/suites/grid/directory/gridMapNavigation';

// test/unit/gridView/gridMapNavigation.test.ts
// Verifies GridMap navigation remains aligned with filtered and refreshed Grid3D collections,
// and that Escape dismisses GridMap's layers one at a time.

describe('gridMapNavigation', () => {
    const sourceItems = [
        { id: 'folder-all' },
        { id: 'album-a' },
        { id: 'album-b' },
    ];

    it('maps a filtered result back to its source collection index', () => {
        expect(resolveGridMapSourceIndex(sourceItems, sourceItems[2], 0)).toBe(2);
    });

    it('uses stable collection ids after local-library objects are refreshed', () => {
        expect(resolveGridMapSourceIndex(sourceItems, { id: 'album-a' }, 0)).toBe(1);
    });

    it('restores the source focus inside a filtered map', () => {
        const displayedItems = [sourceItems[0], sourceItems[2]];
        expect(resolveGridMapDisplayIndex(displayedItems, sourceItems[2])).toBe(1);
    });

    it('falls back safely when the selected collection no longer exists', () => {
        expect(resolveGridMapSourceIndex(sourceItems, { id: 'removed' }, 8)).toBe(2);
        expect(resolveGridMapDisplayIndex([sourceItems[0]], sourceItems[2])).toBe(0);
    });

    it('keeps small card movements clickable', () => {
        expect(shouldSuppressGridMapSelection(5, 5)).toBe(false);
    });

    it('suppresses card selection after an intentional grid drag', () => {
        expect(shouldSuppressGridMapSelection(8, 0)).toBe(true);
        expect(shouldSuppressGridMapSelection(6, 6)).toBe(true);
    });
});

describe('resolveGridMapEscapeAction', () => {
    const idle = {
        searchQuery: '',
        showSidePanel: false,
        showCutInPanel: false,
        isPlaylistEditMode: false,
    };

    it('clears an active filter before anything else', () => {
        expect(resolveGridMapEscapeAction({
            searchQuery: 'ambient',
            showSidePanel: true,
            showCutInPanel: true,
            isPlaylistEditMode: true,
        })).toBe('clear-search');
    });

    it('treats a whitespace-only filter as no filter', () => {
        expect(resolveGridMapEscapeAction({ ...idle, searchQuery: '   ', showSidePanel: true })).toBe('close-side-panel');
    });

    it('closes the side drawer before the cut-in panel', () => {
        expect(resolveGridMapEscapeAction({ ...idle, showSidePanel: true, showCutInPanel: true })).toBe('close-side-panel');
    });

    it('leaves playlist edit mode before closing the cut-in panel that hosts it', () => {
        expect(resolveGridMapEscapeAction({ ...idle, showCutInPanel: true, isPlaylistEditMode: true })).toBe('exit-playlist-edit');
    });

    it('closes the cut-in panel once edit mode is off', () => {
        expect(resolveGridMapEscapeAction({ ...idle, showCutInPanel: true })).toBe('close-cut-in-panel');
    });

    it('navigates back when no layer is open', () => {
        expect(resolveGridMapEscapeAction(idle)).toBe('navigate-back');
    });
});
