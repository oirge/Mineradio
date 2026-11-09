import { useCallback, useEffect, useRef, useState, type FormEventHandler, type ReactNode } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { ChevronLeft, ChevronRight, FileAudio, FolderPlus, Plus, Search, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HostState, HostTrack } from '../client';
import { PAGE_SIZE, useLibraryPage, type LocalCommand } from './useLibraryPage';
import { useMobileMotion } from '../../hooks/useMobileMotion';
import { mobileMotionProps, mobileMotionTransition } from '../../utils/mobileMotion';
import LocalLibraryContent from './LocalLibraryContent';

// src/mineradio/local/LibraryPanel.tsx
// Paginated local catalog/queue; only the requested page is represented in the DOM.
interface Props { state: HostState | null; command: LocalCommand; queue: boolean; onTab: (queue: boolean) => void; onClose: () => void; }
function CreatePlaylistForm({ children, onSubmit }: { children: ReactNode; onSubmit: FormEventHandler<HTMLFormElement> }) {
    const { mobile, reducedMotion } = useMobileMotion();
    const present = useIsPresent();
    const props = mobileMotionProps('component', reducedMotion);
    return <motion.form className="local-create-playlist" onSubmit={onSubmit} inert={!present || undefined} aria-hidden={!present || undefined}
        data-mobile-motion-presence={mobile ? present ? 'present' : 'exiting' : undefined}
        initial={mobile && !reducedMotion ? { ...props.initial, height: 0 } : false}
        animate={{ ...props.animate, height: 'auto' }} exit={mobile ? { ...props.exit, height: 0 } : undefined}
        transition={mobileMotionTransition('component', !mobile || reducedMotion)} style={mobile ? { overflow: 'hidden' } : undefined}>{children}</motion.form>;
}
export default function LibraryPanel({ state, command, queue, onTab, onClose }: Props) {
    const { t } = useTranslation('localPlayer');
    const { mobile, reducedMotion } = useMobileMotion();
    const present = useIsPresent();
    const [details, setDetails] = useState<HostTrack | null>(null);
    const onTracksChanged = useCallback((tracks: ReadonlyMap<string, HostTrack>) => {
        setDetails(previous => previous ? tracks.get(previous.id) ?? previous : null);
    }, []);
    const catalog = useLibraryPage(state, command, queue, onTracksChanged);
    const [creating, setCreating] = useState(false);
    const [createPending, setCreatePending] = useState(false);
    const createRequest = useRef(false);
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
    const [name, setName] = useState('');
    const run = (method: string, params?: Record<string, unknown>) => { void command(method, params).then(catalog.refresh).catch(() => {}); };
    const playlistLabel = (id: string, label: string) => id === 'library' ? t('allMusic') : id === 'special-liked' ? t('liked') : label;
    return <motion.aside className="local-library local-glass" data-testid="local-library"
        inert={!present || undefined} aria-hidden={!present || undefined}
        data-mobile-motion-presence={mobile ? present ? 'present' : 'exiting' : undefined}
        {...(mobile ? mobileMotionProps('sheet', reducedMotion) : { initial: false as const })}>
        <div className="local-panel-title"><div className="local-tabs">
            <button className={!queue ? 'is-active' : ''} onClick={() => onTab(false)}>{t('library')}</button>
            <button className={queue ? 'is-active' : ''} onClick={() => onTab(true)} data-testid="local-queue-tab">{t('queue')}</button>
        </div><button aria-label={t('close')} onClick={onClose}><X size={18} /></button></div>
        <div className="local-library-toolbar">
            {!queue && <div className="local-collection-row"><select aria-label={t('collection')} data-testid="local-collection" value={catalog.collection} onChange={(event) => { catalog.chooseCollection(event.target.value); setDetails(null); }}>
                {catalog.playlists.map((list) => <option value={list.id} key={list.id}>{playlistLabel(list.id, list.name)} · {list.count}</option>)}
            </select><button aria-label={t('createPlaylist')} title={t('createPlaylist')} aria-expanded={creating} onClick={() => setCreating(!creating)}><Plus size={19} /></button></div>}
            <AnimatePresence initial={false}>{creating && <CreatePlaylistForm onSubmit={(event) => {
                event.preventDefault();
                if (createRequest.current) return;
                createRequest.current = true; setCreatePending(true);
                void command('createPlaylist', { name }).then((result) => {
                    if (mounted.current) { catalog.refresh(); catalog.chooseCollection(result.id); setName(''); setCreating(false); }
                }).catch(() => {}).finally(() => {
                    createRequest.current = false;
                    if (mounted.current) setCreatePending(false);
                });
            }}><input autoFocus aria-label={t('playlistName')} placeholder={t('playlistName')} value={name} maxLength={120} onChange={(event) => setName(event.target.value)} />
                <button disabled={!name.trim() || createPending} aria-busy={createPending} type="submit">{t('create')}</button></CreatePlaylistForm>}</AnimatePresence>
            <label className="local-search"><Search size={16} /><input aria-label={t('search')} placeholder={t('search')} data-testid="local-search" value={catalog.query} onChange={(event) => catalog.search(event.target.value)} /></label>
            <div className="local-import-row"><button onClick={() => run('importFiles')} data-testid="local-import-files"><FileAudio size={15} />{t('importFiles')}</button><button onClick={() => run('importFolder')} data-testid="local-import-folder"><FolderPlus size={15} />{t('importFolder')}</button></div>
        </div>
        <LocalLibraryContent state={state} catalog={catalog} queue={queue} details={details} onDetails={setDetails} command={command} run={run} />
        <div className="local-pagination"><small>{t('tracks', { count: catalog.page.total })}</small><div>
            <button disabled={catalog.offset === 0 || catalog.loading} aria-label={t('previousPage')} onClick={() => catalog.setOffset(Math.max(0, catalog.offset - PAGE_SIZE))}><ChevronLeft size={17} /></button>
            <span>{t('page', { page: Math.floor(catalog.offset / PAGE_SIZE) + 1, pages: Math.max(1, Math.ceil(catalog.page.total / PAGE_SIZE)) })}</span>
            <button disabled={catalog.offset + PAGE_SIZE >= catalog.page.total || catalog.loading} aria-label={t('nextPage')} data-testid="local-next-page" onClick={() => catalog.setOffset(catalog.offset + PAGE_SIZE)}><ChevronRight size={17} /></button>
        </div></div>
    </motion.aside>;
}
