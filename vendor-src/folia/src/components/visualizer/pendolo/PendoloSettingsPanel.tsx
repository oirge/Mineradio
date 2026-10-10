import React, { useMemo } from 'react';
import { DEFAULT_PENDOLO_TUNING, type PendoloTuning } from '../../../types';
import { type VisualizerSettingsPanelProps } from '../definition';
import VisualizerPresetGroup, { type VisualizerPresetOption } from '../VisualizerPresetGroup';

// src/components/visualizer/pendolo/PendoloSettingsPanel.tsx
// Owns Pendolo-specific tuning controls while reusing the shared themed preset group.
const PendoloSettingsPanel: React.FC<VisualizerSettingsPanelProps> = ({
    t,
    isDaylight,
    theme,
    rangeInputClass,
    pendoloTuning,
    onPendoloTuningChange,
    onSliderPointerDown,
    onSliderCommit,
}) => {
    const resolvedTuning = pendoloTuning ?? DEFAULT_PENDOLO_TUNING;
    const centerGradientOptions: VisualizerPresetOption<boolean>[] = useMemo(() => ([
        { value: true, label: t('options.pendoloCenterGradientOn') },
        { value: false, label: t('options.pendoloCenterGradientOff') },
    ]), [t]);
    const coverOnWatchFaceOptions: VisualizerPresetOption<boolean>[] = useMemo(() => ([
        { value: true, label: t('options.pendoloCoverOnWatchFaceOn') },
        { value: false, label: t('options.pendoloCoverOnWatchFaceOff') },
    ]), [t]);
    const lineGlowOptions: VisualizerPresetOption<boolean>[] = useMemo(() => ([
        { value: true, label: t('options.pendoloLineGlowOn') },
        { value: false, label: t('options.pendoloLineGlowOff') },
    ]), [t]);
    const gearDecorOptions: VisualizerPresetOption<PendoloTuning['showGearDecor']>[] = useMemo(() => ([
        { value: 'none', label: t('options.decorNone') },
        { value: 'subtle', label: t('options.decorSubtle') },
        { value: 'full', label: t('options.decorFull') },
    ]), [t]);

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-primary)' }}>
                    <span>{t('options.pendoloWheelCenterX')}</span>
                    <span className="font-mono opacity-70" style={{ color: 'var(--text-secondary)' }}>
                        {resolvedTuning.wheelCenterX > 0 ? '+' : ''}{Math.round(resolvedTuning.wheelCenterX * 100)}%
                    </span>
                </div>
                <input
                    type="range"
                    min="-0.20"
                    max="0.40"
                    step="0.01"
                    value={resolvedTuning.wheelCenterX}
                    onChange={(event) => onPendoloTuningChange?.({ wheelCenterX: parseFloat(event.target.value) })}
                    onPointerDown={onSliderPointerDown}
                    onPointerUp={onSliderCommit}
                    className={rangeInputClass}
                />
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-primary)' }}>
                    <span>{t('options.pendoloArcRadius')}</span>
                    <span className="font-mono opacity-70" style={{ color: 'var(--text-secondary)' }}>
                        {Math.round(resolvedTuning.arcRadius * 100)}%
                    </span>
                </div>
                <input
                    type="range"
                    min="0.25"
                    max="0.80"
                    step="0.01"
                    value={resolvedTuning.arcRadius}
                    onChange={(event) => onPendoloTuningChange?.({ arcRadius: parseFloat(event.target.value) })}
                    onPointerDown={onSliderPointerDown}
                    onPointerUp={onSliderCommit}
                    className={rangeInputClass}
                />
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-primary)' }}>
                    <span>{t('options.pendoloArcAngleDeg')}</span>
                    <span className="font-mono opacity-70" style={{ color: 'var(--text-secondary)' }}>
                        {Math.round(resolvedTuning.arcAngleDeg)}°
                    </span>
                </div>
                <input
                    type="range"
                    min="40"
                    max="160"
                    step="5"
                    value={resolvedTuning.arcAngleDeg}
                    onChange={(event) => onPendoloTuningChange?.({ arcAngleDeg: parseFloat(event.target.value) })}
                    onPointerDown={onSliderPointerDown}
                    onPointerUp={onSliderCommit}
                    className={rangeInputClass}
                />
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-primary)' }}>
                    <span>{t('options.pendoloTickSnappiness')}</span>
                    <span className="font-mono opacity-70" style={{ color: 'var(--text-secondary)' }}>
                        {resolvedTuning.tickSnappiness.toFixed(1)}x
                    </span>
                </div>
                <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={resolvedTuning.tickSnappiness}
                    onChange={(event) => onPendoloTuningChange?.({ tickSnappiness: parseFloat(event.target.value) })}
                    onPointerDown={onSliderPointerDown}
                    onPointerUp={onSliderCommit}
                    className={rangeInputClass}
                />
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between text-sm" style={{ color: 'var(--text-primary)' }}>
                    <span>{t('options.pendoloActiveScale')}</span>
                    <span className="font-mono opacity-70" style={{ color: 'var(--text-secondary)' }}>
                        {resolvedTuning.activeScale.toFixed(2)}x
                    </span>
                </div>
                <input
                    type="range"
                    min="1.00"
                    max="1.60"
                    step="0.05"
                    value={resolvedTuning.activeScale}
                    onChange={(event) => onPendoloTuningChange?.({ activeScale: parseFloat(event.target.value) })}
                    onPointerDown={onSliderPointerDown}
                    onPointerUp={onSliderCommit}
                    className={rangeInputClass}
                />
            </div>

            <VisualizerPresetGroup
                label={t('options.pendoloShowGearDecor')}
                value={resolvedTuning.showGearDecor}
                options={gearDecorOptions}
                onChange={(next) => onPendoloTuningChange?.({ showGearDecor: next })}
                isDaylight={isDaylight}
                theme={theme}
            />
            <VisualizerPresetGroup
                label={t('options.pendoloShowCenterGradient')}
                value={resolvedTuning.showCenterGradient ?? true}
                options={centerGradientOptions}
                onChange={(next) => onPendoloTuningChange?.({ showCenterGradient: next })}
                isDaylight={isDaylight}
                theme={theme}
            />
            <VisualizerPresetGroup
                label={t('options.pendoloShowCoverOnWatchFace')}
                value={resolvedTuning.showCoverOnWatchFace ?? false}
                options={coverOnWatchFaceOptions}
                onChange={(next) => onPendoloTuningChange?.({ showCoverOnWatchFace: next })}
                isDaylight={isDaylight}
                theme={theme}
            />
            <VisualizerPresetGroup
                label={t('options.pendoloEnableLineGlow')}
                value={resolvedTuning.enableLineGlow ?? false}
                options={lineGlowOptions}
                onChange={(next) => onPendoloTuningChange?.({ enableLineGlow: next })}
                isDaylight={isDaylight}
                theme={theme}
            />
        </div>
    );
};

export default PendoloSettingsPanel;
