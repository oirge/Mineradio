import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Power, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../../types';
import { colorWithAlpha } from '../visualizer/colorMix';
import {
    AUDIO_EQUALIZER_CUSTOM_SLOT_IDS,
    getAudioEqualizerCustomSlotIndex,
    isAudioEqualizerCustomSlotId,
    type AudioEqualizerCustomSlotId,
    type AudioEqualizerModeId,
    type AudioEqualizerSettings,
} from '../../utils/audioEqualizer';
import { AUDIO_SOUND_PRESETS, AUDIO_SOUND_PRESET_IDS } from '../../utils/audioPresets';
import { createNeutralAudioEffects, type AudioEffectId, type AudioEffectSettings } from '../../utils/audioEffects';
import ThemedDialog from '../shared/ThemedDialog';
import AudioEffectGrid from './equalizer/AudioEffectGrid';
import EqualizerBandGrid from './equalizer/EqualizerBandGrid';
import { buildEqualizerStyles } from './equalizer/equalizerStyles';
import { useAudioSettingsStore } from '../../stores/useAudioSettingsStore';

// src/components/panelTab/AudioEqualizerDialog.tsx
// Provides the compact audio processing editor (ten EQ bands plus the effect chain) opened from the controls tab.

type AudioEqualizerDialogProps = {
    isDaylight: boolean;
    theme: Theme;
};

const PRESET_IDS: AudioEqualizerModeId[] = [...AUDIO_SOUND_PRESET_IDS, ...AUDIO_EQUALIZER_CUSTOM_SLOT_IDS];

const AudioEqualizerDialog: React.FC<AudioEqualizerDialogProps> = ({ isDaylight, theme }) => {
    const { t } = useTranslation();
    const settings = useAudioSettingsStore(state => state.audioEqualizerSettings);
    const isOpen = useAudioSettingsStore(state => state.isAudioEqualizerOpen);
    const close = useAudioSettingsStore(state => state.closeAudioEqualizer);
    const commitSettings = useAudioSettingsStore(state => state.handleSetAudioEqualizerSettings);
    const [draft, setDraft] = useState<AudioEqualizerSettings>(settings);
    const draftRef = useRef(draft);

    const updateDraft = (next: AudioEqualizerSettings) => {
        draftRef.current = next;
        setDraft(next);
    };

    useEffect(() => {
        if (isOpen) {
            updateDraft({
                enabled: settings.enabled,
                gains: [...settings.gains],
                preset: settings.preset,
                effects: { ...settings.effects },
                customSlots: settings.customSlots.map(slot => ({ gains: [...slot.gains], effects: { ...slot.effects } })),
            });
        }
    }, [isOpen, settings]);

    useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            close();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [close, isOpen]);

    // Edits are always written into a custom slot: the active one, or the first while a built-in plays.
    const writeCustomDraft = (gains: number[], effects: AudioEffectSettings) => {
        const slotId: AudioEqualizerCustomSlotId = isAudioEqualizerCustomSlotId(draftRef.current.preset)
            ? draftRef.current.preset
            : AUDIO_EQUALIZER_CUSTOM_SLOT_IDS[0];
        const slotIndex = getAudioEqualizerCustomSlotIndex(slotId);
        updateDraft({
            ...draftRef.current,
            enabled: true,
            gains,
            effects,
            preset: slotId,
            customSlots: draftRef.current.customSlots.map((slot, index) => (
                index === slotIndex ? { gains: [...gains], effects: { ...effects } } : slot
            )),
        });
    };

    const updateBandDraft = (index: number, value: number) => {
        const gains = [...draftRef.current.gains];
        gains[index] = value;
        writeCustomDraft(gains, { ...draftRef.current.effects });
    };

    const updateEffectDraft = (id: AudioEffectId, value: number) => {
        writeCustomDraft([...draftRef.current.gains], { ...draftRef.current.effects, [id]: value });
    };

    const applyPreset = (presetId: AudioEqualizerModeId) => {
        const source = isAudioEqualizerCustomSlotId(presetId)
            ? draftRef.current.customSlots[getAudioEqualizerCustomSlotIndex(presetId)]
            : AUDIO_SOUND_PRESETS[presetId];
        const next: AudioEqualizerSettings = {
            ...draftRef.current,
            enabled: true,
            preset: presetId,
            gains: [...source.gains],
            effects: { ...source.effects },
        };
        updateDraft(next);
        commitSettings(next);
    };

    // Reset only ever clears a custom slot; the built-in presets are not editable, so nothing to undo.
    const resetActiveCustomSlot = () => {
        const slotId = isAudioEqualizerCustomSlotId(draftRef.current.preset) ? draftRef.current.preset : null;
        if (!slotId) return;

        const slotIndex = getAudioEqualizerCustomSlotIndex(slotId);
        const gains = [...AUDIO_SOUND_PRESETS.flat.gains];
        const effects = createNeutralAudioEffects();
        const next: AudioEqualizerSettings = {
            ...draftRef.current,
            gains,
            effects,
            customSlots: draftRef.current.customSlots.map((slot, index) => (
                index === slotIndex ? { gains: [...gains], effects: { ...effects } } : slot
            )),
        };
        updateDraft(next);
        commitSettings(next);
    };

    const styles = buildEqualizerStyles(isDaylight, theme);
    const commitDraft = () => commitSettings(draftRef.current);
    const canResetCustomSlot = isAudioEqualizerCustomSlotId(draft.preset);

    if (typeof document === 'undefined') {
        return null;
    }

    return createPortal((
        <ThemedDialog
            isOpen={isOpen}
            onClose={close}
            isDaylight={isDaylight}
            title={t('ui.equalizerTitle')}
            description={t('ui.equalizerDescription')}
            maxWidthClass="max-w-2xl"
        >
            {/* display:contents，布局一如从前；在的意义只是让这扇对话框自己也能被思索命中。 */}
            <div data-ponder="audio-equalizer" className="contents">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <button
                    type="button"
                    onClick={() => {
                        const next = { ...draftRef.current, enabled: !draftRef.current.enabled };
                        updateDraft(next);
                        commitSettings(next);
                    }}
                    aria-pressed={draft.enabled}
                    className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${styles.buttonClass}`}
                    style={draft.enabled ? {
                        color: styles.selectedAccentColor,
                        borderColor: colorWithAlpha(styles.selectedAccentColor, 0.5),
                        backgroundColor: colorWithAlpha(styles.selectedAccentColor, 0.1),
                    } : undefined}
                >
                    <Power size={14} />
                    {t(draft.enabled ? 'ui.equalizerEnabled' : 'ui.equalizerDisabled')}
                </button>

                <div className="flex flex-wrap items-center gap-1.5">
                    {PRESET_IDS.map(presetId => (
                        <button
                            key={presetId}
                            type="button"
                            onClick={() => applyPreset(presetId)}
                            aria-pressed={draft.preset === presetId}
                            className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${styles.buttonClass}`}
                            style={draft.preset === presetId ? {
                                color: styles.selectedAccentColor,
                                borderColor: colorWithAlpha(styles.selectedAccentColor, 0.55),
                                backgroundColor: colorWithAlpha(styles.selectedAccentColor, 0.12),
                            } : undefined}
                        >
                            {t(`ui.equalizerPreset.${presetId}`)}
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={resetActiveCustomSlot}
                        disabled={!canResetCustomSlot}
                        title={t('ui.equalizerReset')}
                        aria-label={t('ui.equalizerReset')}
                        className={`rounded-full border p-2 transition-colors ${styles.buttonClass} ${canResetCustomSlot ? '' : 'pointer-events-none opacity-35'}`}
                    >
                        <RotateCcw size={14} />
                    </button>
                </div>
            </div>

            <EqualizerBandGrid
                gains={draft.gains}
                styles={styles}
                onBandChange={updateBandDraft}
                onCommit={commitDraft}
            />
            <AudioEffectGrid
                effects={draft.effects}
                styles={styles}
                onEffectChange={updateEffectDraft}
                onCommit={commitDraft}
            />
            </div>
        </ThemedDialog>
    ), document.body);
};

export default AudioEqualizerDialog;
