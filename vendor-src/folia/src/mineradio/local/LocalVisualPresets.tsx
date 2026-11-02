import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCAL_PRESET_NAME_LIMIT } from './visualPresetData';
import { useVisualSettings } from './useVisualSettings';
import { exportVisualPreset, importVisualPreset, PRESET_FILE_LIMIT } from './visualPresetTransfer';

// src/mineradio/local/LocalVisualPresets.tsx
// Saving a combination is separate from applying it, overwriting it or renaming it.
export default function LocalVisualPresets() {
    const settings = useVisualSettings();
    const { t } = useTranslation('localPlayer');
    const [selected, setSelected] = useState(''), [name, setName] = useState(''), [message, setMessage] = useState('');
    const [includeImages, setIncludeImages] = useState(false), [busy, setBusy] = useState(false);
    const fileInput = useRef<HTMLInputElement>(null);
    const preset = settings.presets.find(entry => entry.id === selected);
    const save = (replace: boolean) => {
        const id = settings.savePreset(replace && preset ? preset.name : name, replace ? preset?.id : undefined);
        if (id) { setSelected(id); setName(settings.presets.find(entry => entry.id === id)?.name ?? name.trim()); }
        setMessage(t(id ? 'presetSaved' : 'presetInvalid'));
    };
    const transferError = (error: unknown) => setMessage(t(error instanceof Error && ['presetFileInvalid', 'presetInvalid'].includes(error.message)
        ? error.message : 'presetTransferFailed'));
    const exportFile = async () => {
        if (!preset || busy) return;
        setBusy(true); setMessage('');
        try {
            const text = await exportVisualPreset(preset, includeImages);
            const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
            const link = document.createElement('a');
            link.href = url; link.download = preset.name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') + '.mineradio-preset.json';
            document.body.appendChild(link); link.click(); link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            setMessage(t('presetExported'));
        } catch (error) { transferError(error); }
        finally { setBusy(false); }
    };
    const importFile = async (file?: File) => {
        if (!file || busy) return;
        setBusy(true); setMessage('');
        try {
            if (file.size > PRESET_FILE_LIMIT) throw new Error('presetFileInvalid');
            const id = await importVisualPreset(await file.text());
            setSelected(id); setName(useVisualSettings.getState().presets.find(entry => entry.id === id)?.name ?? '');
            setMessage(t('presetImported'));
        } catch (error) { transferError(error); }
        finally { setBusy(false); }
    };
    return <details className="local-tuning local-visual-presets" data-testid="local-visual-presets">
        <summary>{t('visualPresets')} · {settings.presets.length}</summary>
        <label className="local-setting"><span>{t('presetChoose')}</span><select aria-label={t('presetChoose')} value={preset?.id ?? ''} disabled={busy} onChange={event => {
            const entry = settings.presets.find(item => item.id === event.target.value);
            setSelected(entry?.id ?? ''); setName(entry?.name ?? ''); setMessage('');
        }}><option value="">{t('presetNew')}</option>{settings.presets.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
        <label className="local-setting"><span>{t('presetName')}</span><input aria-label={t('presetName')} maxLength={LOCAL_PRESET_NAME_LIMIT} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
        <div className="local-preset-actions">
            <button type="button" onClick={() => save(false)} disabled={busy || !name.trim()}>{t('presetSaveNew')}</button>
            <button type="button" onClick={() => { if (preset) settings.applyPreset(preset.id); setMessage(t('presetApplied')); }} disabled={busy || !preset}>{t('presetApply')}</button>
            <button type="button" onClick={() => save(true)} disabled={busy || !preset}>{t('presetOverwrite')}</button>
            <button type="button" onClick={() => setMessage(t(preset && settings.renamePreset(preset.id, name) ? 'presetRenamed' : 'presetInvalid'))} disabled={busy || !preset || !name.trim()}>{t('presetRename')}</button>
            <button type="button" onClick={() => { if (preset) settings.deletePreset(preset.id); setSelected(''); setName(''); setMessage(t('presetDeleted')); }} disabled={busy || !preset}>{t('presetDelete')}</button>
        </div>
        <label className="local-setting local-toggle-setting"><span>{t('presetIncludeImages')}</span><input type="checkbox" checked={includeImages}
            disabled={busy} onChange={event => setIncludeImages(event.target.checked)} /></label>
        <div className="local-preset-actions">
            <button type="button" disabled={!preset || busy} onClick={() => void exportFile()}>{t('presetExport')}</button>
            <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}>{t('presetImport')}</button>
            <input ref={fileInput} type="file" hidden accept="application/json,.json" data-testid="local-import-preset" onChange={event => {
                const file = event.target.files?.[0]; event.target.value = ''; void importFile(file);
            }} />
        </div>
        <small>{t('presetAssetsHint')}</small>
        <small>{t('presetTransferHint')}</small>
        {message && <small role="status">{message}</small>}
    </details>;
}
