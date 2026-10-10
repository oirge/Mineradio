import React, { useMemo } from 'react';
import { Pin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import type { Theme } from '../../../types';
import { COMMAND_PALETTE_COMMANDS } from '../../command-palette/commandRegistry';
import { getCommandTitle } from '../../command-palette/commandText';
import { CustomSelect } from '../../shared/CustomSelect';
import { SettingsAnchor } from './navigation/SettingsAnchorContext';
import SettingsSectionHeading from './navigation/SettingsSectionHeading';
import { useSettingsModalStore } from '../../../stores/useSettingsModalStore';

// src/components/modal/settings/PinnedCommandSettings.tsx
// Configures the three registry-backed shortcuts shown below the command palette.

type PinnedCommandSettingsProps = {
    isDaylight: boolean;
    settingsCardClass: string;
    theme?: Theme;
};

const PinnedCommandSettings: React.FC<PinnedCommandSettingsProps> = ({
    isDaylight,
    settingsCardClass,
    theme,
}) => {
    const { t } = useTranslation();
    const { pinnedCommandIds, setPinnedCommandId } = useSettingsModalStore(useShallow(state => ({
        pinnedCommandIds: state.pinnedCommandIds,
        setPinnedCommandId: state.setPinnedCommandId,
    })));

    // Three slots each mapped the whole ~125-command registry through getCommandTitle on every
    // render of the settings screen — roughly 375 t() lookups for a list that only changes when
    // the language does. Resolve the titles once; the per-slot filter below is plain array work.
    const commandOptions = useMemo(() => COMMAND_PALETTE_COMMANDS.map(command => ({
        id: command.id,
        value: command.id,
        label: getCommandTitle(command, t),
    })), [t]);

    return (
        <SettingsAnchor anchorId="pinnedCommands" label={t('options.pinnedCommands')}>
            <SettingsSectionHeading icon={Pin} label={t('options.pinnedCommands')} />
            <div className={`space-y-4 rounded-xl border p-4 ${settingsCardClass}`}>
                <div className="space-y-1">
                    <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {t('options.pinnedCommands')}
                    </div>
                    <div className="max-w-[520px] text-[11px] opacity-50" style={{ color: 'var(--text-secondary)' }}>
                        {t('options.pinnedCommandsDesc')}
                    </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    {pinnedCommandIds.map((commandId, slotIndex) => {
                        const options = [
                            { value: '', label: t('options.pinnedCommandNone') },
                            ...commandOptions.filter(option => (
                                option.id === commandId || !pinnedCommandIds.includes(option.id)
                            )),
                        ];
                        const slotLabel = t('options.pinnedCommandSlot', { index: slotIndex + 1 });

                        return (
                            <div key={slotIndex} className="min-w-0 space-y-1.5">
                                <div className="text-xs opacity-65" style={{ color: 'var(--text-secondary)' }}>
                                    {slotLabel}
                                </div>
                                <CustomSelect
                                    value={commandId ?? ''}
                                    onChange={(value) => setPinnedCommandId(slotIndex, value || null)}
                                    options={options}
                                    ariaLabel={slotLabel}
                                    placeholder={t('options.pinnedCommandNone')}
                                    isDaylight={isDaylight}
                                    theme={theme}
                                />
                            </div>
                        );
                    })}
                </div>
            </div>
        </SettingsAnchor>
    );
};

export default PinnedCommandSettings;
