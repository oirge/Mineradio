import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Minimize2, Music2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { colorWithAlpha, mixColors } from '../../components/visualizer/colorMix';
import { DEFAULT_THEME, DAYLIGHT_THEME } from '../../services/baseThemes';
import { useLocalPlayer } from './useLocalPlayer';
import { useVisualSettings } from './useVisualSettings';
import LibraryPanel from './LibraryPanel';
import PlayerControls from './PlayerControls';
import VisualSettings from './VisualSettings';
import LocalVisualStage from './LocalVisualStage';
import LocalStatusToast from './LocalStatusToast';
import LocalHeader from './LocalHeader';
import { useLocalVisualAssets } from './useLocalVisualAssets';
import './local.css';

// src/mineradio/local/LocalPlayer.tsx
// Embedded local-player composition: upstream effects, host transport, and a bounded local catalog.
export default function LocalPlayer() {
    const { t } = useTranslation('localPlayer');
    const player = useLocalPlayer();
    const visuals = useVisualSettings();
    const assets = useLocalVisualAssets();
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [queue, setQueue] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [focus, setFocus] = useState(false);
    const theme = visuals.daylight ? DAYLIGHT_THEME : DEFAULT_THEME;
    const track = player.state?.currentTrack;
    const isLyrics = visuals.view === 'lyrics';
    const openQueue = () => { setQueue(true); setLibraryOpen(true); setSettingsOpen(false); setFocus(false); };
    const run = (method: string, params?: Record<string, unknown>) => { void player.command(method, params).catch(() => {}); };
    const style = useMemo(() => ({
        '--local-bg': theme.backgroundColor, '--local-text': theme.primaryColor,
        '--local-muted': theme.secondaryColor, '--local-accent': theme.accentColor,
        '--local-glass': colorWithAlpha(theme.backgroundColor, 0.88),
        '--local-hover': colorWithAlpha(theme.primaryColor, 0.07),
        '--local-line': colorWithAlpha(theme.primaryColor, 0.13),
        '--local-raised': mixColors(theme.backgroundColor, theme.primaryColor, 0.07),
        '--text-primary': theme.primaryColor, '--text-secondary': theme.secondaryColor,
        color: theme.primaryColor, backgroundColor: theme.backgroundColor,
    }) as CSSProperties, [theme]);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            const element = event.target as HTMLElement;
            if (element?.matches('input, textarea, select, button, [role="button"], [contenteditable="true"]')) return;
            if (event.code === 'Space') { event.preventDefault(); void player.command('togglePlay').catch(() => {}); }
            if (event.key === 'Escape') { setLibraryOpen(false); setSettingsOpen(false); setFocus(false); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [player.command]);
    return <main className={`local-player ${focus ? 'local-player-focus' : ''} ${!isLyrics ? 'local-player-wall' : ''}`} style={style} data-testid="local-player" data-active={player.active} data-view={visuals.view}>
        <LocalVisualStage player={player} theme={theme} assets={assets} focus={focus} onOpenQueue={openQueue} />
        {!focus && <LocalHeader view={visuals.view} libraryOpen={libraryOpen} settingsOpen={settingsOpen}
            onView={view => { visuals.update({ view }); setLibraryOpen(false); setSettingsOpen(false); }}
            onLibrary={() => { setLibraryOpen(!libraryOpen); setSettingsOpen(false); }}
            onSettings={() => { setSettingsOpen(!settingsOpen); setLibraryOpen(false); }}
            onFocus={() => { setFocus(true); setSettingsOpen(false); setLibraryOpen(false); }} />}
        {focus && <button className="local-exit-focus" aria-label={t('exitFocus')} title={t('exitFocus')} onClick={() => setFocus(false)}><Minimize2 size={18} /></button>}
        {isLyrics && !track && <div className="local-welcome"><Music2 size={38} /><h1>{player.state ? t('chooseSong') : t('connecting')}</h1><p>{t('emptyHint')}</p><div><button onClick={() => run('importFiles')}>{t('importFiles')}</button><button onClick={() => { setLibraryOpen(true); setFocus(false); }}>{t('library')}</button></div></div>}
        {isLyrics && track && !player.lines.length && <div className="local-no-lyrics"><Music2 size={28} /><h2>{track.title}</h2><p>{track.artist || t('unknownArtist')}</p><small>{t('noLyrics')}</small></div>}
        {!focus && <>
            {isLyrics && <div className="local-current-track" data-testid="local-current-track"><div className="local-current-cover">{track?.cover ? <img src={track.cover} alt="" /> : <Music2 size={24} />}</div><div><small>{t('nowPlaying')}</small><strong>{track?.title || t('chooseSong')}</strong><span>{track?.artist || ''}</span></div></div>}
            {isLyrics && <PlayerControls state={player.state} currentTime={player.currentTime} command={player.command} onQueue={() => { setQueue(true); setLibraryOpen(!libraryOpen || !queue); setSettingsOpen(false); }} />}
            {libraryOpen && <LibraryPanel state={player.state} command={player.command} queue={queue} onTab={setQueue} onClose={() => setLibraryOpen(false)} />}
            {settingsOpen && <VisualSettings assets={assets} theme={theme} onClose={() => setSettingsOpen(false)} />}
        </>}
        <LocalStatusToast />
        {player.error && <div className="local-error" role="alert" data-testid="local-error"><span>{player.error}</span><button aria-label={t('close')} onClick={player.clearError}><X size={16} /></button></div>}
    </main>;
}
