import { describe, expect, it } from 'vitest';
import type { SongResult } from '../../../src/types';
import { buildQueueSearchIndex, evaluateQueueSearch } from '../../../src/components/command-palette/queueSearch';

// test/unit/command-palette/queueSearch.test.ts
// Verifies current-song facets, queue-wide completion, exact scopes, and batch target previews.

const song = (id: number, name: string, artistId: number, artist: string, albumId: number, album: string): SongResult => ({
    id,
    name,
    artists: [{ id: artistId, name: artist }],
    album: { id: albumId, name: album },
    durationMs: 180_000,
});

const current = song(1, 'Current', 10, 'Alpha', 20, 'Shared Album');
const sameArtist = song(2, 'Same Artist', 10, 'Alpha', 21, 'Other Album');
const sameAlbum = song(3, 'Same Album', 11, 'Beta', 20, 'Shared Album');
const other = song(4, 'Needle Song', 12, 'Gamma', 22, 'Third Album');
const queue = [current, sameArtist, sameAlbum, other];

describe('queue search evaluation', () => {
    it('shows the union of the current song artist and album for bare @', () => {
        const result = evaluateQueueSearch(buildQueueSearchIndex(queue), current, '@');

        expect(result.matches.map(match => match.entry.song.name)).toEqual(['Current', 'Same Artist', 'Same Album']);
        expect(result.matches[0].reasons).toEqual(['artist', 'album']);
        expect(result.suggestions.map(suggestion => suggestion.label)).toEqual(['Alpha', 'Shared Album']);
        expect(result.eligibleTargetIndices).toEqual([1, 2]);
        expect(result.skippedCurrentCount).toBe(1);
    });

    it('autocompletes queue-wide artist and album names', () => {
        const result = evaluateQueueSearch(buildQueueSearchIndex(queue), current, '@third');

        expect(result.suggestions).toHaveLength(1);
        expect(result.suggestions[0]).toMatchObject({
            type: 'facet',
            facetKind: 'album',
            label: 'Third Album',
            replacement: '@album:"Third Album"',
        });
        expect(result.matches.map(match => match.entry.song)).toEqual([other]);
    });

    it('uses an exact typed facet and optional free text together', () => {
        const result = evaluateQueueSearch(buildQueueSearchIndex(queue), current, '@artist:Alpha same');

        expect(result.suggestions).toEqual([]);
        expect(result.matches.map(match => match.entry.song)).toEqual([sameArtist]);
    });

    it('forbids an unfiltered batch target', () => {
        const action = evaluateQueueSearch(buildQueueSearchIndex(queue), current, '--remove');

        expect(action.hasMeaningfulFilter).toBe(false);
        expect(action.eligibleTargetIndices).toEqual([1, 2, 3]);
    });

    it('leaves flag completions to the palette shell, offering only facets here', () => {
        // CommandPaletteSyntaxHints builds these from the spec for every command with a `syntax`,
        // so building them again here would show each flag twice.
        const draft = evaluateQueueSearch(buildQueueSearchIndex(queue), current, '--');
        expect(draft.suggestions).toEqual([]);
    });
});
