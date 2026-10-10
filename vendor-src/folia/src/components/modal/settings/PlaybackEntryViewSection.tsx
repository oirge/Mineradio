import React from 'react';
import { MonitorPlay } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import type { Theme } from '../../../types';
import { PlaybackEntryViewOptions } from '../playback-entry-view/PlaybackEntryViewOptions';
import { SettingsAnchor } from './navigation/SettingsAnchorContext';
import SettingsSectionHeading from './navigation/SettingsSectionHeading';
import { usePlaybackEntryViewStore } from '../../../stores/usePlaybackEntryViewStore';

// src/components/modal/settings/PlaybackEntryViewSection.tsx
// Where pressing play lands. Same two cards the first-run prompt shows, mounted in 界面设置.

type PlaybackEntryViewSectionProps = {
    isDaylight: boolean;
    settingsCardClass: string;
    theme?: Theme;
};

const PlaybackEntryViewSection: React.FC<PlaybackEntryViewSectionProps> = ({
    isDaylight,
    settingsCardClass,
    theme,
}) => {
    const { t } = useTranslation();
    const { playbackEntryView, setPlaybackEntryView } = usePlaybackEntryViewStore(useShallow(state => ({
        playbackEntryView: state.playbackEntryView,
        setPlaybackEntryView: state.setPlaybackEntryView,
    })));

    const accentColor = theme?.accentColor || (isDaylight ? '#3b82f6' : '#60a5fa');

    return (
        <SettingsAnchor anchorId="playbackEntryView" label={t('options.playbackEntryView')}>
            <SettingsSectionHeading icon={MonitorPlay} label={t('options.playbackEntryView')} />
            <div className={`p-4 rounded-xl border space-y-4 ${settingsCardClass}`}>
                <div className="text-[11px] opacity-50 max-w-[420px]" style={{ color: 'var(--text-secondary)' }}>
                    {t('options.playbackEntryViewDesc')}
                </div>
                <PlaybackEntryViewOptions
                    value={playbackEntryView}
                    onChange={setPlaybackEntryView}
                    isDaylight={isDaylight}
                    accentColor={accentColor}
                />
            </div>
        </SettingsAnchor>
    );
};

export default PlaybackEntryViewSection;
