import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { AudioLines, Captions, Command, Ellipsis, Film, Library, Palette, Radio, SlidersHorizontal, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { LocalHeaderProps } from './LocalHeader';
import { useMobileMotion } from '../../hooks/useMobileMotion';
import { mobileMotionProps, mobileMotionTransition } from '../../utils/mobileMotion';

// src/mineradio/local/LocalMobileNavigation.tsx
function MoreMenu({ tool, onTool, onClose }: Pick<LocalHeaderProps, 'tool' | 'onTool'> & { onClose: () => void }) {
    const { t } = useTranslation('localPlayer');
    const { reducedMotion } = useMobileMotion();
    const present = useIsPresent();
    const panel = useRef<HTMLElement>(null);
    const close = useRef(onClose);
    close.current = onClose;
    useEffect(() => {
        if (!present) return;
        const previous = document.activeElement as HTMLElement | null;
        const node = panel.current;
        node?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
        const key = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); }
        };
        document.addEventListener('keydown', key, true);
        return () => {
            document.removeEventListener('keydown', key, true);
            if (previous?.isConnected && (node?.contains(document.activeElement) || document.activeElement === document.body)) previous.focus({ preventScroll: true });
        };
    }, [present]);
    return <motion.section ref={panel} {...mobileMotionProps('sheet', reducedMotion)}
        inert={!present} aria-hidden={!present || undefined}
        data-mobile-motion-presence={present ? 'present' : 'exiting'}
        className="local-mobile-more local-glass" role="dialog" aria-label={t('mobileMore')} data-testid="local-mobile-more">
        <div className="local-panel-title"><strong>{t('mobileMore')}</strong><button type="button" aria-label={t('close')} onClick={onClose}><X size={20} /></button></div>
        <div>{([{ id: 'commands', label: 'commands', icon: Command }, { id: 'subtitles', label: 'subtitleSettings', icon: Captions },
            { id: 'audio', label: 'audioSettings', icon: AudioLines }, { id: 'videoExport', label: 'videoExport', icon: Film }] as const).map(item => <button key={item.id}
                type="button" data-testid={`local-open-${item.id}`} aria-expanded={tool === item.id} onClick={() => { onClose(); onTool(item.id); }}><item.icon size={22} /><span>{t(item.label)}</span></button>)}</div>
    </motion.section>;
}

// Touch navigation keeps all embedded Folia views and tools within the phone viewport.
export default function LocalMobileNavigation({ view, libraryOpen, settingsOpen, playbackOpen, tool, mobileFocus = false, onView, onLibrary, onSettings, onPlayback, onTool }: LocalHeaderProps) {
    const { t } = useTranslation('localPlayer');
    const { reducedMotion } = useMobileMotion();
    const present = useIsPresent();
    const [more, setMore] = useState(false);
    useEffect(() => { setMore(false); }, [view, libraryOpen, settingsOpen, playbackOpen, tool, mobileFocus]);
    useEffect(() => {
        if (!present || mobileFocus) return;
        const close = (event: Event) => { if (more) { event.preventDefault(); setMore(false); } };
        window.addEventListener('mineradio-mobile-back', close);
        return () => window.removeEventListener('mineradio-mobile-back', close);
    }, [more, present, mobileFocus]);
    const panel = libraryOpen || settingsOpen || playbackOpen || !!tool || more;
    const chooseView = (value: LocalHeaderProps['view']) => { setMore(false); onView(value); };
    return <motion.div initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={mobileMotionTransition('component', reducedMotion)}
        inert={!present || mobileFocus} aria-hidden={!present || mobileFocus || undefined}
        className="local-mobile-navigation" data-testid="local-navigation" data-mobile-focus={String(mobileFocus)}>
        <header className="local-mobile-header">
            <div className="local-mobile-view-switch" role="group" aria-label={t('playbackView')}>
                {(['lyrics', 'records', 'posters'] as const).map(value => <button type="button" key={value}
                    data-testid={`local-view-${value}`} aria-pressed={view === value} onClick={() => chooseView(value)}>{t(`${value}View`)}</button>)}
            </div>
            <button type="button" className="local-mobile-return" data-testid="local-mobile-return" aria-label={t('returnToMineradio')} title={t('returnToMineradio')}
                onClick={() => { const host = window.parent as Window & { MineradioFoliaHost?: { setInterface: (mode: string) => void } }; host.MineradioFoliaHost?.setInterface('mineradio'); }}><Radio size={21} /></button>
        </header>
        <AnimatePresence initial={false} mode="sync" propagate>{more && <MoreMenu key="more" tool={tool} onTool={onTool} onClose={() => setMore(false)} />}</AnimatePresence>
        <nav className="local-mobile-nav" aria-label={t('mobileNavigation')} data-testid="local-mobile-nav">
            <button type="button" aria-pressed={!panel} onClick={() => chooseView(view)}><Captions size={21} /><span>{t('play')}</span></button>
            <button type="button" data-testid="local-open-library" aria-pressed={libraryOpen} onClick={() => { setMore(false); onLibrary(); }}><Library size={21} /><span>{t('library')}</span></button>
            <button type="button" data-testid="local-open-settings" aria-pressed={settingsOpen} onClick={() => { setMore(false); onSettings(); }}><Palette size={21} /><span>{t('effects')}</span></button>
            <button type="button" data-testid="local-open-playback" aria-expanded={playbackOpen} onClick={() => { setMore(false); onPlayback(); }}><SlidersHorizontal size={21} /><span>{t('playbackSettings')}</span></button>
            <button type="button" data-testid="local-mobile-more-toggle" aria-expanded={more} onClick={() => setMore(!more)}><Ellipsis size={21} /><span>{t('mobileMore')}</span></button>
        </nav>
    </motion.div>;
}
