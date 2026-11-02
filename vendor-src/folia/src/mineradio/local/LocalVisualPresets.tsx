import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LOCAL_PRESET_NAME_LIMIT } from './visualPresetData';
import { useVisualSettings } from './useVisualSettings';

// src/mineradio/local/LocalVisualPresets.tsx
// Saving a combination is separate from applying it, overwriting it or renaming it.
export default function LocalVisualPresets() {
    const settings = useVisualSettings();
    const { t } = useTranslation('localPlayer');
    const [selected, setSelected] = useState(''), [name, setName] = useState(''), [message, setMessage] = useState('');
    const preset = settings.presets.find(entry => entry.id === selected);
    const save = (replace: boolean) => {
        const id = settings.savePreset(replace && preset ? preset.name : name, replace ? preset?.id : undefined);
        if (id) { setSelected(id); setName(settings.presets.find(entry => entry.id === id)?.name ?? name.trim()); }
        setMessage(t(id ? 'presetSaved' : 'presetInvalid'));
    };
    return <details className="local-tuning local-visual-presets" data-testid="local-visual-presets">
        <summary>{t('visualPresets')} · {settings.presets.length}</summary>
        <label className="local-setting"><span>{t('presetChoose')}</span><select aria-label={t('presetChoose')} value={preset?.id ?? ''} onChange={event => {
            const entry = settings.presets.find(item => item.id === event.target.value);
            setSelected(entry?.id ?? ''); setName(entry?.name ?? ''); setMessage('');
        }}><option value="">{t('presetNew')}</option>{settings.presets.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
        <label className="local-setting"><span>{t('presetName')}</span><input aria-label={t('presetName')} maxLength={LOCAL_PRESET_NAME_LIMIT} value={name} onChange={event => setName(event.target.value)} /></label>
        <div className="local-preset-actions">
            <button type="button" onClick={() => save(false)} disabled={!name.trim()}>{t('presetSaveNew')}</button>
            <button type="button" onClick={() => { if (preset) settings.applyPreset(preset.id); setMessage(t('presetApplied')); }} disabled={!preset}>{t('presetApply')}</button>
            <button type="button" onClick={() => save(true)} disabled={!preset}>{t('presetOverwrite')}</button>
            <button type="button" onClick={() => setMessage(t(preset && settings.renamePreset(preset.id, name) ? 'presetRenamed' : 'presetInvalid'))} disabled={!preset || !name.trim()}>{t('presetRename')}</button>
            <button type="button" onClick={() => { if (preset) settings.deletePreset(preset.id); setSelected(''); setName(''); setMessage(t('presetDeleted')); }} disabled={!preset}>{t('presetDelete')}</button>
        </div>
        <small>{t('presetAssetsHint')}</small>
        {message && <small role="status">{message}</small>}
    </details>;
}
