import React from 'react';
import { Boxes, Power } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../../../types';
import { ModManager } from '../../../mods/manager/ModManager';
import { ModSystemSwitch } from '../../../mods/manager/ModSystemSwitch';
import { modManagerClassesFor } from '../../../mods/manager/modManagerClasses';
import { SettingsAnchor } from './navigation/SettingsAnchorContext';
import SettingsSectionHeading from './navigation/SettingsSectionHeading';

// src/components/modal/settings/ModsSettingsSubview.tsx
// The mods settings page: the mod system's master switch first, the installed mods under it. Both
// halves are the components the palette's `mods` surface renders, so the two stay identical.

type ModsSettingsSubviewProps = {
    isDaylight: boolean;
    theme?: Theme;
};

const ModsSettingsSubview: React.FC<ModsSettingsSubviewProps> = ({ isDaylight, theme }) => {
    const { t } = useTranslation();
    const classes = modManagerClassesFor(isDaylight);

    return (
        <div className="space-y-5">
            <SettingsAnchor anchorId="modSystem" label={t('options.enableModSystem')} className="space-y-4">
                <SettingsSectionHeading icon={Power} label={t('options.enableModSystem')} />
                <ModSystemSwitch classes={classes} theme={theme ?? null} />
            </SettingsAnchor>

            <SettingsAnchor anchorId="modList" label={t('mods.title')} className="space-y-4">
                <SettingsSectionHeading icon={Boxes} label={t('mods.title')} />
                <ModManager classes={classes} isDaylight={isDaylight} theme={theme ?? null} />
            </SettingsAnchor>
        </div>
    );
};

export default ModsSettingsSubview;
