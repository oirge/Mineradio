import { AnimatePresence } from 'framer-motion';
import { Music2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { useLocalPlayer } from './useLocalPlayer';
import LocalMotionStatus from './LocalMotionStatus';

// src/mineradio/local/LocalPlayerStates.tsx
// Empty, connecting and error states share a reversible entrance without moving the player layout.
export default function LocalPlayerStates({ player, isLyrics, onImport, onLibrary }: {
    player: ReturnType<typeof useLocalPlayer>; isLyrics: boolean; onImport: () => void; onLibrary: () => void;
}) {
    const { t } = useTranslation('localPlayer');
    const track = player.state?.currentTrack;
    return <AnimatePresence initial={false} mode="sync">
        {isLyrics && !track && <LocalMotionStatus key="welcome" className="local-welcome" center="both" role="status">
            <Music2 size={38} /><h1>{player.state ? t('chooseSong') : t('connecting')}</h1><p>{t('emptyHint')}</p>
            <div><button onClick={onImport}>{t('importFiles')}</button><button onClick={onLibrary}>{t('library')}</button></div>
        </LocalMotionStatus>}
        {isLyrics && track && !player.lines.length && <LocalMotionStatus key="no-lyrics" className="local-no-lyrics" center="both">
            <Music2 size={28} /><h2>{track.title}</h2><p>{track.artist || t('unknownArtist')}</p><small>{t('noLyrics')}</small>
        </LocalMotionStatus>}
    </AnimatePresence>;
}

export function LocalPlayerError({ error, onClose }: { error: string; onClose: () => void }) {
    const { t } = useTranslation('localPlayer');
    return <AnimatePresence initial={false}>
        {error && <LocalMotionStatus key="error" className="local-error" role="alert" testId="local-error">
            <span>{error}</span><button aria-label={t('close')} onClick={onClose}><X size={16} /></button>
        </LocalMotionStatus>}
    </AnimatePresence>;
}
