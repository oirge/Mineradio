import React from 'react';
import { DEFAULT_MONET_BACKGROUND_TUNING } from '../../../../types';
import { MonetBackgroundSettingsCard } from './MonetBackgroundSettingsCard';
import MonetBackgroundLayer from './MonetBackgroundLayer';
import { defineVisualizerBackground } from '../definition';
import { QuickControlChip } from '../../../shared/QuickControlChip';

// src/components/visualizer/backgrounds/monet/entry.tsx
// Registers the Monet image-treatment shell background.

export default defineVisualizerBackground({
    mode: 'monet',
    order: 20,
    labelKey: 'options.visualizerBackgroundModeMonet',
    labelFallback: 'Monet',
    render: ({ config, coverUrl, theme, isDaylight, staticMode }) => (
        <MonetBackgroundLayer
            coverUrl={coverUrl}
            monetBackgroundImage={config?.customImage}
            theme={theme}
            isDaylight={isDaylight}
            tuning={config?.monet?.tuning}
            transparentBackground={config?.transparent}
            staticMode={staticMode}
        />
    ),
    renderSettingsPanel: ({
        config,
        actions,
        t,
        isDaylight,
        theme,
        controlCardBg,
        rangeInputClass,
        onSliderPointerDown,
        onSliderCommit,
    }) => (
        <MonetBackgroundSettingsCard
            t={t}
            isDaylight={isDaylight}
            theme={theme}
            controlCardBg={controlCardBg}
            rangeInputClass={rangeInputClass}
            tuning={config?.monet?.tuning ?? DEFAULT_MONET_BACKGROUND_TUNING}
            onTuningChange={actions?.monet?.onTuningChange}
            monetBackgroundImage={config?.customImage}
            onUploadMonetBackgroundImage={actions?.customImage?.onUpload}
            onClearMonetBackgroundImage={actions?.customImage?.onClear}
            isLoadingMonetBackgroundImage={actions?.customImage?.isLoading}
            onSliderPointerDown={onSliderPointerDown}
            onSliderCommit={onSliderCommit}
        />
    ),
    renderQuickControls: ({ config, actions, t, isDaylight }) => {
        const tuning = config?.monet?.tuning ?? DEFAULT_MONET_BACKGROUND_TUNING;
        const isFullOverlay = tuning.backgroundLayout === 'full-overlay';
        const layoutLabel = t(isFullOverlay ? 'options.monetLayoutFullOverlay' : 'options.monetLayoutHalfPane');

        return (
            <QuickControlChip
                isDaylight={isDaylight}
                label={layoutLabel}
                title={`${t('options.monetBackgroundLayout')}: ${layoutLabel}`}
                onClick={() => actions?.monet?.onTuningChange?.({
                    backgroundLayout: isFullOverlay ? 'half-pane-gradient' : 'full-overlay',
                })}
            />
        );
    },
    resetSettings: actions => actions?.monet?.onResetTuning?.(),
});
