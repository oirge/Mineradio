// src/utils/gridMapFolderPath.ts
// Formats local folder paths for compact GridMap card titles.

export const formatGridMapFolderTitle = (path: string): string => {
    const segments = path
        .trim()
        .split(/[\\/]+/)
        .filter(Boolean);

    if (segments.length <= 2) return segments.join('/');
    return `${segments[0]}/…/${segments[segments.length - 1]}`;
};
