import React from 'react';
import { Lightbulb, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// src/components/modal/SettingsHelpActions.tsx

type SettingsHelpActionsProps = {
    onOpenReleaseNotes: () => void;
    onOpenPonder: () => void;
};

const SettingsHelpActions: React.FC<SettingsHelpActionsProps> = ({ onOpenReleaseNotes, onOpenPonder }) => {
    const { t } = useTranslation();

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
                type="button"
                data-testid="help-release-notes"
                onClick={onOpenReleaseNotes}
                className="flex items-center gap-3 rounded-2xl bg-white/5 p-4 text-left transition-colors hover:bg-white/10"
                style={{ color: 'var(--text-primary)' }}
            >
                <Sparkles size={19} className="shrink-0 opacity-75" aria-hidden="true" />
                <span>
                    <span className="block text-sm font-semibold">{t('help.releaseNotes')}</span>
                    <span className="mt-0.5 block text-xs opacity-55">{t('help.releaseNotesDescription')}</span>
                </span>
            </button>
            <button
                type="button"
                data-testid="help-page-ponder"
                onClick={onOpenPonder}
                className="flex items-center gap-3 rounded-2xl bg-white/5 p-4 text-left transition-colors hover:bg-white/10"
                style={{ color: 'var(--text-primary)' }}
            >
                <Lightbulb size={19} className="shrink-0 opacity-75" aria-hidden="true" />
                <span>
                    <span className="block text-sm font-semibold">{t('help.ponder')}</span>
                    <span className="mt-0.5 block text-xs opacity-55">{t('help.ponderDescription')}</span>
                </span>
            </button>
        </div>
    );
};

export default SettingsHelpActions;
