import { describe, expect, it } from 'vitest';
import { buildLocalLibraryDirectoryTrees } from '@/services/localLibraryDirectoryTree';
import type { LocalLibrarySnapshot, LocalSong } from '@/types';

// test/unit/services/localLibraryDirectoryTree.test.ts

describe('local library directory tree', () => {
    it('keeps ignored folders visible with no tracks or descendants', () => {
        const snapshot: LocalLibrarySnapshot = {
            rootFolderName: 'Music', scannedAt: 1,
            tree: {
                name: 'Music', relativePath: 'Music', hash: '', files: [], children: [{
                    name: 'Hidden', relativePath: 'Music/Hidden', hash: '', files: [], ignored: true,
                    children: [{ name: 'Child', relativePath: 'Music/Hidden/Child', hash: '', files: [], children: [] }],
                }],
            },
        };
        const [tree] = buildLocalLibraryDirectoryTrees([snapshot], [
            { id: 'stale', folderName: 'Music/Hidden' } as LocalSong,
        ]);
        expect(tree.totalTrackCount).toBe(0);
        expect(tree.children[0]).toMatchObject({ ignored: true, totalTrackCount: 0, children: [] });
    });
    it('keeps empty snapshot folders and aggregates descendant song counts', () => {
        const snapshot: LocalLibrarySnapshot = {
            rootFolderName: 'Music',
            scannedAt: 1,
            tree: {
                name: 'Music', relativePath: 'Music', hash: 'root', files: [], children: [
                    { name: 'Empty', relativePath: 'Music/Empty', hash: 'empty', files: [], children: [] },
                    { name: 'Album', relativePath: 'Music/Album', hash: 'album', files: [], children: [] },
                ],
            },
        };
        const song = { id: 'song-1', folderName: 'Music/Album' } as LocalSong;

        const [tree] = buildLocalLibraryDirectoryTrees([snapshot], [song]);

        expect(tree.totalTrackCount).toBe(1);
        expect(tree.children.map(node => [node.path, node.totalTrackCount])).toEqual([
            ['Music/Album', 1],
            ['Music/Empty', 0],
        ]);
    });
});
