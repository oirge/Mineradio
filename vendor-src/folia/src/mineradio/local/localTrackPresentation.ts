import type { Album, Artist, SongResult, UnifiedSong } from '../../types';

// src/mineradio/local/localTrackPresentation.ts
// Build-only metadata boundary for the original cards: host local files have no online provider.
export const isSongUnavailable = (_song: SongResult | null | undefined): boolean => false;
export const getSongUnavailableLabel = (_song: SongResult | null | undefined, fallback: string): string => fallback;
export const canResolveSongCatalogRef = (
    _song: UnifiedSong, _kind: 'album' | 'artist', _target: Album | Artist | null | undefined,
): boolean => false;
