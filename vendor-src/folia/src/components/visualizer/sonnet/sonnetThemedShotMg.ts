import type { AdditionalSonnetMgOptions } from './sonnetAdditionalShotMg';
import { drawSonnetCityFacadeMg, drawSonnetGreenhouseMg, drawSonnetPagodaMg } from './sonnetShotMgArchitecture';
import { drawSonnetClimbingVineMg, drawSonnetFernMg, drawSonnetGinkgoMg } from './sonnetShotMgBotanical';
import { drawSonnetCamelliaMg, drawSonnetTulipFieldMg, drawSonnetWildflowerMg } from './sonnetShotMgFlora';
import { drawSonnetCoastalCliffMg, drawSonnetMountainLakeMg, drawSonnetTerracesMg } from './sonnetShotMgLandscape';

// src/components/visualizer/sonnet/sonnetThemedShotMg.ts
// Registers the twelve themed backgrounds as one deterministic extension range.
export const SONNET_THEMED_GEO_VARIANT_START = 24;
export const SONNET_THEMED_GEO_VARIANT_COUNT = 12;

export const SONNET_THEMED_GEO_VARIANTS = [
    'camellia', 'tulip-field', 'wildflower',
    'fern', 'ginkgo', 'climbing-vine',
    'greenhouse', 'pagoda', 'city-facade',
    'terraces', 'mountain-lake', 'coastal-cliff',
] as const;

const THEMED_DRAWERS = [
    drawSonnetCamelliaMg, drawSonnetTulipFieldMg, drawSonnetWildflowerMg,
    drawSonnetFernMg, drawSonnetGinkgoMg, drawSonnetClimbingVineMg,
    drawSonnetGreenhouseMg, drawSonnetPagodaMg, drawSonnetCityFacadeMg,
    drawSonnetTerracesMg, drawSonnetMountainLakeMg, drawSonnetCoastalCliffMg,
] as const;

export const drawThemedSonnetShotMg = (options: AdditionalSonnetMgOptions) => {
    const index = options.variant - SONNET_THEMED_GEO_VARIANT_START;
    const drawer = THEMED_DRAWERS[index];
    if (!drawer) return false;
    drawer(options);
    return true;
};
