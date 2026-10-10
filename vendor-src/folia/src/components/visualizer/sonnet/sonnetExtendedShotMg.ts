import type { AdditionalSonnetMgOptions } from './sonnetAdditionalShotMg';
import { SONNET_CELESTIAL_DRAWERS, SONNET_CELESTIAL_GEO_VARIANTS } from './sonnetShotMgCelestial';
import { SONNET_MARINE_DRAWERS, SONNET_MARINE_GEO_VARIANTS } from './sonnetShotMgMarine';
import { SONNET_MUSIC_DRAWERS, SONNET_MUSIC_GEO_VARIANTS } from './sonnetShotMgMusic';
import { SONNET_CRAFT_DRAWERS, SONNET_CRAFT_GEO_VARIANTS } from './sonnetShotMgCraft';
import { SONNET_KINETIC_DRAWERS, SONNET_KINETIC_GEO_VARIANTS } from './sonnetShotMgKinetic';

// src/components/visualizer/sonnet/sonnetExtendedShotMg.ts
// Registers the 52 extended themed backgrounds (geo variants 48-99) as one
// deterministic range, dispatched to the per-topic drawer tables.

export const SONNET_EXTENDED_GEO_VARIANT_START = 48;
export const SONNET_EXTENDED_GEO_VARIANT_COUNT = 52;

export const SONNET_EXTENDED_GEO_VARIANTS = [
    ...SONNET_CELESTIAL_GEO_VARIANTS,
    ...SONNET_MARINE_GEO_VARIANTS,
    ...SONNET_MUSIC_GEO_VARIANTS,
    ...SONNET_CRAFT_GEO_VARIANTS,
    ...SONNET_KINETIC_GEO_VARIANTS,
] as const;

const EXTENDED_DRAWERS = [
    ...SONNET_CELESTIAL_DRAWERS,
    ...SONNET_MARINE_DRAWERS,
    ...SONNET_MUSIC_DRAWERS,
    ...SONNET_CRAFT_DRAWERS,
    ...SONNET_KINETIC_DRAWERS,
] as const;

export const drawExtendedSonnetShotMg = (options: AdditionalSonnetMgOptions) => {
    const index = options.variant - SONNET_EXTENDED_GEO_VARIANT_START;
    const drawer = EXTENDED_DRAWERS[index];
    if (!drawer) return false;
    drawer(options);
    return true;
};
