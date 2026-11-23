import type { CladdaghTuning } from '../../../types';
import { SliderRow, times, ToggleRow } from '../panelRows';
import { CLADDAGH_POSITION_LIMIT_PERCENT } from '../layoutTuning';

// Position the whole ring and style the translated line that follows its curve.
export default function CladdaghLayoutSettings({ tuning, change, t }: {
    tuning: CladdaghTuning; change: (patch: Partial<CladdaghTuning>) => void; t: (key: string) => string;
}) {
    const limit = CLADDAGH_POSITION_LIMIT_PERCENT;
    const translated = tuning.showTranslation === true;
    return <section data-testid="claddagh-layout-settings">
        <SliderRow label={t('options.claddaghPositionX')} value={tuning.positionX ?? 0} min={-limit} max={limit} step={1}
            format={value => `${value}%`} onChange={positionX => change({ positionX })} />
        <SliderRow label={t('options.claddaghPositionY')} value={tuning.positionY ?? 0} min={-limit} max={limit} step={1}
            format={value => `${value}%`} onChange={positionY => change({ positionY })} />
        <ToggleRow label={t('options.claddaghShowTranslation')} checked={translated} onChange={showTranslation => change({ showTranslation })} />
        {translated && <>
            <SliderRow label={t('options.claddaghTranslationScale')} value={tuning.translationScale ?? 1} min={0.5} max={2} step={0.05}
                format={times} onChange={translationScale => change({ translationScale })} />
            <SliderRow label={t('options.claddaghTranslationLetterSpacingOffset')} value={tuning.translationLetterSpacingOffset ?? 0} min={-5} max={20} step={0.5}
                format={value => `${value}px`} onChange={translationLetterSpacingOffset => change({ translationLetterSpacingOffset })} />
        </>}
    </section>;
}
