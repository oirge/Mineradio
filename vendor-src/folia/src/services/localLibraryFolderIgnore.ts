import type { LocalLibrarySnapshotNode } from '../types';
import { getLocalLibrarySnapshot, saveLocalLibrarySnapshot } from './db';

// src/services/localLibraryFolderIgnore.ts

export const normalizeLocalFolderPath = (path: string) => path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

let pendingMutation: Promise<unknown> = Promise.resolve();

// Serialize scans, ignore changes and hydration writes so an older scan cannot undo a deletion.
export function runLocalFolderMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = pendingMutation.then(operation, operation);
    pendingMutation = result.catch(() => undefined);
    return result;
}

export const isLocalFolderIgnored = (path: string, ignoredPaths: readonly string[]) => (
    ignoredPaths.some(ignored => path === ignored || path.startsWith(`${ignored}/`))
);

// Persist literal folder paths separately from disk rules, retaining an empty tree entry for recovery.
export async function setLocalFolderIgnored(folderPath: string, ignored: boolean): Promise<void> {
    const path = normalizeLocalFolderPath(folderPath);
    const rootFolderName = path.split('/')[0];
    if (!path.includes('/')) return;
    const snapshot = await getLocalLibrarySnapshot(rootFolderName);
    const ignoredPaths = new Set(snapshot?.ignoredFolderPaths || []);
    if (ignored) ignoredPaths.add(path);
    else ignoredPaths.delete(path);

    const updateNode = (node: LocalLibrarySnapshotNode): LocalLibrarySnapshotNode => {
        if (node.relativePath === path) {
            return { ...node, ignored, files: [], children: [], hash: '' };
        }
        return { ...node, children: node.children.map(updateNode) };
    };
    const tree = updateNode(snapshot?.tree || {
        name: rootFolderName, relativePath: rootFolderName, hash: '', files: [], children: [],
    });
    let parent = tree;
    const parts = path.split('/');
    for (let index = 1; index < parts.length; index++) {
        const relativePath = parts.slice(0, index + 1).join('/');
        let child = parent.children.find(node => node.relativePath === relativePath);
        if (!child) {
            child = { name: parts[index], relativePath, hash: '', files: [], children: [] };
            parent.children.push(child);
        }
        parent = child;
    }
    parent.ignored = ignored;
    await saveLocalLibrarySnapshot({
        rootFolderName,
        scannedAt: snapshot?.scannedAt || 0,
        ignoredFolderPaths: [...ignoredPaths],
        lyricFormatOrder: snapshot?.lyricFormatOrder,
        tree,
    });
}
