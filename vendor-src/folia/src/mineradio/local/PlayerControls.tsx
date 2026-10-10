import { useEffect, useRef } from 'react';
import { useMotionValueEvent, type MotionValue } from 'framer-motion';
import { Heart, ListMusic, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HostState } from '../client';
import type { LocalCommand } from './useLibraryPage';
import { formatTime } from './formatTime';

// src/mineradio/local/PlayerControls.tsx
// Transport shares the host's sole audio output; the continuous playhead stays outside React state.
interface Props { state: HostState | null; currentTime: MotionValue<number>; command: LocalCommand; onQueue: () => void; }
export default function PlayerControls({ state, currentTime, command, onQueue }: Props) {
    const { t } = useTranslation('localPlayer');
    const progress = useRef<HTMLInputElement>(null);
    const elapsed = useRef<HTMLSpanElement>(null);
    const dragging = useRef(false);
    const lastSecond = useRef(-1);
    const duration = Math.max(0, state?.duration || 0);
    const run = (method: string, params?: Record<string, unknown>) => { void command(method, params).catch(() => {}); };
    const syncTime = (seconds: number) => {
        if (!dragging.current && progress.current) progress.current.value = String(seconds);
        const second = Math.floor(seconds);
        if (elapsed.current && second !== lastSecond.current) {
            elapsed.current.textContent = formatTime(seconds); lastSecond.current = second;
        }
    };
    useMotionValueEvent(currentTime, 'change', syncTime);
    useEffect(() => { syncTime(currentTime.get()); }, [duration, currentTime]);
    const mode = state?.playMode || 'loop';
    const ModeIcon = mode === 'shuffle' ? Shuffle : mode === 'single' ? Repeat1 : Repeat;
    const nextMode = mode === 'loop' ? 'shuffle' : mode === 'shuffle' ? 'single' : 'loop';
    return <footer className="local-controls" data-testid="local-controls">
        <div className="local-playhead">
            <span ref={elapsed}>00:00</span>
            <input ref={progress} data-testid="local-seek" aria-label={t('seek')} type="range" min="0" max={duration || 1} step="0.05" defaultValue="0" disabled={!duration}
                onPointerDown={(event) => { dragging.current = true; event.currentTarget.setPointerCapture(event.pointerId); }}
                onPointerUp={(event) => { dragging.current = false; run('seek', { seconds: Number(event.currentTarget.value) }); }}
                onPointerCancel={() => { dragging.current = false; }}
                onChange={(event) => { if (!dragging.current) run('seek', { seconds: Number(event.currentTarget.value) }); }} />
            <span>{formatTime(duration)}</span>
        </div>
        <div className="local-transport">
            <div className="local-transport-side">
                <button title={t(mode)} aria-label={t(mode)} data-testid="local-play-mode" onClick={() => run('setPlayMode', { mode: nextMode })}><ModeIcon size={19} /></button>
                <button title={t(state?.currentTrack?.liked ? 'unlike' : 'like')} aria-label={t(state?.currentTrack?.liked ? 'unlike' : 'like')} className={state?.currentTrack?.liked ? 'is-liked' : ''} disabled={!state?.currentTrack} data-testid="local-like"
                    onClick={() => run('toggleLike', { id: state?.currentTrack?.id })}><Heart size={19} fill={state?.currentTrack?.liked ? 'currentColor' : 'none'} /></button>
            </div>
            <div className="local-transport-main">
                <button aria-label={t('previous')} title={t('previous')} data-testid="local-previous" onClick={() => run('previous')}><SkipBack size={22} fill="currentColor" /></button>
                <button className="local-play-button" aria-label={t(state?.playing ? 'pause' : 'play')} data-testid="local-toggle-play" onClick={() => run('togglePlay')}>
                    {state?.playing ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                </button>
                <button aria-label={t('next')} title={t('next')} data-testid="local-next" onClick={() => run('next')}><SkipForward size={22} fill="currentColor" /></button>
            </div>
            <div className="local-transport-side local-volume">
                <button aria-label={t('mute')} title={t('mute')} aria-pressed={state?.muted || false} onClick={() => run('setMuted', { muted: !state?.muted })}>
                    {state?.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <input data-testid="local-volume" aria-label={t('volume')} type="range" min="0" max="1" step="0.01" value={state?.volume ?? 1} onChange={(event) => run('setVolume', { volume: Number(event.currentTarget.value) })} />
                <button aria-label={t('queue')} title={t('queue')} onClick={onQueue}><ListMusic size={19} /></button>
            </div>
        </div>
    </footer>;
}
