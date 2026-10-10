import { useEffect, useMemo, useState } from 'react';
import { useMotionValue, useMotionValueEvent } from 'framer-motion';
import type { AudioBands, VisualizerMode } from '../../../types';
import {
    findPreviewPlaceholderLineIndex,
    getPreviewPlaceholderStartOffset,
    VIS_PLAYGROUND_PREVIEW_LINES,
    VIS_PLAYGROUND_PREVIEW_LOOP_DURATION,
} from '../../visualizer/PreviewPlaceholder';

// src/components/modal/theme-park/useThemeParkPreviewClock.ts
// Drives the Theme Park preview without audio: a looping rAF clock plus synthetic band energies,
// so the visualizer animates the same way it would during playback.

export const useThemeParkPreviewClock = (visualizerMode: VisualizerMode, isPaused: boolean) => {
    const currentTime = useMotionValue(getPreviewPlaceholderStartOffset(visualizerMode, VIS_PLAYGROUND_PREVIEW_LOOP_DURATION));
    const audioPower = useMotionValue(0.24);
    const bass = useMotionValue(0.18);
    const lowMid = useMotionValue(0.15);
    const mid = useMotionValue(0.12);
    const vocal = useMotionValue(0.2);
    const treble = useMotionValue(0.1);

    const [currentLineIndex, setCurrentLineIndex] = useState(() => findPreviewPlaceholderLineIndex(
        VIS_PLAYGROUND_PREVIEW_LINES,
        getPreviewPlaceholderStartOffset(visualizerMode, VIS_PLAYGROUND_PREVIEW_LOOP_DURATION),
    ));

    const audioBands = useMemo<AudioBands>(() => ({
        bass,
        lowMid,
        mid,
        vocal,
        treble,
    }), [bass, lowMid, mid, vocal, treble]);

    useEffect(() => {
        currentTime.set(getPreviewPlaceholderStartOffset(visualizerMode, VIS_PLAYGROUND_PREVIEW_LOOP_DURATION));
    }, [visualizerMode, currentTime]);

    useEffect(() => {
        if (isPaused) {
            return;
        }

        let frameId = 0;
        const startedAt = performance.now();
        const previewOffset = currentTime.get();

        const tick = (now: number) => {
            const elapsed = (previewOffset + (now - startedAt) / 1000) % VIS_PLAYGROUND_PREVIEW_LOOP_DURATION;
            currentTime.set(elapsed);

            const waveTime = previewOffset * 1000 + (now - startedAt);
            const wave = (offset: number, speed: number, floor: number, amplitude: number) =>
                floor + (Math.sin(waveTime * speed + offset) * 0.5 + 0.5) * amplitude;

            audioPower.set(wave(0.2, 0.0024, 0.16, 0.18));
            bass.set(wave(0.9, 0.0032, 0.14, 0.2));
            lowMid.set(wave(1.7, 0.0028, 0.12, 0.16));
            mid.set(wave(2.6, 0.0023, 0.1, 0.14));
            vocal.set(wave(3.4, 0.0038, 0.16, 0.22));
            treble.set(wave(4.2, 0.0046, 0.08, 0.14));

            frameId = window.requestAnimationFrame(tick);
        };

        frameId = window.requestAnimationFrame(tick);
        return () => window.cancelAnimationFrame(frameId);
    }, [isPaused, audioPower, bass, currentTime, lowMid, mid, treble, visualizerMode, vocal]);

    useMotionValueEvent(currentTime, 'change', latest => {
        const nextIndex = findPreviewPlaceholderLineIndex(VIS_PLAYGROUND_PREVIEW_LINES, latest);
        setCurrentLineIndex(previous => (previous === nextIndex ? previous : nextIndex));
    });

    return { currentTime, audioPower, audioBands, currentLineIndex };
};
