import React from 'react';
import { AudioLines } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    AUDIO_EQUALIZER_BANDS,
    AUDIO_EQUALIZER_MAX_GAIN_DB,
    AUDIO_EQUALIZER_MIN_GAIN_DB,
} from '../../../utils/audioEqualizer';
import type { EqualizerStyles } from './equalizerStyles';

// src/components/panelTab/equalizer/EqualizerBandGrid.tsx
// Renders the ten vertical band faders of the audio effect dialog.

type EqualizerBandGridProps = {
    gains: number[];
    styles: EqualizerStyles;
    onBandChange: (index: number, value: number) => void;
    onCommit: () => void;
};

const EqualizerBandGrid: React.FC<EqualizerBandGridProps> = ({ gains, styles, onBandChange, onCommit }) => {
    const { t } = useTranslation();

    return (
        <div className={`overflow-x-auto rounded-2xl border p-4 ${styles.surfaceClass}`}>
            <div className="mb-3 flex min-w-[520px] items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em]">
                <span className={`flex items-center gap-1.5 ${styles.inactiveText}`}><AudioLines size={13} />{t('ui.equalizerGain')}</span>
                <span className={styles.inactiveText}>+12 dB · 0 · −12 dB</span>
            </div>
            <div className="grid min-w-[520px] grid-cols-10 gap-2">
                {AUDIO_EQUALIZER_BANDS.map((band, index) => {
                    const gain = gains[index] ?? 0;
                    return (
                        <label key={band.frequency} className="flex flex-col items-center gap-2">
                            <span
                                className={`text-[10px] font-semibold tabular-nums ${styles.valueTextClass}`}
                                style={{ color: gain === 0 ? undefined : styles.selectedAccentColor }}
                            >
                                {gain > 0 ? '+' : ''}{gain}
                            </span>
                            <input
                                type="range"
                                min={AUDIO_EQUALIZER_MIN_GAIN_DB}
                                max={AUDIO_EQUALIZER_MAX_GAIN_DB}
                                step="1"
                                value={gain}
                                aria-label={`${band.label} Hz`}
                                onInput={event => onBandChange(index, Number(event.currentTarget.value))}
                                onChange={event => onBandChange(index, Number(event.currentTarget.value))}
                                onPointerUp={onCommit}
                                onPointerCancel={onCommit}
                                onKeyUp={onCommit}
                                onBlur={onCommit}
                                className={`h-32 w-1.5 cursor-pointer appearance-none rounded-full ${styles.trackClass}`}
                                style={{
                                    writingMode: 'vertical-lr',
                                    direction: 'rtl',
                                    accentColor: styles.isDaylight ? styles.selectedAccentColor : styles.accentColor,
                                }}
                            />
                            <span className={`text-[10px] font-semibold tabular-nums ${styles.inactiveText}`}>{band.label}</span>
                        </label>
                    );
                })}
            </div>
            <div className={`mt-2 min-w-[520px] text-center text-[9px] uppercase tracking-[0.2em] ${styles.inactiveText}`}>Hz</div>
        </div>
    );
};

export default EqualizerBandGrid;
