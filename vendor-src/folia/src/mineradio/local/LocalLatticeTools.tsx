import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Crosshair, Focus, ListMusic, Settings2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLatticeControlsStore } from '../../stores/useLatticeControlsStore';
import { useLatticeSettingsStore } from '../../stores/useLatticeSettingsStore';
import { SlideActionButton } from '../../components/shared/SlideActionButton';
import '../../components/app/lattice/LatticeFocusButton.css';

// src/mineradio/local/LocalLatticeTools.tsx
// The upstream wall utility panel, with its queue action connected directly to the local catalog.
export default function LocalLatticeTools({ isDaylight, onOpenQueue }: { isDaylight: boolean; onOpenQueue: () => void }) {
    const { t } = useTranslation();
    const { t: localText } = useTranslation('localPlayer');
    const [isOpen, setIsOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const focusCurrentSong = useLatticeControlsStore(state => state.focusCurrentSong);
    const settings = useLatticeSettingsStore();
    useEffect(() => {
        if (!isOpen) return;
        const close = (event: PointerEvent) => {
            if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setIsOpen(false);
        };
        const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setIsOpen(false); };
        document.addEventListener('pointerdown', close);
        document.addEventListener('keydown', escape);
        return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', escape); };
    }, [isOpen]);
    const openQueue = () => { setIsOpen(false); onOpenQueue(); };
    return <motion.div ref={rootRef} style={{ bottom: 24 }} className={`lattice-tools group ${isDaylight ? 'is-daylight' : ''}`}>
        <AnimatePresence initial={false}>{isOpen && <motion.div role="menu" aria-label={t('home.latticeTools')}
            initial={{ opacity: 0, scale: 0.9, originX: 1, originY: 1 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2, ease: 'easeOut' }} className="lattice-tools-panel">
            <button type="button" role="menuitem" className="lattice-tools-action" disabled={!focusCurrentSong}
                onClick={() => { focusCurrentSong?.(); setIsOpen(false); }}><Crosshair /><span>{t('home.latticeFocusCurrent')}</span></button>
            <button type="button" role="menuitemcheckbox" aria-checked={settings.autoFocusOnSongChange} className="lattice-tools-action"
                onClick={() => settings.handleToggleAutoFocusOnSongChange(!settings.autoFocusOnSongChange)}><Focus /><span>{t('home.latticeAutoFocusOnSongChange')}</span>
                <span className={`lattice-tools-toggle ${settings.autoFocusOnSongChange ? 'is-on' : ''}`} aria-hidden="true"><span /></span></button>
            <button type="button" role="menuitem" className="lattice-tools-action" onClick={openQueue}><ListMusic /><span>{localText('queue')}</span></button>
            <div className="lattice-tools-help-section"><button type="button" role="menuitemcheckbox" aria-checked={settings.latticeLightsOn}
                aria-label={t('home.latticeLights')} className="lattice-tools-lights-toggle" onClick={() => settings.handleToggleLatticeLights(!settings.latticeLightsOn)}>
                <span className={settings.latticeLightsOn ? 'is-active' : ''}>{t('home.latticeLightsOn')}</span>
                <span className={!settings.latticeLightsOn ? 'is-active' : ''}>{t('home.latticeLightsOff')}</span>
            </button></div>
        </motion.div>}</AnimatePresence>
        <SlideActionButton icon={isOpen ? X : Settings2} title={t('home.latticeTools')} onActivate={() => setIsOpen(value => !value)}
            slideIcon={ListMusic} slideTitle={localText('queue')} onSlide={openQueue} isDaylight={isDaylight} accentColor="var(--text-accent)" />
    </motion.div>;
}
