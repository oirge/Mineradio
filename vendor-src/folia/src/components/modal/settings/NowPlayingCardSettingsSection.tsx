import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../../../types';
import type { StageTrackPillMode } from '../../../stores/useStageSettingsStore';

// src/components/modal/settings/NowPlayingCardSettingsSection.tsx
// Controls the shared now-playing card shown on the player, Lattice and optionally Home.

type NowPlayingCardSettingsSectionProps = {
    accentOutlineColor: string;
    isDaylight: boolean;
    mode: StageTrackPillMode;
    timeoutSec: number;
    showOnHome: boolean;
    settingsCardClass: string;
    toggleOffBackgroundClass: string;
    theme?: Theme;
    onChangeMode: (mode: StageTrackPillMode) => void;
    onChangeTimeoutSec: (sec: number) => void;
    onToggleShowOnHome: (enabled: boolean) => void;
};

const NowPlayingCardSettingsSection: React.FC<NowPlayingCardSettingsSectionProps> = ({
    accentOutlineColor,
    isDaylight,
    mode,
    timeoutSec,
    showOnHome,
    settingsCardClass,
    toggleOffBackgroundClass,
    theme,
    onChangeMode,
    onChangeTimeoutSec,
    onToggleShowOnHome,
}) => {
    const { t } = useTranslation();
    const getOptionStyle = (selected: boolean): React.CSSProperties => selected
        ? {
            borderColor: accentOutlineColor,
            boxShadow: `inset 0 0 0 1px ${accentOutlineColor}`,
            backgroundColor: isDaylight ? `${accentOutlineColor}12` : `${accentOutlineColor}18`,
        }
        : {
            borderColor: isDaylight ? 'rgba(24, 24, 27, 0.12)' : 'rgba(255, 255, 255, 0.1)',
            backgroundColor: isDaylight ? 'rgba(255, 255, 255, 0.72)' : 'rgba(255, 255, 255, 0.05)',
        };

    return (
        <div className={`p-4 rounded-xl border space-y-4 ${settingsCardClass}`}>
            <div className="space-y-1">
                <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    {t('options.stageTrackPill')}
                </div>
                <div className="text-xs opacity-50 max-w-[360px]" style={{ color: 'var(--text-secondary)' }}>
                    {t('options.stageTrackPillDesc')}
                </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {(['auto', 'always', 'never'] as const).map(pillMode => (
                    <button
                        key={pillMode}
                        type="button"
                        onClick={() => onChangeMode(pillMode)}
                        aria-pressed={mode === pillMode}
                        className="px-2 py-1.5 rounded-lg text-xs border transition-all"
                        style={getOptionStyle(mode === pillMode)}
                    >
                        {t(`options.stageTrackPillMode_${pillMode}`)}
                    </button>
                ))}
            </div>
            {mode === 'auto' && (
                <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between gap-4">
                        <div className="text-xs opacity-50" style={{ color: 'var(--text-secondary)' }}>
                            {t('options.stageTrackPillTimeout')}
                        </div>
                        <span className="text-xs font-mono w-12 text-right shrink-0" style={{ color: 'var(--text-primary)' }}>
                            {timeoutSec}s
                        </span>
                    </div>
                    {/* accentColor 取主题色，随明暗与换主题实时跟随；写法与设置中其他量条
                        （GridViewSettingsSection / LatticePosterTintControls）保持一致 */}
                    <input
                        type="range"
                        min={3}
                        max={60}
                        step={1}
                        value={timeoutSec}
                        onChange={(event) => onChangeTimeoutSec(Number(event.target.value))}
                        className="w-full accent-current"
                        style={{ accentColor: theme?.accentColor }}
                        aria-label={t('options.stageTrackPillTimeout')}
                    />
                    <div className="flex justify-between text-[11px] font-mono opacity-60" style={{ color: 'var(--text-secondary)' }}>
                        <span>3s</span>
                        <span>60s</span>
                    </div>
                </div>
            )}
            {mode !== 'never' && (
                <div className="flex items-center justify-between gap-4 pt-1">
                    <div className="space-y-0.5 min-w-0">
                        <div className="text-xs" style={{ color: 'var(--text-primary)' }}>
                            {t('options.stageTrackPillOnHome')}
                        </div>
                        <div className="text-xs opacity-50 max-w-[300px]" style={{ color: 'var(--text-secondary)' }}>
                            {t('options.stageTrackPillOnHomeDesc')}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => onToggleShowOnHome(!showOnHome)}
                        className={`w-12 h-6 rounded-full p-1 transition-colors shrink-0 ${!showOnHome ? toggleOffBackgroundClass : ''}`}
                        style={{ backgroundColor: showOnHome ? theme?.secondaryColor || 'rgba(114, 119, 134, 1)' : undefined }}
                        aria-pressed={showOnHome}
                        aria-label={t('options.stageTrackPillOnHome')}
                    >
                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${showOnHome ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default NowPlayingCardSettingsSection;
