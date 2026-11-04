import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HostState } from '../client';
import { subscribeHost } from '../client';
import type { LocalCommand } from './useLibraryPage';
import { useVisualSettings } from './useVisualSettings';
import { isLocalVideoExportBusy, LOCAL_VIDEO_PRESETS, LOCAL_VIDEO_FRAME_RATES, localVideoExportParams, readVideoExportTransition, saveVideoExportTransition, readVideoExportFrameRate, saveVideoExportFrameRate, videoElapsedLabel, type LocalVideoExportState, type VideoExportFrameRate } from './localVideoExportData';
import LocalToolPanel from './LocalToolPanel';
import './localVideoExport.css';

// src/mineradio/local/LocalVideoExport.tsx
// This dialog only controls the host job. Unmounting it never cancels recording.
export default function LocalVideoExport({ state, command, onClose }: {
    state: HostState | null; command: LocalCommand; onClose: () => void;
}) {
    const { t } = useTranslation('localPlayer');
    const [job, setJob] = useState<LocalVideoExportState>({ supported: false, status: 'idle', progress: 0, elapsed: 0 });
    const [loaded, setLoaded] = useState(false), [pending, setPending] = useState(false), [error, setError] = useState('');
    const [preset, setPreset] = useState(0), [startMode, setStartMode] = useState<'from-start' | 'current'>('from-start');
    const [transitionBehavior, setTransitionBehavior] = useState<'continue' | 'save'>(() => readVideoExportTransition());
    const [frameRate, setFrameRate] = useState<VideoExportFrameRate>(() => readVideoExportFrameRate());
    const mounted = useRef(false), revision = useRef(0), runningRequest = useRef(''), operation = useRef(0);
    useEffect(() => {
        mounted.current = true;
        const stop = subscribeHost('videoExport', (next: LocalVideoExportState) => { revision.current++; setJob(next); setLoaded(true); setError(''); });
        const ticket = revision.current;
        void command('getVideoExportState').then((next: LocalVideoExportState) => {
            if (mounted.current && ticket === revision.current) { setJob(next); setLoaded(true); }
        }).catch(() => { if (mounted.current && ticket === revision.current) { setError(t('videoExportFailed')); setLoaded(true); } });
        return () => { mounted.current = false; stop(); };
    }, [command, t]);
    const busy = isLocalVideoExportBusy(job);
    const run = async (method: string, params?: Record<string, unknown>) => {
        if (runningRequest.current && !(method === 'cancelVideoExport' && runningRequest.current === 'startVideoExport')) return;
        runningRequest.current = method;
        const operationTicket = ++operation.current;
        setPending(true); setError('');
        const ticket = revision.current;
        try {
            const next: LocalVideoExportState = await command(method, params);
            if (mounted.current && operationTicket === operation.current && ticket === revision.current) setJob(next);
        } catch (failure) {
            if (mounted.current && operationTicket === operation.current) setError(failure instanceof Error ? failure.message : t('videoExportFailed'));
        } finally { if (operationTicket === operation.current) { runningRequest.current = ''; if (mounted.current) setPending(false); } }
    };
    return <LocalToolPanel id="local-video-export" title={t('videoExport')} onClose={onClose}>
        <p className="local-tool-hint">{t('videoExportHint')}</p>
        <fieldset disabled={!loaded || busy || pending || !job.supported}>
            <label className="local-setting"><span>{t('videoResolution')}</span><select data-testid="local-video-resolution" value={preset} onChange={event => setPreset(Number(event.target.value))}>
                {LOCAL_VIDEO_PRESETS.map((value, index) => <option key={index} value={index}>{t(value.width > value.height ? 'videoLandscape' : 'videoPortrait')} · {value.width} × {value.height}</option>)}
            </select></label>
            <label className="local-setting"><span>{t('videoStartMode')}</span><select data-testid="local-video-start-mode" value={startMode} onChange={event => setStartMode(event.target.value as typeof startMode)}>
                <option value="from-start">{t('videoFromStart')}</option><option value="current">{t('videoFromCurrent')}</option>
            </select></label>
            <label className="local-setting"><span>{t('videoFrameRate')}</span><select data-testid="local-video-frame-rate" value={busy ? job.frameRate ?? frameRate : frameRate}
                onChange={event => { const value = Number(event.target.value) as VideoExportFrameRate; setFrameRate(value); saveVideoExportFrameRate(value); }}>
                {LOCAL_VIDEO_FRAME_RATES.map(value => <option key={value} value={value}>{t('videoFrameRateOption', { frameRate: value })}</option>)}
            </select></label>
            <small className="local-tool-hint">{t('videoIncludesAudio')}</small>
            <label className="local-setting"><span>{t('videoTransition')}</span><select data-testid="local-video-transition" value={busy ? job.transitionBehavior ?? transitionBehavior : transitionBehavior}
                onChange={event => { const value = event.target.value === 'save' ? 'save' : 'continue'; setTransitionBehavior(value); saveVideoExportTransition(value); }}>
                <option value="continue">{t('videoTransitionContinue')}</option><option value="save">{t('videoTransitionSave')}</option>
            </select></label>
        </fieldset>
        <p className="local-tool-hint" data-testid="local-video-transition-hint">{t(`videoTransitionHint_${busy ? job.transitionBehavior ?? transitionBehavior : transitionBehavior}`)}</p>
        <div className="local-video-status" role="status" aria-live="polite" data-testid="local-video-status" data-status={job.status}>
            <strong>{t(!loaded ? 'loading' : `videoStatus_${job.status}`)}</strong>
            {(busy || job.status === 'saved') && <span>{videoElapsedLabel(job.elapsed)} · {Math.round(Math.max(0, Math.min(1, job.progress || 0)) * 100)}%</span>}
            {busy && <progress aria-label={t('videoExportProgress')} max={1} value={Math.max(0, Math.min(1, job.progress || 0))} />}
            {job.status === 'saved' && job.fileName && <small data-i18n-skip>{job.fileName}</small>}
        </div>
        {(error || job.status === 'error') && <p role="alert" className="local-tool-error" data-testid="local-video-error">{error || job.error || t('videoExportFailed')}</p>}
        {loaded && !job.supported && !error && <p className="local-tool-hint">{t('videoExportUnavailable')}</p>}
        {!state?.currentTrack && !busy && <p className="local-tool-hint">{t('chooseSong')}</p>}
        <div className="local-video-actions">
            {busy ? <>
                <button type="button" data-testid="local-video-stop" disabled={pending || !['recording', 'paused'].includes(job.status)} onClick={() => { void run('stopVideoExport'); }}>{t('videoExportStop')}</button>
                <button type="button" data-testid="local-video-cancel" disabled={(pending && runningRequest.current !== 'startVideoExport') || job.status === 'saving'} onClick={() => { void run('cancelVideoExport'); }}>{t('videoExportCancel')}</button>
            </> : <button type="button" data-testid="local-video-start" disabled={!loaded || pending || !job.supported || !state?.currentTrack}
                onClick={() => { void run('startVideoExport', localVideoExportParams(LOCAL_VIDEO_PRESETS[preset], startMode, useVisualSettings.getState(), transitionBehavior, frameRate)); }}>{t('videoExportStart')}</button>}
        </div>
        <p className="local-tool-hint">{t('videoExportBackground')}</p>
    </LocalToolPanel>;
}
