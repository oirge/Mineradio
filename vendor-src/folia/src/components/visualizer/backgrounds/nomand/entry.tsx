import React from 'react';
import { Layers } from 'lucide-react';
import { DEFAULT_NOMAND_BACKGROUND_TUNING } from '../../../../types';
import NomandBackgroundLayer from './NomandBackgroundLayer';
import NomandBackgroundSettingsCard from './NomandBackgroundSettingsCard';
import { defineVisualizerBackground } from '../definition';
import { QuickControlToggle } from '../../../shared/QuickControlChip';

// src/components/visualizer/backgrounds/nomand/entry.tsx
// Registers the Paper image-effect shell background.

export default defineVisualizerBackground({
    mode: 'nomand',
    order: 30,
    labelKey: 'options.visualizerBackgroundModeNomand',
    labelFallback: 'Nomand',
    render: ({ config, coverUrl, theme, isDaylight }) => (
        <NomandBackgroundLayer
            coverUrl={coverUrl}
            monetBackgroundImage={config?.customImage}
            tuning={config?.nomand?.tuning}
            theme={theme}
            isDaylight={isDaylight}
        />
    ),
    renderSettingsPanel: ({ config, actions, ...props }) => (
        <NomandBackgroundSettingsCard
            {...props}
            tuning={config?.nomand?.tuning ?? DEFAULT_NOMAND_BACKGROUND_TUNING}
            onTuningChange={actions?.nomand?.onTuningChange}
            monetBackgroundImage={config?.customImage}
            onUploadMonetBackgroundImage={actions?.customImage?.onUpload}
            onClearMonetBackgroundImage={actions?.customImage?.onClear}
            isLoadingMonetBackgroundImage={actions?.customImage?.isLoading}
        />
    ),
    renderQuickControls: ({ config, actions, t, theme }) => {
        const tuning = config?.nomand?.tuning ?? DEFAULT_NOMAND_BACKGROUND_TUNING;

        return (
            <QuickControlToggle
                active={tuning.overlayEnabled}
                theme={theme}
                label={t('options.nomandBackgroundOverlay')}
                onToggle={() => actions?.nomand?.onTuningChange?.({ overlayEnabled: !tuning.overlayEnabled })}
            >
                <Layers size={14} />
            </QuickControlToggle>
        );
    },
    resetSettings: actions => actions?.nomand?.onResetTuning?.(),
});
