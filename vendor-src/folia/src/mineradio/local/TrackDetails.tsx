import { Music2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HostPlaylist, HostTrack } from '../client';
import type { LocalCommand } from './useLibraryPage';

// src/mineradio/local/TrackDetails.tsx
// Local file metadata and collection membership actions use host-owned identifiers.
interface Props { track: HostTrack; playlists: HostPlaylist[]; collection: string; command: LocalCommand; onClose: () => void; onChanged: () => void; }
export default function TrackDetails({ track, playlists, collection, command, onClose, onChanged }: Props) {
    const { t } = useTranslation('localPlayer');
    const run = (method: string, params: Record<string, unknown>) => {
        void command(method, params).then(onChanged).catch(() => {});
    };
    return <section className="local-track-details" data-testid="local-track-details">
        <div className="local-panel-title"><strong>{t('details')}</strong><button aria-label={t('close')} onClick={onClose}><X size={16} /></button></div>
        <div className="local-details-song">{track.cover ? <img src={track.cover} alt="" /> : <Music2 />}<div><strong>{track.title}</strong><span>{track.artist || t('unknownArtist')}</span></div></div>
        <dl><dt>{t('album')}</dt><dd>{track.album || t('unknownAlbum')}</dd><dt>{t('format')}</dt><dd>{track.format.toUpperCase() || '—'}</dd><dt>{t('path')}</dt><dd className="local-file-path">{track.filePath || '—'}</dd></dl>
        {playlists.some((item) => !item.readOnly) && <select aria-label={t('addToPlaylist')} defaultValue="" onChange={(event) => {
            if (event.target.value) run('addToPlaylist', { playlistId: event.target.value, trackIds: [track.id] });
            event.target.value = '';
        }}><option value="" disabled>{t('addToPlaylist')}</option>{playlists.filter((item) => !item.readOnly).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>}
        {playlists.some((item) => item.id === collection && !item.readOnly) && <button className="local-text-button" onClick={() => run('removeFromPlaylist', { playlistId: collection, trackIds: [track.id] })}>{t('removeFromPlaylist')}</button>}
    </section>;
}
