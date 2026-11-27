import { lazy, Suspense } from 'react';
import VisualizerRenderer from '../../components/visualizer/VisualizerRenderer';
import type { Theme } from '../../types';
import type { LocalPlayer } from './playerTypes';
import type { LocalVisualAssets } from './useLocalVisualAssets';
import { useVisualSceneSettings, useVisualSettings } from './useVisualSettings';

// src/mineradio/local/LocalVisualStage.tsx
// Each surface owns its visual runtime; transport remains in Mineradio throughout switches.
const loadRecordWall = () => import('./LocalRecordWall');
const loadPosterWall = () => import('./LocalPosterWall');
const loadCinema = () => import('./cinema/LocalCinema');
const LocalRecordWall = lazy(loadRecordWall);
const LocalPosterWall = lazy(loadPosterWall);
const LocalCinema = lazy(loadCinema);

export type InitialLocalStage =
    | { view: 'records'; Wall: typeof import('./LocalRecordWall')['default'] }
    | { view: 'posters'; Wall: typeof import('./LocalPosterWall')['default']; Radio?: typeof import('./LocalRadioWall')['default'] };

// Load the saved surface while the host connects, so its first render can skip a Suspense reveal.
export function prepareInitialLocalStage(): Promise<InitialLocalStage> | undefined {
    const { view, lyricScene, latticeWallForm } = useVisualSettings.getState();
    if (view === 'records') return loadRecordWall().then(({ default: Wall }) => ({ view, Wall }));
    if (view === 'posters') {
        return Promise.all([loadPosterWall(), latticeWallForm === 'radio' ? import('./LocalRadioWall') : undefined])
            .then(([wall, radio]) => ({ view, Wall: wall.default, Radio: radio?.default }));
    }
    // Let the lyric controls mount while the hall's Three.js bundle is loading.
    if (lyricScene === 'cinema') void loadCinema().catch(() => {});
}

interface Props {
    player: LocalPlayer;
    theme: Theme;
    assets: LocalVisualAssets;
    focus: boolean;
    onOpenQueue: () => void;
    initialStage?: InitialLocalStage;
}
export default function LocalVisualStage({ player, theme, assets, focus, onOpenQueue, initialStage }: Props) {
    const visuals = useVisualSceneSettings();
    const track = player.state?.currentTrack;
    const lyrics = () => visuals.update({ view: 'lyrics' });
    const wallProps = { player, theme, isDaylight: visuals.daylight, onBack: lyrics, onOpenQueue, onOpenLyrics: lyrics };
    const RecordWall = initialStage?.view === 'records' ? initialStage.Wall : LocalRecordWall;
    const PosterWall = initialStage?.view === 'posters' ? initialStage.Wall : LocalPosterWall;
    const initialRadioWall = initialStage?.view === 'posters' ? initialStage.Radio : undefined;
    if (visuals.view !== 'lyrics') return <Suspense key={visuals.view} fallback={null}>
        {player.active && (visuals.view === 'records' ? <RecordWall {...wallProps} />
            : <PosterWall {...wallProps} translation={visuals.translation} initialRadioWall={initialRadioWall} />)}
    </Suspense>;
    const cinema = visuals.lyricScene === 'cinema';
    // Replace the mode's Suspense boundary so old GPU resources are destroyed during a lazy switch.
    const lyricStage = player.active && <VisualizerRenderer key={visuals.mode} mode={visuals.mode} theme={theme} isDaylight={visuals.daylight}
            currentTime={player.currentTime} currentLineIndex={player.currentLineIndex} lines={player.lines}
            audioPower={player.audioPower} audioBands={player.audioBands} paused={!player.state?.playing}
            seed={track?.id || 'mineradio-local'} coverUrl={track?.cover} songTitle={track?.title} songArtist={track?.artist} songAlbum={track?.album}
            background={{ ...visuals.background, transparent: !cinema && visuals.background.transparent,
                customImage: assets.background.images[0] ?? null }}
            cappellaCustomEmojiImages={assets.emoji.images} cappellaCustomAvatarImages={assets.avatar.images}
            monetPortraitImage={assets.portrait.images[0] ?? null}
            onMonetTuningChange={patch => visuals.tune('monet', patch)}
            onCladdaghTuningChange={patch => visuals.tune('claddagh', patch)}
            onPendoloTuningChange={patch => visuals.tune('pendolo', patch)}
            onSonnetTuningChange={patch => visuals.tune('sonnet', patch)}
            onTemperaTuningChange={patch => visuals.tune('tempera', patch)}
            onLumiereTuningChange={patch => visuals.tune('lumiere', patch)}
            lyricsFontScale={visuals.lyricsFontScale} visualizerTunings={visuals.tunings}
            showText={player.lines.length > 0} showSubtitleTranslation={visuals.translation} hideTranslationSubtitle={visuals.subtitleHidden}
            subtitleContentMode={visuals.subtitleContentMode} subtitleOverlayLayout={visuals.subtitleLayout} subtitleOverlayBackground={visuals.subtitleBackground}
            showHarmonySubtitle={visuals.harmony} onVisualizerTuningChange={patch => visuals.tune(visuals.mode as never, patch as Record<string, unknown>)} isPlayerChromeHidden={focus}
            onLyricLineSeek={seconds => { void player.command('seek', { seconds }).catch(() => {}); }} />;
    return <div className="local-visualizer" data-testid="local-visualizer" data-mode={visuals.mode}>
        {player.active && cinema ? <Suspense fallback={lyricStage}>
            <LocalCinema player={player} theme={theme} lightsUp={visuals.cinemaLights} curtainsOnPause={visuals.cinemaCurtainsOnPause}
                onClose={() => visuals.update({ lyricScene: 'flat' })}>{lyricStage}</LocalCinema>
        </Suspense> : lyricStage}
    </div>;
}
