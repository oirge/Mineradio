import { useTranslation } from 'react-i18next';
import type { SubtitleContentMode } from '../../types';
import LocalToolPanel from './LocalToolPanel';
import SubtitleRowsSettings from './SubtitleRowsSettings';
import { useVisualSettings } from './useVisualSettings';

// src/mineradio/local/LocalSubtitleSettings.tsx
// Bottom overlay visibility, row content and secondary subtitles retain their separate meanings.
export default function LocalSubtitleSettings({ onClose }: { onClose: () => void }) {
    const { t } = useTranslation('localPlayer');
    const settings = useVisualSettings();
    return <LocalToolPanel id="local-subtitle-settings" title={t('subtitleSettings')} onClose={onClose}>
        <label className="local-playback-toggle"><span>{t('subtitleHidden')}</span><input type="checkbox" data-testid="local-subtitle-hidden"
            checked={settings.subtitleHidden} onChange={event => settings.update({ subtitleHidden: event.target.checked })} /></label>
        <SubtitleRowsSettings />
        <label className="local-playback-toggle"><span>{t('subtitleBackground')}</span><input type="checkbox" data-testid="local-subtitle-background"
            checked={settings.subtitleBackground} onChange={event => settings.update({ subtitleBackground: event.target.checked })} /></label>
        <label className="local-setting"><span>{t('secondarySubtitle')}</span><select data-testid="local-secondary-subtitle" value={settings.subtitleContentMode}
            onChange={event => settings.update({ subtitleContentMode: event.target.value as SubtitleContentMode })}>
            {(['translation', 'romanization', 'both', 'none'] as const).map(mode => <option key={mode} value={mode}>{t(`subtitleSource_${mode}`)}</option>)}
        </select></label>
        <label className="local-playback-toggle"><span>{t('harmonySubtitles')}</span><input type="checkbox" data-testid="local-harmony"
            checked={settings.harmony} onChange={event => settings.update({ harmony: event.target.checked })} /></label>
        <p className="local-tool-hint">{t('subtitleHint')}</p>
    </LocalToolPanel>;
}
