import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { HostAudioChain, HostAudioOptions, HostState } from '../client';
import type { LocalCommand } from './useLibraryPage';
import LocalToolPanel from './LocalToolPanel';

// src/mineradio/local/LocalAudioSettings.tsx
// Edit the existing host EQ and AudioContext sink; no audio objects are created by this surface.
export default function LocalAudioSettings({ state, command, onClose }: {
    state: HostState | null; command: LocalCommand; onClose: () => void;
}) {
    const { t } = useTranslation('localPlayer');
    const [options, setOptions] = useState<HostAudioOptions | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [refresh, setRefresh] = useState(0);
    const [optimistic, setOptimistic] = useState<HostAudioChain | null>(null);
    const request = useRef(0);
    const chain = optimistic ?? state?.audioChain;
    const output = state?.outputDevice;
    useEffect(() => {
        let cancelled = false;
        setLoading(true); setFailed(false);
        void command('getAudioOptions').then((result: HostAudioOptions) => {
            if (!cancelled) setOptions(result);
        }).catch(() => { if (!cancelled) setFailed(true); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [command, refresh]);
    const edit = (params: Record<string, unknown>) => {
        const ticket = ++request.current;
        setOptimistic(previous => {
            const next = previous ?? state?.audioChain;
            if (!next) return null;
            const patch = { ...params };
            delete patch.preset; delete patch.band;
            if (params.band) {
                const band = params.band as { index: number; gain: number }, gains = next.gains.slice();
                gains[band.index] = band.gain;
                return { ...next, ...patch, gains, preset: 'custom', profileName: '' };
            }
            return { ...next, ...patch };
        });
        void command('setAudioChain', params).catch(() => {}).finally(() => {
            if (ticket === request.current) setOptimistic(null);
        });
    };
    const range = (key: 'preampDb' | 'limiterThresholdDb' | 'widthRatio', label: string, limits: [number, number], step: number) =>
        <label className="local-setting local-range-setting"><span>{t(label)}<output>{chain?.[key] ?? 0}{key === 'widthRatio' ? '×' : ' dB'}</output></span>
            <input type="range" min={limits[0]} max={limits[1]} step={step} value={chain?.[key] ?? 0}
                data-testid={`local-audio-${key}`} onChange={event => edit({ [key]: Number(event.target.value) })} /></label>;
    const toggle = (key: 'enabled' | 'autoPreamp' | 'limiterEnabled' | 'spatialEnabled', label: string) =>
        <label className="local-playback-toggle"><span>{t(label)}</span><input type="checkbox" checked={chain?.[key] ?? false}
            data-testid={`local-audio-${key}`} onChange={event => edit({ [key]: event.target.checked })} /></label>;
    const deviceName = (device: HostAudioOptions['devices'][number]) => !device.deviceId ? t('outputDefault')
        : device.fallbackIndex ? t('outputNumber', { count: device.fallbackIndex }) : device.label;
    const actual = options?.devices.find(device => device.deviceId === output?.actualId);
    return <LocalToolPanel id="local-audio-settings" title={t('audioSettings')} onClose={onClose} wide>
        {failed && <div className="local-tool-error" role="alert">{t('audioLoadFailed')}</div>}
        <fieldset disabled={!chain || !options}>
            <legend>{t('audioEqualizer')}</legend>
            {toggle('enabled', 'audioEnabled')}
            <div className="local-audio-presets">{options?.presets.map(preset => <button type="button" key={preset.id}
                data-testid={`local-audio-preset-${preset.id}`} aria-pressed={chain?.preset === preset.id}
                onClick={() => edit({ preset: preset.id })}>{t(`audioPreset_${preset.id}`, { defaultValue: preset.label })}</button>)}</div>
            <div className="local-eq-bands">{options?.frequencies.map((frequency, index) => <label key={frequency}>
                <output>{chain?.gains[index] ?? 0}</output><input type="range" min={options.limits.gain[0]} max={options.limits.gain[1]} step="0.5"
                    aria-label={t('audioBand', { frequency })} data-testid={`local-audio-band-${index}`} value={chain?.gains[index] ?? 0}
                    onChange={event => edit({ band: { index, gain: Number(event.target.value) } })} />
                <span>{frequency >= 1000 ? `${frequency / 1000}k` : frequency}</span>
            </label>)}</div>
            <small className="local-tool-hint">{t('audioBandUnits')}</small>
            {toggle('autoPreamp', 'audioAutoPreamp')}
            {range('preampDb', 'audioPreamp', options?.limits.preamp ?? [-12, 12], 0.5)}
            {toggle('limiterEnabled', 'audioLimiter')}
            {range('limiterThresholdDb', 'audioThreshold', options?.limits.threshold ?? [-12, 0], 0.5)}
            {toggle('spatialEnabled', 'audioSpatial')}
            {range('widthRatio', 'audioWidth', options?.limits.width ?? [0, 2], 0.05)}
        </fieldset>
        <hr className="local-tool-divider" />
        <label className="local-setting"><span>{t('outputDevice')}</span><select data-testid="local-output-device" value={output?.deviceId ?? ''}
            disabled={!options || !output?.supported || output.status === 'pending'}
            onChange={event => { void command('setOutputDevice', { deviceId: event.target.value }).catch(() => {}); }}>
            {!options?.devices.some(device => !device.deviceId) && <option value="">{t('outputDefault')}</option>}
            {options?.devices.map(device => <option key={device.deviceId} value={device.deviceId}>{deviceName(device)}</option>)}
            {output?.deviceId && !options?.devices.some(device => device.deviceId === output.deviceId)
                && <option value={output.deviceId} disabled>{output.label || t('outputPrevious')} · {t('outputUnavailable')}</option>}
        </select></label>
        <p className="local-tool-hint" data-testid="local-output-status" role="status">
            {output?.supported ? t(`outputStatus_${output.status}`) : t('outputUnsupported')}
            {output?.supported && output.status !== 'pending' && <> {t('outputActual', { name: actual ? deviceName(actual) : t('outputDefault') })}</>}
            {output?.needsPermission && <> {t('outputPermission')}</>}
        </p>
        <button type="button" disabled={loading} data-testid="local-output-refresh" onClick={() => setRefresh(value => value + 1)}>{t(loading ? 'loading' : 'outputRefresh')}</button>
        <p className="local-tool-hint">{t('audioHostHint')}</p>
    </LocalToolPanel>;
}
