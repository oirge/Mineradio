import React from 'react';
import type { NomandBackgroundEffect } from '../../../../types';
import NomandDitheringSettings from './NomandDitheringSettings';
import NomandFlutedGlassSettings from './NomandFlutedGlassSettings';
import NomandHalftoneDotsSettings from './NomandHalftoneDotsSettings';
import NomandLensDistortionSettings from './NomandLensDistortionSettings';
import NomandPaperTextureSettings from './NomandPaperTextureSettings';
import { getNomandEffectPanelColors, type NomandBackgroundEffectPanelProps } from './NomandBackgroundEffectPanel';

// src/components/visualizer/backgrounds/nomand/NomandBackgroundEffectSettings.tsx
// Selects the active Paper shader and mounts only its small, effect-specific tuning panel.

const EFFECTS: NomandBackgroundEffect[] = [
    'dithering',
    'fluted-glass',
    'paper-texture',
    'halftone-dots',
    'lens-distortion',
];

const EFFECT_LABEL_KEYS: Record<NomandBackgroundEffect, string> = {
    dithering: 'options.nomandBackgroundEffectDithering',
    'fluted-glass': 'options.nomandBackgroundEffectFlutedGlass',
    'paper-texture': 'options.nomandBackgroundEffectPaperTexture',
    'halftone-dots': 'options.nomandBackgroundEffectHalftoneDots',
    'lens-distortion': 'options.nomandBackgroundEffectLensDistortion',
};

const NomandBackgroundEffectSettings: React.FC<NomandBackgroundEffectPanelProps> = props => {
    const {
        t,
        isDaylight,
        theme,
        tuning,
    } = props;
    const { borderColor, selectedBg } = getNomandEffectPanelColors(theme, isDaylight);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <div className="text-sm" style={{ color: theme.primaryColor }}>
                    {t('options.nomandBackgroundEffect')}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {EFFECTS.map(effect => (
                        <button
                            key={effect}
                            type="button"
                            onClick={() => props.onTuningChange?.({ effect })}
                            className="rounded-xl border px-2 py-2 text-xs"
                            style={{
                                borderColor: tuning.effect === effect ? theme.accentColor : borderColor,
                                backgroundColor: tuning.effect === effect ? selectedBg : 'transparent',
                                color: theme.primaryColor,
                            }}
                        >
                            {t(EFFECT_LABEL_KEYS[effect])}
                        </button>
                    ))}
                </div>
            </div>

            {tuning.effect === 'dithering' && <NomandDitheringSettings {...props} />}
            {tuning.effect === 'fluted-glass' && <NomandFlutedGlassSettings {...props} />}
            {tuning.effect === 'paper-texture' && <NomandPaperTextureSettings {...props} />}
            {tuning.effect === 'halftone-dots' && <NomandHalftoneDotsSettings {...props} />}
            {tuning.effect === 'lens-distortion' && <NomandLensDistortionSettings {...props} />}
        </div>
    );
};

export default NomandBackgroundEffectSettings;
