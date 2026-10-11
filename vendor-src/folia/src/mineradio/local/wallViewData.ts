import type { LatticeTile } from '../../components/app/lattice/latticeModel';
import type { GridItem } from '../../library/suites/grid/shared/PolaroidCard';
import { getPlaybackSongKey } from '../../utils/appPlaybackGuards';
import type { LocalWallSong } from './wallCatalogData';

// src/mineradio/local/wallViewData.ts
export interface RecordWallItems {
    songs: readonly LocalWallSong[];
    unknownArtist: string;
    items: GridItem[];
}

export interface PosterWallTiles {
    songs: readonly LocalWallSong[];
    songKey: string;
    currentIndex: number;
    tiles: LatticeTile[];
}

const recordItem = (song: LocalWallSong, index: number, unknownArtist: string): GridItem => ({
    id: song.id, name: song.name, coverUrl: song.album.coverUrl,
    description: song.artists.map(artist => artist.name).filter(Boolean).join(' / ') || unknownArtist,
    rawTrack: song, rawTrackIndex: index,
});

const posterTile = (song: LocalWallSong, index: number, currentIndex: number): LatticeTile => ({
    id: getPlaybackSongKey(song), queueIndex: index, song, title: song.name,
    artist: song.artists.map(artist => artist.name).filter(Boolean).join(' / ') || song.album.name,
    coverUrl: song.album.coverUrl,
    section: index === currentIndex ? 'now' : currentIndex >= 0 && index < currentIndex ? 'played' : 'upcoming',
});

// Rebuild only changed slots while the collection order and display language stay fixed.
export function buildRecordWallItems(songs: readonly LocalWallSong[], unknownArtist: string,
    previous?: RecordWallItems): RecordWallItems {
    const rebuild = (): RecordWallItems => ({
        songs, unknownArtist, items: songs.map((song, index) => recordItem(song, index, unknownArtist)),
    });
    if (!previous || previous.unknownArtist !== unknownArtist || previous.songs.length !== songs.length) return rebuild();
    if (previous.songs === songs) return previous;
    let items: GridItem[] | undefined;
    for (let index = 0; index < songs.length; index++) {
        if (previous.songs[index].id !== songs[index].id) return rebuild();
        if (previous.songs[index] === songs[index]) continue;
        items ??= previous.items.slice();
        items[index] = recordItem(songs[index], index, unknownArtist);
    }
    return { songs, unknownArtist, items: items ?? previous.items };
}

// A stable playhead keeps every unaffected poster's section and identity unchanged.
export function buildPosterWallTiles(songs: readonly LocalWallSong[], songKey: string,
    previous?: PosterWallTiles): PosterWallTiles {
    const rebuild = (): PosterWallTiles => {
        const currentIndex = songKey ? songs.findIndex(song => getPlaybackSongKey(song) === songKey) : -1;
        return { songs, songKey, currentIndex,
            tiles: songs.map((song, index) => posterTile(song, index, currentIndex)) };
    };
    if (!previous || previous.songKey !== songKey || previous.songs.length !== songs.length) return rebuild();
    if (previous.songs === songs) return previous;
    let tiles: LatticeTile[] | undefined;
    for (let index = 0; index < songs.length; index++) {
        if (previous.songs[index].id !== songs[index].id) return rebuild();
        if (previous.songs[index] === songs[index]) continue;
        tiles ??= previous.tiles.slice();
        tiles[index] = posterTile(songs[index], index, previous.currentIndex);
    }
    return { songs, songKey, currentIndex: previous.currentIndex, tiles: tiles ?? previous.tiles };
}
