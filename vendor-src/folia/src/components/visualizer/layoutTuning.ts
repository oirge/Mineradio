import { MONET_CHROME_VISIBILITIES, type CladdaghTuning, type MonetChromeVisibility, type MonetTuning, type PendoloTuning } from '../../types';
import { numberWithin } from './tuningDefinition';
import { PENDOLO_HUB_VIEW_BACK_MAX, PENDOLO_HUB_VIEW_BACK_MIN, PENDOLO_HUB_VIEW_HEIGHT_MAX, PENDOLO_HUB_VIEW_HEIGHT_MIN, PENDOLO_TILT_LIMIT_DEG } from './pendolo/pendoloDialProjection';

// Normalize the layout options before rendering or importing a visual preset.

export const MONET_CUSTOM_DESCRIPTION_MAX_LENGTH = 120;

export function resolveMonetChromeVisibility(visibility: unknown, shown: unknown): MonetChromeVisibility {
    if (shown === false) return 'hidden';
    return MONET_CHROME_VISIBILITIES.includes(visibility as MonetChromeVisibility) ? visibility as MonetChromeVisibility : 'auto';
}

export function normalizeMonetLayout(tuning: MonetTuning): MonetTuning {
    const descriptionVisibility = resolveMonetChromeVisibility(tuning.descriptionVisibility, tuning.showDescription);
    const portraitHangerVisibility = resolveMonetChromeVisibility(tuning.portraitHangerVisibility, tuning.showPortraitDragHanger);
    return { ...tuning, descriptionVisibility, showDescription: descriptionVisibility !== 'hidden',
        portraitHangerVisibility, showPortraitDragHanger: portraitHangerVisibility !== 'hidden',
        portraitSource: tuning.portraitSource === 'custom' || tuning.portraitSource === 'none' ? tuning.portraitSource : 'cover',
        mirrorLayout: tuning.mirrorLayout === true,
        customDescription: typeof tuning.customDescription === 'string' ? tuning.customDescription.slice(0, MONET_CUSTOM_DESCRIPTION_MAX_LENGTH) : '' };
}

export const CLADDAGH_POSITION_LIMIT_PERCENT = 40;

export function normalizeCladdaghLayout(tuning: CladdaghTuning): CladdaghTuning {
    const limit = CLADDAGH_POSITION_LIMIT_PERCENT;
    return { ...tuning, positionX: numberWithin(tuning.positionX, 0, -limit, limit),
        positionY: numberWithin(tuning.positionY, 0, -limit, limit), showTranslation: tuning.showTranslation === true,
        translationScale: numberWithin(tuning.translationScale, 1, 0.5, 2),
        translationLetterSpacingOffset: numberWithin(tuning.translationLetterSpacingOffset, 0, -5, 20) };
}

export function normalizePendoloLayout(tuning: PendoloTuning): PendoloTuning {
    return { ...tuning, mirrorLayout: tuning.mirrorLayout === true, hubView: tuning.hubView === true,
        tiltDeg: numberWithin(tuning.tiltDeg, 0, -PENDOLO_TILT_LIMIT_DEG, PENDOLO_TILT_LIMIT_DEG),
        tiltAxisDeg: numberWithin(tuning.tiltAxisDeg, 0, -90, 90),
        parallaxDepth: numberWithin(tuning.parallaxDepth, 1, 0, 2),
        hubViewHeight: numberWithin(tuning.hubViewHeight, 1.4, PENDOLO_HUB_VIEW_HEIGHT_MIN, PENDOLO_HUB_VIEW_HEIGHT_MAX),
        hubViewBack: numberWithin(tuning.hubViewBack, 1.2, PENDOLO_HUB_VIEW_BACK_MIN, PENDOLO_HUB_VIEW_BACK_MAX) };
}
