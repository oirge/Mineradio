import { lazy, Suspense, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import VisualizerRenderer from '../../components/visualizer/VisualizerRenderer';
import type { Theme } from '../../types';
import type { LocalPlayer } from './playerTypes';
import type { LocalVisualAssets } from './useLocalVisualAssets';
import { useVisualSceneSettings } from './useVisualSettings';
import { useLocalMobileLyricFit } from './useLocalMobileLyricFit';
import { useLocalViewMotion } from './useLocalViewMotion';
import './localNavigationMotion.css';

// src/mineradio/local/LocalVisualStage.tsx
// Each surface owns its visual runtime; transport remains in Mineradio throughout switches.
const LocalRecordWall = lazy(() => import('./LocalRecordWall'));
const LocalPosterWall = lazy(() => import('./LocalPosterWall'));
function WallReady({ onReady }: { onReady: () => void }) {
    useEffect(onReady, [onReady]);
    return null;
}
interface Props {
    player: LocalPlayer;
    theme: Theme;
    assets: LocalVisualAssets;
    focus: boolean;
    mobile: boolean;
    onOpenQueue: () => void;
}
export default function LocalVisualStage({ player, theme, assets, focus, mobile, onOpenQueue }: Props) {
    const { t } = useTranslation('localPlayer');
    const visuals = useVisualSceneSettings();
    const stage = useRef<HTMLDivElement>(null);
    const route = useRef({ view: visuals.view, direction: 1 });
    if (route.current.view !== visuals.view) {
        const order = { lyrics: 0, records: 1, posters: 2 };
        route.current = { view: visuals.view, direction: order[visuals.view] > order[route.current.view] ? 1 : -1 };
    }
    const surfaceKey = visuals.view === 'lyrics' ? `lyrics:${visuals.mode}` : visuals.view;
    const viewMotion = useLocalViewMotion(surfaceKey, player.active, route.current.direction);
    useLocalMobileLyricFit(stage, mobile && visuals.view === 'lyrics' && visuals.mode === 'classic',
        player.lines[player.currentLineIndex]?.startTime, visuals.lyricsFontScale, theme);
    const track = player.state?.currentTrack;
    const lyrics = () => visuals.update({ view: 'lyrics' });
    const wallProps = { player, theme, isDaylight: visuals.daylight, onBack: lyrics, onOpenQueue, onOpenLyrics: lyrics };
    return <>
        <div ref={viewMotion.surface} className="local-view-surface" data-testid="local-view-surface" data-view={visuals.view} data-mobile-motion-view={visuals.view}
            data-mobile-motion-loading={viewMotion.loading || undefined}>
        {visuals.view !== 'lyrics' ? <Suspense key={visuals.view} fallback={null}>
            {player.active && <>{visuals.view === 'records' ? <LocalRecordWall {...wallProps} />
                : <LocalPosterWall {...wallProps} translation={visuals.translation} />}
                <WallReady onReady={viewMotion.onReady} /></>}
        </Suspense> : <div ref={stage} className="local-visualizer" data-testid="local-visualizer" data-mode={visuals.mode}>
        {/* Replace the mode's Suspense boundary so old GPU resources are destroyed during a lazy switch. */}
        {player.active && <VisualizerRenderer key={visuals.mode} mode={visuals.mode} onReady={viewMotion.onReady} theme={theme} isDaylight={visuals.daylight}
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
            showText={player.lines.length > 0} showSubtitleTranslation={visuals.translation} hideTranslationSubtitle={visuals.subtitleHidden}
            subtitleContentMode={visuals.subtitleContentMode} subtitleOverlayLayout={visuals.subtitleLayout} subtitleOverlayBackground={visuals.subtitleBackground}
            showHarmonySubtitle={visuals.harmony} onVisualizerTuningChange={patch => visuals.tune(visuals.mode as never, patch as Record<string, unknown>)} isPlayerChromeHidden={focus}
            onLyricLineSeek={seconds => { void player.command('seek', { seconds }).catch(() => {}); }} />}
        </div>}
        </div>
        {viewMotion.loading && <div className="local-view-loading" role="status" aria-busy="true" data-testid="local-view-loading">
            <Loader2 size={22} className={viewMotion.reducedMotion ? undefined : 'local-view-loader-spin'} /><span>{t('loading')}</span>
        </div>}
    </>;
}
