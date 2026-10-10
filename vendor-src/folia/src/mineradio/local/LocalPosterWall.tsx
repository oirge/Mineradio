import { useMemo, type CSSProperties } from 'react';
import { ChevronLeft, Music2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PlayerState, type Theme } from '../../types';
import PosterWall from '../../components/app/lattice/PosterWall';
import { LatticeTransportContext, type LatticeTransport } from '../../components/app/lattice/LatticeTransportContext';
import LatticeLyricsProvider from '../../components/app/lattice/lyrics/LatticeLyricsProvider';
import type { LatticeTile } from '../../components/app/lattice/latticeModel';
import { useLatticeSettingsStore } from '../../stores/useLatticeSettingsStore';
import { useLatticeControlsStore } from '../../stores/useLatticeControlsStore';
import { getPlaybackSongKey } from '../../utils/appPlaybackGuards';
import { useStableCallbacks } from '../../hooks/useStableCallbacks';
import { hostTrackToWallSong, useLocalWallCatalog } from './wallCatalog';
import { LocalLatticeActionsContext } from './LocalLatticeExtraControls';
import LocalLatticeTools from './LocalLatticeTools';
import type { LocalPlayer } from './playerTypes';
import '../../components/app/lattice/Lattice.css';
import './localPosterWall.css';

// src/mineradio/local/LocalPosterWall.tsx
// The original Lattice wall, camera, reflow and lyric canvas consume the host's local catalog.
interface Props {
    player: LocalPlayer;
    theme: Theme;
    isDaylight: boolean;
    onBack: () => void;
    onOpenQueue: () => void;
    onOpenLyrics: () => void;
    translation?: boolean;
}

export default function LocalPosterWall({ player, theme, isDaylight, onBack, onOpenQueue, onOpenLyrics, translation = true }: Props) {
    const { t } = useTranslation();
    const { t: localText } = useTranslation('localPlayer');
    const catalog = useLocalWallCatalog(player);
    const settings = useLatticeSettingsStore();
    const focusCurrentSong = useLatticeControlsStore(state => state.focusCurrentSong);
    const track = player.state?.currentTrack;
    const currentSong = useMemo(() => track ? hostTrackToWallSong(track) : null, [track]);
    const songKey = currentSong ? getPlaybackSongKey(currentSong) : '';
    const tiles = useMemo<LatticeTile[]>(() => {
        const currentIndex = catalog.songs.findIndex(song => getPlaybackSongKey(song) === songKey);
        return catalog.songs.map((song, index) => ({
            id: getPlaybackSongKey(song), queueIndex: index, song, title: song.name,
            artist: song.artists.map(artist => artist.name).filter(Boolean).join(' / ') || song.album.name,
            coverUrl: song.album.coverUrl,
            section: index === currentIndex ? 'now' : currentIndex >= 0 && index < currentIndex ? 'played' : 'upcoming',
        }));
    }, [catalog.songs, songKey]);
    const wall = useStableCallbacks({
        onPlay: (tile: LatticeTile) => { void player.command('play', { id: String(tile.song.id), playlistId: catalog.playlistId }).catch(() => {}); },
        onTogglePlayback: () => { void player.command('togglePlay').catch(() => {}); },
        onSeek: (seconds: number) => { void player.command('seek', { seconds }).catch(() => {}); },
        onOpenPlayer: onOpenLyrics,
    });
    const transport = useMemo<LatticeTransport>(() => ({ currentSong,
        playerState: !track ? PlayerState.IDLE : player.state?.playing ? PlayerState.PLAYING : PlayerState.PAUSED,
        currentTime: player.currentTime, playbackDuration: player.state?.duration ?? 0, canTogglePlayback: Boolean(track),
    }), [currentSong, track, player.state?.playing, player.state?.duration, player.currentTime]);
    const actions = useMemo(() => ({ state: player.state, command: player.command, onOpenQueue }), [player.state, player.command, onOpenQueue]);
    const lyricSource = useMemo(() => ({ currentTime: player.currentTime, currentLineIndex: player.currentLineIndex,
        lines: player.lines, theme, paused: !player.state?.playing, showSubtitleTranslation: translation,
        hideTranslationSubtitle: !translation, subtitleContentMode: translation ? 'translation' as const : 'none' as const,
    }), [player.currentTime, player.currentLineIndex, player.lines, player.state?.playing, theme, translation]);
    const style = {
        '--bg-color': theme.backgroundColor, '--text-primary': theme.primaryColor,
        '--text-secondary': theme.secondaryColor, '--text-accent': theme.accentColor,
        '--lattice-poster-tint-color': settings.latticePosterTintColor,
        '--lattice-poster-tint-intensity': settings.latticePosterTintIntensity,
    } as CSSProperties;
    return <LocalLatticeActionsContext.Provider value={actions}>
        <LatticeTransportContext.Provider value={transport}>
            <LatticeLyricsProvider source={lyricSource} songKey={songKey} keywordColoringEnabled>
                <section data-testid="local-poster-wall" aria-label={t('home.latticeLabel')} style={style}
                    className={`lattice-root ${isDaylight ? 'is-daylight' : ''} ${settings.latticeVignette ? 'has-vignette' : ''} ${settings.latticeLightsOn ? '' : 'is-lights-out'} ${settings.latticePosterTintEnabled ? 'has-poster-tint' : ''} ${settings.latticePosterTintUseCustomColor ? 'uses-custom-poster-tint' : ''}`}>
                    {player.active && <PosterWall tiles={tiles} currentSong={currentSong} onPlay={wall.onPlay}
                        onTogglePlayback={wall.onTogglePlayback} onSeek={wall.onSeek} onOpenPlayer={wall.onOpenPlayer} onBack={onBack} />}
                    <button type="button" className="lattice-back" data-testid="local-poster-back" onClick={onBack}
                        aria-label={t('home.latticeBack')} title={t('home.latticeBack')}><ChevronLeft size={20} /></button>
                    <LocalLatticeTools isDaylight={isDaylight} onOpenQueue={onOpenQueue} />
                    {!tiles.length && <div className="lattice-empty"><strong>{catalog.loading ? localText('loading') : t('home.latticeEmptyTitle')}</strong>
                        <span>{catalog.error || t('home.latticeEmptyText')}</span></div>}
                </section>
                {track && <button type="button" className="local-poster-now-playing" data-testid="local-poster-now-playing" style={style}
                    onClick={() => focusCurrentSong?.()} aria-label={t('home.latticeFocusCurrent')}>
                    {track.cover ? <img src={track.cover} alt="" /> : <Music2 size={25} />}
                    <span><small>{localText('nowPlaying')}</small><strong>{track.title}</strong><em>{track.artist}</em></span>
                </button>}
            </LatticeLyricsProvider>
        </LatticeTransportContext.Provider>
    </LocalLatticeActionsContext.Provider>;
}
