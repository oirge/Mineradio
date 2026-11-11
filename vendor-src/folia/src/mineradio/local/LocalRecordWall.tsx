import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { ChevronDown, ChevronLeft, List, Loader2, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import LocalCatalogRetry from './LocalCatalogRetry';
import type { Theme } from '../../types';
import { SlideActionButton } from '../../components/shared/SlideActionButton';
import { useLocalWallCatalog } from './wallCatalog';
import { buildRecordWallItems, type RecordWallItems } from './wallViewData';
import type { LocalPlayer } from './playerTypes';
import RecordWallViewport from './RecordWallViewport';
import LocalRecordTransport from './LocalRecordTransport';
import LocalArtwork from './LocalArtwork';
import LocalMotionStatus from './LocalMotionStatus';
import { useMobileMotion } from '../../hooks/useMobileMotion';
import { mobileMotionProps } from '../../utils/mobileMotion';
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
function CatalogPanel({ children, panelRef }: { children: ReactNode; panelRef: RefObject<HTMLDivElement | null> }) {
    const { mobile, reducedMotion } = useMobileMotion();
    const present = useIsPresent();
    return <motion.div ref={panelRef} className="local-record-catalog theme-glass-panel" data-wheel-scroll-region
        {...(mobile ? mobileMotionProps('menu', reducedMotion) : { initial: false as const })}
        style={{ transformOrigin: '0 0' }} inert={!present || undefined} aria-hidden={!present || undefined}
        data-mobile-motion-presence={mobile ? present ? 'present' : 'exiting' : undefined}>
        {children}
    </motion.div>;
}
export default function LocalRecordWall({ player, theme, isDaylight, onBack, onOpenQueue, onOpenLyrics }: Props) {
    const { t } = useTranslation('localPlayer');
    const catalog = useLocalWallCatalog(player);
    const [showCatalog, setShowCatalog] = useState(false);
    const catalogRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const closeCatalog = useCallback(() => {
        if (document.activeElement && catalogRef.current?.contains(document.activeElement)) triggerRef.current?.focus({ preventScroll: true });
        setShowCatalog(false);
    }, []);
    useEffect(() => {
        if (!showCatalog) return;
        const outside = (event: PointerEvent) => {
            if (event.target instanceof Node && !catalogRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)
                && !(event.target instanceof Element && event.target.closest('.local-record-list-button'))) closeCatalog();
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeCatalog(); }
        };
        const back = (event: Event) => { event.preventDefault(); event.stopImmediatePropagation(); closeCatalog(); };
        document.addEventListener('pointerdown', outside);
        document.addEventListener('keydown', escape);
        window.addEventListener('mineradio-mobile-back', back, true);
        return () => {
            document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape);
            window.removeEventListener('mineradio-mobile-back', back, true);
        };
    }, [showCatalog, closeCatalog]);
    const itemsCache = useRef<RecordWallItems | undefined>(undefined);
    const unknownArtist = t('unknownArtist');
    const items = useMemo(() => {
        const next = buildRecordWallItems(catalog.songs, unknownArtist, itemsCache.current);
        itemsCache.current = next;
        return next.items;
    }, [catalog.songs, unknownArtist]);
    const command = player.command;
    const play = useCallback((id: string) => {
        void command('play', { id, playlistId: catalog.playlistId }).catch(() => {});
    }, [command, catalog.playlistId]);
    const addToQueue = useCallback((id: string) => { void command('addToQueue', { id }).catch(() => {}); }, [command]);
    const collection = catalog.playlists.find(playlist => playlist.id === catalog.playlistId);
    const playlistLabel = (id: string, name: string) => id === 'library' ? t('allMusic') : id === 'special-liked' ? t('liked') : name;
    const title = collection ? playlistLabel(collection.id, collection.name) : t('allMusic');
    const style = { '--bg-color': theme.backgroundColor, '--text-primary': theme.primaryColor,
        '--text-secondary': theme.secondaryColor, '--text-accent': theme.accentColor,
        backgroundColor: theme.backgroundColor, color: theme.primaryColor } as CSSProperties;
    return <section className="local-record-wall" data-testid="local-record-wall" style={style}>
        <LocalCatalogRetry error={catalog.error} retry={catalog.refresh} />
        {collection?.cover && <div className="local-record-backdrop" style={{ opacity: isDaylight ? 0.18 : 0.12 }}>
            <LocalArtwork src={collection.cover} alt="" /></div>}
        <button className="local-record-back" onClick={onBack} aria-label={t('back')}
            data-testid="local-record-back"><ChevronLeft size={20} /></button>
        <button ref={triggerRef} className="local-record-title" onClick={() => setShowCatalog(!showCatalog)} aria-expanded={showCatalog} data-testid="local-record-collection-toggle">
            <strong>{title}<ChevronDown size={13} /></strong><small>{t('tracks', { count: items.length })}</small>
        </button>
        {items.length > 0 && <RecordWallViewport key={`${catalog.playlistId}:${catalog.query}`}
            items={items} theme={theme} isDaylight={isDaylight} onPlay={play} onAddQueue={addToQueue} />}
        <AnimatePresence initial={false}>{!items.length && <LocalMotionStatus key={catalog.loading ? 'record-loading' : 'record-empty'}
            className="local-record-empty" center="none" role="status">
            {catalog.loading ? <><Loader2 className="local-view-loader-spin" size={32} /><span>{t('loading')}</span></>
                : <><strong>{catalog.error || t(catalog.query ? 'noResults' : 'emptyLibrary')}</strong><p>{t('emptyHint')}</p>
                    <button onClick={() => { void command('importFiles').catch(() => {}); }}>{t('importFiles')}</button></>}
        </LocalMotionStatus>}</AnimatePresence>
        <AnimatePresence initial={false}>{showCatalog && <CatalogPanel key="catalog" panelRef={catalogRef}>
            <div className="local-record-catalog-heading"><strong>{t('collection')}</strong><button onClick={closeCatalog} aria-label={t('close')}><X size={16} /></button></div>
            <select aria-label={t('collection')} value={catalog.playlistId} onChange={event => catalog.setPlaylistId(event.target.value)}>
                {catalog.playlists.length ? catalog.playlists.map(playlist => <option key={playlist.id} value={playlist.id}>{playlistLabel(playlist.id, playlist.name)} · {playlist.count}</option>) : <option value="library">{t('allMusic')}</option>}
            </select>
            <label><Search size={16} /><input autoFocus aria-label={t('search')} placeholder={t('search')} value={catalog.query} onChange={event => catalog.setQuery(event.target.value)} /></label>
        </CatalogPanel>}</AnimatePresence>
        <div className="local-record-desktop-transport"><LocalRecordTransport player={player} theme={theme} isDaylight={isDaylight} onOpenQueue={onOpenQueue} onOpenLyrics={onOpenLyrics} /></div>
        <div className="local-record-list-button group"><SlideActionButton icon={List} title={t('queue')} onActivate={onOpenQueue}
            slideIcon={Search} slideTitle={t('search')} onSlide={() => setShowCatalog(true)} isDaylight={isDaylight} accentColor={theme.accentColor} /></div>
    </section>;
}
