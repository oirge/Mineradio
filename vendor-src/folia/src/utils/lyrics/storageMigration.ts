import { LocalSong, LyricData } from '../../types';
import { migrateLyricDataRenderHints, type MigrationResult } from './renderHints';

export interface MatchedLyricsCarrier {
    matchedLyrics?: LyricData;
}

export function migrateMatchedLyricsCarrierRenderHints<T extends MatchedLyricsCarrier>(value: T): MigrationResult<T>;
export function migrateMatchedLyricsCarrierRenderHints<T extends MatchedLyricsCarrier>(
    value: T | null | undefined
): MigrationResult<T | null>;
export function migrateMatchedLyricsCarrierRenderHints<T extends MatchedLyricsCarrier>(
    value: T | null | undefined
): MigrationResult<T | null> {
    if (!value?.matchedLyrics) {
        return {
            value: value ?? null,
            changed: false,
        };
    }

    const migration = migrateLyricDataRenderHints(value.matchedLyrics);
    if (!migration.changed) {
        return {
            value,
            changed: false,
        };
    }

    return {
        value: {
            ...value,
            matchedLyrics: migration.value ?? undefined,
        },
        changed: true,
    };
}

export interface LocalSongMigrationResult extends MigrationResult<LocalSong[]> {
    changedSongs: LocalSong[];
}

export const migrateLocalSongsRenderHints = (songs: LocalSong[]): LocalSongMigrationResult => {
    let changed = false;
    const changedSongs: LocalSong[] = [];

    const nextSongs = songs.map(song => {
        const migration = migrateMatchedLyricsCarrierRenderHints(song);
        if (!migration.changed || !migration.value) {
            return song;
        }

        changed = true;
        changedSongs.push(migration.value);
        return migration.value;
    });

    return {
        value: changed ? nextSongs : songs,
        changed,
        changedSongs,
    };
};
