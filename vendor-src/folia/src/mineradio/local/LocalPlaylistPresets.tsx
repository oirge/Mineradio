import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HostState } from '../client';
import type { LocalCommand } from './useLibraryPage';
import { usePlaybackPlaylists } from './usePlaybackPlaylists';
import { useVisualSettings } from './useVisualSettings';

export default function LocalPlaylistPresets({ state, command }: { state: HostState | null; command: LocalCommand }) {
    const { t } = useTranslation('localPlayer');
    const catalog = usePlaybackPlaylists(state, command);
    const [chosen, setChosen] = useState<string | null>(null);
    const { presets, playlistPresets, bindPlaylistPreset, applyPreset } = useVisualSettings();
    const playlistId = chosen && catalog.playlists.some(entry => entry.id === chosen) ? chosen : catalog.currentId;
    return <details className="local-tuning" data-testid="local-playlist-presets">
        <summary>{t('playlistPresets')}</summary>
        <label className="local-setting"><span>{t('collection')}</span><select aria-label={t('presetPlaylist')} value={playlistId}
            disabled={catalog.loading} onChange={event => setChosen(event.target.value)}>
            {catalog.playlists.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
        </select></label>
        <label className="local-setting"><span>{t('visualPresets')}</span><select aria-label={t('playlistPreset')} value={playlistPresets[playlistId] ?? ''}
            disabled={catalog.loading || !catalog.playlists.length} onChange={event => {
                const id = event.target.value;
                bindPlaylistPreset(playlistId, id || null);
                if (id && playlistId === catalog.currentId) applyPreset(id);
            }}><option value="">{t('presetUnbound')}</option>{presets.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
        <small>{t('playlistPresetHint')}</small>
    </details>;
}
