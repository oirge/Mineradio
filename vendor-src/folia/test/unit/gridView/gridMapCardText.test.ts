import { describe, expect, it } from 'vitest';
import { resolveGridMapCardTitle, resolveGridMapFolderLabel } from '../../../src/library/suites/grid/directory/gridMapCardText';

// test/unit/gridView/gridMapCardText.test.ts
// 钉住 GridMap 卡片上的文件夹文字：虚拟的「全部歌曲」没有 path，但卡片照旧把名称放在路径的位置
// （标题、两行描述、「本目录 N 首」都按它判断）——P3.1 丢过一次。

describe('GridMap card folder text', () => {
    it('uses the path of a real folder and compacts deep paths in the title', () => {
        const folder = { type: 'folder', name: 'Astros/Classics/Cello', path: 'Astros/Classics/Cello' };
        expect(resolveGridMapFolderLabel(folder)).toBe('Astros/Classics/Cello');
        expect(resolveGridMapCardTitle(folder)).toBe('Astros/…/Cello');
    });

    it('puts the virtual All Songs name where a folder path goes, although it has no path', () => {
        for (const name of ['All Songs', '全部歌曲']) {
            const allSongs = { type: 'folder', name, isVirtual: true };
            expect(resolveGridMapFolderLabel(allSongs)).toBe(name);
            expect(resolveGridMapCardTitle(allSongs)).toBe(name);
        }
    });

    it('has no folder label for other cards', () => {
        expect(resolveGridMapFolderLabel({ type: 'playlist', name: 'Mix', isVirtual: true })).toBe('');
        expect(resolveGridMapFolderLabel({ type: 'album', name: 'Unknown Album', isVirtual: true })).toBe('');
        expect(resolveGridMapCardTitle({ type: 'album', name: 'A/B/C' })).toBe('A/B/C');
    });
});
