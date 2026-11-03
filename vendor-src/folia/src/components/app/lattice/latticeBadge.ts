import type { LatticeTile } from './latticeModel';

// src/components/app/lattice/latticeBadge.ts
// This display helper must not load the catalog/provider implementation in the embedded player.
export const latticeBadgeIsIndex = (tile: LatticeTile): boolean => tile.label === undefined;
