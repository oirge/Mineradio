import React from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import type { Theme } from '@/types';
import SettingsRow, { SettingsToggle } from '../../components/modal/settings/SettingsRow';
import { useDesktopSettingsStore } from '../../stores/useDesktopSettingsStore';
import type { ModManagerClasses } from './modManagerClasses';

// src/mods/manager/ModSystemSwitch.tsx
// The mod system's master switch as a one-row card. Rendered at the top of both the settings page
// and the palette surface, so the list below it always sits under the switch that governs it.

type ModSystemSwitchProps = {
    classes: ModManagerClasses;
    theme: Theme | null;
};

export const ModSystemSwitch: React.FC<ModSystemSwitchProps> = ({ classes, theme }) => {
    const { t } = useTranslation();
    const { modSystemEnabled, onToggleModSystem } = useDesktopSettingsStore(useShallow(state => ({
        modSystemEnabled: state.modSystemEnabled,
        onToggleModSystem: state.handleToggleModSystem,
    })));

    return (
        <div className={`rounded-xl border overflow-hidden ${classes.card}`}>
            <SettingsRow
                title={(
                    <>
                        {t('options.enableModSystem')}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-normal border ${classes.experimentalBadge}`}>
                            {t('mods.experimental')}
                        </span>
                    </>
                )}
                description={t('options.enableModSystemDesc')}
                note={t('options.enableModSystemDescSub')}
                control={(
                    <SettingsToggle
                        checked={modSystemEnabled}
                        onChange={() => onToggleModSystem(!modSystemEnabled)}
                        offClass={classes.toggleOff}
                        onColor={theme?.secondaryColor}
                        ariaLabel={t('options.enableModSystem')}
                    />
                )}
                dividerClass={classes.divider}
                isLast
            />
        </div>
    );
};

export default ModSystemSwitch;
