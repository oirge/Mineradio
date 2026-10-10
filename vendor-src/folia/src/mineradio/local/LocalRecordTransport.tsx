import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PlayerState, type Theme } from '../../types';
import FloatingPlayerControls from '../../components/FloatingPlayerControls';
import { usePlayerChromeSettingsStore } from '../../stores/usePlayerChromeSettingsStore';
import type { LocalPlayer } from './playerTypes';

// src/mineradio/local/LocalRecordTransport.tsx
// Folia's original hover-expanding progress capsule controls Mineradio's existing audio instance.
export default function LocalRecordTransport({ player, theme, isDaylight, onOpenQueue, onOpenLyrics }: {
    player: LocalPlayer; theme: Theme; isDaylight: boolean; onOpenQueue: () => void; onOpenLyrics: () => void;
}) {
    const { t } = useTranslation('localPlayer');
    const state = player.state, track = state?.currentTrack;
    const commitOffset = usePlayerChromeSettingsStore(settings => settings.handleSetPlayerBottomBarOffset);
    const lyrics = useMemo(() => ({ lines: player.lines, title: track?.title, artist: track?.artist }), [player.lines, track?.title, track?.artist]);
    const run = (method: string, params?: Record<string, unknown>) => { void player.command(method, params).catch(() => {}); };
    return <FloatingPlayerControls currentSong={track ? { name: track.title } : null}
        playerState={!track ? PlayerState.IDLE : state?.playing ? PlayerState.PLAYING : PlayerState.PAUSED}
        currentTime={player.currentTime} duration={state?.duration || 0}
        loopMode={state?.playMode === 'single' ? 'one' : 'all'} currentView="home" audioSrc={null} canTogglePlay={Boolean(track)}
        lyrics={lyrics} theme={theme} isDaylight={isDaylight} primaryColor={theme.primaryColor} secondaryColor={theme.secondaryColor}
        noTrackText={t('chooseSong')} onSeek={seconds => run('seek', { seconds })} onTogglePlay={() => run('togglePlay')}
        onToggleLoop={() => run('setPlayMode', { mode: state?.playMode === 'single' ? 'loop' : 'single' })}
        onNavigateToPlayer={onOpenLyrics} onCommitBottomBarOffset={commitOffset}
        trackNavigation={{ currentTrackKey: track?.id || '', onPrev: () => run('previous'), onNext: () => run('next'),
            canPrev: Boolean(track), canNext: Boolean(track), prevTitle: null, nextTitle: null, prevLabel: t('previous'), nextLabel: t('next') }}
        slotPrimary="like" slotSecondary="queue" slotContext={{
            onShuffle: () => run('setPlayMode', { mode: 'shuffle' }), canShuffle: Boolean(track),
            onLike: () => run('toggleLike', { id: track?.id }), isLiked: Boolean(track?.liked), likeDisabled: !track,
            invokeCommandById: onOpenQueue, canInvokeCommandById: () => true,
        }} />;
}
