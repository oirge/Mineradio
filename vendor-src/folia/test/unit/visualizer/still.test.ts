import React from 'react';
import { motionValue } from 'framer-motion';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_THEME } from '@/services/baseThemes';
import VisualizerStill from '@/components/visualizer/still/VisualizerStill';
import VisualizerRenderer from '@/components/visualizer/VisualizerRenderer';

// test/unit/visualizer/still.test.ts
// Locks the low-resource mode contract: shared shell chrome stays mounted while the background renderer does not.
vi.mock('@/components/visualizer/backgrounds/VisualizerBackgroundRenderer', () => ({
    default: () => React.createElement('div', { 'data-testid': 'background-renderer' }),
}));
vi.mock('@/components/visualizer/VisualizerHarmonyOverlay', () => ({
    default: () => React.createElement('div', { 'data-testid': 'harmony-overlay' }),
}));

const createAudioBands = () => ({
    bass: motionValue(0),
    lowMid: motionValue(0),
    mid: motionValue(0),
    vocal: motionValue(0),
    treble: motionValue(0),
});

describe('VisualizerStill', () => {
    it('keeps VisualizerShell chrome but leaves the background renderer unmounted', () => {
        const markup = renderToStaticMarkup(React.createElement(VisualizerStill, {
            currentTime: motionValue(0),
            currentLineIndex: 0,
            lines: [],
            theme: DEFAULT_THEME,
            audioPower: motionValue(0),
            audioBands: createAudioBands(),
            onBack: () => undefined,
        }));

        expect(markup).toContain('visualizer-still');
        expect(markup).toContain('<button');
        expect(markup).not.toContain('background-renderer');
    });

    it('keeps the shared harmony overlay enabled', () => {
        const markup = renderToStaticMarkup(React.createElement(VisualizerRenderer, {
            mode: 'still',
            currentTime: motionValue(0),
            currentLineIndex: 0,
            lines: [],
            theme: DEFAULT_THEME,
            audioPower: motionValue(0),
            audioBands: createAudioBands(),
        }));

        expect(markup).toContain('harmony-overlay');
        expect(markup).not.toContain('background-renderer');
    });
});
