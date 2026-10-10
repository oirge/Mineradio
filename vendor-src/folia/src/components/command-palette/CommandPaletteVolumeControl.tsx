import React, { useEffect, useRef, useState } from 'react';
import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { Theme } from '../../types';

// src/components/command-palette/CommandPaletteVolumeControl.tsx
// Keeps drag previews local and commits the persisted player volume only when interaction finishes.

type CommandPaletteVolumeControlProps = {
    isDaylight: boolean;
    isMuted: boolean;
    query: string;
    theme: Theme;
    volume: number;
    onQueryChange: (query: string) => void;
    onVolumeChange: (volume: number) => void;
    onVolumePreview: (volume: number) => void;
};

const parsePercent = (value: string) => {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
};

const CommandPaletteVolumeControl: React.FC<CommandPaletteVolumeControlProps> = ({
    isDaylight,
    isMuted,
    query,
    theme,
    volume,
    onQueryChange,
    onVolumeChange,
    onVolumePreview,
}) => {
    const { t } = useTranslation();
    const [sliderVolume, setSliderVolume] = useState(volume);
    const isDraggingRef = useRef(false);
    const pendingVolumeRef = useRef(volume);

    useEffect(() => {
        const queryPercent = parsePercent(query);
        if (queryPercent !== null) {
            const nextVolume = queryPercent / 100;
            setSliderVolume(nextVolume);
            pendingVolumeRef.current = nextVolume;
            return;
        }

        if (!isDraggingRef.current && query.trim() === '') {
            setSliderVolume(volume);
            pendingVolumeRef.current = volume;
        }
    }, [query, volume]);

    const handleSliderInput = (nextVolume: number) => {
        isDraggingRef.current = true;
        pendingVolumeRef.current = nextVolume;
        setSliderVolume(nextVolume);
        onQueryChange(String(Math.round(nextVolume * 100)));
        if (!isMuted) {
            onVolumePreview(nextVolume);
        }
    };

    const commitVolumeChange = () => {
        if (!isDraggingRef.current) {
            return;
        }
        isDraggingRef.current = false;
        onVolumeChange(pendingVolumeRef.current);
    };

    const VolumeIcon = isMuted || sliderVolume === 0
        ? VolumeX
        : sliderVolume < 0.5 ? Volume1 : Volume2;
    const percent = Math.round(sliderVolume * 100);

    return (
        <div className="flex h-full items-center justify-center px-4 py-10">
            <div className="w-full max-w-lg px-6 py-7">
                <div className="mb-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <VolumeIcon size={22} style={{ color: theme.accentColor }} />
                        <div>
                            <div className="text-sm font-medium">{t('commandPalette.volumeControlTitle')}</div>
                            <div className="mt-0.5 text-xs opacity-50">
                                {isMuted
                                    ? t('commandPalette.volumeMutedHint')
                                    : t('commandPalette.volumeControlHint')}
                            </div>
                        </div>
                    </div>
                    <div className="text-2xl font-semibold tabular-nums" style={{ color: theme.primaryColor }}>
                        {percent}%
                    </div>
                </div>

                <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={sliderVolume}
                    onInput={(event) => handleSliderInput(Number(event.currentTarget.value))}
                    onChange={(event) => handleSliderInput(Number(event.currentTarget.value))}
                    onPointerUp={commitVolumeChange}
                    onPointerCancel={commitVolumeChange}
                    onKeyUp={commitVolumeChange}
                    onBlur={commitVolumeChange}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full"
                    style={{
                        accentColor: theme.accentColor,
                        backgroundColor: isDaylight ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.10)',
                    }}
                    aria-label={t('ui.volume')}
                />
            </div>
        </div>
    );
};

export default CommandPaletteVolumeControl;
