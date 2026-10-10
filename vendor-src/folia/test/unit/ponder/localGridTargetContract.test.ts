import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { findPonderTarget } from '@/components/ponder/ponderRegistry';

// test/unit/ponder/localGridTargetContract.test.ts

const SRC = path.resolve(__dirname, '../../../src');
const source = (relativePath: string) => readFileSync(path.join(SRC, relativePath), 'utf8');

describe('local grid Ponder target contract', () => {
    it('本地 Grid3D 工具条和 GridMap 目录树都挂上自己的目标', () => {
        expect(source('library/suites/grid/home/LocalGrid3DView.tsx')).toContain('ponderControls="local-grid-controls"');
        expect(source('library/suites/grid/home/LocalGrid3DView.tsx')).toContain('gridMapPonderScope="local-grid-map-page"');
        expect(source('library/suites/grid/directory/GridMap.tsx')).toContain('data-ponder-page-scope={ponderPageScope}');
        expect(source('library/suites/grid/directory/GridMapBatchPanel.tsx')).toContain("'local-grid-map-directory-tree'");
        expect(findPonderTarget('local-grid-controls')?.hoverSelector).toBe('[data-ponder="local-grid-controls"]');
        expect(findPonderTarget('local-grid-map-directory-tree')?.hoverSelector).toBe('[data-ponder="local-grid-map-directory-tree"]');
    });

    it('GridView 按本地和在线来源声明不同的左侧操作目标', () => {
        const gridView = source('library/suites/grid/collection/GridView.tsx');
        expect(gridView).toContain("isLocalCollection ? 'local-folder-actions' : 'online-collection-actions'");
        expect(findPonderTarget('local-folder-actions')?.hoverSelector).toBe('[data-ponder="local-folder-actions"]');
        expect(findPonderTarget('online-collection-actions')?.hoverSelector).toBe('[data-ponder="online-collection-actions"]');
    });
});
