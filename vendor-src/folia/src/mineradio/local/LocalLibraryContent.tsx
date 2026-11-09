import { useRef, type ReactNode, type RefObject } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { Heart, Info, Loader2, Music2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HostState, HostTrack } from '../client';
import type { useLibraryPage } from './useLibraryPage';
import { useMobileMotion } from '../../hooks/useMobileMotion';
import { mobileMotionProps, mobileMotionTransition } from '../../utils/mobileMotion';
import { formatTime } from './formatTime';
import LocalArtwork from './LocalArtwork';
import TrackDetails from './TrackDetails';
import { useLocalTrackListMotion, type LocalListMemory } from './useLocalTrackListMotion';
import './localNavigationMotion.css';

// src/mineradio/local/LocalLibraryContent.tsx
// The bounded page keeps row identities and scroll position through metadata refreshes.
type Catalog = ReturnType<typeof useLibraryPage>;
interface Props {
    state: HostState | null;
    catalog: Catalog;
    queue: boolean;
    details: HostTrack | null;
    onDetails: (track: HostTrack | null) => void;
    run: (method: string, params?: Record<string, unknown>) => void;
    command: Parameters<typeof TrackDetails>[0]['command'];
}
function ContentLayer({ direction, children }: { direction: number; children: ReactNode }) {
    const { mobile, reducedMotion } = useMobileMotion();
    const present = useIsPresent();
    const props = mobileMotionProps('page', reducedMotion, direction);
    return <motion.div className="local-library-content-layer" inert={!present || undefined} aria-hidden={!present || undefined}
        data-mobile-motion-presence={mobile ? present ? 'present' : 'exiting' : undefined}
        variants={{
            initial: (next: number) => mobileMotionProps('page', reducedMotion, next).initial,
            visible: props.animate,
            exit: (next: number) => mobileMotionProps('page', reducedMotion, next).exit,
        }} custom={direction} initial={mobile ? 'initial' : false} animate="visible" exit={mobile ? 'exit' : undefined}
        transition={mobile ? props.transition : { duration: 0 }}>{children}</motion.div>;
}
interface RowProps extends Pick<Props, 'onDetails' | 'run' | 'queue'> {
    track: HostTrack; identity: string; collection: string; loading: boolean;
    currentId?: string; mobile: boolean; reducedMotion: boolean;
}
const favoriteVariants = { liked: { scale: 1.05 }, idle: { scale: 1 } };
function TrackRow({ track, identity, collection, loading,
    currentId, mobile, reducedMotion, queue, onDetails, run }: RowProps) {
    const { t } = useTranslation('localPlayer');
    return <div className={`local-track-row ${currentId === track.id ? 'is-current' : ''}`}
        data-testid="local-track-row" data-local-row-key={identity}>
        <button className="local-track-play" data-track-id={track.id} disabled={loading} onClick={() => {
            // Queue search offsets are display-only; play by host identity, as before.
            run('play', queue ? { id: track.id } : { id: track.id, playlistId: collection });
        }}>
            <span className="local-track-cover">{track.cover ? <LocalArtwork loading="lazy" src={track.cover} alt="" /> : <Music2 size={19} />}</span>
            <span className="local-track-text"><strong>{track.title}</strong><small>{track.artist || t('unknownArtist')}{track.album ? ` · ${track.album}` : ''}</small></span>
            <span className="local-track-duration">{formatTime(track.duration)}</span>
        </button>
        <button className={track.liked ? 'is-liked' : ''} aria-label={t(track.liked ? 'unlike' : 'like')} aria-pressed={track.liked}
            onClick={() => run('toggleLike', { id: track.id })}>
            <motion.span initial={false} animate={mobile && !reducedMotion && track.liked ? 'liked' : 'idle'} variants={favoriteVariants}
                transition={mobileMotionTransition('micro', !mobile || reducedMotion)} style={{ display: 'inline-flex' }}>
                <Heart size={15} fill={track.liked ? 'currentColor' : 'none'} />
            </motion.span>
        </button>
        <button aria-label={t('details')} title={t('details')} onClick={() => onDetails(track)}><Info size={15} /></button>
    </div>;
}
function TrackList({ state, catalog, queue, onDetails, run, scrollMemory, entered }: Omit<Props, 'details' | 'command'> & {
    scrollMemory: LocalListMemory; entered: RefObject<boolean>;
}) {
    const { t } = useTranslation('localPlayer');
    const { mobile, reducedMotion } = useMobileMotion();
    const occurrences = new Map<string, number>();
    const rows = catalog.page.items.map(track => {
        const occurrence = occurrences.get(track.id) ?? 0;
        occurrences.set(track.id, occurrence + 1);
        return { track, key: `${track.id}:${occurrence}` };
    });
    const identity = JSON.stringify(rows.map(row => row.key));
    const list = useLocalTrackListMotion({ scope: catalog.displayScope, stale: catalog.stale, identity, scrollMemory, entered });
    return <><div ref={list} className="local-track-list" aria-busy={catalog.loading} inert={catalog.stale || undefined}
        data-testid="local-track-list" data-content-scope={catalog.displayScope} data-request-scope={catalog.scope}>
        {!rows.length && (mobile && catalog.loading ? <div role="status" aria-label={t('loading')} data-testid="local-track-skeleton">
            <span className="local-track-loading-label">{t('loading')}</span>
            {Array.from({ length: 6 }, (_, index) => <div key={index} className="local-track-row local-track-skeleton" aria-hidden="true">
                <div className="local-track-play"><span className="local-track-cover" /><span className="local-track-text"><span /><span /></span><span className="local-track-duration" /></div>
            </div>)}
        </div> : <motion.div className="local-empty-list" {...(mobile ? mobileMotionProps('status', reducedMotion) : {})}>
            <Music2 size={30} /><p>{catalog.loading ? t('loading') : catalog.query ? t('noResults') : t('emptyLibrary')}</p>
            {!catalog.query && !catalog.loading && <small>{t('emptyHint')}</small>}
        </motion.div>)}
            {rows.map(({ track, key }) => <TrackRow key={key} track={track} identity={key}
                collection={catalog.collection} loading={catalog.loading} currentId={state?.currentTrack?.id}
                queue={queue} onDetails={onDetails} run={run} mobile={mobile} reducedMotion={reducedMotion} />)}
    </div>{mobile && catalog.stale && rows.length > 0 && <div className="local-track-pending" role="status">
        <Loader2 size={14} className="local-view-loader-spin" /><span>{t('loading')}</span>
    </div>}</>;
}
export default function LocalLibraryContent(props: Props) {
    const scrollMemory = useRef({ scope: props.catalog.scope, top: 0 });
    const entered = useRef(false);
    const direction = props.details ? 1 : -1;
    return <div className="local-library-content">
        <AnimatePresence initial={false} custom={direction}>
            <ContentLayer key={props.details ? 'details' : 'tracks'} direction={direction}>
                {props.details ? <TrackDetails track={props.details} playlists={props.catalog.playlists} collection={props.catalog.collection}
                    command={props.command} onClose={() => props.onDetails(null)} onChanged={props.catalog.refresh} />
                    : <TrackList {...props} scrollMemory={scrollMemory} entered={entered} />}
            </ContentLayer>
        </AnimatePresence>
    </div>;
}
