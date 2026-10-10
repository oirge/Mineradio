import type { LocalSong } from '../types';
import { getImportedAlbumName } from './localLibraryNames';

// Shared ordering rules for local-library views and their playback queues.
export type LocalSongFolderSortField = 'fileName' | 'fileLastModified' | 'albumTrack';
export type LocalSongFolderSortDirection = 'asc' | 'desc';

const naturalCollator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: 'base',
});

const compareText = (left: string, right: string): number => naturalCollator.compare(left, right);

const getSongName = (song: LocalSong): string => song.title?.trim() || song.fileName;

export const compareLocalSongsByFileName = (left: LocalSong, right: LocalSong): number =>
    compareText(left.fileName, right.fileName)
    || compareText(left.filePath, right.filePath);

const compareLocalSongsByLastModified = (left: LocalSong, right: LocalSong): number =>
    (left.fileLastModified ?? 0) - (right.fileLastModified ?? 0)
    || compareLocalSongsByFileName(left, right);

const compareTrackPosition = (left: LocalSong, right: LocalSong): number =>
    (left.discNumber ?? 1) - (right.discNumber ?? 1)
    || (left.trackNumber ?? 0) - (right.trackNumber ?? 0);

/**
 * How a song is filed under an album for sorting purposes.
 *
 * `entityId` is the local-library album entity, the identity the rest of the app groups and
 * navigates by; `name` is only what the group is called on screen. Two releases can share a name,
 * so the id decides identity and the name decides order.
 */
export type LocalAlbumGroupKey = {
    entityId?: string;
    name: string;
};

export type LocalAlbumGroupResolver = (song: LocalSong) => LocalAlbumGroupKey | undefined;

// Views that have no catalog on hand fall back to the imported album tag.
const resolveImportedAlbumGroup: LocalAlbumGroupResolver = song => ({
    name: getImportedAlbumName(song) || '',
});

// Orders two album groups by their on-screen name, with the entity id keeping same-named releases apart.
const compareAlbumGroup = (
    leftGroup: LocalAlbumGroupKey | undefined,
    rightGroup: LocalAlbumGroupKey | undefined,
): number => (
    compareText(leftGroup?.name || '', rightGroup?.name || '')
    || compareText(leftGroup?.entityId || '', rightGroup?.entityId || '')
);

/**
 * Album-number ordering for views that mix several albums, such as a folder holding more than one
 * release or the whole-library "all songs" collection.
 *
 * The album group leads, so a track number only ever competes with numbers from the same release;
 * without it every album's track 1 would clump together. Files that carry no number, and numbered
 * files filed under no album, have no place in this order at all, so they sink to the bottom in
 * both directions instead of being treated as a very small number.
 */
const compareLocalSongsByAlbumTrack = (
    left: LocalSong,
    right: LocalSong,
    direction: LocalSongFolderSortDirection,
    resolveAlbumGroup: LocalAlbumGroupResolver,
): number => {
    const leftNumbered = typeof left.trackNumber === 'number';
    const rightNumbered = typeof right.trackNumber === 'number';
    if (leftNumbered !== rightNumbered) {
        return leftNumbered ? -1 : 1;
    }

    if (!leftNumbered) {
        const unnumbered = compareLocalSongsByFileName(left, right);
        return direction === 'desc' ? -unnumbered : unnumbered;
    }

    const leftGroup = resolveAlbumGroup(left);
    const rightGroup = resolveAlbumGroup(right);
    if (Boolean(leftGroup?.name) !== Boolean(rightGroup?.name)) {
        return leftGroup?.name ? -1 : 1;
    }

    const result = compareAlbumGroup(leftGroup, rightGroup)
        || compareTrackPosition(left, right)
        || compareLocalSongsByFileName(left, right);

    return direction === 'desc' ? -result : result;
};

export const compareLocalFolderSongs = (
    left: LocalSong,
    right: LocalSong,
    field: LocalSongFolderSortField = 'fileName',
    direction: LocalSongFolderSortDirection = 'asc',
    resolveAlbumGroup: LocalAlbumGroupResolver = resolveImportedAlbumGroup,
): number => {
    if (field === 'albumTrack') {
        return compareLocalSongsByAlbumTrack(left, right, direction, resolveAlbumGroup);
    }

    const result = field === 'fileLastModified'
        ? compareLocalSongsByLastModified(left, right)
        : compareLocalSongsByFileName(left, right);

    return direction === 'desc' ? -result : result;
};

export const compareLocalAlbumSongs = (left: LocalSong, right: LocalSong): number => {
    const leftHasTrackNumber = typeof left.trackNumber === 'number';
    const rightHasTrackNumber = typeof right.trackNumber === 'number';

    if (leftHasTrackNumber !== rightHasTrackNumber) {
        return leftHasTrackNumber ? -1 : 1;
    }

    if (leftHasTrackNumber && rightHasTrackNumber) {
        const positionDifference = compareTrackPosition(left, right);
        if (positionDifference !== 0) {
            return positionDifference;
        }
    }

    return compareText(getSongName(left), getSongName(right))
        || compareLocalSongsByFileName(left, right);
};

export const sortLocalFolderSongs = (
    songs: LocalSong[],
    field: LocalSongFolderSortField = 'fileName',
    direction: LocalSongFolderSortDirection = 'asc',
    resolveAlbumGroup?: LocalAlbumGroupResolver,
): LocalSong[] => [...songs].sort((left, right) => (
    compareLocalFolderSongs(left, right, field, direction, resolveAlbumGroup)
));

export const sortLocalAlbumSongs = (songs: LocalSong[]): LocalSong[] =>
    [...songs].sort(compareLocalAlbumSongs);

/**
 * The album number as the track list shows it, or null when the file carries none.
 *
 * The disc is only named when there is more than one, so an ordinary single-disc album reads as a
 * plain track number instead of "1-" on every row.
 */
export const formatLocalAlbumTrackLabel = (song: LocalSong): string | null => {
    if (typeof song.trackNumber !== 'number') return null;
    const disc = song.discNumber;
    return typeof disc === 'number' && disc > 1
        ? `${disc}-${song.trackNumber}`
        : String(song.trackNumber);
};
