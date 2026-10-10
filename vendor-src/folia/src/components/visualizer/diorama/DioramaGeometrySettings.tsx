import React, { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
    type DioramaGeometryVisibility,
    type Theme,
} from '../../../types';
import { colorWithAlpha } from '../colorMix';
import { DioramaParticleAppearanceSettings } from './DioramaParticleAppearanceSettings';
import { DioramaSettingsToggle } from './DioramaSettingsToggle';

// src/components/visualizer/diorama/DioramaGeometrySettings.tsx
// Hierarchical visibility and density controls for Diorama's procedural particle-cloud families.
interface DioramaGeometrySettingsProps {
    t: (key: string) => string;
    theme: Theme;
    isDaylight: boolean;
    value: DioramaGeometryVisibility;
    onChange: (next: DioramaGeometryVisibility) => void;
    density: number;
    onDensityChange: (next: number) => void;
    particleScale: number;
    onParticleScaleChange: (next: number) => void;
    glowEnabled: boolean;
    onGlowEnabledChange: (next: boolean) => void;
    glowIntensity: number;
    onGlowIntensityChange: (next: number) => void;
    rangeInputClass: string;
    onSliderPointerDown?: () => void;
    onSliderCommit?: () => void;
}

type GeometryChildKey = Exclude<keyof DioramaGeometryVisibility, 'enabled' | 'mode'>;

const CHILDREN: Array<{ key: GeometryChildKey; labelKey: string }> = [
    { key: 'strands', labelKey: 'options.dioramaGeometryStrands' },
    { key: 'blobs', labelKey: 'options.dioramaGeometryBlobs' },
    { key: 'ribbons', labelKey: 'options.dioramaGeometryRibbons' },
    { key: 'rings', labelKey: 'options.dioramaGeometryRings' },
];

const MODES: Array<{ key: DioramaGeometryVisibility['mode']; labelKey: string }> = [
    { key: 'clouds', labelKey: 'options.dioramaGeometryModeClouds' },
    { key: 'corridor', labelKey: 'options.dioramaGeometryModeCorridor' },
];

export const DioramaGeometrySettings: React.FC<DioramaGeometrySettingsProps> = ({
    t,
    theme,
    isDaylight,
    value,
    onChange,
    density,
    onDensityChange,
    particleScale,
    onParticleScaleChange,
    glowEnabled,
    onGlowEnabledChange,
    glowIntensity,
    onGlowIntensityChange,
    rangeInputClass,
    onSliderPointerDown,
    onSliderCommit,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const childrenId = useId();

    return (
        <fieldset className="space-y-2.5">
            <legend className="sr-only">{t('options.dioramaGeometry')}</legend>
            <div
                className="flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-3"
                style={{
                    borderColor: colorWithAlpha(theme.secondaryColor, isDaylight ? 0.17 : 0.14),
                    backgroundColor: colorWithAlpha(theme.backgroundColor, isDaylight ? 0.24 : 0.34),
                }}
            >
                <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={childrenId}
                    onClick={() => setIsExpanded((expanded) => !expanded)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                    <ChevronDown
                        size={16}
                        aria-hidden="true"
                        className={`shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        style={{ color: 'var(--text-secondary)' }}
                    />
                    <span className="min-w-0">
                        <span className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {t('options.dioramaGeometry')}
                        </span>
                    </span>
                </button>
                <DioramaSettingsToggle
                    checked={value.enabled}
                    label={t('options.dioramaGeometry')}
                    onChange={(enabled) => onChange({ ...value, enabled })}
                    theme={theme}
                    isDaylight={isDaylight}
                />
            </div>

            {isExpanded && (
                <div
                    id={childrenId}
                    className="ml-3 space-y-1.5 border-l pl-3"
                    style={{ borderColor: colorWithAlpha(theme.accentColor, value.enabled ? 0.3 : 0.12) }}
                >
                    {/* Mutually-exclusive shape of the whole layer: per-line clouds OR one path tunnel. */}
                    <div
                        className="flex gap-2 transition-opacity"
                        role="group"
                        aria-label={t('options.dioramaGeometryMode')}
                        style={{ opacity: value.enabled ? 1 : 0.52 }}
                    >
                        {MODES.map((item) => {
                            const isActive = value.mode === item.key;
                            return (
                                <button
                                    key={item.key}
                                    type="button"
                                    aria-pressed={isActive}
                                    disabled={!value.enabled}
                                    onClick={() => onChange({ ...value, mode: item.key })}
                                    className="flex-1 rounded-xl px-3 py-2 text-sm transition-all border disabled:cursor-not-allowed"
                                    style={{
                                        color: 'var(--text-primary)',
                                        borderColor: isActive
                                            ? theme.accentColor
                                            : colorWithAlpha(theme.secondaryColor, isDaylight ? 0.18 : 0.14),
                                        backgroundColor: isActive
                                            ? colorWithAlpha(theme.accentColor, isDaylight ? 0.1 : 0.16)
                                            : colorWithAlpha(theme.backgroundColor, isDaylight ? 0.24 : 0.34),
                                        boxShadow: isActive ? `inset 0 0 0 1px ${theme.accentColor}` : 'none',
                                    }}
                                >
                                    {t(item.labelKey)}
                                </button>
                            );
                        })}
                    </div>

                    {value.mode === 'clouds' && CHILDREN.map((item) => (
                        <div
                            key={item.key}
                            className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 transition-opacity"
                            style={{
                                opacity: value.enabled ? 1 : 0.52,
                                backgroundColor: colorWithAlpha(theme.backgroundColor, isDaylight ? 0.16 : 0.26),
                            }}
                        >
                            <div className="min-w-0">
                                <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                                    {t(item.labelKey)}
                                </div>
                            </div>
                            <DioramaSettingsToggle
                                checked={value[item.key]}
                                disabled={!value.enabled}
                                label={t(item.labelKey)}
                                onChange={(checked) => onChange({ ...value, [item.key]: checked })}
                                theme={theme}
                                isDaylight={isDaylight}
                            />
                        </div>
                    ))}
                    <DioramaParticleAppearanceSettings
                        t={t}
                        theme={theme}
                        isDaylight={isDaylight}
                        enabled={value.enabled}
                        density={density}
                        onDensityChange={onDensityChange}
                        particleScale={particleScale}
                        onParticleScaleChange={onParticleScaleChange}
                        glowEnabled={glowEnabled}
                        onGlowEnabledChange={onGlowEnabledChange}
                        glowIntensity={glowIntensity}
                        onGlowIntensityChange={onGlowIntensityChange}
                        rangeInputClass={rangeInputClass}
                        onSliderPointerDown={onSliderPointerDown}
                        onSliderCommit={onSliderCommit}
                    />
                </div>
            )}
        </fieldset>
    );
};
