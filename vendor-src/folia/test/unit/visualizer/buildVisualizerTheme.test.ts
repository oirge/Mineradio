import { describe, expect, it } from 'vitest';
import { buildVisualizerTheme } from '@/components/app/presentation/buildVisualizerTheme';
import type { CSSProperties } from 'react';
import type { Theme } from '@/types';

// test/unit/visualizer/buildVisualizerTheme.test.ts
// Locks lyrics and subtitle font theme derivation before the visualizer renderer receives props.
const baseTheme: Theme = {
    name: 'Base',
    backgroundColor: '#000000',
    primaryColor: '#ffffff',
    accentColor: '#ffcc00',
    secondaryColor: '#cccccc',
    fontStyle: 'serif',
    animationIntensity: 'normal',
};

describe('buildVisualizerTheme', () => {
    it('lets subtitle theme inherit the resolved lyrics font by default', () => {
        const result = buildVisualizerTheme({
            appStyle: { '--bg-color': '#111111' } as CSSProperties,
            theme: baseTheme,
            lyricsFontStyle: 'serif',
            lyricsFontWeight: 650,
            lyricsCustomFontFamily: 'FZKai-Z03',
            lyricsFontFallbackFamilies: ['Songti SC', 'serif'],
            currentSongId: 123,
            visualizerMode: 'classic',
        });

        expect(result.visualizerTheme.fontFamily).toBe('FZKai-Z03');
        expect(result.visualizerTheme.fontWeight).toBe(650);
        expect(result.visualizerTheme.fontFamilyStack).toEqual(['Songti SC', 'serif']);
        expect(result.visualizerSubtitleTheme).toBe(result.visualizerTheme);
        expect(result.visualizerTheme.backgroundColor).toBe('#111111');
        expect(result.visualizerGeometrySeed).toBe(123);
    });

    it('builds an independent subtitle theme when inheritance is disabled', () => {
        const result = buildVisualizerTheme({
            appStyle: { '--bg-color': '#111111' } as CSSProperties,
            theme: baseTheme,
            lyricsFontStyle: 'serif',
            lyricsFontWeight: 700,
            lyricsCustomFontFamily: 'FZKai-Z03',
            lyricsFontFallbackFamilies: ['Songti SC'],
            subtitleFontInheritsLyrics: false,
            subtitleFontStyle: 'sans',
            subtitleFontWeight: 350,
            subtitleFontFamily: 'Microsoft YaHei',
            subtitleFontFallbackFamilies: ['PingFang SC', 'sans-serif'],
            visualizerMode: 'monet',
        });

        expect(result.visualizerSubtitleTheme).not.toBe(result.visualizerTheme);
        expect(result.visualizerSubtitleTheme.fontStyle).toBe('sans');
        expect(result.visualizerSubtitleTheme.fontWeight).toBe(350);
        expect(result.visualizerSubtitleTheme.fontFamily).toBe('Microsoft YaHei');
        expect(result.visualizerSubtitleTheme.fontFamilyStack).toEqual(['PingFang SC', 'sans-serif']);
        expect(result.visualizerTheme.fontFamily).toBe('FZKai-Z03');
        expect(result.visualizerTheme.fontWeight).toBe(700);
        expect(result.visualizerGeometrySeed).toBe('geometry-monet');
    });
});
