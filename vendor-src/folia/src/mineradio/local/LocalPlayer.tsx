import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Minimize2, Music2 } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion, useIsPresent } from 'framer-motion';
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
import { useLocalMobileLayout } from './useLocalMobileLayout';
import { useLocalFocusMotion } from './useLocalFocusMotion';
import { useMobileMotion } from '../../hooks/useMobileMotion';
import { mobileMotionProps } from '../../utils/mobileMotion';
import LocalPlayerStates, { LocalPlayerError } from './LocalPlayerStates';
import LocalArtwork from './LocalArtwork';
import './local.css';
import './localMobile.css';
import './localMobileMotion.css';

// src/mineradio/local/LocalPlayer.tsx
// Embedded local-player composition: upstream effects, host transport, and a bounded local catalog.
function ExitFocusButton({ onExit }: { onExit: () => void }) {
    const { t } = useTranslation('localPlayer');
    const { mobile, reducedMotion } = useMobileMotion();
    const present = useIsPresent();
    return <motion.button {...(mobile ? mobileMotionProps('component', reducedMotion) : {})}
        inert={!present} aria-hidden={!present || undefined}
        className="local-exit-focus" data-testid="local-exit-focus" aria-label={t('exitFocus')} title={t('exitFocus')} onClick={onExit}><Minimize2 size={18} /></motion.button>;
}
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
    const [focus, setFocus] = useLocalFocusMotion();
    const theme = visuals.daylight ? DAYLIGHT_THEME : DEFAULT_THEME;
    const track = player.state?.currentTrack;
    const isLyrics = visuals.view === 'lyrics';
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
    const mobile = useLocalMobileLayout(() => {
        if (!libraryOpen && !settingsOpen && !playbackOpen && !focus && !tools.tool) return false;
        tools.close(); setLibraryOpen(false); setSettingsOpen(false); setPlaybackOpen(false); setFocus(false);
        return true;
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
            if (event.key === 'Escape' && mobile && focus) { event.preventDefault(); setFocus(false); return; }
            const element = event.target as HTMLElement;
            if (element?.matches('input, textarea, select, button, [role="button"], [contenteditable="true"]')) return;
            if (event.code === 'Space') { event.preventDefault(); void player.command('togglePlay').catch(() => {}); }
            if (event.key === 'Escape') { setLibraryOpen(false); setSettingsOpen(false); setPlaybackOpen(false); setFocus(false); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [player.command, setFocus, mobile, focus]);
    usePlaylistVisualPreset(track?.id, player.state?.playbackPlaylistId);
    return <LocalActionsContext.Provider value={tools.context}><main className={`local-player ${focus ? 'local-player-focus' : ''} ${!isLyrics ? 'local-player-wall' : ''}`} style={style} data-testid="local-player" data-active={player.active} data-view={visuals.view} data-mobile-focus={mobile ? String(focus) : undefined} data-panel={libraryOpen || settingsOpen || playbackOpen || tools.tool ? 'open' : 'closed'}>
        <LocalErrorBoundary surface={`${visuals.view}:${visuals.mode}`} captureRuntime>
            <LocalVisualStage player={player} theme={theme} assets={assets} focus={focus} mobile={mobile} onOpenQueue={openQueue} />
        </LocalErrorBoundary>
        <AnimatePresence initial={false}>{(!focus || mobile) && <LocalHeader key="header" mobile={mobile} mobileFocus={mobile && focus} view={visuals.view} libraryOpen={libraryOpen} settingsOpen={settingsOpen} playbackOpen={playbackOpen}
            tool={tools.tool} onTool={tools.open}
            onPlayback={() => { tools.close(); setPlaybackOpen(!playbackOpen); setLibraryOpen(false); setSettingsOpen(false); }}
            onView={view => { tools.close(); visuals.update({ view }); setLibraryOpen(false); setSettingsOpen(false); setPlaybackOpen(false); }}
            onLibrary={() => { tools.close(); setLibraryOpen(!libraryOpen); setSettingsOpen(false); setPlaybackOpen(false); }}
            onSettings={() => { tools.close(); setSettingsOpen(!settingsOpen); setPlaybackOpen(false); setLibraryOpen(false); }}
            onFocus={() => { tools.close(); setFocus(true); setSettingsOpen(false); setPlaybackOpen(false); setLibraryOpen(false); }} />}</AnimatePresence>
        <AnimatePresence initial={false} mode="sync">{focus && <ExitFocusButton key="exit-focus" onExit={() => setFocus(false)} />}</AnimatePresence>
        <LocalPlayerStates player={player} isLyrics={isLyrics} onImport={() => run('importFiles')}
            onLibrary={() => { setLibraryOpen(true); setFocus(false); }} />
        {(!focus || mobile) && <>
            {(isLyrics || mobile) && <div className="local-current-track" data-testid="local-current-track" data-mobile-focus={mobile ? String(focus) : undefined} inert={mobile && focus} aria-hidden={mobile && focus || undefined}><div className="local-current-cover">{track?.cover ? <LocalArtwork src={track.cover} alt="" /> : <Music2 size={24} />}</div><div><small>{t('nowPlaying')}</small><strong>{track?.title || t('chooseSong')}</strong><span>{track?.artist || ''}</span></div></div>}
            {(isLyrics || mobile) && <PlayerControls state={player.state} currentTime={player.currentTime} command={player.command} mobileFocus={mobile && focus}
                onLibrary={() => { setQueue(false); setLibraryOpen(true); setSettingsOpen(false); setPlaybackOpen(false); }}
                onQueue={() => { setQueue(true); setLibraryOpen(!libraryOpen || !queue); setSettingsOpen(false); setPlaybackOpen(false); }} />}
        </>}
        <MotionConfig reducedMotion="user"><AnimatePresence initial={false} mode="sync">
            {!focus && libraryOpen && <LibraryPanel key="library" state={player.state} command={player.command} queue={queue} onTab={setQueue} onClose={() => setLibraryOpen(false)} />}
            {!focus && playbackOpen && <LocalPlaybackSettings key="playback" state={player.state} command={player.command} onClose={closePlayback} />}
            {!focus && settingsOpen && <VisualSettings key="visuals" assets={assets} theme={theme} state={player.state} command={player.command} onClose={() => setSettingsOpen(false)}
                onLanguage={language => run('setUiLanguage', { language })} />}
        </AnimatePresence></MotionConfig>
        <MotionConfig reducedMotion="user"><LocalToolDialogs tool={tools.tool} state={player.state} command={player.command} onClose={tools.close}
            onLibrary={() => tools.context.run('library')} /></MotionConfig>
        <LocalStatusToast />
        <LocalPlayerError error={player.error} onClose={player.clearError} />
    </main></LocalActionsContext.Provider>;
}
