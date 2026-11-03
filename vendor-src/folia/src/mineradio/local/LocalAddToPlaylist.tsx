import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HostState } from '../client';
import type { LocalCommand } from './useLibraryPage';
import { usePlaybackPlaylists } from './usePlaybackPlaylists';
import LocalToolPanel from './LocalToolPanel';

// src/mineradio/local/LocalAddToPlaylist.tsx
// Add the selected current track to an editable host playlist without switching playback.
export default function LocalAddToPlaylist({ state, command, onClose, onLibrary }: {
    state: HostState | null; command: LocalCommand; onClose: () => void; onLibrary: () => void;
}) {
    const { t } = useTranslation('localPlayer');
    const { playlists, loading } = usePlaybackPlaylists(state, command);
    const [busy, setBusy] = useState(false), [done, setDone] = useState('');
    const editable = playlists.filter(playlist => !playlist.readOnly);
    return <LocalToolPanel id="local-add-playlist" title={t('addToPlaylist')} onClose={onClose}>
        <strong data-i18n-skip>{state?.currentTrack?.title || t('chooseSong')}</strong>
        {loading ? <p className="local-tool-hint">{t('loading')}</p> : editable.length ? <select aria-label={t('addToPlaylist')} value=""
            disabled={busy || !state?.currentTrack} onChange={event => {
                const track = state?.currentTrack, playlistId = event.target.value;
                if (!track || !playlistId || busy) return;
                setBusy(true); setDone('');
                void command('addToPlaylist', { playlistId, trackIds: [track.id] }).then(() => setDone(track.title))
                    .catch(() => {}).finally(() => setBusy(false));
            }}><option value="" disabled>{t('presetChoose')}</option>{editable.map(playlist => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}</select>
            : <p className="local-tool-hint">{t('noEditablePlaylist')}</p>}
        {done && <p role="status" className="local-tool-hint" data-i18n-skip>{t('addedToPlaylist')} · {done}</p>}
        <button type="button" onClick={onLibrary}>{t('managePlaylists')}</button>
    </LocalToolPanel>;
}
