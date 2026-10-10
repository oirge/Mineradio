import { useState } from 'react';
import { ChevronLeft, ChevronRight, FileAudio, FolderPlus, Heart, Info, Music2, Plus, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HostState, HostTrack } from '../client';
import { formatTime } from './formatTime';
import { PAGE_SIZE, useLibraryPage, type LocalCommand } from './useLibraryPage';
import TrackDetails from './TrackDetails';

// src/mineradio/local/LibraryPanel.tsx
// Paginated local catalog/queue; only the requested page is represented in the DOM.
interface Props { state: HostState | null; command: LocalCommand; queue: boolean; onTab: (queue: boolean) => void; onClose: () => void; }
export default function LibraryPanel({ state, command, queue, onTab, onClose }: Props) {
    const { t } = useTranslation('localPlayer');
    const catalog = useLibraryPage(state, command, queue);
    const [details, setDetails] = useState<HostTrack | null>(null);
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState('');
    const run = (method: string, params?: Record<string, unknown>) => { void command(method, params).then(catalog.refresh).catch(() => {}); };
    const playlistLabel = (id: string, label: string) => id === 'library' ? t('allMusic') : id === 'special-liked' ? t('liked') : label;
    return <aside className="local-library local-glass" data-testid="local-library">
        <div className="local-panel-title"><div className="local-tabs">
            <button className={!queue ? 'is-active' : ''} onClick={() => onTab(false)}>{t('library')}</button>
            <button className={queue ? 'is-active' : ''} onClick={() => onTab(true)} data-testid="local-queue-tab">{t('queue')}</button>
        </div><button aria-label={t('close')} onClick={onClose}><X size={18} /></button></div>
        <div className="local-library-toolbar">
            {!queue && <div className="local-collection-row"><select aria-label={t('collection')} data-testid="local-collection" value={catalog.collection} onChange={(event) => { catalog.chooseCollection(event.target.value); setDetails(null); }}>
                {catalog.playlists.map((list) => <option value={list.id} key={list.id}>{playlistLabel(list.id, list.name)} · {list.count}</option>)}
            </select><button aria-label={t('createPlaylist')} title={t('createPlaylist')} onClick={() => setCreating(!creating)}><Plus size={19} /></button></div>}
            {creating && <form className="local-create-playlist" onSubmit={(event) => {
                event.preventDefault();
                void command('createPlaylist', { name }).then((result) => { catalog.refresh(); catalog.chooseCollection(result.id); setName(''); setCreating(false); }).catch(() => {});
            }}><input autoFocus aria-label={t('playlistName')} placeholder={t('playlistName')} value={name} maxLength={120} onChange={(event) => setName(event.target.value)} /><button disabled={!name.trim()} type="submit">{t('create')}</button></form>}
            <label className="local-search"><Search size={16} /><input aria-label={t('search')} placeholder={t('search')} data-testid="local-search" value={catalog.query} onChange={(event) => catalog.search(event.target.value)} /></label>
            <div className="local-import-row"><button onClick={() => run('importFiles')} data-testid="local-import-files"><FileAudio size={15} />{t('importFiles')}</button><button onClick={() => run('importFolder')} data-testid="local-import-folder"><FolderPlus size={15} />{t('importFolder')}</button></div>
        </div>
        {details ? <TrackDetails track={details} playlists={catalog.playlists} collection={catalog.collection} command={command} onClose={() => setDetails(null)} onChanged={catalog.refresh} /> : <div className="local-track-list" aria-busy={catalog.loading}>
            {catalog.page.items.length === 0 ? <div className="local-empty-list"><Music2 size={30} /><p>{catalog.loading ? t('loading') : catalog.query ? t('noResults') : t('emptyLibrary')}</p>{!catalog.query && !catalog.loading && <small>{t('emptyHint')}</small>}</div> : catalog.page.items.map((track, index) => <div className={`local-track-row ${state?.currentTrack?.id === track.id ? 'is-current' : ''}`} key={`${track.id}-${index}`} data-testid="local-track-row">
                <button className="local-track-play" data-track-id={track.id} disabled={catalog.loading} onClick={() => {
                    // Queue searches alter displayed offsets; identity-based play preserves the host's existing queue.
                    run('play', queue ? { id: track.id } : { id: track.id, playlistId: catalog.collection });
                }}>
                    <span className="local-track-cover">{track.cover ? <img loading="lazy" src={track.cover} alt="" /> : <Music2 size={19} />}</span>
                    <span className="local-track-text"><strong>{track.title}</strong><small>{track.artist || t('unknownArtist')}{track.album ? ` · ${track.album}` : ''}</small></span>
                    <span className="local-track-duration">{formatTime(track.duration)}</span>
                </button>
                <button className={track.liked ? 'is-liked' : ''} aria-label={t(track.liked ? 'unlike' : 'like')} onClick={() => run('toggleLike', { id: track.id })}><Heart size={15} fill={track.liked ? 'currentColor' : 'none'} /></button>
                <button aria-label={t('details')} title={t('details')} onClick={() => setDetails(track)}><Info size={15} /></button>
            </div>)}
        </div>}
        <div className="local-pagination"><small>{t('tracks', { count: catalog.page.total })}</small><div>
            <button disabled={catalog.offset === 0 || catalog.loading} aria-label={t('previousPage')} onClick={() => catalog.setOffset(Math.max(0, catalog.offset - PAGE_SIZE))}><ChevronLeft size={17} /></button>
            <span>{t('page', { page: Math.floor(catalog.offset / PAGE_SIZE) + 1, pages: Math.max(1, Math.ceil(catalog.page.total / PAGE_SIZE)) })}</span>
            <button disabled={catalog.offset + PAGE_SIZE >= catalog.page.total || catalog.loading} aria-label={t('nextPage')} data-testid="local-next-page" onClick={() => catalog.setOffset(catalog.offset + PAGE_SIZE)}><ChevronRight size={17} /></button>
        </div></div>
    </aside>;
}
