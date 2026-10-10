import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { ChevronDown, ChevronLeft, List, Loader2, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../../types';
import type { GridItem } from '../../library/suites/grid/shared/PolaroidCard';
import { SlideActionButton } from '../../components/shared/SlideActionButton';
import { useLocalWallCatalog } from './wallCatalog';
import type { LocalPlayer } from './playerTypes';
import RecordWallViewport from './RecordWallViewport';
import LocalRecordTransport from './LocalRecordTransport';
import './localRecordWall.css';

// src/mineradio/local/LocalRecordWall.tsx
// The original floating Polaroid wall is composed around the host catalog, with no Folia app bootstrap.
interface Props {
    player: LocalPlayer;
    theme: Theme;
    isDaylight: boolean;
    onBack: () => void;
    onOpenQueue: () => void;
    onOpenLyrics: () => void;
}
export default function LocalRecordWall({ player, theme, isDaylight, onBack, onOpenQueue, onOpenLyrics }: Props) {
    const { t } = useTranslation('localPlayer');
    const catalog = useLocalWallCatalog(player);
    const [showCatalog, setShowCatalog] = useState(false);
    const items = useMemo<GridItem[]>(() => catalog.songs.map((song, index) => ({
        id: song.id, name: song.name, coverUrl: song.album.coverUrl,
        description: song.artists.map(artist => artist.name).filter(Boolean).join(' / ') || t('unknownArtist'),
        rawTrack: song, rawTrackIndex: index,
    })), [catalog.songs, t]);
    const command = player.command;
    const play = useCallback((id: string) => {
        void command('play', { id, playlistId: catalog.playlistId }).catch(() => {});
    }, [command, catalog.playlistId]);
    const addToQueue = useCallback((id: string) => { void command('addToQueue', { id }).catch(() => {}); }, [command]);
    const collection = catalog.playlists.find(playlist => playlist.id === catalog.playlistId);
    const title = collection?.name || t('allMusic');
    const style = { '--bg-color': theme.backgroundColor, '--text-primary': theme.primaryColor,
        '--text-secondary': theme.secondaryColor, '--text-accent': theme.accentColor,
        backgroundColor: theme.backgroundColor, color: theme.primaryColor } as CSSProperties;
    return <section className="local-record-wall" data-testid="local-record-wall" style={style}>
        {collection?.cover && <div className="local-record-backdrop" style={{ opacity: isDaylight ? 0.18 : 0.12 }}>
            <img src={collection.cover} alt="" /></div>}
        <button className="local-record-back" onClick={onBack} aria-label={t('back', { defaultValue: '返回歌词' })}
            data-testid="local-record-back"><ChevronLeft size={20} /></button>
        <button className="local-record-title" onClick={() => setShowCatalog(!showCatalog)} aria-expanded={showCatalog} data-testid="local-record-collection-toggle">
            <strong>{title}<ChevronDown size={13} /></strong><small>{t('tracks', { count: items.length })}</small>
        </button>
        {!catalog.loading && items.length > 0 && <RecordWallViewport key={`${catalog.playlistId}:${catalog.query}`}
            items={items} theme={theme} isDaylight={isDaylight} onPlay={play} onAddQueue={addToQueue} />}
        {(catalog.loading || !items.length) && <div className="local-record-empty">
            {catalog.loading ? <><Loader2 className="animate-spin" size={32} /><span>{t('loading')}</span></>
                : <><strong>{catalog.error || t(catalog.query ? 'noResults' : 'emptyLibrary')}</strong><p>{t('emptyHint')}</p>
                    <button onClick={() => { void command('importFiles').catch(() => {}); }}>{t('importFiles')}</button></>}
        </div>}
        {showCatalog && <div className="local-record-catalog theme-glass-panel" data-wheel-scroll-region>
            <div className="local-record-catalog-heading"><strong>{t('collection')}</strong><button onClick={() => setShowCatalog(false)} aria-label={t('close')}><X size={16} /></button></div>
            <select aria-label={t('collection')} value={catalog.playlistId} onChange={event => catalog.setPlaylistId(event.target.value)}>
                {catalog.playlists.length ? catalog.playlists.map(playlist => <option key={playlist.id} value={playlist.id}>{playlist.name} · {playlist.count}</option>) : <option value="library">{t('allMusic')}</option>}
            </select>
            <label><Search size={16} /><input autoFocus aria-label={t('search')} placeholder={t('search')} value={catalog.query} onChange={event => catalog.setQuery(event.target.value)} /></label>
        </div>}
        <LocalRecordTransport player={player} theme={theme} isDaylight={isDaylight} onOpenQueue={onOpenQueue} onOpenLyrics={onOpenLyrics} />
        <div className="local-record-list-button group"><SlideActionButton icon={List} title={t('queue')} onActivate={onOpenQueue}
            slideIcon={Search} slideTitle={t('search')} onSlide={() => setShowCatalog(true)} isDaylight={isDaylight} accentColor={theme.accentColor} /></div>
    </section>;
}
