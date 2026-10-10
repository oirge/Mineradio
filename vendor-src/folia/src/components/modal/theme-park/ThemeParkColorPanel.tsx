import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DualTheme } from '../../../types';
import FastColorPicker from '../../shared/FastColorPicker';
import { COLOR_FIELDS, type EditableColorKey, type EditableMode } from './themeParkDraft';

// src/components/modal/theme-park/ThemeParkColorPanel.tsx
// Color tab of the Theme Park editor: light/dark switch, the four theme color slots, the picker
// with its hex field, and the cover-derived recommended swatches.

type ThemeParkColorPanelProps = {
    mode: EditableMode;
    onModeChange: (mode: EditableMode) => void;
    activeColorKey: EditableColorKey;
    onActiveColorKeyChange: (key: EditableColorKey) => void;
    safeDraft: DualTheme;
    rawColorValue: string;
    recommendedColors: string[];
    isDaylight: boolean;
    onColorDrag: (color: string) => void;
    onColorPick: (color: string) => void;
    onHexInput: (value: string) => void;
    onHexCommit: () => void;
};

const ThemeParkColorPanel: React.FC<ThemeParkColorPanelProps> = ({
    mode,
    onModeChange,
    activeColorKey,
    onActiveColorKeyChange,
    safeDraft,
    rawColorValue,
    recommendedColors,
    isDaylight,
    onColorDrag,
    onColorPick,
    onHexInput,
    onHexCommit,
}) => {
    const { t } = useTranslation();
    const activeTheme = safeDraft[mode];
    const activeColor = activeTheme[activeColorKey];
    const pickerField = COLOR_FIELDS.find(field => field.key === activeColorKey) ?? COLOR_FIELDS[0];
    const idleBorderColor = isDaylight ? 'rgba(24,24,27,0.08)' : 'rgba(255,255,255,0.08)';
    const selectedBg = isDaylight ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.07)';

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-full bg-white/5 p-1">
                {(['light', 'dark'] as EditableMode[]).map(nextMode => (
                    <button
                        key={nextMode}
                        type="button"
                        onClick={() => onModeChange(nextMode)}
                        className="flex-1 rounded-full px-3 py-2 text-sm transition-colors"
                        style={{
                            color: 'var(--text-primary)',
                            backgroundColor: mode === nextMode
                                ? (isDaylight ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.12)')
                                : 'transparent',
                        }}
                    >
                        {t(nextMode === 'light' ? 'options.lightTheme' : 'options.darkTheme')}
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                {COLOR_FIELDS.map(field => {
                    const colorValue = activeTheme[field.key];
                    const isActive = activeColorKey === field.key;

                    return (
                        <button
                            key={`${mode}-${field.key}`}
                            type="button"
                            onClick={() => onActiveColorKeyChange(field.key)}
                            className="flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all"
                            style={{
                                borderColor: isActive ? activeTheme.accentColor : idleBorderColor,
                                backgroundColor: isActive ? selectedBg : 'transparent',
                            }}
                        >
                            <div className="h-10 w-10 rounded-xl border border-black/10" style={{ backgroundColor: colorValue }} />
                            <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                    {t(field.labelKey)}
                                </div>
                                <div className="mt-0.5 text-xs opacity-55" style={{ color: 'var(--text-secondary)' }}>
                                    {t(field.descKey)}
                                </div>
                            </div>
                            <div className="text-xs font-mono opacity-70" style={{ color: 'var(--text-secondary)' }}>
                                {colorValue.toUpperCase()}
                            </div>
                        </button>
                    );
                })}
            </div>

            <div className="relative z-40 space-y-3 rounded-[24px] border border-white/10 p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            {t(pickerField.labelKey)}
                        </div>
                        <div className="mt-1 text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                            {t(pickerField.descKey)}
                        </div>
                    </div>
                    <div className="rounded-full px-3 py-1 text-xs font-mono" style={{ color: activeTheme.backgroundColor, backgroundColor: activeColor }}>
                        {activeColor.toUpperCase()}
                    </div>
                </div>

                <div className="rounded-[22px] border border-white/10 bg-black/10 p-3">
                    <FastColorPicker
                        color={activeColor}
                        height={220}
                        onChange={onColorDrag}
                    />
                </div>

                <label className="block space-y-2">
                    <div className="text-xs font-medium uppercase tracking-[0.22em] opacity-50" style={{ color: 'var(--text-secondary)' }}>
                        HEX
                    </div>
                    <input
                        type="text"
                        value={rawColorValue}
                        onChange={(event) => onHexInput(event.target.value)}
                        onBlur={onHexCommit}
                        className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm outline-none transition-colors focus:border-white/20"
                        style={{ color: 'var(--text-primary)' }}
                        spellCheck={false}
                    />
                </label>
            </div>

            {recommendedColors.length > 0 && (
                <div className="space-y-2 rounded-[24px] border border-white/10 p-4">
                    <div className="text-xs font-medium uppercase tracking-[0.22em] opacity-50" style={{ color: 'var(--text-secondary)' }}>
                        {t('options.aiThemeQuickEditRecommendedColors')}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {recommendedColors.map(color => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => onColorPick(color)}
                                className="h-8 w-8 rounded-lg border border-white/15 transition-transform hover:scale-110 active:scale-95"
                                style={{ backgroundColor: color }}
                                title={color.toUpperCase()}
                                aria-label={color}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ThemeParkColorPanel;
