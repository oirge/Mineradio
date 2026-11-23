import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { LyricRenderOverride, LyricRenderQuality } from '../../types';
import { formatLyricRenderScale, LYRIC_RENDER_SCALES, resolveLyricRenderQuality } from '../../utils/lyricRenderQuality';
import LocalToolPanel from './LocalToolPanel';
import { DEFAULT_LOCAL_TUNINGS, useVisualSettings } from './useVisualSettings';

// Measure the active lyric stage for fixed intervals, with an optional temporary quality comparison.
interface Sample { fps: number; slowFrameMs: number }
interface Trial { quality: LyricRenderQuality; sample: Sample }

function sampleFrameRate(signal: AbortSignal): Promise<Sample> {
    return new Promise((resolve, reject) => {
        let handle = 0, start: number | null = null, previous: number | null = null;
        const intervals: number[] = [];
        const stop = () => {
            cancelAnimationFrame(handle);
            window.clearTimeout(timeout);
            signal.removeEventListener('abort', cancel);
        };
        const cancel = () => { stop(); reject(new Error('Frame-rate check canceled')); };
        const frame = (timestamp: number) => {
            start ??= timestamp;
            if (timestamp - start >= 750) {
                if (previous !== null && timestamp > previous) intervals.push(timestamp - previous);
                previous = timestamp;
                if (timestamp - start >= 2750 && intervals.length) {
                    stop();
                    const elapsed = intervals.reduce((sum, value) => sum + value, 0);
                    intervals.sort((a, b) => a - b);
                    resolve({ fps: 1000 * intervals.length / elapsed, slowFrameMs: intervals[Math.ceil(intervals.length * 0.95) - 1] });
                    return;
                }
            }
            handle = requestAnimationFrame(frame);
        };
        const timeout = window.setTimeout(cancel, 10000);
        if (signal.aborted) cancel();
        else {
            signal.addEventListener('abort', cancel, { once: true });
            handle = requestAnimationFrame(frame);
        }
    });
}

type RunState = { status: 'idle' | 'running' | 'stopped' } | { status: 'done'; trials: Trial[] };

export default function LocalFrameRateCheck({ canMeasure, trackId, setQuality, onClose }: {
    canMeasure: boolean; trackId: string | undefined; setQuality: (quality: LyricRenderQuality | null) => void; onClose: () => void;
}) {
    const { t } = useTranslation('localPlayer');
    const { t: settingsText } = useTranslation();
    const mode = useVisualSettings(state => state.mode);
    const [run, setRun] = useState<RunState>({ status: 'idle' });
    const controller = useRef<AbortController | null>(null);
    const stop = () => { controller.current?.abort(); };
    useEffect(() => {
        const hidden = () => { if (document.hidden) stop(); };
        document.addEventListener('visibilitychange', hidden);
        return () => {
            document.removeEventListener('visibilitychange', hidden);
            const current = controller.current;
            controller.current = null;
            current?.abort();
            if (current) setRun({ status: 'stopped' });
            setQuality(null);
        };
    }, [canMeasure, mode, setQuality, trackId]);

    const start = async () => {
        if (!canMeasure || controller.current || document.hidden) return;
        const current = new AbortController();
        controller.current = current;
        setRun({ status: 'running' });
        const { lyricRenderQuality, tunings } = useVisualSettings.getState();
        const modeKey = mode as keyof typeof tunings;
        const tuning = tunings[modeKey] as { render?: LyricRenderOverride } | undefined;
        const base = resolveLyricRenderQuality(lyricRenderQuality, tuning?.render);
        const presets = [base];
        const defaultTuning = DEFAULT_LOCAL_TUNINGS[modeKey];
        if (defaultTuning && 'render' in defaultTuning) {
            const lower = LYRIC_RENDER_SCALES[Math.max(0, LYRIC_RENDER_SCALES.indexOf(base.scale) - 1)];
            presets.push(base.scale !== lower || base.antialias !== 'off' ? { scale: lower, antialias: 'off' } : { scale: 1, antialias: 'auto' });
        }
        try {
            const trials: Trial[] = [];
            for (const quality of presets) {
                if (current.signal.aborted) return;
                setQuality(quality);
                trials.push({ quality, sample: await sampleFrameRate(current.signal) });
            }
            if (controller.current === current) setRun({ status: 'done', trials });
        } catch {
            if (controller.current === current) setRun({ status: 'stopped' });
        } finally {
            if (controller.current === current) { controller.current = null; setQuality(null); }
        }
    };

    return <LocalToolPanel id="local-frame-rate-check" title={t('frameRateCheck')} onClose={onClose}>
        <p>{t(canMeasure ? 'frameRateHint' : 'frameRateNeedsPlayback')}</p>
        <button type="button" className="local-reroll" data-testid="local-frame-rate-start" disabled={!canMeasure}
            onClick={run.status === 'running' ? stop : () => { void start(); }}>{t(run.status === 'running' ? 'frameRateStop' : 'frameRateStart')}</button>
        <div aria-live="polite" data-testid="local-frame-rate-summary">
            {run.status === 'running' && <p>{t('frameRateMeasuring')}</p>}
            {run.status === 'stopped' && <p>{t('frameRateStopped')}</p>}
            {run.status === 'done' && <ul>{run.trials.map(({ quality, sample }, index) => <li key={index}>
                <strong>{index ? t('frameRateComparison') : t('frameRateCurrent')}</strong>
                {` · ${formatLyricRenderScale(quality.scale)} · ${settingsText(`options.lyricAntialias${quality.antialias === 'auto' ? 'Auto' : quality.antialias === 'on' ? 'On' : 'Off'}`)}`}
                <div>{t('frameRateResult', { fps: sample.fps.toFixed(1), ms: sample.slowFrameMs.toFixed(1) })}</div>
            </li>)}</ul>}
        </div>
    </LocalToolPanel>;
}
