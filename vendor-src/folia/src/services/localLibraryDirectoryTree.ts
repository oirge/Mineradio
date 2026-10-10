import type { LocalLibrarySnapshot, LocalLibrarySnapshotNode, LocalSong } from '../types';
import type { LibraryDirectoryNode } from '../library/core/contracts/directory';
import { getDirHandles, getLocalLibrarySnapshot, getLocalSongs } from './db';
import { isMineradioEmbedded } from '../mineradio/client';

// src/services/localLibraryDirectoryTree.ts

const normalizeLocalPath = (value: string) => value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

const getSongFolderPath = (song: LocalSong) => normalizeLocalPath(song.folderName || '');

// Converts persisted scan snapshots into a directory-only tree without touching the disk.
export const buildLocalLibraryDirectoryTrees = (
    snapshots: LocalLibrarySnapshot[],
    songs: LocalSong[],
): LibraryDirectoryNode[] => {
    const directCounts = new Map<string, number>();
    for (const song of songs) {
        const folderPath = getSongFolderPath(song);
        if (!folderPath) continue;
        directCounts.set(folderPath, (directCounts.get(folderPath) || 0) + 1);
    }

    const convertNode = (
        node: LocalLibrarySnapshotNode,
        rootPath: string,
        depth: number,
    ): LibraryDirectoryNode => {
        const path = normalizeLocalPath(node.relativePath || rootPath);
        const children = (node.ignored ? [] : node.children)
            .map(child => convertNode(child, rootPath, depth + 1))
            .sort((a, b) => a.name.localeCompare(b.name));
        const directTrackCount = node.ignored ? 0 : directCounts.get(path) || 0;
        const totalTrackCount = directTrackCount + children.reduce((sum, child) => sum + child.totalTrackCount, 0);

        return {
            id: `${rootPath}:${path}`,
            name: node.name || rootPath,
            path,
            rootPath,
            depth,
            ignored: node.ignored,
            directTrackCount,
            totalTrackCount,
            children,
        };
    };

    return snapshots
        .map(snapshot => convertNode(snapshot.tree, snapshot.rootFolderName, 0))
        .sort((a, b) => a.name.localeCompare(b.name));
};

export const loadLocalLibraryDirectoryTrees = async (songs?: LocalSong[]): Promise<LibraryDirectoryNode[]> => {
    if (isMineradioEmbedded()) return buildMineradioDirectoryTrees(songs ?? await getLocalSongs());
    const handles = await getDirHandles();
    const snapshots = (await Promise.all(
        Object.keys(handles).map(rootPath => getLocalLibrarySnapshot(rootPath)),
    )).filter((snapshot): snapshot is LocalLibrarySnapshot => Boolean(snapshot));

    return buildLocalLibraryDirectoryTrees(snapshots, songs ?? await getLocalSongs());
};

// Host files do not have browser FileSystemDirectoryHandles. Build their tree
// from indexed paths without requesting new file-system permissions.
export const buildMineradioDirectoryTrees = (songs: LocalSong[]): LibraryDirectoryNode[] => {
    const roots: LibraryDirectoryNode[] = [];
    const nodes = new Map<string, LibraryDirectoryNode>();
    for (const song of songs) {
        const parts = getSongFolderPath(song).split('/').filter(Boolean);
        let parent: LibraryDirectoryNode | undefined;
        for (let depth = 0; depth < parts.length; depth += 1) {
            const path = parts.slice(0, depth + 1).join('/');
            let node = nodes.get(path);
            if (!node) {
                node = { id: `mineradio:${path}`, name: parts[depth], path, rootPath: parts[0], depth, directTrackCount: 0, totalTrackCount: 0, children: [] };
                nodes.set(path, node);
                if (parent) parent.children.push(node);
                else roots.push(node);
            }
            node.totalTrackCount += 1;
            if (depth === parts.length - 1) node.directTrackCount += 1;
            parent = node;
        }
    }
    for (const node of nodes.values()) node.children.sort((a, b) => a.name.localeCompare(b.name));
    return roots.sort((a, b) => a.name.localeCompare(b.name));
};
