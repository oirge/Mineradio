import React from 'react';
import { Library } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../../../types';
import { SettingsAnchor } from './navigation/SettingsAnchorContext';
import SettingsSectionHeading from './navigation/SettingsSectionHeading';
import { hasLibrarySuiteChoice } from '../../../library/registry';
import { chooseLibrarySuite, listLibrarySuiteOptions, useActiveLibrarySuiteId } from '../../../library/app/librarySuiteChoice';

// src/components/modal/settings/LibrarySuiteSection.tsx
// 资料库界面（Library UI suite）的选择，挂在界面设置里「播放进入视图」的下面。选项来自 registry 里可用的 suite，
// 只有一套可用时整节不渲染（命令面板用同一个 hasLibrarySuiteChoice）。高亮的是实际生效的 suite，
// 切换走 chooseLibrarySuite（当前会话 key + switchLibrarySuite）。不进外观配置的导入导出。

type LibrarySuiteSectionProps = {
    isDaylight: boolean;
    settingsCardClass: string;
    theme?: Theme;
};

const LibrarySuiteSection: React.FC<LibrarySuiteSectionProps> = ({
    isDaylight,
    settingsCardClass,
    theme,
}) => {
    const { t } = useTranslation();
    const activeSuiteId = useActiveLibrarySuiteId();

    if (!hasLibrarySuiteChoice()) return null;

    const accentColor = theme?.accentColor || (isDaylight ? '#3b82f6' : '#60a5fa');

    return (
        <SettingsAnchor anchorId="librarySuite" label={t('options.librarySuite')}>
            <SettingsSectionHeading icon={Library} label={t('options.librarySuite')} />
            <div className={`p-4 rounded-xl border space-y-4 ${settingsCardClass}`}>
                <div className="text-[11px] opacity-50 max-w-[420px]" style={{ color: 'var(--text-secondary)' }}>
                    {t('options.librarySuiteDesc')}
                </div>
                <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label={t('options.librarySuite')}>
                    {listLibrarySuiteOptions().map(option => {
                        const isSelected = option.id === activeSuiteId;
                        const frameClass = isSelected
                            ? (isDaylight ? 'bg-white shadow-md' : 'bg-white/[0.07]')
                            : (isDaylight ? 'bg-zinc-50 hover:bg-white' : 'bg-white/[0.03] hover:bg-white/[0.06]');
                        return (
                            <button
                                key={option.id}
                                type="button"
                                role="radio"
                                aria-checked={isSelected}
                                data-library-suite-option={option.id}
                                onClick={() => chooseLibrarySuite(option.id)}
                                className={`text-left rounded-2xl border px-3 py-2.5 text-sm font-medium transition-colors ${frameClass}`}
                                style={{
                                    color: 'var(--text-primary)',
                                    borderColor: isSelected
                                        ? accentColor
                                        : (isDaylight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.08)'),
                                }}
                            >
                                {t(option.labelKey)}
                            </button>
                        );
                    })}
                </div>
            </div>
        </SettingsAnchor>
    );
};

export default LibrarySuiteSection;
