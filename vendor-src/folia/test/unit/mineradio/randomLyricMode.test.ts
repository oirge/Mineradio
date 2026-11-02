import { describe, expect, it } from 'vitest';
import { normalizeRandomPool, randomLyricMode } from '../../../src/mineradio/local/randomLyricMode';
import { BUILTIN_VISUALIZER_MODES } from '../../../src/types/visualizerModes';
import { parseSubtitleOverlayLayout, withSubtitleOverlayRowCount, withSubtitleOverlayRow } from '../../../src/utils/lyrics/subtitleOverlayLayout';

// test/unit/mineradio/randomLyricMode.test.ts
// Stored preferences may be outdated; random picks and row edits must stay valid.
describe('random lyric styles', () => {
    it('has all 17 modes including the new three', () => {
        expect(BUILTIN_VISUALIZER_MODES).toHaveLength(17);
        expect(BUILTIN_VISUALIZER_MODES).toEqual(expect.arrayContaining(['hanabi', 'nebbia', 'machi']));
    });
    it('removes duplicates and unavailable styles', () => {
        expect(normalizeRandomPool(['classic', 'missing', 'classic', 'hanabi'])).toEqual(['classic', 'hanabi']);
        expect(normalizeRandomPool([])).toEqual([...BUILTIN_VISUALIZER_MODES]);
    });
    it('never repeats consecutively with more than one choice', () => {
        for (const n of [0, 0.25, 0.99, 1]) expect(randomLyricMode(['hanabi', 'machi'], 'hanabi', () => n)).toBe('machi');
    });
    it('supports a single-item pool and a current style outside the pool', () => {
        expect(randomLyricMode(['nebbia'], 'nebbia')).toBe('nebbia');
        expect(randomLyricMode(['nebbia', 'machi'], 'classic', () => 0.99)).toBe('machi');
    });
});
describe('subtitle row preferences', () => {
    it('round-trips single to two to three rows', () => {
        const two = withSubtitleOverlayRowCount('translation', 2);
        expect(two).toBe('current+translation');
        expect(withSubtitleOverlayRowCount(two, 3)).toBe('current+translation+romanization');
        expect(withSubtitleOverlayRowCount(two, 1)).toBe('translation');
    });
    it('rejects invalid layouts and first rows', () => {
        expect(parseSubtitleOverlayLayout('translation+current')).toBeNull();
        expect(parseSubtitleOverlayLayout('current+next+next+next')).toBeNull();
        expect(withSubtitleOverlayRow('current+translation', 0, 'next')).toBe('current+translation');
    });
});
