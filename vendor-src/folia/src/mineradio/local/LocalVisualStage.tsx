import { lazy, Suspense } from 'react';
import VisualizerRenderer from '../../components/visualizer/VisualizerRenderer';
import type { Theme } from '../../types';
import type { LocalPlayer } from './playerTypes';
import type { LocalVisualAssets } from './useLocalVisualAssets';
import { useVisualSettings } from './useVisualSettings';

// src/mineradio/local/LocalVisualStage.tsx
// Each surface owns its visual runtime; transport remains in Mineradio throughout switches.
const LocalRecordWall = lazy(() => import('./LocalRecordWall'));
const LocalPosterWall = lazy(() => import('./LocalPosterWall'));
interface Props {
    player: LocalPlayer;
    theme: Theme;
    assets: LocalVisualAssets;
    focus: boolean;
    onOpenQueue: () => void;
}
export default function LocalVisualStage({ player, theme, assets, focus, onOpenQueue }: Props) {
    const visuals = useVisualSettings();
    const track = player.state?.currentTrack;
    const lyrics = () => visuals.update({ view: 'lyrics' });
    const wallProps = { player, theme, isDaylight: visuals.daylight, onBack: lyrics, onOpenQueue, onOpenLyrics: lyrics };
    if (visuals.view !== 'lyrics') return <Suspense key={visuals.view} fallback={null}>
        {player.active && (visuals.view === 'records' ? <LocalRecordWall {...wallProps} />
            : <LocalPosterWall {...wallProps} translation={visuals.translation} />)}
    </Suspense>;
    return <div className="local-visualizer" data-testid="local-visualizer" data-mode={visuals.mode}>
        {/* Replace the mode's Suspense boundary so old GPU resources are destroyed during a lazy switch. */}
        {player.active && <VisualizerRenderer key={visuals.mode} mode={visuals.mode} theme={theme} isDaylight={visuals.daylight}
            currentTime={player.currentTime} currentLineIndex={player.currentLineIndex} lines={player.lines}
            audioPower={player.audioPower} audioBands={player.audioBands} paused={!player.state?.playing}
            seed={track?.id || 'mineradio-local'} coverUrl={track?.cover} songTitle={track?.title} songArtist={track?.artist} songAlbum={track?.album}
            background={{ ...visuals.background, customImage: assets.background.images[0] ?? null }}
            cappellaCustomEmojiImages={assets.emoji.images} cappellaCustomAvatarImages={assets.avatar.images}
            monetPortraitImage={assets.portrait.images[0] ?? null}
            onMonetTuningChange={patch => visuals.tune('monet', patch)}
            onCladdaghTuningChange={patch => visuals.tune('claddagh', patch)}
            onPendoloTuningChange={patch => visuals.tune('pendolo', patch)}
            onSonnetTuningChange={patch => visuals.tune('sonnet', patch)}
            onTemperaTuningChange={patch => visuals.tune('tempera', patch)}
            onLumiereTuningChange={patch => visuals.tune('lumiere', patch)}
            lyricsFontScale={visuals.lyricsFontScale} visualizerTunings={visuals.tunings}
            showText={player.lines.length > 0} showSubtitleTranslation={visuals.translation} hideTranslationSubtitle={!visuals.translation}
            subtitleContentMode={visuals.translation ? 'translation' : 'none'} isPlayerChromeHidden={focus}
            onLyricLineSeek={seconds => { void player.command('seek', { seconds }).catch(() => {}); }} />}
    </div>;
}
