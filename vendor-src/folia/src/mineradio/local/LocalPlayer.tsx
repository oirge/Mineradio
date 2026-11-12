import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Minimize2, Music2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { colorWithAlpha, mixColors } from '../../components/visualizer/colorMix';
import { DEFAULT_THEME, DAYLIGHT_THEME } from '../../services/baseThemes';
import { useLocalPlayer } from './useLocalPlayer';
import { useVisualSceneSettings } from './useVisualSettings';
import { usePlaylistVisualPreset } from './usePlaylistVisualPreset';
import LibraryPanel from './LibraryPanel';
import PlayerControls from './PlayerControls';
import VisualSettings from './VisualSettings';
import LocalVisualStage from './LocalVisualStage';
import LocalErrorBoundary from './LocalErrorBoundary';
import LocalStatusToast from './LocalStatusToast';
import LocalHeader from './LocalHeader';
import LocalPlaybackSettings from './LocalPlaybackSettings';
import LocalToolDialogs from './LocalToolDialogs';
import { LocalActionsContext } from './LocalActionsContext';
import { useLocalActions } from './useLocalActions';
import { useLocalVisualAssets } from './useLocalVisualAssets';
import { useLocalVisualizerPrewarm } from './useLocalVisualizerPrewarm';
import { useLocalSubtitleBottom } from './useLocalSubtitleBottom';
import { PlayerSubtitleBottomContext } from '../../components/floating-player/PlayerBottomBarLayoutContext';
import './local.css';

// src/mineradio/local/LocalPlayer.tsx
// Embedded local-player composition: upstream effects, host transport, and a bounded local catalog.
export default function LocalPlayer() {
    const { t, i18n } = useTranslation('localPlayer');
    const player = useLocalPlayer();
    useEffect(() => {
        const language = player.state?.uiLanguage;
        if (language && language !== i18n.language) void i18n.changeLanguage(language);
    }, [player.state?.uiLanguage, i18n]);
    useEffect(() => { document.title = t('windowTitle'); }, [t]);
    const visuals = useVisualSceneSettings();
    const assets = useLocalVisualAssets();
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [queue, setQueue] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [playbackOpen, setPlaybackOpen] = useState(false);
    const closePlayback = useCallback(() => setPlaybackOpen(false), []);
    // Leave the GPU to the selected effect and live preview while the user edits settings.
    useLocalVisualizerPrewarm(player.active && !settingsOpen);
    const [focus, setFocus] = useState(false);
    const theme = visuals.daylight ? DAYLIGHT_THEME : DEFAULT_THEME;
    const track = player.state?.currentTrack;
    const isLyrics = visuals.view === 'lyrics';
    const playerRoot = useRef<HTMLElement>(null);
    const subtitleBottom = useLocalSubtitleBottom(playerRoot, isLyrics && !focus);
    const transparent = isLyrics && visuals.background.transparent === true;
    useEffect(() => {
        document.documentElement.classList.toggle('local-player-transparent', transparent);
        return () => document.documentElement.classList.remove('local-player-transparent');
    }, [transparent]);
    const openQueue = () => { setQueue(true); setLibraryOpen(true); setSettingsOpen(false); setPlaybackOpen(false); setFocus(false); };
    const tools = useLocalActions({ state: player.state, command: player.command, active: player.active,
        beforeTool: () => { setLibraryOpen(false); setSettingsOpen(false); setPlaybackOpen(false); setFocus(false); },
        library: queue => { setQueue(queue); setLibraryOpen(true); setSettingsOpen(false); setPlaybackOpen(false); setFocus(false); },
        playback: () => { setPlaybackOpen(true); setLibraryOpen(false); setSettingsOpen(false); setFocus(false); },
        visuals: () => { setSettingsOpen(true); setLibraryOpen(false); setPlaybackOpen(false); setFocus(false); },
        focus: () => { setFocus(true); setSettingsOpen(false); setLibraryOpen(false); setPlaybackOpen(false); },
        view: view => { visuals.update({ view }); setLibraryOpen(false); setSettingsOpen(false); setPlaybackOpen(false); },
    });
    const run = (method: string, params?: Record<string, unknown>) => { void player.command(method, params).catch(() => {}); };
    const style = useMemo(() => ({
        '--local-bg': theme.backgroundColor, '--local-text': theme.primaryColor,
        '--local-muted': theme.secondaryColor, '--local-accent': theme.accentColor,
        '--local-glass': colorWithAlpha(theme.backgroundColor, 0.88),
        '--local-hover': colorWithAlpha(theme.primaryColor, 0.07),
        '--local-line': colorWithAlpha(theme.primaryColor, 0.13),
        '--local-raised': mixColors(theme.backgroundColor, theme.primaryColor, 0.07),
        '--text-primary': theme.primaryColor, '--text-secondary': theme.secondaryColor,
        color: theme.primaryColor, backgroundColor: transparent ? 'transparent' : theme.backgroundColor,
    }) as CSSProperties, [theme, transparent]);
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.defaultPrevented) return;
            const element = event.target as HTMLElement;
            if (element?.matches('input, textarea, select, button, [role="button"], [contenteditable="true"]')) return;
            if (event.code === 'Space') { event.preventDefault(); void player.command('togglePlay').catch(() => {}); }
            if (event.key === 'Escape') { setLibraryOpen(false); setSettingsOpen(false); setPlaybackOpen(false); setFocus(false); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [player.command]);
    usePlaylistVisualPreset(track?.id, player.state?.playbackPlaylistId);
    return <LocalActionsContext.Provider value={tools.context}><main ref={playerRoot} className={`local-player ${focus ? 'local-player-focus' : ''} ${!isLyrics ? 'local-player-wall' : ''}`} style={style} data-testid="local-player" data-active={player.active} data-view={visuals.view}>
        <LocalErrorBoundary surface={`${visuals.view}:${visuals.mode}`} captureRuntime>
            <PlayerSubtitleBottomContext.Provider value={isLyrics ? subtitleBottom : null}>
                <LocalVisualStage player={player} theme={theme} assets={assets} focus={focus} onOpenQueue={openQueue} />
            </PlayerSubtitleBottomContext.Provider>
        </LocalErrorBoundary>
        {!focus && <LocalHeader view={visuals.view} libraryOpen={libraryOpen} settingsOpen={settingsOpen} playbackOpen={playbackOpen}
            tool={tools.tool} onTool={tools.open}
            onPlayback={() => { tools.close(); setPlaybackOpen(!playbackOpen); setLibraryOpen(false); setSettingsOpen(false); }}
            onView={view => { tools.close(); visuals.update({ view }); setLibraryOpen(false); setSettingsOpen(false); setPlaybackOpen(false); }}
            onLibrary={() => { tools.close(); setLibraryOpen(!libraryOpen); setSettingsOpen(false); setPlaybackOpen(false); }}
            onSettings={() => { tools.close(); setSettingsOpen(!settingsOpen); setPlaybackOpen(false); setLibraryOpen(false); }}
            onFocus={() => { tools.close(); setFocus(true); setSettingsOpen(false); setPlaybackOpen(false); setLibraryOpen(false); }} />}
        {focus && <button className="local-exit-focus" aria-label={t('exitFocus')} title={t('exitFocus')} onClick={() => setFocus(false)}><Minimize2 size={18} /></button>}
        {isLyrics && !track && <div className="local-welcome"><Music2 size={38} /><h1>{player.state ? t('chooseSong') : t('connecting')}</h1><p>{t('emptyHint')}</p><div><button onClick={() => run('importFiles')}>{t('importFiles')}</button><button onClick={() => { setLibraryOpen(true); setFocus(false); }}>{t('library')}</button></div></div>}
        {isLyrics && track && !player.lines.length && <div className="local-no-lyrics"><Music2 size={28} /><h2>{track.title}</h2><p>{track.artist || t('unknownArtist')}</p><small>{t('noLyrics')}</small></div>}
        {!focus && <>
            {isLyrics && <div className="local-current-track" data-testid="local-current-track"><div className="local-current-cover">{track?.cover ? <img src={track.cover} alt="" /> : <Music2 size={24} />}</div><div><small>{t('nowPlaying')}</small><strong>{track?.title || t('chooseSong')}</strong><span>{track?.artist || ''}</span></div></div>}
            {isLyrics && <PlayerControls state={player.state} currentTime={player.currentTime} command={player.command}
                onLibrary={() => { setQueue(false); setLibraryOpen(true); setSettingsOpen(false); setPlaybackOpen(false); }}
                onQueue={() => { setQueue(true); setLibraryOpen(!libraryOpen || !queue); setSettingsOpen(false); setPlaybackOpen(false); }} />}
            {libraryOpen && <LibraryPanel state={player.state} command={player.command} queue={queue} onTab={setQueue} onClose={() => setLibraryOpen(false)} />}
            {playbackOpen && <LocalPlaybackSettings state={player.state} command={player.command} onClose={closePlayback} />}
            {settingsOpen && <VisualSettings assets={assets} theme={theme} state={player.state} command={player.command} onClose={() => setSettingsOpen(false)}
                onLanguage={language => run('setUiLanguage', { language })} />}
        </>}
        <LocalToolDialogs tool={tools.tool} state={player.state} command={player.command} onClose={tools.close}
            onLibrary={() => tools.context.run('library')} />
        <LocalStatusToast />
        {player.error && <div className="local-error" role="alert" data-testid="local-error"><span>{player.error}</span><button aria-label={t('close')} onClick={player.clearError}><X size={16} /></button></div>}
    </main></LocalActionsContext.Provider>;
}
