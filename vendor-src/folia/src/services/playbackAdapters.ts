import { AmllDbPlatform, LocalSong, LyricProviderSource, SongResult, UnifiedSong } from '../types';
import { NavidromeSong } from '../types/navidrome';
import type { LocalLibraryAssignment, LocalLibraryEntity } from '../types/localLibrary';
import { buildLocalLibraryIndex, followEntityRedirect, type LocalLibraryIndex } from '../utils/localLibraryIndex';
import { getLocalCoverAssetUrl } from './localCoverAssetUrl';
import { buildLocalSourceRevision, buildNavidromeSourceRevision } from './playbackRecovery/sourceRevision';

export type LocalLibraryDisplayCatalog = {
    entities: LocalLibraryEntity[];
    assignments: LocalLibraryAssignment[];
};

export type ResolvedLocalSongMetadata = {
    artists: Array<{ entityId: string; name: string }>;
    album?: { entityId: string; name: string };
};

// Resolves the canonical artist and album display from stable entity assignments only.
export const resolveLocalSongMetadata = (
    songId: string,
    catalog: LocalLibraryDisplayCatalog,
    preparedIndex?: LocalLibraryIndex,
): ResolvedLocalSongMetadata => {
    const index = preparedIndex || buildLocalLibraryIndex(catalog.entities, catalog.assignments);
    const assignment = index.assignmentsBySongId.get(songId);
    const artists = assignment?.artistEntityIds.flatMap(entityId => {
        const activeEntityId = followEntityRedirect(entityId, index.entitiesById);
        const entity = activeEntityId ? index.entitiesById.get(activeEntityId) : undefined;
        return entity?.kind === 'artist' ? [{ entityId: entity.id, name: entity.displayName }] : [];
    }) || [];
    const activeAlbumId = assignment?.albumEntityId
        ? followEntityRedirect(assignment.albumEntityId, index.entitiesById)
        : undefined;
    const albumEntity = activeAlbumId ? index.entitiesById.get(activeAlbumId) : undefined;
    return {
        artists,
        album: albumEntity?.kind === 'album'
            ? { entityId: albumEntity.id, name: albumEntity.displayName }
            : undefined,
    };
};

const resolveLocalLibraryDisplayArtists = (
    songId: string,
    catalog?: LocalLibraryDisplayCatalog,
    preparedIndex?: LocalLibraryIndex,
) => {
    if (!catalog) return [];

    const resolved = resolveLocalSongMetadata(songId, catalog, preparedIndex);
    const seenEntityIds = new Set<string>();
    return resolved.artists.flatMap(entity => {
        if (seenEntityIds.has(entity.entityId)) return [];
        seenEntityIds.add(entity.entityId);
        return [{ id: 0, entityId: entity.entityId, name: entity.name }];
    });
};

// Replaces legacy joined artist text with the song's stable local-library artist entities.
export const applyLocalLibraryArtistDisplay = <T extends SongResult>(
    song: T,
    catalog?: LocalLibraryDisplayCatalog,
    preparedIndex?: LocalLibraryIndex,
): T => {
    const songId = (song as UnifiedSong).localRef?.songId;
    if (!songId) return song;

    const artists = resolveLocalLibraryDisplayArtists(songId, catalog, preparedIndex);
    if (artists.length === 0) return song;

    return {
        ...song,
        artists,
    };
};

// Maps a local song's album assignment onto both album fields used by GridView and player surfaces.
const applyLocalLibraryAlbumDisplay = <T extends SongResult>(
    song: T,
    catalog?: LocalLibraryDisplayCatalog,
    preparedIndex?: LocalLibraryIndex,
): T => {
    const songId = (song as UnifiedSong).localRef?.songId;
    if (!songId || !catalog) return song;

    const entity = resolveLocalSongMetadata(songId, catalog, preparedIndex).album;
    if (!entity) return song;

    return {
        ...song,
        album: {
            ...song.album,
            entityId: entity.entityId,
            name: entity.name,
        },
    };
};

// Applies the complete local entity display model used by cards, queues, and CoverTab.
export const applyLocalLibraryEntityDisplay = <T extends SongResult>(
    song: T,
    catalog?: LocalLibraryDisplayCatalog,
    preparedIndex?: LocalLibraryIndex,
): T => applyLocalLibraryAlbumDisplay(
    applyLocalLibraryArtistDisplay(song, catalog, preparedIndex),
    catalog,
    preparedIndex,
);

// Applies a resolved local cover URL to the canonical album field used by song cards.
export const applyLocalSongCoverDisplay = <T extends SongResult>(song: T, coverUrl: string): T => ({
    ...song,
    album: song.album
        ? { ...song.album, coverUrl }
        : { id: 0, name: '', coverUrl },
});

export const getLocalSongId = (localSong: LocalSong): number => {
    // Generate a reliable 52-bit hash from the string ID to avoid parsing long digits and losing precision or colliding.
    // DJB2 style hash into two parts to create a safe integer
    let h1 = 0x811c9dc5;
    let h2 = 0x811c9dc5;
    
    for (let i = 0; i < localSong.id.length; i++) {
        const char = localSong.id.charCodeAt(i);
        h1 ^= char;
        h1 = Math.imul(h1, 0x01000193);
        h2 ^= char;
        h2 = Math.imul(h2, 0x10a9055);
    }
    
    // Combine into a 53-bit safe positive integer, then make it negative
    const high = (h1 & 0x1FFFFF) * 0x100000000;
    const low = (h2 >>> 0);
    const combined = high + low;
    return combined === 0 ? -1 : -combined;
};

export function buildUnifiedLocalSong({
    localSong,
    matchedSong,
    coverUrl,
    preferOnlineMetadata,
}: {
    localSong: LocalSong;
    matchedSong: SongResult | null;
    coverUrl: string | null;
    preferOnlineMetadata: boolean;
}): UnifiedSong {
    const useMatchedLyrics =
        localSong.lyricsSource === 'online'
        || (!localSong.lyricsSource && !localSong.hasLocalLyrics && !localSong.hasEmbeddedLyrics);
    const displayTitle = localSong.title;
    const displayArtists = (localSong.titleOrigin === 'import'
        ? localSong.importedMetadata.artistNames
        : localSong.onlineMetadata?.artists.map(artist => artist.name) || localSong.importedMetadata.artistNames)
        .map(name => ({ id: 0, name }));
    const displayAlbum = localSong.titleOrigin === 'import'
        ? localSong.importedMetadata.albumName
        : localSong.onlineMetadata?.album?.name || localSong.importedMetadata.albumName;

    const unifiedSong: UnifiedSong = {
        id: getLocalSongId(localSong),
        name: displayTitle,
        artists: displayArtists,
        // The cover has to survive an empty album tag: a file with artwork but no album name still
        // needs `album.coverUrl`, which is the only cover channel queue-derived surfaces read.
        album: { id: 0, name: displayAlbum || '', ...(coverUrl ? { coverUrl } : {}) },
        durationMs: localSong.duration,
        isPureMusic: useMatchedLyrics ? localSong.matchedIsPureMusic : false,
        isLocal: true,
        localRef: { songId: localSong.id },
        sourceRef: { kind: 'local', mediaId: localSong.id },
        playbackSourceRevision: buildLocalSourceRevision(localSong),
    };

    if (!matchedSong) {
        return unifiedSong;
    }

    if (coverUrl) {
        if (unifiedSong.album) {
            unifiedSong.album.coverUrl = coverUrl;
        }
    }

    return unifiedSong;
}

// Local covers are served in two thumbnail buckets. Player surfaces render the artwork full-bleed
// and take the large one; list rows ask for the small one so a long list does not decode four times
// the pixels it shows, and so both callers land in the same bucket the preloader warmed.
export const QUEUE_COVER_SIZE = 1024;
export const LIST_ROW_COVER_SIZE = 512;

export function buildLocalQueue(
    queue: LocalSong[],
    currentSong?: UnifiedSong,
    catalog?: LocalLibraryDisplayCatalog,
    coverSize: number = QUEUE_COVER_SIZE,
): UnifiedSong[] {
    const catalogIndex = catalog
        ? buildLocalLibraryIndex(catalog.entities, catalog.assignments)
        : undefined;
    const convertedQueue = queue.map(song => {
        const localCoverUrl = getLocalCoverAssetUrl(song.localCoverAssetId, coverSize);
        return applyLocalLibraryEntityDisplay(buildUnifiedLocalSong({
            localSong: song,
            matchedSong: null,
            coverUrl: song.useOnlineCover
                ? song.onlineMetadata?.coverUrl || localCoverUrl
                : localCoverUrl,
            preferOnlineMetadata: false,
        }), catalog, catalogIndex);
    });

    if (!currentSong) {
        return convertedQueue;
    }

    return convertedQueue.map(song => {
        if (song.id === currentSong.id) {
            return applyLocalLibraryEntityDisplay(currentSong, catalog, catalogIndex);
        }
        return song;
    });
}

export function buildUnifiedNavidromeSong(
    navidromeSong: NavidromeSong,
    options?: {
        coverUrl?: string;
        useOnlineMetadata?: boolean;
        matchedArtists?: string;
        matchedAlbumName?: string;
        matchedLyricsSource?: LyricProviderSource;
        matchedLyricsProviderPlatform?: AmllDbPlatform;
    }
): SongResult {
    const displayArtists = (options?.useOnlineMetadata && options.matchedArtists)
        ? [{ id: 0, name: options.matchedArtists }]
        : (navidromeSong.artists || []);
    const displayAlbum = navidromeSong.album || { id: 0, name: '' };
    const displayAlbumWithCover = options?.coverUrl
        ? { ...displayAlbum, coverUrl: options.coverUrl }
        : displayAlbum;

    const unifiedSong = {
        id: navidromeSong.id,
        name: (options?.useOnlineMetadata && options.matchedAlbumName) ? options.matchedAlbumName : navidromeSong.name,
        artists: displayArtists,
        album: displayAlbumWithCover,
        durationMs: navidromeSong.durationMs || 0,
        isPureMusic: navidromeSong.lyricsSource === 'online' ? navidromeSong.matchedIsPureMusic : false,
        isNavidrome: true,
        navidromeData: navidromeSong,
        sourceRef: { kind: 'navidrome', mediaId: navidromeSong.navidromeData.id },
        matchedLyricsSource: options?.matchedLyricsSource,
        matchedLyricsProviderPlatform: options?.matchedLyricsProviderPlatform
    } as SongResult;
    unifiedSong.playbackSourceRevision = buildNavidromeSourceRevision(
        unifiedSong,
        navidromeSong.navidromeData.streamUrl,
    );
    return unifiedSong;
}

export function buildNavidromeQueue(queue: NavidromeSong[], currentSong?: SongResult): SongResult[] {
    const convertedQueue = queue.map(song => buildUnifiedNavidromeSong(song));

    if (!currentSong) {
        return convertedQueue;
    }

    return convertedQueue.map(song => song.id === currentSong.id ? currentSong : song);
}
