import React from 'react';
import { GraduationCap, Lightbulb } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { selectPonderSettingsSnapshot, usePonderStore } from '../../../stores/usePonderStore';
import { PONDER_HINT_VISIBILITY_VALUES, type PonderHintVisibility } from '../../../types/ponder';
import { SettingsAnchor } from './navigation/SettingsAnchorContext';
import SettingsSectionHeading from './navigation/SettingsSectionHeading';

// src/components/modal/settings/PonderHintSettingsSection.tsx
// 思索教程提示的三档可见性。
//
// 独立成文件：file-modularization 说一次往既有文件加 80 行以上就该建模块。渲染在界面设置页
// （GeneralSettingsSubview）的末尾，锚点照样被 settingsAnchorCoverage 扫到（它只看 settings/
// 这一层的 *.tsx）。
//
// renderToggle 是两态的，套不上三档，所以这里自己画一组分段按钮。
//
// 触屏那颗按钮也归这一组：它和悬停提示是同一件事的两种形态 —— 一个给指针，一个给手指，
// 分到两处只会让「怎么把思索的提示关掉」变成要找两遍。

const LABEL_KEYS: Record<PonderHintVisibility, string> = {
    always: 'options.ponderHintsAlways',
    unseen: 'options.ponderHintsUnseen',
    off: 'options.ponderHintsOff',
};

type PonderHintSettingsSectionProps = {
    settingsCardClass: string;
    isDaylight: boolean;
    accentColor?: string;
};

const PonderHintSettingsSection: React.FC<PonderHintSettingsSectionProps> = ({
    settingsCardClass,
    isDaylight,
    accentColor,
}) => {
    const { t } = useTranslation();
    const {
        ponderHintVisibility,
        setPonderHintVisibility,
        showPonderTouchButton,
        setShowPonderTouchButton,
    } = usePonderStore(useShallow(selectPonderSettingsSnapshot));

    const idleClass = isDaylight ? 'hover:bg-black/[0.06]' : 'hover:bg-white/[0.08]';

    return (
        <SettingsAnchor anchorId="ponderHints" label={t('options.ponderHints')} className="space-y-4">
            <SettingsSectionHeading icon={GraduationCap} label={t('options.ponderHints')} />

            <div className={`p-4 rounded-xl border space-y-3 ${settingsCardClass}`}>
                <div className="space-y-1">
                    <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <GraduationCap size={14} />
                        {t('options.ponderHints')}
                    </div>
                    <div className="text-xs opacity-50 max-w-[420px]" style={{ color: 'var(--text-secondary)' }}>
                        {t('options.ponderHintsDesc')}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('options.ponderHints')}>
                    {PONDER_HINT_VISIBILITY_VALUES.map(value => {
                        const isActive = ponderHintVisibility === value;
                        return (
                            <button
                                key={value}
                                type="button"
                                role="radio"
                                aria-checked={isActive}
                                onClick={() => setPonderHintVisibility(value)}
                                className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${isActive ? '' : idleClass}`}
                                style={isActive
                                    ? { backgroundColor: accentColor || (isDaylight ? '#27272a' : '#fafafa'), color: isDaylight ? '#fafafa' : '#18181b' }
                                    : { color: 'var(--text-secondary)' }}
                            >
                                {t(LABEL_KEYS[value])}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className={`p-4 rounded-xl border ${settingsCardClass}`}>
                <div className="flex items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                            <Lightbulb size={14} />
                            {t('options.ponderTouchButton')}
                        </div>
                        <div className="text-xs opacity-50 max-w-[420px]" style={{ color: 'var(--text-secondary)' }}>
                            {t('options.ponderTouchButtonDesc')}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowPonderTouchButton(!showPonderTouchButton)}
                        aria-pressed={showPonderTouchButton}
                        aria-label={t('options.ponderTouchButton')}
                        className={`w-12 h-6 rounded-full p-1 transition-colors shrink-0 ${
                            showPonderTouchButton ? '' : (isDaylight ? 'bg-black/10' : 'bg-white/10')
                        }`}
                        style={showPonderTouchButton
                            ? { backgroundColor: accentColor || (isDaylight ? '#27272a' : '#fafafa') }
                            : undefined}
                    >
                        <span className={`block w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${showPonderTouchButton ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                </div>
            </div>
        </SettingsAnchor>
    );
};

export default PonderHintSettingsSection;
