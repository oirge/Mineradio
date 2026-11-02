import { describe, expect, it } from 'vitest';
import { getUpcomingLyricsClassName, resolveVisualizerSubtitleOverlayContent } from '@/components/visualizer/VisualizerSubtitleOverlay';
import type { Line, SubtitleOverlayLayout } from '@/types';

// test/unit/visualizer/subtitleOverlay.test.ts
// The bottom subtitle owns its rows independently from the main lyric's alternate text.
const line: Line = { startTime: 1, endTime: 2, fullText: 'Hello', translation: '你好', romanization: 'Harō', words: [] };
const next: Line = { startTime: 2, endTime: 3, fullText: 'World', words: [] };
const resolve = (layout: SubtitleOverlayLayout, patch: Partial<Parameters<typeof resolveVisualizerSubtitleOverlayContent>[0]> = {}) =>
    resolveVisualizerSubtitleOverlayContent({ showText: true, activeLine: line, recentCompletedLine: null, nextLines: [next], subtitleOverlayLayout: layout, ...patch });

describe('bottom subtitle rows', () => {
    it('keeps upcoming blur configurable', () => {
        expect(getUpcomingLyricsClassName()).toContain('blur-[1px]');
        expect(getUpcomingLyricsClassName(false)).not.toContain('blur-[1px]');
    });
    it('hides the whole overlay when disabled', () => {
        expect(resolve('translation', { hideTranslationSubtitle: true })).toEqual({ shouldRenderOverlay: false, rows: [], upcomingLines: [] });
        expect(resolve('current', { showText: false }).rows).toEqual([]);
    });
    it('shows any supported single row', () => {
        expect(resolve('current').rows.map(row => row.text)).toEqual(['Hello']);
        expect(resolve('translation').rows.map(row => row.text)).toEqual(['你好']);
        expect(resolve('romanization').rows.map(row => row.text)).toEqual(['Harō']);
    });
    it('shows current and translation in two rows', () => {
        expect(resolve('current+translation').rows.map(row => row.text)).toEqual(['Hello', '你好']);
    });
    it('shows current, romanization and translation in three rows', () => {
        expect(resolve('current+romanization+translation').rows.map(row => row.source)).toEqual(['current', 'romanization', 'translation']);
    });
    it('omits missing tracks without an empty row', () => {
        expect(resolve('current+romanization+translation', { activeLine: { ...line, romanization: undefined } }).rows.map(row => row.text)).toEqual(['Hello', '你好']);
    });
    it('deduplicates tracks that repeat the current line', () => {
        expect(resolve('current+romanization+translation', { activeLine: { ...line, romanization: 'Hello' } }).rows.map(row => row.text)).toEqual(['Hello', '你好']);
    });
    it('reads romanization from alternateTexts', () => {
        expect(resolve('romanization', { activeLine: { ...line, romanization: undefined, alternateTexts: [{ role: 'romanization', text: 'Harō' }] } }).rows[0].text).toBe('Harō');
    });
    it('omits timing markers and previews the next readable line', () => {
        expect(resolve('translation', { activeLine: { ...line, translation: '//' } })).toMatchObject({ rows: [], upcomingLines: [next] });
    });
    it('keeps the completed line in gaps', () => {
        expect(resolve('translation', { activeLine: null, recentCompletedLine: line }).rows[0].text).toBe('你好');
    });
    it('uses successive coming lines for two next rows', () => {
        expect(resolve('current+next+next', { nextLines: [next, { ...next, fullText: 'Again' }] }).rows.map(row => row.text)).toEqual(['Hello', 'World', 'Again']);
    });
});
