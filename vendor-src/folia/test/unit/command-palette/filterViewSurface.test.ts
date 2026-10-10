import { describe, expect, it, vi } from 'vitest';
import { filterViewSurface } from '../../../src/components/command-palette/surfaces/filterViewSurface';
import type { CommandPaletteContext } from '../../../src/components/command-palette/types';
import type { CommandSurfaceArgs } from '../../../src/components/command-palette/surfaces/types';
import type { GridSurfaceState } from '../../../src/types/gridCommandSurface';

// test/unit/command-palette/filterViewSurface.test.ts
// 筛选框接的是「谁注册了 filter」，而 --play / --add 打的是「曲目网格的那两个按钮」——
// 这两者不是同一批界面。三个网格都注册筛选，只有 GridView 有那两个按钮，所以「flag 在没有
// 网格的地方该不存在」不是边角情况，是这条方言的作用域本身。

const gridState = (): GridSurfaceState => ({
    availableActions: ['play-filtered', 'enqueue-filtered'],
    filteredTrackCount: 4,
    isFilterActive: true,
    sortField: 'fileName',
    sortDirection: 'asc',
    isInfoPanelOpen: false,
    isTrackListOpen: false,
    isEditMode: false,
});

const createArgs = (query: string, { withGrid }: { withGrid: boolean }) => {
    const setFilterQuery = vi.fn();
    const run = vi.fn();
    const setQuery = vi.fn();
    const context = {
        scope: {
            view: 'home',
            filter: { getQuery: () => query, setQuery: setFilterQuery, getAnchor: () => null },
            grid: withGrid ? { getState: gridState, run } : null,
        },
    } as unknown as CommandPaletteContext;

    return { args: { context, query, setQuery } as unknown as CommandSurfaceArgs, setFilterQuery, run, setQuery };
};

describe('filter view surface', () => {
    it('keeps the flag out of the grid it is filtering', () => {
        const { args, setFilterQuery } = createArgs('midnight --play', { withGrid: true });

        filterViewSurface.onQueryChange?.(args);

        expect(setFilterQuery).toHaveBeenCalledWith('midnight');
    });

    it('runs the matching action on Enter and then drops the flag', () => {
        const { args, run, setQuery } = createArgs('midnight --add', { withGrid: true });

        filterViewSurface.onSubmit?.(args);

        expect(run).toHaveBeenCalledWith('enqueue-filtered');
        expect(setQuery).toHaveBeenCalledWith('midnight');
    });

    it('swallows Enter without a flag, as the grids own box did', () => {
        const { args, run, setQuery } = createArgs('midnight', { withGrid: true });

        expect(filterViewSurface.onSubmit?.(args)).toBe(true);
        expect(run).not.toHaveBeenCalled();
        expect(setQuery).not.toHaveBeenCalled();
    });

    it('treats the flag as plain text where no grid can act on it', () => {
        const { args, setFilterQuery, setQuery } = createArgs('midnight --play', { withGrid: false });

        filterViewSurface.onQueryChange?.(args);
        filterViewSurface.onSubmit?.(args);

        // 不剥、不动作：那些界面上根本没有这条方言，悄悄吃掉几个字符只会让筛选结果对不上框里写的。
        expect(setFilterQuery).toHaveBeenCalledWith('midnight --play');
        expect(setQuery).not.toHaveBeenCalled();
    });
});
