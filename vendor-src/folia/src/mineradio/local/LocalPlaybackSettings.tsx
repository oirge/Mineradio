import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HostState } from '../client';
import type { LocalCommand } from './useLibraryPage';
import './localPlaybackSettings.css';
import { motion, useIsPresent } from 'framer-motion';
import { useMobileMotion } from '../../hooks/useMobileMotion';
import { mobileMotionProps } from '../../utils/mobileMotion';

// src/mineradio/local/LocalPlaybackSettings.tsx
// Playback preferences stay in the host; this panel only projects and edits its snapshot.
export default function LocalPlaybackSettings({ state, command, onClose }: {
    state: HostState | null; command: LocalCommand; onClose: () => void;
}) {
    const { t } = useTranslation('localPlayer');
    const { mobile, reducedMotion } = useMobileMotion();
    const present = useIsPresent();
    const panel = useRef<HTMLElement>(null);
    const closeButton = useRef<HTMLButtonElement>(null);
    const [now, setNow] = useState(Date.now);
    const [optimistic, setOptimistic] = useState<HostState | null>(null);
    const requestSerial = useRef(0);
    const displayed = optimistic ?? state;
    const sleep = displayed?.sleepTimer;
    const replay = displayed?.replayGain;
    const gapless = displayed?.gapless;
    // Give native inputs immediate feedback while the host commits. The last reply releases the
    // overlay; failures restore the authoritative snapshot and use the player's error toast.
    const run = (method: string, params: Record<string, unknown>) => {
        const ticket = ++requestSerial.current;
        setOptimistic(previous => {
            const next = previous ?? state;
            if (!next) return null;
            if (method === 'setPlaybackRate') return { ...next, playbackRate: params.rate as number };
            if (method === 'setSleepTimer') return { ...next, sleepTimer: { ...next.sleepTimer!, mode: params.mode as NonNullable<HostState['sleepTimer']>['mode'] } };
            if (method === 'setReplayGain') return { ...next, replayGain: { ...next.replayGain!, ...params } };
            if (method === 'setGapless') return { ...next, gapless: { ...next.gapless!, ...params } };
            return next;
        });
        void command(method, params).catch(() => {}).finally(() => {
            if (requestSerial.current === ticket) setOptimistic(null);
        });
    };
    useEffect(() => {
        if (!present) return;
        closeButton.current?.focus();
        const outside = (event: PointerEvent) => {
            const target = event.target as Element | null;
            if (!event.composedPath().includes(panel.current!) && !target?.closest?.('[data-testid="local-open-playback"]')) onClose();
        };
        const escape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
        };
        const documents = [document];
        try { if (window.parent.document !== document) documents.push(window.parent.document); } catch { /* Standalone preview. */ }
        documents.forEach(doc => { doc.addEventListener('pointerdown', outside); doc.addEventListener('keydown', escape, true); });
        return () => {
            documents.forEach(doc => { doc.removeEventListener('pointerdown', outside); doc.removeEventListener('keydown', escape, true); });
            const active = document.activeElement;
            if (active === document.body || panel.current?.contains(active)) {
                for (const doc of documents) doc.querySelector<HTMLButtonElement>('[data-testid="local-open-playback"]')?.focus();
            }
        };
    }, [onClose, present]);
    useEffect(() => {
        setNow(Date.now());
        if (!sleep?.dueAt) return;
        const timer = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => clearInterval(timer);
    }, [sleep?.dueAt]);
    const minutes = Math.max(0, Math.ceil(((sleep?.dueAt ?? 0) - now) / 60_000));
    return <motion.aside ref={panel} role="dialog" aria-labelledby="local-playback-title"
        {...(mobile ? mobileMotionProps('sheet', reducedMotion) : {})}
        inert={!present} aria-hidden={!present || undefined}
        data-mobile-motion-presence={mobile ? (present ? 'present' : 'exiting') : undefined}
        className="local-playback-settings local-glass" data-testid="local-playback-settings">
        <div className="local-panel-title"><strong id="local-playback-title">{t('playbackSettings')}</strong>
            <button ref={closeButton} type="button" aria-label={t('close')} onClick={onClose}><X size={17} /></button></div>
        <div className="local-settings-body">
            <fieldset disabled={!state}><legend>{t('playbackSpeed')}</legend>
                <div className="local-playback-choices">{[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => <button type="button" key={rate}
                    aria-pressed={displayed?.playbackRate === rate} data-testid={`local-rate-${rate}`}
                    onClick={() => run('setPlaybackRate', { rate })}>{rate}×</button>)}</div>
                <p>{t('preservePitch')}</p>
            </fieldset>
            <fieldset disabled={!sleep}><legend>{t('sleepTimer')}</legend>
                <div className="local-playback-choices">{(['off', '15', '30', '60', 'track'] as const).map(mode => <button type="button" key={mode}
                    aria-pressed={sleep?.mode === mode} data-testid={`local-sleep-${mode}`} onClick={() => run('setSleepTimer', { mode })}>
                    {mode === 'off' ? t('timerOff') : mode === 'track' ? t('timerTrack') : t('timerMinutes', { count: Number(mode) })}</button>)}</div>
                <p role="status">{sleep?.fading ? t('timerFading') : sleep?.dueAt ? t('timerRemaining', { count: minutes }) : t('timerHint')}</p>
            </fieldset>
            <fieldset disabled={!replay}><legend>{t('replayGain')}</legend>
                <label className="local-playback-toggle"><span>{t('replayGainEnabled')}</span><input type="checkbox" data-testid="local-replaygain-enabled"
                    checked={replay?.enabled ?? false} onChange={event => run('setReplayGain', { enabled: event.target.checked })} /></label>
                <div className="local-playback-choices">{(['track', 'album'] as const).map(mode => <button type="button" key={mode}
                    aria-pressed={replay?.mode === mode} data-testid={`local-replaygain-${mode}`} onClick={() => run('setReplayGain', { mode })}>{t(`replayGain${mode === 'track' ? 'Track' : 'Album'}`)}</button>)}</div>
                <label className="local-setting local-range-setting"><span>{t('replayGainPreamp')}<output>{replay?.preampDb ?? 0} dB</output></span>
                    <input type="range" min="-12" max="12" step="0.5" value={replay?.preampDb ?? 0} data-testid="local-replaygain-preamp"
                        onChange={event => run('setReplayGain', { preampDb: Number(event.target.value) })} /></label>
                <label className="local-playback-toggle"><span>{t('replayGainClipGuard')}</span><input type="checkbox" data-testid="local-replaygain-clipguard"
                    checked={replay?.clipGuard ?? true} onChange={event => run('setReplayGain', { clipGuard: event.target.checked })} /></label>
                <p>{t('replayGainHint')}</p>
            </fieldset>
            <fieldset disabled={!gapless}><legend>{t('trackTransition')}</legend>
                <label className="local-playback-toggle"><span>{t('gaplessPlayback')}</span><input type="checkbox" data-testid="local-gapless-enabled"
                    checked={gapless?.enabled ?? true} onChange={event => run('setGapless', { enabled: event.target.checked })} /></label>
                <label className="local-setting local-range-setting"><span>{t('crossfade')}<output>{gapless?.crossfadeSeconds ?? 0} s</output></span>
                    <input type="range" min="0" max="10" step="0.5" value={gapless?.crossfadeSeconds ?? 0} data-testid="local-crossfade"
                        onChange={event => run('setGapless', { crossfadeSeconds: Number(event.target.value) })} /></label>
                <p>{t('crossfadeHint')}</p>
            </fieldset>
        </div>
    </motion.aside>;
}
