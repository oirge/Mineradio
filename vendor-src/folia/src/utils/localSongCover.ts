import type { LocalSong } from '../types';

// src/utils/localSongCover.ts
// Detects the canonical content-addressed local cover reference.

export const hasLocalSongCover = (song: LocalSong): boolean => (
  Boolean(song.localCoverAssetId)
);
